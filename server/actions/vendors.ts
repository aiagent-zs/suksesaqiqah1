'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/server/auth/session';
import { canDo } from '@/server/auth/capabilities';
import {
  createVendorSchema,
  deleteVendorServiceSchema,
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

  if (error) return internalError('Gagal memperbarui mitra', error);
  if ((data ?? []).length === 0) return notFound('Mitra tidak ditemukan.');

  revalidatePath('/vendors');
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
  return { ok: true, data: null };
}
