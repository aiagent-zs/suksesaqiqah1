import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';
import {
  ACTIVITY_COOKIE,
  ACTIVITY_COOKIE_MAX_AGE_S,
  IDLE_NOTICE,
  isIdle,
  parseActivity,
} from '@/lib/auth/idle';
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
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/orders',
  '/schedule',
  '/validation',
  '/vendors',
  '/users',
];

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Permintaan pramuat dari `<Link>`, bukan perbuatan user.
 *
 * Next memuat rute di depan saat tautan masuk viewport. Kalau permintaan itu
 * ikut menyegarkan cap waktu aktivitas, halaman yang kebetulan penuh tautan
 * bisa memperpanjang sesi tanpa seorang pun menyentuh perangkat.
 */
function isPrefetch(request: NextRequest): boolean {
  return (
    request.headers.get('next-router-prefetch') === '1' ||
    request.headers.get('purpose') === 'prefetch' ||
    request.headers.get('x-purpose') === 'prefetch'
  );
}

/**
 * Alihkan sambil membawa cookie yang sudah disetel pada `source`.
 *
 * `NextResponse.redirect()` membuat response baru yang kosong — cookie hasil
 * penyegaran token Supabase (atau penghapusan sesi) akan hilang kalau tidak
 * disalin. Menyalinnya membuat token yang baru saja diperbarui tidak terbuang
 * setiap kali middleware mengalihkan permintaan.
 */
function redirectCarryingCookies(url: URL, source: NextResponse): NextResponse {
  const response = NextResponse.redirect(url);
  for (const cookie of source.cookies.getAll()) response.cookies.set(cookie);
  return response;
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
    return redirectCarryingCookies(url, supabaseResponse);
  }

  // --- Keluar otomatis saat menganggur (lib/auth/idle.ts) --------------------
  //
  // Penegakan sebenarnya ada di sini, bukan di pengawas klien: berlaku juga
  // untuk Server Action (POST-nya melewati middleware yang sama) dan tetap
  // bekerja meski JavaScript dimatikan.
  if (user) {
    const now = Date.now();
    const lastActivity = parseActivity(request.cookies.get(ACTIVITY_COOKIE)?.value);

    // Cookie tidak ada = sesi baru saja dimulai (login menyetelnya). Yang
    // ditindak hanya cap waktu yang benar-benar sudah lewat ambang.
    if (lastActivity !== null && isIdle(lastActivity, now)) {
      await supabase.auth.signOut();

      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.search = '';
      url.searchParams.set('notice', IDLE_NOTICE);

      // signOut() menuliskan cookie kosong ke supabaseResponse lewat setAll;
      // cookie itu harus ikut terbawa, kalau tidak sesi tampak masih hidup.
      const response = redirectCarryingCookies(url, supabaseResponse);
      response.cookies.delete(ACTIVITY_COOKIE);

      // Halaman publik tidak perlu dilempar ke /login — sesinya sudah dicabut,
      // pengunjungnya cukup dilanjutkan sebagai anonim.
      if (!isProtectedRoute(pathname)) {
        const cleared = NextResponse.next({ request });
        for (const cookie of supabaseResponse.cookies.getAll()) cleared.cookies.set(cookie);
        cleared.cookies.delete(ACTIVITY_COOKIE);
        return cleared;
      }

      return response;
    }

    if (!isPrefetch(request)) {
      supabaseResponse.cookies.set(ACTIVITY_COOKIE, String(now), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: ACTIVITY_COOKIE_MAX_AGE_S,
      });
    }
  }

  // Sudah login dan akses /login → redirect ke /dashboard
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return redirectCarryingCookies(url, supabaseResponse);
  }

  return supabaseResponse;
}
