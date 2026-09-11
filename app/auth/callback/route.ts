import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * Callback Supabase Auth — penukar `code` jadi sesi.
 *
 * Dipakai OAuth **dan** tautan atur ulang sandi. Keduanya mengirim `code` yang
 * harus ditukar lebih dulu; tanpa itu halaman tujuan tidak tahu siapa yang
 * datang, dan `auth.updateUser()` menolak.
 *
 * `next` menentukan ke mana orangnya dibawa sesudah penukaran — dan **hanya
 * menerima jalur relatif**. Tanpa penjagaan itu, tautan yang disusun orang
 * lain bisa memakai callback ini untuk melempar korbannya ke situs luar
 * dengan sesi yang baru saja terbentuk.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // next: URL tujuan setelah login (opsional)
  const requested = searchParams.get('next') ?? '/dashboard';
  // Hanya "/jalur", bukan "//host-lain" atau "https://..." — lihat docblock.
  const next = /^\/(?!\/)/.test(requested) ? requested : '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Tautan atur ulang yang kedaluwarsa juga berakhir di sini. Kodenya tetap
  // `oauth_failed` supaya halaman login tidak perlu tahu asal-usulnya —
  // kalimat yang ditampilkan sama-sama berlaku: coba lagi dari awal.
  return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
}
