import { AlertTriangle } from 'lucide-react';
import { getCheckoutOptions } from '@/features/checkout/queries';
import { CheckoutForm } from '@/features/checkout/components/checkout-form';

export const metadata = {
  // Tanpa akhiran nama situs: root layout sudah menempelkannya lewat
  // `title.template` (`%s — Sukses Aqiqah`).
  title: 'Pesan Aqiqah & Qurban',
  description:
    'Pesan paket Aqiqah dan Qurban Sukses Aqiqah secara mandiri, tanpa perlu membuat akun.',
};

/**
 * Checkout mandiri (`prd.md` FR-C2 · FR-C3 · FR-C4).
 *
 * Halaman publik: dirender untuk pengunjung anonim, jadi pilihannya hanya boleh
 * datang dari dua jalan yang memang dibuka untuk `anon` — SELECT pada
 * `services` dan RPC `get_public_branches`.
 *
 * Selalu dirender ulang. Katalog dan harga berubah dari sisi admin, dan halaman
 * yang ter-cache akan memajang harga lama — angkanya tetap tidak mengikat
 * (RPC membaca ulang dari database), tapi selisihnya membingungkan pemesan.
 */
export const dynamic = 'force-dynamic';

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ paket?: string }>;
}) {
  const { paket } = await searchParams;
  const { packages, branches } = await getCheckoutOptions();

  // `?paket=` membawa slug dari kartu paket di landing. Dicocokkan ke katalog
  // di sini, bukan dipercaya sebagai id: slug yang tidak dikenal cukup
  // diabaikan dan form jatuh ke paket pertama, bukan gagal.
  const preselected = paket ? packages.find((p) => p.slug === paket) : undefined;

  // Tanpa salah satunya, form tidak bisa menghasilkan order yang sah:
  // `orders.branch_id` NOT NULL dan setiap order butuh minimal satu paket.
  const unavailable = packages.length === 0 || branches.length === 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 md:px-6 md:py-14">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Pesan Aqiqah & Qurban</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Isi formulir di bawah untuk memesan. Tidak perlu membuat akun — tim kami akan menghubungi
          Anda lewat WhatsApp untuk konfirmasi dan pembayaran.
        </p>
      </header>

      {unavailable ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-medium">Pemesanan mandiri belum tersedia</p>
            <p className="mt-1 text-sm">
              Katalog paket atau wilayah layanan belum siap. Silakan hubungi admin untuk memesan
              lebih dulu.
            </p>
          </div>
        </div>
      ) : (
        <CheckoutForm packages={packages} branches={branches} initialServiceId={preselected?.id} />
      )}
    </div>
  );
}
