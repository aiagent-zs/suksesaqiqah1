import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * Callback OAuth dari Supabase Auth (Google, dll).
 * Supabase mengarahkan user ke sini setelah login OAuth berhasil.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // next: URL tujuan setelah login (opsional)
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Gagal → redirect ke halaman login dengan pesan error
  return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
}
