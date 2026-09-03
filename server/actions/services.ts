'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';
import { requireAuth } from '@/server/auth/session';
import { canDo } from '@/server/auth/capabilities';
import {
  clearServicePhotoSchema,
  createServiceSchema,
  setServiceActiveSchema,
  setServicePhotoSchema,
  updateServiceSchema,
} from '@/features/services/schema';
import {
  isRepoPhotoPath,
  isServicePhotoPath,
  PUBLIC_ASSET_BUCKET,
} from '@/features/services/storage';

import {
  conflict,
  forbidden,
  notFound,
  scopedInternalError,
  validationError,
  type ActionResult,
} from './result';

const internalError = scopedInternalError('services');

/** Pesan tunggal untuk penolakan hak, supaya bunyinya sama di semua aksi. */
const FORBIDDEN_MESSAGE =
  'Pengelolaan katalog hanya dapat dilakukan superadmin — harga di sini adalah harga yang ditagih ke pembeli.';

/**
 * Constraint `services_landing_requires_active` ditabrak.
 *
 * Terjadi saat "tampilkan di halaman depan" dicentang pada paket yang sedang
 * non-aktif. Postgres membalas 23514 dengan nama constraint-nya — teks yang
 * tidak berarti apa-apa bagi operator, jadi diterjemahkan di sini dan
 * ditempelkan ke medan yang menyebabkannya.
 *
 * Kebalikannya (menonaktifkan paket yang sedang dipasarkan) tidak pernah
 * sampai ke sini: `setServiceActive` menurunkan keduanya bersamaan.
 */
function landingRequiresActive(): ActionResult<never> {
  return {
    ok: false,
    error: {
      code: 'CONFLICT',
      message: 'Paket non-aktif tidak dapat dipasarkan di halaman depan.',
      fields: {
        show_on_landing: 'Aktifkan dulu paketnya sebelum memasarkannya.',
      },
    },
  };
}

/**
 * Slug bentrok, dari indeks unik `services.slug`.
 *
 * Ditempelkan ke medan `slug` supaya galatnya muncul tepat di kolomnya, bukan
 * sebagai pesan umum di kepala formulir. Bersandar pada constraint dan bukan
 * SELECT lebih dulu: pemeriksaan terpisah punya celah waktu antara "sudah
 * kucek, aman" dan baris benar-benar ditulis — pola yang sama dipakai
 * `createVendor`/`updateVendor`.
 */
function slugConflict(): ActionResult<never> {
  return {
    ok: false,
    error: {
      code: 'CONFLICT',
      message: 'Slug ini sudah dipakai paket lain.',
      fields: { slug: 'Sudah dipakai paket lain.' },
    },
  };
}

/**
 * Rakit `meta` dari medan formulir, **di atas `meta` yang sudah ada**.
 *
 * Kuncinya: `meta` kolom bebas yang memuat lebih banyak daripada yang
 * dirender formulir — `favorit` dan `premium` pada nasi box, misalnya, dan
 * apa pun yang kelak ditambahkan jalur lain. Menulis objek baru dari nol akan
 * **menghapusnya diam-diam** setiap kali seseorang menyimpan formulir, tanpa
 * satu pun galat.
 *
 * Karena itu yang dilakukan menimpa kunci yang memang disunting dan
 * membiarkan sisanya. Kunci yang dikosongkan dibuang, bukan disimpan sebagai
 * string kosong — `serviceDetails()` memeriksa keberadaan kunci, jadi
 * `{"cocok_untuk": ""}` akan mencetak baris kosong di kartu.
 */
function metaFrom(
  v: {
    type: string;
    porsi?: number;
    jenis_olahan?: string;
    cocok_untuk?: string;
    items?: string[];
  },
  existing: unknown,
): Json {
  // `Json` bukan `Record<string, unknown>`: kolomnya bisa memuat array dan
  // nilai bersarang, dan tipe itulah yang diterima PostgREST. Ditulis sebagai
  // objek Json supaya kunci yang dibawa dari baris lama ikut terbawa apa
  // adanya tanpa perlu ditebak bentuknya satu per satu.
  const base: { [key: string]: Json | undefined } =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as { [key: string]: Json }) }
      : {};

  if (v.type === 'nasi_box') {
    // Aqiqah dan nasi box memakai bentuk berbeda; menulis keduanya sekaligus
    // membuat kartu mencetak porsi untuk sebuah box nasi.
    //
    // Bentuk lawannya **dibuang**, bukan dibiarkan: mengubah jenis sebuah paket
    // dari aqiqah ke nasi box meninggalkan `hasil` & `cocok_untuk` di baris
    // yang sama, dan `serviceDetails()` membaca seluruh kunci tanpa memandang
    // jenis — kartunya akan mencetak "80 porsi · Olahan: gulai & sate · nasi
    // putih · sate" sekaligus. Formulir pun tidak lagi menampilkan medannya,
    // jadi tidak ada cara membersihkannya lewat aplikasi.
    delete base.hasil;
    delete base.cocok_untuk;

    if (v.items && v.items.length > 0) base.items = v.items;
    else delete base.items;
    return base;
  }

  // Kebalikannya, dengan alasan yang sama.
  delete base.items;

  const hasil: { [key: string]: Json | undefined } = {};
  if (v.porsi !== undefined) hasil.porsi = v.porsi;
  if (v.jenis_olahan) hasil.jenis = v.jenis_olahan;

  if (Object.keys(hasil).length > 0) base.hasil = hasil;
  else delete base.hasil;

  if (v.cocok_untuk) base.cocok_untuk = v.cocok_untuk;
  else delete base.cocok_untuk;

  return base;
}

