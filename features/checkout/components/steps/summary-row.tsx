'use client';

/** Satu baris rincian di tahap ringkasan. */
export function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3">
      <dt className="shrink-0 text-xs font-medium text-neutral-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-neutral-900">{children}</dd>
    </div>
  );
}
