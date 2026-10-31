import { updateSession } from '@/lib/supabase/middleware';
import { CHANNEL_COOKIE, CHANNEL_PARAM, parseChannel } from '@/lib/brand';
import type { NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  // Link masuk mitra (`?ch=linkaja`) menetapkan merek untuk sisa kunjungan.
  // Ditulis ke cookie permintaan juga, supaya render pertama sudah bermerek.
  const ch = request.nextUrl.searchParams.get(CHANNEL_PARAM);
  if (ch !== null) request.cookies.set(CHANNEL_COOKIE, parseChannel(ch));

  const response = await updateSession(request);

  if (ch !== null) {
    response.cookies.set(CHANNEL_COOKIE, parseChannel(ch), {
      // `none` + secure: webview mitra bisa memperlakukan halaman kita sebagai
      // konteks pihak ketiga, dan `lax` membuat cookie-nya tidak terkirim.
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return response;
}

export const config = {
  matcher: [
    /*
     * Match semua route kecuali:
     * - _next/static (aset build)
     * - _next/image (image optimization)
     * - favicon.ico
     * - file dengan ekstensi (gambar, font, dll)
     *
     * `xml|txt|webmanifest` wajib ada di daftar ekstensi: tanpa itu
     * /sitemap.xml dan /robots.txt ikut masuk middleware dan crawler
     * kehilangan keduanya.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf|xml|txt|webmanifest)$).*)',
  ],
};
