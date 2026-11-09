import { AlertTriangle } from 'lucide-react';
import { getChannel } from '@/lib/brand-server';
import { BRANDS } from '@/lib/brand';
import { CheckoutHero } from '@/features/checkout/components/checkout-hero';
import { getCheckoutOptions } from '@/features/checkout/queries';
import { bookingMaxDate, bookingMinDate } from '@/features/checkout/schema';
import { todayWib } from '@/lib/format/date-range';
import { CheckoutForm } from '@/features/checkout/components/checkout-form';

export const metadata = {
  // Tanpa akhiran nama situs: root layout sudah menempelkannya lewat
  // `title.template` (`%s | <nama merek>`).
  title: 'Pesan Aqiqah',
  description: 'Pesan paket aqiqah secara mandiri, tanpa perlu membuat akun.',
};

/**
 * Checkout mandiri (`prd.md` FR-C2 · FR-C3 · FR-C4).
 *
 * Halaman publik: dirender untuk pengunjung anonim, jadi pilihannya hanya boleh
 * datang dari jalan yang memang dibuka untuk `anon` — SELECT pada `services`.
 *
 * Selalu dirender ulang. Dua alasan sekarang: katalog dan harga berubah dari
 * sisi admin, dan halaman yang ter-cache akan memajang harga lama (angkanya
 * tetap tidak mengikat — RPC membaca ulang dari database — tapi selisihnya
 * membingungkan pemesan); dan sejak pemesan memilih tanggal, jendela
 * `BOOKING_MIN_DAYS … BOOKING_MAX_DAYS` ikut dihitung di sini, jadi halaman yang
 * ter-cache akan menawarkan jendela tanggal milik kemarin.
 */
export const dynamic = 'force-dynamic';

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ paket?: string }>;
}) {
  const { paket } = await searchParams;
  const { packages, nasiBoxes, provinces } = await getCheckoutOptions();

  // `?paket=` membawa slug dari kartu paket di landing. Dicocokkan ke katalog
  // di sini, bukan dipercaya sebagai id: slug yang tidak dikenal cukup
  // diabaikan dan form jatuh ke paket pertama, bukan gagal.
  const preselected = paket ? packages.find((p) => p.slug === paket) : undefined;

  // Setiap order butuh minimal satu paket; tanpa katalog, form tidak bisa
  // menghasilkan order yang sah.
  const unavailable = packages.length === 0;

  // Jendela tanggal dihitung di server, bukan di komponen: memanggil jam di
  // badan komponen melanggar aturan kemurnian React, dan jam peramban pemesan
  // bisa berada di zona waktu mana saja — sementara batasnya harus WIB, sama
  // dengan yang ditegakkan `create_guest_order`.
  const channel = await getChannel();
  const minDate = bookingMinDate();
  const maxDate = bookingMaxDate();
  // Hari ini, terpisah dari batas bawah pemesanan: sejak ada jeda persiapan
  // `minDate` tidak lagi bernilai hari ini, sementara batas atas tanggal lahir
  // anak tetap hari ini.
  const today = todayWib();

  return (
    // Latar abu-hijau, form dalam kartu putih: tiap bagian terpisah jelas
    // dari latarnya. Versi putih polos membuat isian mengalir tanpa batas.
    <div className="bg-surface-muted min-h-screen pb-10">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:max-w-6xl">
        <CheckoutHero channel={channel} title="Pesan aqiqah">
          Satu halaman, tanpa perlu membuat akun. Tim kami menghubungi Anda lewat WhatsApp untuk
          konfirmasi dan pembayaran.
        </CheckoutHero>

        {unavailable ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-medium">Pemesanan mandiri belum tersedia</p>
              <p className="mt-1 text-sm">
                Katalog paket belum siap. Silakan hubungi admin untuk memesan lebih dulu.
              </p>
            </div>
          </div>
        ) : (
          <CheckoutForm
            packages={packages}
            nasiBoxes={nasiBoxes}
            provinces={provinces}
            minDate={minDate}
            maxDate={maxDate}
            today={today}
            initialServiceId={preselected?.id}
            brandName={BRANDS[channel].name}
          />
        )}
      </div>
    </div>
  );
}
