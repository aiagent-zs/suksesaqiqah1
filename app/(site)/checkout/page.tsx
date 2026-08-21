import { AlertTriangle } from 'lucide-react';
import { getCheckoutOptions } from '@/features/checkout/queries';
import { bookingMaxDate, bookingMinDate } from '@/features/checkout/schema';
import { CheckoutForm } from '@/features/checkout/components/checkout-form';

export const metadata = {
  // Tanpa akhiran nama situs: root layout sudah menempelkannya lewat
  // `title.template` (`%s — Sukses Aqiqah`).
  title: 'Pesan Aqiqah',
  description:
    'Pesan paket Aqiqah Sukses Aqiqah secara mandiri, tanpa perlu membuat akun.',
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
 * membingungkan pemesan); dan sejak pemesan memilih tanggal, batas
 * "hari ini … 7 hari ke depan" ikut dihitung di sini, jadi halaman yang
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
  const minDate = bookingMinDate();
  const maxDate = bookingMaxDate();

  return (
    // Latar putih polos, sejalan dengan landing. Versi sebelumnya memakai latar
    // abu agar kartu form tampak "melayang" — sekarang formnya sendiri sudah
    // datar dan bergaris rambut, jadi tidak ada yang perlu diangkat.
    <div className="min-h-screen pb-14 sm:pb-20">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <header className="border-b border-neutral-200 py-10 sm:py-14">
          <p className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
            Pemesanan Mandiri
          </p>
          <h1 className="mt-4 text-[1.75rem] leading-tight font-bold tracking-tight text-neutral-900 sm:text-4xl">
            Pesan aqiqah
          </h1>
          <p className="mt-3.5 max-w-xl text-base leading-7 text-neutral-600">
            Empat langkah singkat, tanpa perlu membuat akun. Tim kami menghubungi Anda lewat
            WhatsApp untuk konfirmasi dan pembayaran.
          </p>
        </header>

        {unavailable ? (
          <div className="mt-8 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900">
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
            initialServiceId={preselected?.id}
          />
        )}
      </div>
    </div>
  );
}
