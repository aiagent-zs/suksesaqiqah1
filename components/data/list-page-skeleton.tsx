/**
 * Kerangka halaman berisi daftar: header → filter → baris → paginasi.
 *
 * Dipakai bersama oleh `/orders`, `/schedule`, `/validation`, `/vendors`, dan
 * `/users` — kelimanya mengikuti pola halaman list yang sama (`design.md §7`),
 * jadi kerangkanya juga satu. Menyalinnya lima kali berarti lima berkas yang
 * harus dijaga tetap mirip dengan tata letak yang mereka tiru.
 *
 * Kenapa perlu sama sekali: tanpa `loading.tsx`, Next menahan navigasi sampai
 * seluruh query halaman selesai, dan peramban masih menampilkan halaman
 * sebelumnya. Operator tidak bisa membedakan "sedang dimuat" dari "kliknya
 * tidak masuk".
 */
function Bar({ className = '' }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded ${className}`} />;
}

export function ListPageSkeleton({
  /** Nama halaman untuk pembaca layar — denyut visual tidak terbaca tanpanya. */
  label,
  rows = 5,
  /** Halaman tanpa baris penyaring (mis. `/users`) melewatkan bloknya. */
  withFilters = true,
}: {
  label: string;
  rows?: number;
  withFilters?: boolean;
}) {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat {label}…</span>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Bar className="h-7 w-40" />
          <Bar className="mt-2 h-3 w-64 max-w-full" />
        </div>
        <Bar className="h-9 w-32" />
      </header>

      {withFilters && (
        <div className="border-border bg-card rounded-lg border p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Bar key={i} className="h-9 w-full" />
            ))}
          </div>
        </div>
      )}

      <div className="border-border bg-card divide-border divide-y rounded-lg border shadow-sm">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-3 px-5 py-4">
            <div className="min-w-0 flex-1">
              <Bar className="h-4 w-48 max-w-full" />
              <Bar className="mt-2 h-3 w-32" />
            </div>
            <Bar className="h-6 w-24 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
