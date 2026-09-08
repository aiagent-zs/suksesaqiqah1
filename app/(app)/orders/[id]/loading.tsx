/**
 * Kerangka halaman detail order.
 *
 * Halaman ini menunggu delapan query Supabase sebelum apa pun tampil — detail
 * order, pembayaran, tahap, bukti, kendala, laporan, dan dua daftar pilihan.
 * Tanpa berkas ini, Next menahan seluruh navigasi sampai semuanya selesai, dan
 * peramban masih menampilkan halaman sebelumnya. Dari sisi operator tidak ada
 * bedanya antara "sedang dimuat" dan "kliknya tidak masuk" — yang kedua membuat
 * orang menekan lagi.
 *
 * Bentuknya mengikuti tata letak `page.tsx`: header, kartu langkah berikutnya,
 * dua kolom panel, dan sidebar. Kerangka yang bentuknya berbeda dari isinya
 * menghasilkan lompatan tata letak begitu data datang — persis yang dilarang
 * `design.md §1` ("hindari layout shift").
 */
function Bar({ className = '' }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded ${className}`} />;
}

function PanelSkeleton() {
  return (
    <div className="border-border bg-card rounded-lg border p-5 shadow-sm">
      <Bar className="h-5 w-40" />
      <Bar className="mt-2 h-3 w-64 max-w-full" />
    </div>
  );
}

export default function OrderDetailLoading() {
  return (
    // `aria-busy` + teks khusus pembaca layar: animasi denyut sama sekali tidak
    // terbaca tanpa penglihatan, jadi keadaan "sedang memuat" harus dikatakan.
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat detail order…</span>

      <Bar className="h-4 w-40" />

      {/* Header: nomor order + stepper */}
      <div className="border-border bg-card rounded-lg border p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Bar className="h-7 w-48" />
            <Bar className="mt-2 h-3 w-56" />
          </div>
          <div className="flex gap-2">
            <Bar className="h-6 w-20 rounded-full" />
            <Bar className="h-6 w-24 rounded-full" />
          </div>
        </div>
        <Bar className="mt-5 h-8 w-full" />
      </div>

      {/* Kartu "Langkah berikutnya" */}
      <div className="border-border bg-card rounded-lg border p-5 shadow-sm">
        <Bar className="h-3 w-32" />
        <Bar className="mt-2 h-6 w-80 max-w-full" />
        <Bar className="mt-3 h-3 w-48" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <PanelSkeleton key={i} />
          ))}
        </div>

        <div className="space-y-6">
          <div className="border-border bg-card rounded-lg border p-5 shadow-sm">
            <Bar className="h-5 w-28" />
            <Bar className="mt-3 h-9 w-full" />
          </div>
          <div className="border-border bg-card rounded-lg border p-5 shadow-sm">
            <Bar className="h-5 w-28" />
            <div className="mt-4 space-y-3">
              {[0, 1, 2].map((i) => (
                <Bar key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
