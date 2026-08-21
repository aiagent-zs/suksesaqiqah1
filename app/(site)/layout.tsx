import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';

export default function SiteLayout({ children }: LayoutProps<'/'>) {
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
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
