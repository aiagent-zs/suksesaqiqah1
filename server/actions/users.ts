'use server';

import { revalidatePath } from 'next/cache';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { supabaseUrl } from '@/lib/supabase/env';
import { requireAuth } from '@/server/auth/session';
import { canDo } from '@/server/auth/capabilities';
import type { Database } from '@/types/database';
import {
  createUserSchema,
  deleteUserSchema,
  setUserActiveSchema,
  updateUserSchema,
} from '@/features/users/schema';

import {
  conflict,
  forbidden,
  notFound,
  scopedInternalError,
  validationError,
  type ActionResult,
} from './result';

const internalError = scopedInternalError('users');

// untuk membuat user baru (buat akun)
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

// untuk mencegah superadmin hapus diri sendiri
async function lastSuperadminGuard(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<ActionResult<never> | null> {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'superadmin')
    .eq('is_active', true)
    .is('deleted_at', null);

  // Hitungan yang gagal menahan, bukan meloloskan: `count` null pada error, dan
  // `(count ?? 0) <= 1` akan diam-diam meloloskan justru saat datanya tak
  // terbaca.
  if (error || count === null) {
    return internalError('Gagal memeriksa jumlah superadmin', error ?? { message: 'count kosong' });
  }

  if (count <= 1) {
    return conflict(
      'Ini satu-satunya superadmin aktif. Angkat superadmin lain lebih dulu sebelum mengubah yang ini.',
    );
  }

  return null;
}

// membuat akun
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
    return internalError('Pengaturan server belum lengkap', e as { message: string });
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

