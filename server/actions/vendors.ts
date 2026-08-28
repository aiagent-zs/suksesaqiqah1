'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/server/auth/session';
import { canDo } from '@/server/auth/capabilities';
import {
  createVendorSchema,
  deleteVendorSchema,
  deleteVendorServiceSchema,
  saveVendorCoverageSchema,
  setVendorActiveSchema,
  updateVendorSchema,
  vendorServiceSchema,
} from '@/features/vendors/schema';

import {
  conflict,
  forbidden,
  notFound,
  scopedInternalError,
  validationError,
  type ActionResult,
} from './result';

const internalError = scopedInternalError('vendors');

/**
 * Rakit alamat mitra jadi satu baris, sekaligus mengambil nama wilayah dari
 * `regions`.
 *
 * Nama tidak pernah dipercaya dari klien: yang dibaca orang adalah namanya,
 * jadi nama yang boleh dikirim sendiri berarti alamat tercatat bisa berbeda
 * dari wilayah yang sebenarnya dipilih.
 */
async function resolveAddress(
  supabase: Awaited<ReturnType<typeof createClient>>,
  codes: {
    province_code?: string;
    city_code?: string;
    district_code?: string;
    village_code?: string;
    postal_code?: string;
    address_detail?: string;
  },
) {
  const wanted = [
    codes.province_code,
    codes.city_code,
    codes.district_code,
    codes.village_code,
  ].filter((c): c is string => Boolean(c));

  if (wanted.length === 0) {
    return { names: {}, address: null as string | null };
  }

  const { data } = await supabase.from('regions').select('code, name').in('code', wanted);
  const byCode = new Map((data ?? []).map((r) => [r.code, r.name]));

  const names = {
    province: codes.province_code ? (byCode.get(codes.province_code) ?? null) : null,
    city: codes.city_code ? (byCode.get(codes.city_code) ?? null) : null,
    district: codes.district_code ? (byCode.get(codes.district_code) ?? null) : null,
    village: codes.village_code ? (byCode.get(codes.village_code) ?? null) : null,
  };

  const parts = [
    codes.address_detail || null,
    names.village ? `Kel. ${names.village}` : null,
    names.district ? `Kec. ${names.district}` : null,
    names.city,
    names.province ? `${names.province}${codes.postal_code ? ` ${codes.postal_code}` : ''}` : null,
  ].filter(Boolean);

  return { names, address: parts.length > 0 ? parts.join(', ') : null };
}

/**
 * Kolom mitra dari input yang sudah tervalidasi.
 *
 * `code` kini **ikut**: sejak `updateVendorSchema` menerimanya, kedua aksi
 * sama-sama membawa kode yang sudah tervalidasi, jadi menyusunnya di sini tidak
 * lagi berisiko menulis `undefined` ke kolom `not null` — justru sebaliknya,
 * meninggalkannya berarti kode yang disunting tidak pernah tersimpan.
 */
function rowFrom(
  v: Record<string, unknown>,
  names: { province?: string | null; city?: string | null; district?: string | null; village?: string | null },
  address: string | null,
) {
  return {
    code: v.code as string,
    name: v.name as string,
    legal_name: (v.legal_name as string) || null,
    owner_name: (v.owner_name as string) || null,
    npwp: (v.npwp as string) || null,
    phone: v.phone as string,
    whatsapp: (v.whatsapp as string) || null,
    email: (v.email as string) || null,
    province_code: (v.province_code as string) || null,
    province: names.province ?? null,
    city_code: (v.city_code as string) || null,
    city: names.city ?? null,
    district_code: (v.district_code as string) || null,
    district: names.district ?? null,
    village_code: (v.village_code as string) || null,
    village: names.village ?? null,
    postal_code: (v.postal_code as string) || null,
    address_detail: (v.address_detail as string) || null,
    address,
    agreement_number: (v.agreement_number as string) || null,
    agreement_start: (v.agreement_start as string) || null,
    agreement_end: (v.agreement_end as string) || null,
    daily_capacity: (v.daily_capacity as number) ?? null,
    service_modes: v.service_modes as ('salur' | 'kirim')[],
    bank_name: (v.bank_name as string) || null,
    bank_account_no: (v.bank_account_no as string) || null,
    bank_account_name: (v.bank_account_name as string) || null,
    notes: (v.notes as string) || null,
  };
}

