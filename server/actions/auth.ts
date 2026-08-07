'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

/**
 * Kode error login yang stabil.
 *
 * Halaman login memetakan kode-kode ini ke kalimat bahasa Indonesia. Pesan
 * mentah dari Supabase sengaja TIDAK diteruskan ke URL: teksnya berbahasa
 * Inggris, bisa berubah sewaktu-waktu tanpa pemberitahuan, dan membocorkan
 * detail internal penyedia auth.
 */
export type LoginErrorCode =
  'invalid_input' | 'invalid_credentials' | 'email_not_confirmed' | 'rate_limited' | 'unknown';

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

  redirect('/dashboard');
}

/**
 * Logout — menghapus sesi dan redirect ke /login.
 */
export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
