import { updateSession } from '@/lib/supabase/middleware';
import type { NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  return await updateSession(request);
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