// =============================================================================
// Buat & ubah mitra
// =============================================================================

export async function createVendor(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_VENDORS')) {
    return forbidden('Pengelolaan mitra hanya dapat dilakukan superadmin.');
  }

  const parsed = createVendorSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const v = parsed.data;

  const supabase = await createClient();
  const { names, address } = await resolveAddress(supabase, v);

  const { data, error } = await supabase
    .from('vendors')
    .insert(rowFrom(v, names, address))
    .select('id')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        error: {
          code: 'CONFLICT',
          message: 'Kode mitra ini sudah dipakai.',
          fields: { code: 'Sudah dipakai mitra lain.' },
        },
      };
    }
    return internalError('Gagal menyimpan mitra', error);
  }
  if (!data) return internalError('Mitra tidak tersimpan', { message: 'insert kosong' });

  revalidatePath('/vendors');
  return { ok: true, data: { id: data.id } };
}

export async function updateVendor(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_VENDORS')) {
    return forbidden('Pengelolaan mitra hanya dapat dilakukan superadmin.');
  }

  const parsed = updateVendorSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { id, ...v } = parsed.data;

  const supabase = await createClient();
  const { names, address } = await resolveAddress(supabase, v);

  const { data, error } = await supabase
    .from('vendors')
    .update(rowFrom(v, names, address))
    .eq('id', id)
    .select('id');

  if (error) {
    // Kode yang sudah dipakai mitra lain ditolak `vendors_code_key`. Pesannya
    // ditempelkan ke medan `code` supaya muncul tepat di kolomnya, bukan sebagai
    // galat umum di kepala formulir — sama seperti `createVendor` di atas.
    //
    // Penjagaannya sengaja bersandar pada constraint, bukan SELECT lebih dulu:
    // pemeriksaan terpisah punya celah waktu antara "sudah kucek, aman" dan
    // baris benar-benar ditulis — dua superadmin yang menyimpan kode sama pada
    // detik yang sama akan sama-sama lolos pemeriksaan itu.
    if (error.code === '23505') {
      return {
        ok: false,
        error: {
          code: 'CONFLICT',
          message: 'Kode mitra ini sudah dipakai mitra lain.',
          fields: { code: 'Sudah dipakai mitra lain.' },
        },
      };
    }
    return internalError('Gagal memperbarui mitra', error);
  }
  if ((data ?? []).length === 0) return notFound('Mitra tidak ditemukan.');

  revalidatePath('/vendors');
  revalidatePath(`/vendors/${id}`);
  return { ok: true, data: null };
}

/**
 * Aktifkan / nonaktifkan mitra.
 *
 * Menonaktifkan lebih tepat daripada menghapus: order yang sudah dikerjakan
 * mitra ini tetap menunjuk kepadanya, dan `vendors.id` di-`on delete restrict`
 * justru akan menolak penghapusannya.
 */
export async function setVendorActive(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_VENDORS')) {
    return forbidden('Pengelolaan mitra hanya dapat dilakukan superadmin.');
  }

  const parsed = setVendorActiveSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { id, is_active } = parsed.data;

  const supabase = await createClient();

  // Mitra yang masih memegang order berjalan tidak boleh dinonaktifkan diam-
  // diam: akun vendornya akan kehilangan akses di tengah pekerjaan.
  if (!is_active) {
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('vendor_id', id)
      .not('status', 'in', '("completed","cancelled")')
      .is('deleted_at', null);

    if ((count ?? 0) > 0) {
      return conflict(
        `Mitra ini masih memegang ${count} order berjalan. Selesaikan atau pindahkan lebih dulu.`,
      );
    }
  }

  const { data, error } = await supabase
    .from('vendors')
    .update({ is_active })
    .eq('id', id)
    .select('id');

  if (error) return internalError('Gagal mengubah status mitra', error);
  if ((data ?? []).length === 0) return notFound('Mitra tidak ditemukan.');

  revalidatePath('/vendors');
  revalidatePath(`/vendors/${id}`);
  return { ok: true, data: null };
}

