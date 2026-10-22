import { AlertTriangle } from 'lucide-react';
import { getCateringOptions } from '@/features/catering/queries';
import { bookingMaxDate, bookingMinDate } from '@/features/catering/schema';
import { CateringForm } from '@/features/catering/components/catering-form';

export const metadata = {
  // Tanpa akhiran nama situs: root layout sudah menempelkannya lewat
  // `title.template` (`%s — Sukses Aqiqah`).
  title: 'Pesan Katering',
  description:
    'Pesan katering nasi kotak dan prasmanan untuk acara Anda — pengajian, rapat, syukuran.',
};

/**
 * Checkout katering.
 *
 * **Rute terpisah dari `/checkout`, bukan cabang di dalamnya.** Aqiqah dan
 * katering berbeda di bawah form, bukan hanya di atasnya: pesanan aqiqah
 * melahirkan baris `animals` dan segala yang mengalir darinya — jumlah ekor,
 * data lahir anak, tahap penyembelihan, sertifikat. Katering tidak punya satu
 * pun dari itu. Menyatukannya membuat tiap aturan jadi bersyarat di tiga lapis
 * yang wajib sepakat selamanya (layar, zod, fungsi database), dan begitu
 * ketiganya berselisih gejalanya persis yang sudah pernah terjadi di repo ini:
 * pemesan lolos seluruh isian, menekan konfirmasi, lalu ditolak database.
 *
 * `/checkout` tetap milik aqiqah, jadi tidak ada tautan lama yang putus.
 *
 * Selalu dirender ulang, dua alasan yang sama dengan checkout aqiqah: katalog &
 * harga berubah dari sisi admin, dan jendela tanggal dihitung di sini — halaman
 * yang ter-cache akan menawarkan jendela milik kemarin.
 */
export const dynamic = 'force-dynamic';

export default async function CateringCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ paket?: string }>;
}) {
  const { paket } = await searchParams;
  const { packages, provinces } = await getCateringOptions();

  // `?paket=` membawa slug dari kartu di halaman depan. Dicocokkan ke katalog
  // di sini, bukan dipercaya sebagai id: slug tak dikenal cukup diabaikan dan
  // form jatuh ke paket pertama, bukan gagal. Pola yang sama dengan checkout
  // aqiqah.
  const preselected = paket ? packages.find((p) => p.slug === paket) : undefined;

  // Setiap order butuh minimal satu paket; tanpa katalog, form tidak bisa
  // menghasilkan order yang sah.
  const unavailable = packages.length === 0;

  // Jendela tanggal dihitung di server: memanggil jam di badan komponen
  // melanggar aturan kemurnian React, dan jam peramban pemesan bisa berada di
  // zona mana saja — sementara batasnya harus WIB, sama dengan yang ditegakkan
  // `create_catering_order`.
  const minDate = bookingMinDate();
  const maxDate = bookingMaxDate();

  return (
    <div className="relative min-h-screen pb-14 sm:pb-20">
      {/* Tekstur yang sama dengan hero landing & checkout aqiqah — ketiganya
          terasa berasal dari sistem yang sama. */}
      <div
        aria-hidden
        className="bg-grid pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 [mask-image:radial-gradient(100%_80%_at_20%_0%,black,transparent_75%)]"
      />
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <header className="border-b border-neutral-200 py-10 sm:py-14">
          <p className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
            Pemesanan Mandiri
          </p>
          <h1 className="mt-4 text-[1.75rem] leading-tight font-bold tracking-tight text-neutral-900 sm:text-4xl">
            Pesan katering
          </h1>
          <p className="mt-3.5 max-w-xl text-base leading-7 text-neutral-600">
            Nasi kotak dan prasmanan untuk acara Anda. Empat langkah singkat, tanpa perlu membuat
            akun. Tim kami menghubungi Anda lewat WhatsApp untuk konfirmasi dan pembayaran.
          </p>
        </header>

        {unavailable ? (
          <div className="mt-8 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-medium">Pemesanan katering belum tersedia</p>
              <p className="mt-1 text-sm">
                Katalog paket katering belum siap. Silakan hubungi admin untuk memesan lebih dulu.
              </p>
            </div>
          </div>
        ) : (
          <CateringForm
            packages={packages}
            provinces={provinces}
            minDate={minDate}
            maxDate={maxDate}
            initialServiceId={preselected?.id}
          />
        )}
      </div>
    </div>
  );
}
