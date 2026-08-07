import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';
import { supabaseAnonKey, supabaseUrl } from './env';

/**
 * Prefix route yang butuh sesi — seluruh route group `(app)`.
 *
 * Sengaja allow-by-default: sisi publik (landing, katalog program, halaman
 * laporan `/r/{token}`, sitemap) harus bisa dibuka pengunjung anonim. Guard
 * sebenarnya ada di server — `app/(app)/layout.tsx` memanggil `requireAuth()`
 * dan tiap Server Action memanggilnya lagi — jadi middleware ini hanya
 * mempercepat redirect, bukan satu-satunya pertahanan.
 *
 * Tambahkan prefix baru di sini setiap kali ada halaman baru di bawah `(app)`.
 */
const PROTECTED_PREFIXES = ['/dashboard', '/orders', '/schedule', '/validation'];

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Update sesi Supabase di middleware.
 * Pola resmi dari @supabase/ssr untuk Next.js App Router.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // Penting: jangan tambahkan logika di antara createServerClient & getUser.
  // Kesalahan ini bisa menyebabkan sesi tidak ter-refresh dengan benar.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Belum login dan akses route terproteksi → redirect ke /login
  if (!user && isProtectedRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Sudah login dan akses /login → redirect ke /dashboard
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