/**
 * Hapus mitra — `deleted_at`, bukan `delete`.
 *
 * Tiga tabel menahannya dengan `on delete restrict` (`orders`, `locations`,
 * `profiles`): penghapusan sungguhan akan ditolak database begitu mitra ini
 * pernah menyentuh satu order pun, dan jejak yang menunjuk siapa pelakunya
 * memang harus tetap terbaca. Semua pembacaan mitra sudah menyaring
 * `deleted_at is null`, jadi baris ini hilang dari layar tanpa memutus rujukan.
 *
 * Dua penjagaan sebelum itu, keduanya kegagalan yang baru terasa jauh dari
 * sini: order berjalan akan kehilangan pelaksananya di tengah pekerjaan, dan
 * akun vendor yang tertaut akan tetap hidup tapi buta — `can_read_order`
 * membandingkan `profiles.vendor_id` dengan mitra yang tidak lagi tampil di
 * mana pun.
 */
export async function deleteVendor(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_VENDORS')) {
    return forbidden('Penghapusan mitra hanya dapat dilakukan superadmin.');
  }

  const parsed = deleteVendorSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { id } = parsed.data;

  const supabase = await createClient();

  const [ordersResult, accountsResult] = await Promise.all([
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('vendor_id', id)
      .not('status', 'in', '("completed","cancelled")')
      .is('deleted_at', null),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('vendor_id', id)
      .is('deleted_at', null),
  ]);

  // Hitungan yang gagal menghentikan penghapusan, bukan meloloskannya.
  // `(count ?? 0) > 0` akan berbuat sebaliknya: pemeriksaan yang error
  // mengembalikan `count` null, dan mitra yang justru paling perlu ditahan —
  // yang datanya tidak bisa dibaca — malah lolos. Penjagaan yang runtuh diam-
  // diam lebih buruk daripada tidak ada penjagaan.
  const ordersOpen = ordersResult.count;
  const accounts = accountsResult.count;

  if (ordersResult.error || accountsResult.error || ordersOpen === null || accounts === null) {
    return internalError(
      'Gagal memeriksa keterkaitan mitra',
      ordersResult.error ?? accountsResult.error ?? { message: 'count kosong' },
    );
  }

  if (ordersOpen > 0) {
    return conflict(
      `Mitra ini masih memegang ${ordersOpen} order berjalan. Selesaikan atau pindahkan lebih dulu.`,
    );
  }

  if (accounts > 0) {
    return conflict(
      'Mitra ini masih punya akun login. Hapus akunnya lebih dulu di menu Pengguna.',
    );
  }

  // `is_active` ikut dimatikan: beberapa pembacaan menyaring keaktifan saja
  // (mis. `getVendorOptions`), dan baris yang terhapus tapi masih "aktif"
  // adalah keadaan yang tidak punya arti.
  const { data, error } = await supabase
    .from('vendors')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id');

  if (error) return internalError('Gagal menghapus mitra', error);
  if ((data ?? []).length === 0) return notFound('Mitra tidak ditemukan.');

  revalidatePath('/vendors');
  return { ok: true, data: null };
}

// =============================================================================
// Daftar modal per paket
// =============================================================================

/**
 * Simpan modal satu paket untuk satu mitra.
 *
 * Upsert pada `(vendor_id, service_id)`: satu mitra hanya punya satu harga per
 * paket, dan menyunting yang sudah ada tidak boleh menabrak constraint unik.
 */
