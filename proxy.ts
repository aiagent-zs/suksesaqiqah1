import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import {
  CHANNEL_HEADER,
  CHANNEL_PARAM,
  channelFromPath,
  channelHref,
  parseChannel,
} from '@/lib/brand';

/** Halaman publik yang punya kembaran di `/aqiqahaja`. */
const CHANNEL_PAGES = ['/', '/paket', '/checkout', '/checkout/katering', '/lacak'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Link masuk lama `?ch=linkaja` (sebelum ada area `/aqiqahaja`): dialihkan ke
  // kembarannya supaya link yang sudah terpasang di mini app tetap bekerja.
  const ch = request.nextUrl.searchParams.get(CHANNEL_PARAM);
  if (ch !== null) {
    const url = request.nextUrl.clone();
    url.searchParams.delete(CHANNEL_PARAM);
    if (parseChannel(ch) === 'linkaja' && channelFromPath(pathname) === 'web') {
      url.pathname = channelHref('linkaja', CHANNEL_PAGES.includes(pathname) ? pathname : '/');
    }
    const response = NextResponse.redirect(url);
    // Cookie kanal versi lama tidak dibaca lagi; dibuang supaya tidak menetap.
    response.cookies.delete('channel');
    return response;
  }

  // Ditimpa selalu: nilai `x-channel` kiriman klien tidak boleh menentukan merek
  // maupun `orders.channel`.
  request.headers.set(CHANNEL_HEADER, channelFromPath(pathname));
  return updateSession(request);
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