export async function updateUser(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_USERS')) {
    return forbidden('Pengelolaan akun hanya dapat dilakukan superadmin.');
  }

  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const v = parsed.data;

  const supabase = await createClient();

  const { data: target } = await supabase
    .from('profiles')
    .select('id, role, email')
    .eq('id', v.user_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!target) return notFound('Akun tidak ditemukan.');

  if (target.role === 'superadmin' && v.role !== 'superadmin') {
    const guard = await lastSuperadminGuard(supabase);
    if (guard) return guard;
  }

  // Mitra diperiksa lebih dulu — sama seperti `createUser`, supaya perubahan
  // tidak berhenti di tengah dengan email sudah terlanjur berpindah.
  if (v.role === 'vendor') {
    const { data: vendor } = await supabase
      .from('vendors')
      .select('id')
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

  // Hanya email yang menyentuh `auth.users` di sini. Sandi tidak lagi bisa
  // disetel dari halaman ini — lihat catatan di `updateUserSchema`.
  const emailChanged = v.email !== target.email;
  const needsAuthWrite = emailChanged;

  let admin: ReturnType<typeof adminClient> | null = null;

  if (needsAuthWrite) {
    try {
      admin = adminClient();
    } catch (e) {
      return internalError('Pengaturan server belum lengkap', e as { message: string });
    }

    const { error: authError } = await admin.auth.admin.updateUserById(v.user_id, {
      email: v.email,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.toLowerCase().includes('already')) {
        return {
          ok: false,
          error: {
            code: 'CONFLICT',
            message: 'Email ini sudah dipakai akun lain.',
            fields: { email: 'Sudah dipakai akun lain.' },
          },
        };
      }
      return internalError('Gagal memperbarui kredensial akun', authError);
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      email: v.email,
      full_name: v.full_name,
      phone: v.phone || null,
      role: v.role,
      vendor_id: v.vendor_id || null,
    })
    .eq('id', v.user_id)
    .is('deleted_at', null)
    .select('id');

  if (error || (data ?? []).length === 0) {
    // Email sudah berpindah di auth tapi profilnya tidak — dikembalikan supaya
    // orang ini tidak login dengan satu email lalu tampil dengan email lain.
    if (emailChanged && admin && target.email) {
      await admin.auth.admin.updateUserById(v.user_id, {
        email: target.email,
        email_confirm: true,
      });
    }

    if (error?.code === '23505') {
      return conflict('Email ini sudah dipakai akun lain.');
    }
    if (error?.code === '23514') {
      return conflict('Kombinasi peran dan mitra tidak sah.');
    }
    if (error) return internalError('Gagal memperbarui akun', error);
    return notFound('Akun tidak ditemukan.');
  }

  revalidatePath('/users');
  revalidatePath('/vendors');
  return { ok: true, data: null };
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
// Hapus akun
// =============================================================================

/**
 * Hapus akun — `deleted_at`, bukan `delete`.
 *
 * `profiles.id` memakai `on delete cascade` dari `auth.users`, jadi menghapus
 * akun auth ikut menghapus profilnya; dan sebelas kolom di tabel lain
 * (`reported_by`, `validated_by`, `uploaded_by`, `reviewed_by`, `actor_id`, …)
 * memakai `on delete set null`. Penghapusan sungguhan tidak ditolak database —
 * ia berhasil diam-diam dan **mengosongkan jejak siapa mengerjakan apa**, justru
 * pada kolom yang gunanya cuma satu itu.
 *
 * Dua langkah, keduanya perlu:
 *
 *   1. `deleted_at` — `auth_role()` mengembalikan NULL, setiap kebijakan RLS
 *      gagal, dan barisnya hilang dari `listUsers`.
 *   2. Ban di `auth.users` — tanpa ini orangnya masih bisa login. `getSession`
 *      membaca profilnya lewat `profiles_select` (`id = auth.uid()`, yang tidak
 *      menyaring `deleted_at`), jadi ia mendarat di dasbor sebagai vendor tanpa
 *      data alih-alih ditolak di halaman login.
 *
 * `vendor_id` dilepas supaya mitranya bisa diberi akun pengganti:
 * `profiles_vendor_unique_idx` unik tanpa menyaring `deleted_at`, jadi akun yang
 * terhapus tetap memegang slot mitranya kalau tautannya dibiarkan.
 */
export async function deleteUser(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_USERS')) {
    return forbidden('Penghapusan akun hanya dapat dilakukan superadmin.');
  }

  const parsed = deleteUserSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { user_id } = parsed.data;

  // Menghapus diri sendiri berarti terkunci keluar di tengah tindakan, dan
  // halaman yang bisa membatalkannya ikut hilang bersama akunnya.
  if (user_id === session.id) {
    return conflict('Anda tidak dapat menghapus akun Anda sendiri.');
  }

  const supabase = await createClient();

  const { data: target } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!target) return notFound('Akun tidak ditemukan.');

  if (target.role === 'superadmin') {
    const guard = await lastSuperadminGuard(supabase);
    if (guard) return guard;
  }

  let admin: ReturnType<typeof adminClient>;
  try {
    admin = adminClient();
  } catch (e) {
    return internalError('Pengaturan server belum lengkap', e as { message: string });
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      deleted_at: new Date().toISOString(),
      is_active: false,
      vendor_id: null,
    })
    .eq('id', user_id)
    .is('deleted_at', null)
    .select('id');

  if (error) return internalError('Gagal menghapus akun', error);
  if ((data ?? []).length === 0) return notFound('Akun tidak ditemukan.');

  // Sesudah profilnya ditandai, bukan sebelum: ban yang berhasil sementara
  // profilnya gagal ditandai meninggalkan akun terkunci yang masih tampil aktif
  // di daftar, tanpa tombol untuk membukanya lagi.
  const { error: banError } = await admin.auth.admin.updateUserById(user_id, {
    ban_duration: '876000h',
  });

  if (banError) {
    // Profilnya sudah mati — orang ini tidak bisa berbuat apa pun. Yang tersisa
    // hanya ia masih bisa melewati halaman login, jadi ini dicatat, bukan
    // dijadikan kegagalan yang membuat superadmin menekan tombolnya lagi.
    console.error('[users] Akun terhapus tapi gagal diban:', banError.message);
  }

  revalidatePath('/users');
  revalidatePath('/vendors');
  return { ok: true, data: null };
}
