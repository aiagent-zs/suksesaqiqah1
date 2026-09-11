'use server';

import { z } from 'zod';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ACTIVITY_COOKIE, ACTIVITY_COOKIE_MAX_AGE_S, IDLE_NOTICE } from '@/lib/auth/idle';
import { appUrl } from '@/lib/constants/site';
import { requestPasswordResetSchema, resetPasswordSchema } from '@/features/users/schema';

/**
 * Mulai jendela menganggur yang baru.
 *
 * Wajib dipanggil saat login berhasil. Tanpa ini, cookie sisa dari sesi
 * sebelumnya masih membawa cap waktu lama — dan middleware akan langsung
 * mengeluarkan user yang baru saja berhasil masuk.
 */
async function startActivityWindow() {
  const store = await cookies();
  store.set(ACTIVITY_COOKIE, String(Date.now()), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ACTIVITY_COOKIE_MAX_AGE_S,
  });
}

async function clearActivityWindow() {
  const store = await cookies();
  store.delete(ACTIVITY_COOKIE);
}

/**
 * Kode error login yang stabil.
 *
 * Halaman login memetakan kode-kode ini ke kalimat bahasa Indonesia. Pesan
 * mentah dari Supabase sengaja TIDAK diteruskan ke URL: teksnya berbahasa
 * Inggris, bisa berubah sewaktu-waktu tanpa pemberitahuan, dan membocorkan
 * detail internal penyedia auth.
 */
export type LoginErrorCode =
  | 'invalid_input'
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'rate_limited'
  /** Tautan atur ulang sandi sudah dipakai, kedaluwarsa, atau dibuka di peramban lain. */
  | 'reset_expired'
  /** Penukaran kode di `/auth/callback` gagal — termasuk tautan atur ulang. */
  | 'oauth_failed'
  | 'unknown';

const credentialsSchema = z.object({
  email: z.string().trim().min(1, 'Email wajib diisi').email(),
  password: z.string().min(1, 'Kata sandi wajib diisi'),
});

/**
 * Terjemahkan kegagalan Supabase Auth ke kode internal.
 * `error.code` dipakai lebih dulu; pencocokan pesan hanya cadangan untuk versi
 * SDK lama yang belum mengisi kolom itu.
 */
function toLoginErrorCode(error: { code?: string; message: string }): LoginErrorCode {
  switch (error.code) {
    case 'invalid_credentials':
      return 'invalid_credentials';
    case 'email_not_confirmed':
      return 'email_not_confirmed';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'rate_limited';
  }

  const message = error.message.toLowerCase();
  if (message.includes('invalid login credentials')) return 'invalid_credentials';
  if (message.includes('email not confirmed')) return 'email_not_confirmed';
  if (message.includes('rate limit')) return 'rate_limited';

  console.error('[auth] login gagal dengan error tak dikenal:', error.code ?? '-', error.message);
  return 'unknown';
}

/**
 * Login dengan Email + Password.
 * Dipanggil dari form action di halaman /login.
 */
export async function loginWithEmail(formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    redirect('/login?error=invalid_input');
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    redirect(`/login?error=${toLoginErrorCode(error)}`);
  }

  await startActivityWindow();
  redirect('/dashboard');
}

/**
 * Logout — menghapus sesi dan redirect ke /login.
 *
 * Sengaja tanpa parameter: dipakai langsung sebagai `<form action={logout}>`,
 * dan Server Action yang dipasang begitu menerima `FormData` sebagai argumen
 * pertama. Alasan keluar otomatis punya action-nya sendiri di bawah.
 */
export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await clearActivityWindow();
  redirect('/');
}

/**
 * Logout karena menganggur — dipanggil pengawas `IdleLogout` di klien.
 *
 * Bukan pengganti pemeriksaan di middleware, melainkan pelengkapnya: tab yang
 * dibiarkan terbuka tidak mengirim permintaan apa pun, jadi tanpa ini user
 * baru terlempar saat menekan sesuatu.
 */
export async function logoutIdle() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await clearActivityWindow();
  redirect(`/login?notice=${IDLE_NOTICE}`);
}

/**
 * Minta tautan atur ulang sandi dari halaman masuk.
 *
 * **Selalu mengaku berhasil**, bahkan untuk email yang tidak terdaftar. Pesan
 * yang membedakan keduanya mengubah halaman ini jadi alat pemeriksa: siapa pun
 * bisa mencoba satu per satu email dan mengetahui mana yang punya akun di
 * sini. Padahal daftar akun kami memuat mitra dan staf, bukan sesuatu yang
 * pantas bisa ditebak orang luar.
 *
 * Yang benar-benar terjadi — email terkirim atau tidak — hanya diketahui
 * pemilik kotak masuknya, dan itu memang satu-satunya yang berhak tahu.
 */
export async function requestPasswordReset(
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const parsed = requestPasswordResetSchema.safeParse({ email: formData.get('email') });

  if (!parsed.success) {
    return { ok: false, message: 'Masukkan alamat email yang benar.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    // Lewat callback, bukan langsung: tautannya membawa `code` yang harus
    // ditukar jadi sesi lebih dulu — tanpa itu halaman tujuan tidak tahu
    // siapa yang datang, dan `updateUser` akan menolak.
    redirectTo: `${appUrl()}/auth/callback?next=/atur-sandi`,
  });

  // Batas pengiriman tetap disampaikan: itu keadaan sementara yang bisa
  // ditindaklanjuti ("tunggu sebentar"), bukan petunjuk ada-tidaknya akun.
  if (error && toLoginErrorCode(error) === 'rate_limited') {
    return { ok: false, message: 'Terlalu sering mencoba. Tunggu beberapa menit lalu ulangi.' };
  }

  if (error) {
    console.error('[auth] gagal mengirim tautan atur ulang:', error.code ?? '-', error.message);
  }

  return {
    ok: true,
    message:
      'Kalau email itu terdaftar, tautan untuk mengatur ulang kata sandi sudah dikirim. ' +
      'Periksa kotak masuk dan folder spam.',
  };
}

/**
 * Setel sandi baru sesudah menekan tautan atur ulang.
 *
 * Tidak menuntut sandi lama — justru yang lupa sandinyalah yang memakai ini.
 * Yang membuktikan haknya adalah tautan di emailnya, yang sudah ditukar jadi
 * sesi sementara oleh `/auth/callback` sebelum halaman ini terbuka.
 */
export async function resetPassword(
  input: unknown,
): Promise<{ ok: boolean; message: string; fields?: Record<string, string> }> {
  const parsed = resetPasswordSchema.safeParse(input);

  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && !fields[key]) fields[key] = issue.message;
    }
    return { ok: false, message: 'Kata sandi belum memenuhi syarat.', fields };
  }

  const supabase = await createClient();

  // Tanpa sesi dari tautannya, `updateUser` akan mengubah sandi siapa pun yang
  // kebetulan sedang masuk di peramban itu — bukan pemilik tautannya.
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return {
      ok: false,
      message: 'Tautan sudah kedaluwarsa atau tidak sah. Minta tautan baru dari halaman masuk.',
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.new_password });

  if (error) {
    return { ok: false, message: `Gagal menyimpan kata sandi: ${error.message}` };
  }

  await startActivityWindow();
  return { ok: true, message: 'Kata sandi berhasil diperbarui.' };
}
