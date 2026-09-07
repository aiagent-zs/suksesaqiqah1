function Bar({ className = '' }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded ${className}`} />;
}

export default function DashboardLoading() {
  return (
    // `aria-busy` + teks khusus pembaca layar: animasi denyut sama sekali tidak
    // terbaca tanpa penglihatan, jadi keadaan "sedang memuat" harus dikatakan.
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat dashboard…</span>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Bar className="h-7 w-56" />
          <Bar className="mt-2 h-4 w-72" />
        </div>
        <Bar className="h-9 w-32" />
      </header>

      {/* Pita keuangan */}
      <section className="border-border bg-card rounded-xl border p-5 shadow-sm md:p-6">
        <div className="grid gap-5 sm:grid-cols-3 sm:gap-6">
          <div>
            <Bar className="h-4 w-28" />
            <Bar className="mt-2 h-9 w-40" />
            <Bar className="mt-2 h-3 w-20" />
          </div>
          <div>
            <Bar className="h-4 w-28" />
            <Bar className="mt-2 h-7 w-32" />
          </div>
          <div>
            <Bar className="h-4 w-20" />
            <Bar className="mt-2 h-7 w-32" />
            <Bar className="mt-2 h-3 w-28" />
          </div>
        </div>
        <Bar className="mt-5 h-1.5 w-full" />
        <div className="border-border mt-4 border-t pt-4">
          <Bar className="h-3 w-80 max-w-full" />
        </div>
      </section>

      {/* Yang menunggu */}
      <section>
        <Bar className="mb-2.5 h-4 w-28" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-border bg-card rounded-xl border p-4">
              <Bar className="h-4 w-24" />
              <Bar className="mt-2 h-7 w-12" />
              <Bar className="mt-2 h-3 w-full" />
            </div>
          ))}
        </div>
      </section>

      {/* Perlu Tindakan + Kendala Terbuka */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="border-border bg-card rounded-lg border p-5 lg:col-span-2">
          <Bar className="h-4 w-32" />
          <Bar className="mt-3 h-4 w-full" />
          <Bar className="mt-2 h-4 w-4/5" />
        </div>
        <div className="border-border bg-card rounded-lg border p-5">
          <Bar className="h-4 w-32" />
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <Bar key={i} className="h-14" />
            ))}
          </div>
        </div>
      </div>

      {/* Tabel order */}
      <section className="space-y-4">
        <Bar className="h-5 w-48" />
        <div className="border-border bg-card space-y-3 rounded-lg border p-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Bar key={i} className="h-8 w-full" />
          ))}
        </div>
      </section>
    </div>
  );
}