/** Kolom katalog dari input yang sudah tervalidasi. */
function rowFrom(
  v: {
    type: 'aqiqah' | 'qurban' | 'sedekah_daging' | 'nasi_box';
    name: string;
    slug: string;
    description?: string;
    price: number;
    sort_order?: number;
    tagline?: string;
    landing_features?: string[];
    photo_alt?: string;
    is_popular?: boolean;
    show_on_landing?: boolean;
  },
  meta?: Json,
) {
  return {
    ...(meta === undefined ? {} : { meta }),
    type: v.type,
    name: v.name,
    slug: v.slug,
    description: v.description || null,
    price: v.price,
    ...(v.sort_order === undefined ? {} : { sort_order: v.sort_order }),
    tagline: v.tagline || null,
    landing_features: v.landing_features ?? [],
    photo_alt: v.photo_alt || null,
    is_popular: v.is_popular ?? false,
    show_on_landing: v.show_on_landing ?? false,
    // `photo_path` sengaja TIDAK di sini: ia diubah lewat `setServicePhoto` /
    // `clearServicePhoto` yang juga mengurus berkasnya di Storage. Kalau ikut
    // di sini, menyimpan formulir akan menghapus foto tiap kali medannya
    // kebetulan tidak ikut terkirim.
  };
}

/**
 * Segarkan setiap halaman yang menampilkan katalog.
 *
 * **Landing (`/`) kini ikut**, dan itulah perubahan terpentingnya: sejak
 * `20260903010000` halaman depan membaca `services`, bukan lagi konstanta di
 * `lib/constants/site.ts`. Tanpa baris itu, harga baru tersimpan di database
 * tapi pengunjung tetap melihat angka lama sampai deploy berikutnya — persis
 * kelas kekeliruan yang hendak dihapus perubahan ini.
 */
function revalidateCatalogue() {
  revalidatePath('/');
  revalidatePath('/vendors');
  revalidatePath('/checkout');
  revalidatePath('/orders/new');
}

export async function createService(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_MASTER_DATA')) {
    return forbidden(FORBIDDEN_MESSAGE);
  }

  const parsed = createServiceSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('services')
    .insert(rowFrom(parsed.data, metaFrom(parsed.data, null)))
    .select('id')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') return slugConflict();
    if (error.code === '23514' && error.message.includes('landing_requires_active')) {
      return landingRequiresActive();
    }
    return internalError('Gagal menyimpan paket', error);
  }
  if (!data) return internalError('Paket tidak tersimpan', { message: 'insert kosong' });

  revalidateCatalogue();
  return { ok: true, data: { id: data.id } };
}

/**
 * Sunting paket — termasuk **harga**.
 *
 * Yang membuat ini aman bukan pendapat melainkan bentuk skemanya:
 * `order_items.unit_price` menyimpan harganya sendiri, disalin saat order
 * dibuat. Jadi menaikkan harga katalog hari ini **tidak menggeser** tagihan
 * order yang sudah berjalan — prinsip rekaman sejarah yang sama dengan
 * `vendor_unit_price` di tabel itu.
 *
 * `slug` ikut tersunting, dan konsekuensinya tidak simetris dengan `code` milik
 * mitra: slug **dipakai sebagai tautan** (`/checkout?paket={slug}`).
 * Mengubahnya membuat tautan lama tidak lagi cocok, dan `checkout/page.tsx`
 * sengaja mengabaikan slug tak dikenal lalu jatuh ke paket pertama — jadi
 * tautan yang telanjur tersebar akan diam-diam mengarah ke paket yang salah,
 * bukan menghasilkan galat. Formulirnya memperingatkan ini di layar.
 */
