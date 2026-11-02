import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { getBrand } from '@/lib/brand-server';
import { ChatWidget } from '@/components/site/chat-widget';

// ponytail: membaca cookie kanal membuat halaman publik dirender per permintaan
// (sebelumnya statis). Kalau beban Supabase terasa, cache `getLandingCatalogue`.
export default async function SiteLayout({ children }: LayoutProps<'/'>) {
  const brand = await getBrand();
  return (
    <>
      {/*
        Jaring pengaman untuk pengunjung yang mematikan JavaScript.

        `[data-reveal]` lahir dengan `opacity: 0` dan baru ditampilkan oleh
        `<Reveal>` di klien. Tanpa JavaScript, skrip itu tidak pernah jalan dan
        seluruh isi halaman akan tak terlihat — halaman kosong yang tampak
        rusak, bukan halaman tanpa animasi.

        Ditaruh di layout, bukan di `<head>` global, karena hanya halaman publik
        yang memakai pola reveal ini.
      */}
      <noscript>
        <style dangerouslySetInnerHTML={{ __html: '[data-reveal]{opacity:1 !important}' }} />
      </noscript>
      <SiteHeader brand={brand} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      {process.env.NEXT_PUBLIC_CHATBOT_ENABLED !== 'false' && <ChatWidget brandName={brand.name} />}
    </>
  );
}