export async function saveVendorService(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_VENDORS')) {
    return forbidden('Daftar modal mitra hanya dapat diubah superadmin.');
  }

  const parsed = vendorServiceSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const v = parsed.data;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('vendor_services')
    .upsert(
      {
        vendor_id: v.vendor_id,
        service_id: v.service_id,
        vendor_price: v.vendor_price,
        is_offered: v.is_offered,
        notes: v.notes || null,
      },
      { onConflict: 'vendor_id,service_id' },
    )
    .select('id');

  if (error) return internalError('Gagal menyimpan modal paket', error);
  if ((data ?? []).length === 0) return forbidden('Penyimpanan ditolak.');

  revalidatePath(`/vendors/${v.vendor_id}`);
  revalidatePath('/dashboard');
  return { ok: true, data: null };
}

export async function deleteVendorService(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_VENDORS')) {
    return forbidden('Daftar modal mitra hanya dapat diubah superadmin.');
  }

  const parsed = deleteVendorServiceSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('vendor_services')
    .delete()
    .eq('id', parsed.data.id)
    .select('vendor_id');

  if (error) return internalError('Gagal menghapus modal paket', error);
  if ((data ?? []).length === 0) return notFound('Baris tidak ditemukan.');

  revalidatePath(`/vendors/${(data ?? [])[0].vendor_id}`);
  revalidatePath('/dashboard');
  return { ok: true, data: null };
}

// =============================================================================
// Wilayah layanan
// =============================================================================

/**
 * Simpan wilayah layanan satu mitra sebagai satu keadaan utuh.
 *
 * Hapus-lalu-sisipkan, bukan selisih per baris: yang dikirim layar adalah
 * daftar lengkap "mitra ini melayani wilayah ini", dan menghitung selisihnya di
 * sini hanya menambah kode untuk hasil yang sama. Tabelnya kecil — lazimnya
 * belasan baris per mitra.
 *
 * Nama wilayah dibaca ulang dari `regions`, tidak dipercaya dari klien: yang
 * dibaca orang adalah namanya, jadi nama yang boleh dikirim sendiri berarti
 * cakupan tercatat bisa berbeda dari wilayah yang sebenarnya dipilih. Alasan
 * yang sama dipakai `resolveAddress` di atas dan `create_guest_order` di RPC.
 */
export async function saveVendorCoverage(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_VENDORS')) {
    return forbidden('Wilayah layanan mitra hanya dapat diubah superadmin.');
  }

  const parsed = saveVendorCoverageSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { vendor_id, region_codes } = parsed.data;

  const supabase = await createClient();

  const { data: vendor } = await supabase
    .from('vendors')
    .select('id')
    .eq('id', vendor_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!vendor) return notFound('Mitra tidak ditemukan.');

  let rows: Array<{
    vendor_id: string;
    region_code: string;
    region_name: string;
    level: number;
  }> = [];

  if (region_codes.length > 0) {
    const { data: regions, error: regionError } = await supabase
      .from('regions')
      .select('code, name, level')
      .in('code', region_codes);

    if (regionError) return internalError('Gagal memuat wilayah', regionError);

    const found = new Map((regions ?? []).map((r) => [r.code, r]));
    // Kode yang tidak ada di `regions` ditolak di sini, bukan didiamkan:
    // tabelnya tanpa FK (disengaja, lihat migration 02), jadi baris ngawur akan
    // tersimpan diam-diam dan baru terasa saat pencocokan order tidak menemukan
    // mitra mana pun.
    const unknown = region_codes.filter((c) => !found.has(c));
    if (unknown.length > 0) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Wilayah tidak dikenali: ${unknown.slice(0, 3).join(', ')}.`,
          fields: { region_codes: 'Ada kode wilayah yang tidak dikenali.' },
        },
      };
    }

    rows = region_codes.map((code) => {
      const r = found.get(code)!;
      return { vendor_id, region_code: code, region_name: r.name, level: r.level };
    });
  }

  const { error: deleteError } = await supabase
    .from('vendor_coverage')
    .delete()
    .eq('vendor_id', vendor_id);

  if (deleteError) return internalError('Gagal memperbarui wilayah layanan', deleteError);

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from('vendor_coverage').insert(rows);
    if (insertError) return internalError('Gagal menyimpan wilayah layanan', insertError);
  }

  revalidatePath(`/vendors/${vendor_id}`);
  return { ok: true, data: null };
}
