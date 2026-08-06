'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

/**
 * Login dengan Email + Password.
 * Dipanggil dari form action di halaman /login.
 */
export async function loginWithEmail(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect('/dashboard');
}

/**
 * Login dengan Google OAuth.
 * Redirect ke URL otorisasi Google via Supabase.
 */
export async function loginWithGoogle() {
  const supabase = await createClient();

  const siteUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (error || !data.url) {
    redirect('/login?error=oauth_init_failed');
  }

  redirect(data.url);
}

/**
 * Logout — menghapus sesi dan redirect ke /login.
 */
export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
