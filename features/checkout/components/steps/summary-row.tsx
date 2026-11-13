'use client';

import { formatCurrency } from '@/lib/format';

/**
 * Satu kelompok di ringkasan, sejajar dengan satu bagian form.
 *
 * Satu tombol "Ubah" per kelompok, bukan per baris: dulu tujuh tombol "Ubah"
 * berjejer di kanan, tiga di antaranya menuju bagian yang sama, dan kolom
 * tombol itu memakan lebar yang dibutuhkan alamat di 375px.
 */
export function SummarySection({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="border-line border-t px-4 first:border-t-0 sm:px-5">
      <div className="flex items-center justify-between gap-4 pt-2">
        <h3 className="text-ink text-sm font-bold">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Ubah ${title.toLowerCase()}`}
          className="text-primary -mr-2 inline-flex min-h-11 items-center rounded-md px-2 text-sm font-semibold underline-offset-2 hover:underline"
        >
          Ubah
        </button>
      </div>
      <dl className="divide-line divide-y">{children}</dl>
    </section>
  );
}

/**
 * Satu baris rincian: label kecil di atas, isinya di bawah, dan nominal rata
 * kanan bila baris itu berharga. Garis antar-baris dari `divide-y` di
 * `SummarySection`, rujukan ke kertas bergaris (`design.md` §0, motif).
 */
export function SummaryRow({
  label,
  amount,
  children,
}: {
  label: string;
  amount?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="py-3">
      <dt className="text-ink-muted text-xs">{label}</dt>
      <dd className="mt-0.5 flex items-baseline justify-between gap-4 text-sm">
        <span className="text-ink min-w-0 font-medium wrap-break-word">{children}</span>
        {amount !== undefined && (
          <span className="text-ink shrink-0 font-semibold tabular-nums">
            {formatCurrency(amount)}
          </span>
        )}
      </dd>
    </div>
  );
}
