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
     * - favicon.ico, sitemap.xml, robots.txt
     * - file dengan ekstensi (gambar, font, dll)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)$).*)',
  ],
};
