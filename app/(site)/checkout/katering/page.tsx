import { AlertTriangle } from 'lucide-react';
import { getChannel } from '@/lib/brand-server';
import { BRANDS } from '@/lib/brand';
import { CheckoutHero } from '@/features/checkout/components/checkout-hero';
import { getCateringOptions } from '@/features/catering/queries';
import { bookingMaxDate, bookingMinDate } from '@/features/catering/schema';
import { CateringForm } from '@/features/catering/components/catering-form';

export const metadata = {
  // Tanpa akhiran nama situs: root layout sudah menempelkannya lewat
  // `title.template` (`%s | <nama merek>`).
  title: 'Pesan Katering',
  description:
    'Pesan katering nasi kotak dan prasmanan untuk acara Anda: pengajian, rapat, atau syukuran.',
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
  const channel = await getChannel();
  const minDate = bookingMinDate();
  const maxDate = bookingMaxDate();

  return (
    // Latar abu-hijau, form dalam kartu putih: sama dengan checkout aqiqah.
    <div className="bg-surface-muted min-h-screen pb-10">
      <div className="container-site">
        <CheckoutHero channel={channel} title="Pesan katering">
          Nasi kotak dan prasmanan untuk acara Anda. Satu halaman, tanpa perlu membuat akun. Tim
          kami menghubungi Anda lewat WhatsApp untuk konfirmasi dan pembayaran.
        </CheckoutHero>

        {unavailable ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900">
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
            brandName={BRANDS[channel].name}
          />
        )}
      </div>
    </div>
  );
}
