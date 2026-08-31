'use server';

import { revalidatePath } from 'next/cache';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { supabaseUrl } from '@/lib/supabase/env';
import { requireAuth } from '@/server/auth/session';
import { canDo } from '@/server/auth/capabilities';
import type { Database } from '@/types/database';
import { changeRoleSchema, createUserSchema, setUserActiveSchema } from '@/features/users/schema';

import {
  conflict,
  forbidden,
  notFound,
  scopedInternalError,
  validationError,
  type ActionResult,
} from './result';

const internalError = scopedInternalError('users');

/**
 * Klien service role — **melewati seluruh RLS**.
 *
 * Dipakai hanya untuk membuat akun di `auth.users`, satu-satunya hal yang tidak
 * bisa dikerjakan lewat kunci publik. Karena RLS tidak berlaku di sini, setiap
 * fungsi yang memakainya **wajib memeriksa role pemanggilnya sendiri** lebih
 * dulu — tidak ada jaring pengaman kedua di database.
 */
function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'Environment SUPABASE_SERVICE_ROLE_KEY belum diisi — akun pengguna tidak dapat dibuat.',
    );
  }

  return createAdminClient<Database>(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// =============================================================================
// Buat akun
// =============================================================================

/**
 * Buat akun pengguna baru beserta profilnya.
 *
 * Urutannya penting dan tidak bisa dibalik:
 *
 * 1. `auth.admin.createUser` membuat baris di `auth.users`
 * 2. trigger `handle_new_user` otomatis membuat `profiles` — selalu sebagai
 *    **vendor non-aktif**, apa pun isi metadata-nya
 * 3. server action ini menaikkan role & mengaktifkan, setelah memastikan
 *    pemanggilnya superadmin
 *
 * Langkah 2 sengaja tidak bisa dipengaruhi dari luar: kalau role dibaca dari
 * user metadata, siapa pun yang bisa mendaftar mandiri di Supabase dapat
 * menyisipkan `{"role":"admin"}` dan langsung jadi admin.
 */
export async function createUser(
  input: unknown,
): Promise<ActionResult<{ id: string; email: string }>> {
  const session = await requireAuth();

  // RLS tidak menolong di bawah service role — pemeriksaan ini satu-satunya
  // yang berdiri antara pemanggil dan pembuatan akun berwenang penuh.
  if (!canDo(session.profile?.role, 'MANAGE_USERS')) {
    return forbidden('Pengelolaan akun hanya dapat dilakukan superadmin.');
  }

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const v = parsed.data;

  const supabase = await createClient();

  // Mitra diperiksa lebih dulu: akun vendor yang tertaut ke mitra tidak sah
  // akan ditolak constraint di tengah jalan, meninggalkan akun auth yatim.
  if (v.role === 'vendor') {
    const { data: vendor } = await supabase
      .from('vendors')
      .select('id, is_active')
      .eq('id', v.vendor_id as string)
      .is('deleted_at', null)
      .maybeSingle();

    if (!vendor) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Mitra tidak ditemukan.',
          fields: { vendor_id: 'Mitra tidak dikenal.' },
        },
      };
    }
  }

  let admin: ReturnType<typeof adminClient>;
  try {
    admin = adminClient();
  } catch (e) {
    return internalError('Kunci service role belum tersedia', e as { message: string });
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: v.email,
    password: v.password,
    // Akun dibuat admin, bukan mendaftar sendiri — jadi tidak perlu menunggu
    // konfirmasi email yang tidak akan pernah dibuka siapa pun.
    email_confirm: true,
    user_metadata: {
      full_name: v.full_name,
      phone: v.phone || null,
      // Sengaja tanpa `role`: trigger mengabaikannya. `vendor_id` boleh karena
      // ia tidak memberi wewenang apa pun — hanya menentukan order mana yang
      // kelak terlihat.
      vendor_id: v.vendor_id || null,
    },
  });

  if (createError) {
    // Pesan Supabase untuk email ganda cukup jelas dan tidak membocorkan apa
    // pun; sisanya ditelan supaya detail internal tidak sampai ke layar.
    if (createError.message.toLowerCase().includes('already')) {
      return {
        ok: false,
        error: {
          code: 'CONFLICT',
          message: 'Email ini sudah terdaftar.',
          fields: { email: 'Sudah dipakai akun lain.' },
        },
      };
    }
    return internalError('Gagal membuat akun', createError);
  }

  const userId = created.user?.id;
  if (!userId) return internalError('Akun terbuat tanpa id', { message: 'user.id kosong' });

  // Naikkan role & aktifkan. Lewat klien biasa, jadi RLS `profiles_manage`
  // ikut memeriksa — dua lapis untuk langkah yang paling menentukan.
  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update({
      role: v.role,
      vendor_id: v.vendor_id || null,
      full_name: v.full_name,
      phone: v.phone || null,
      is_active: true,
    })
    .eq('id', userId)
    .select('id');

  if (updateError || (updated ?? []).length === 0) {
    // Akun auth sudah terlanjur ada tapi profilnya gagal disetel — dibersihkan
    // supaya tidak meninggalkan akun yang bisa login tapi tidak punya peran.
    await admin.auth.admin.deleteUser(userId);
    return internalError(
      'Gagal menetapkan peran akun',
      updateError ?? { message: 'profiles tidak terbarui' },
    );
  }

  revalidatePath('/users');
  return { ok: true, data: { id: userId, email: v.email } };
}