export async function updateService(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_MASTER_DATA')) {
    return forbidden(FORBIDDEN_MESSAGE);
  }

  const parsed = updateServiceSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { id, ...v } = parsed.data;

  const supabase = await createClient();

  // `meta` lama dibaca lebih dulu supaya kunci yang tidak dirender formulir
  // (`favorit`, `premium`, dan apa pun yang kelak ditambahkan) tidak hilang
  // tiap kali formulir disimpan.
  const { data: before } = await supabase
    .from('services')
    .select('meta')
    .eq('id', id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('services')
    .update(rowFrom(v, metaFrom(v, before?.meta ?? null)))
    .eq('id', id)
    .select('id');

  if (error) {
    if (error.code === '23505') return slugConflict();
    if (error.code === '23514' && error.message.includes('landing_requires_active')) {
      return landingRequiresActive();
    }
    return internalError('Gagal memperbarui paket', error);
  }
  if ((data ?? []).length === 0) return notFound('Paket tidak ditemukan.');

  revalidateCatalogue();
  return { ok: true, data: null };
}

/**
 * Aktifkan / nonaktifkan paket.
 *
 * **Inilah pengganti "hapus" yang sesungguhnya**, dan bukan sekadar pilihan
 * yang lebih sopan. `order_items.service_id` di-`on delete restrict`, jadi
 * paket yang pernah dipesan memang tidak bisa dihapus — database akan
 * menolaknya. Menonaktifkan mencabutnya dari checkout dan dari pilihan modal
 * mitra, sementara order lama tetap menunjuk ke baris yang masih ada dan
 * laporannya tetap bisa dibaca.
 */
export async function setServiceActive(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_MASTER_DATA')) {
    return forbidden(FORBIDDEN_MESSAGE);
  }

  const parsed = setServiceActiveSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();

  // Menonaktifkan paket yang sedang dipasarkan akan ditabrak
  // `services_landing_requires_active` — dan galat 23514 itu tidak berarti
  // apa-apa bagi operator. Yang ia maksud jelas: paket ini tidak lagi dijual.
  // Jadi keduanya diturunkan bersama alih-alih menolak aksinya.
  const { data, error } = await supabase
    .from('services')
    .update(
      parsed.data.is_active ? { is_active: true } : { is_active: false, show_on_landing: false },
    )
    .eq('id', parsed.data.id)
    .select('id');

  if (error) return internalError('Gagal mengubah status paket', error);
  if ((data ?? []).length === 0) return notFound('Paket tidak ditemukan.');

  revalidateCatalogue();
  return { ok: true, data: null };
}

/**
 * Hapus paket — hanya yang belum pernah dipakai.
 *
 * Penghapusannya soft delete (`deleted_at`), mengikuti kolom yang memang sudah
 * ada di tabel dan sudah disaring `services_select_public`.
 *
 * Pemeriksaan pemakaian tetap dilakukan lebih dulu **meski database sudah
 * menjaganya** — tapi perhatikan apa yang sebenarnya dijaga masing-masing:
 * `on delete restrict` hanya menolak DELETE sungguhan, sedangkan ini UPDATE,
 * jadi di sini **tidak ada jaring pengaman kedua di database**. Itu sebabnya
 * pemeriksaannya wajib, bukan sekadar demi pesan yang lebih ramah.
 *
 * Celah yang tersisa dan diterima sadar: TOCTOU antara hitungan ini dan
 * UPDATE-nya. Order yang masuk pada detik yang sama akan menunjuk paket yang
 * baru saja ditandai terhapus — akibatnya paket itu hilang dari checkout,
 * bukan data yang rusak, dan superadmin tinggal mengaktifkannya kembali.
 */
