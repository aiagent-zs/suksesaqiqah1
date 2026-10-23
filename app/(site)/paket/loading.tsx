/** Kerangka katalog: bentuknya sama dengan kartu sungguhan supaya tidak ada lompatan tata letak. */
export default function PackagesLoading() {
  return (
    <section className="bg-surface-muted border-line border-b" aria-busy="true">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="sr-only" role="status">
          Memuat daftar paket…
        </p>
        <div className="bg-line h-10 w-64 max-w-full animate-pulse rounded" />
        <div className="bg-line mt-4 h-5 w-full max-w-xl animate-pulse rounded" />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="border-line overflow-hidden rounded-lg border bg-white">
              <div className="bg-line aspect-[3/2] animate-pulse" />
              <div className="space-y-3 p-6">
                <div className="bg-line h-5 w-1/2 animate-pulse rounded" />
                <div className="bg-line h-8 w-2/3 animate-pulse rounded" />
                <div className="bg-line h-11 w-full animate-pulse rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