// =============================================================================
// Aktif / non-aktif
// =============================================================================

/**
 * Aktifkan atau nonaktifkan akun.
 *
 * Menonaktifkan lebih tepat daripada menghapus: `auth_role()` mengembalikan
 * NULL selama `is_active` false, jadi akunnya seketika tidak bisa apa-apa —
 * sementara jejaknya di audit dan kolom `reported_by` tetap terbaca.
 */
export async function setUserActive(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_USERS')) {
    return forbidden('Pengelolaan akun hanya dapat dilakukan superadmin.');
  }

  const parsed = setUserActiveSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { user_id, is_active } = parsed.data;

  // Menonaktifkan diri sendiri berarti terkunci keluar dari satu-satunya
  // halaman yang bisa membatalkannya.
  if (user_id === session.id && !is_active) {
    return conflict('Anda tidak dapat menonaktifkan akun Anda sendiri.');
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('profiles')
    .update({ is_active })
    .eq('id', user_id)
    .select('id');

  if (error) return internalError('Gagal mengubah status akun', error);
  if ((data ?? []).length === 0) return notFound('Akun tidak ditemukan.');

  revalidatePath('/users');
  return { ok: true, data: null };
}

// =============================================================================
// Ubah peran
// =============================================================================

/**
 * Ubah peran sebuah akun.
 *
 * Superadmin terakhir sengaja dijaga: sistem tanpa superadmin tidak punya siapa
 * pun yang bisa mengangkat superadmin baru, dan pemulihannya menuntut akses
 * langsung ke database.
 */
export async function changeUserRole(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_USERS')) {
    return forbidden('Perubahan peran hanya dapat dilakukan superadmin.');
  }

  const parsed = changeRoleSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { user_id, role, vendor_id } = parsed.data;

  const supabase = await createClient();

  const { data: target } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user_id)
    .maybeSingle();

  if (!target) return notFound('Akun tidak ditemukan.');

  if (target.role === 'superadmin' && role !== 'superadmin') {
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'superadmin')
      .eq('is_active', true)
      .is('deleted_at', null);

    if ((count ?? 0) <= 1) {
      return conflict(
        'Ini satu-satunya superadmin aktif. Angkat superadmin lain lebih dulu sebelum menurunkan yang ini.',
      );
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ role, vendor_id: vendor_id || null })
    .eq('id', user_id)
    .select('id');

  if (error) {
    // Constraint `profiles_vendor_scope_check` / `profiles_staff_no_vendor_check`
    // menolak kombinasi peran & mitra yang tidak masuk akal.
    if (error.code === '23514') {
      return conflict('Kombinasi peran dan mitra tidak sah.');
    }
    return internalError('Gagal mengubah peran', error);
  }
  if ((data ?? []).length === 0) return notFound('Akun tidak ditemukan.');

  revalidatePath('/users');
  return { ok: true, data: null };
}