export async function deleteService(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_MASTER_DATA')) {
    return forbidden(FORBIDDEN_MESSAGE);
  }

  const parsed = setServiceActiveSchema.pick({ id: true }).safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { id } = parsed.data;

  const supabase = await createClient();

  const { count, error: countError } = await supabase
    .from('order_items')
    .select('id', { count: 'exact', head: true })
    .eq('service_id', id);

  if (countError) return internalError('Gagal memeriksa pemakaian paket', countError);

  if ((count ?? 0) > 0) {
    return conflict(
      `Paket ini sudah dipakai ${count} order dan tidak dapat dihapus. Nonaktifkan saja — paket akan hilang dari checkout, sementara order lama tetap utuh.`,
    );
  }

  const { data, error } = await supabase
    .from('services')
    // `show_on_landing` WAJIB ikut diturunkan: `services_landing_requires_active`
    // menolak baris non-aktif yang masih dipasarkan, jadi tanpa ini menghapus
    // paket yang sedang tampil di halaman depan **selalu** gagal — dengan galat
    // 23514 yang diterjemahkan jadi "coba lagi", menyuruh operator mengulang
    // sesuatu yang tidak akan pernah berhasil.
    .update({
      deleted_at: new Date().toISOString(),
      is_active: false,
      show_on_landing: false,
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id');

  if (error) return internalError('Gagal menghapus paket', error);
  if ((data ?? []).length === 0) return notFound('Paket tidak ditemukan.');

  revalidateCatalogue();
  return { ok: true, data: null };
}

// =============================================================================
// Foto katalog
// =============================================================================

/**
 * Simpan foto yang baru diunggah ke sebuah paket.
 *
 * Berkasnya diunggah langsung dari peramban ke Storage — sama seperti bukti
 * pembayaran. Yang lewat server action hanyalah **path**-nya, jadi berkas
 * sebesar 5 MB tidak perlu menempuh dua kali perjalanan (klien→server→Storage).
 *
 * Path-nya diperiksa ulang di sini meski dirakit `servicePhotoPath()` di klien:
 * apa pun yang sampai ke server action datang dari klien dan bisa berisi apa
 * saja. Tanpa pemeriksaan ini `photo_path` bisa diisi path ke object bucket
 * lain — dan `SitePhoto` akan dengan patuh menyajikannya di halaman depan.
 */
export async function setServicePhoto(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_MASTER_DATA')) {
    return forbidden(FORBIDDEN_MESSAGE);
  }

  const parsed = setServicePhotoSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { id, photo_path, photo_alt } = parsed.data;

  if (!isServicePhotoPath(photo_path)) {
    return validationErrorMessage('photo_path', 'Path foto tidak dikenali.');
  }

  const supabase = await createClient();

  // Foto lama dibaca lebih dulu supaya berkasnya bisa dibuang sesudah kolomnya
  // menunjuk yang baru. Urutannya sengaja begitu: menghapus lebih dulu lalu
  // gagal meng-update meninggalkan paket tanpa foto sama sekali.
  const { data: before } = await supabase
    .from('services')
    .select('photo_path')
    .eq('id', id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('services')
    .update({ photo_path, photo_alt: photo_alt || null })
    .eq('id', id)
    .select('id');

  if (error) return internalError('Gagal menyimpan foto', error);
  if ((data ?? []).length === 0) return notFound('Paket tidak ditemukan.');

  await removeStoredPhoto(supabase, before?.photo_path ?? null);

  revalidateCatalogue();
  return { ok: true, data: null };
}

/** Lepaskan foto dari paket, sekaligus buang berkasnya bila milik Storage. */
export async function clearServicePhoto(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_MASTER_DATA')) {
    return forbidden(FORBIDDEN_MESSAGE);
  }

  const parsed = clearServicePhotoSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();

  const { data: before } = await supabase
    .from('services')
    .select('photo_path')
    .eq('id', parsed.data.id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('services')
    .update({ photo_path: null, photo_alt: null })
    .eq('id', parsed.data.id)
    .select('id');

  if (error) return internalError('Gagal menghapus foto', error);
  if ((data ?? []).length === 0) return notFound('Paket tidak ditemukan.');

  await removeStoredPhoto(supabase, before?.photo_path ?? null);

  revalidateCatalogue();
  return { ok: true, data: null };
}

/**
 * Buang berkas foto dari Storage — kalau ia memang milik Storage.
 *
 * Dua penjagaan, masing-masing menutup kekeliruan yang berbeda:
 *
 *   - `isRepoPhotoPath` melindungi kesepuluh foto bawaan di `public/`. Path
 *     itu bukan object Storage sama sekali, jadi menghapusnya tidak akan
 *     berhasil — tapi memintanya berarti kode ini tidak tahu bedanya.
 *   - `isServicePhotoPath` menolak path yang bentuknya tidak dikenali. Yang
 *     dihapus di sini datang dari kolom database, dan kolom itu bisa memuat
 *     nilai lama dari sebelum aturan path ini ada.
 *
 * Kegagalannya sengaja **tidak** membatalkan aksi: kolomnya sudah benar, dan
 * berkas yatim di bucket privat-superadmin adalah sampah, bukan kerusakan.
 * Membatalkan justru mengembalikan paket ke foto yang sudah tidak ada.
 */
async function removeStoredPhoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string | null,
): Promise<void> {
  if (!path || isRepoPhotoPath(path) || !isServicePhotoPath(path)) return;

  const { error } = await supabase.storage.from(PUBLIC_ASSET_BUCKET).remove([path]);
  if (error) {
    console.error('[services] sisa berkas foto tidak terhapus:', path, error.message);
  }
}

/** Galat validasi satu medan, tanpa perlu merakit ZodError. */
function validationErrorMessage(field: string, message: string): ActionResult<never> {
  return {
    ok: false,
    error: { code: 'VALIDATION_ERROR', message, fields: { [field]: message } },
  };
}
