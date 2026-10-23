'use client';

import type { LucideIcon } from 'lucide-react';

/**
 * Satu baris rincian di tahap ringkasan.
 *
 * `onEdit` memunculkan tombol "Ubah" yang membawa langsung ke langkah asal
 * baris itu, jadi pemesan tidak perlu menebak langkah mana yang harus dibuka.
 */
export function SummaryRow({
  label,
  icon: Icon,
  onEdit,
  children,
}: {
  label: string;
  icon?: LucideIcon;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-5 py-3.5">
      {Icon && <Icon aria-hidden className="text-primary mt-0.5 size-5 shrink-0" />}
      <div className="min-w-0 flex-1 sm:flex sm:items-start sm:justify-between sm:gap-4">
        <dt className="text-ink-muted shrink-0 text-sm">{label}</dt>
        <dd className="text-ink mt-0.5 text-sm font-medium break-words sm:mt-0 sm:text-right">
          {children}
        </dd>
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Ubah ${label.toLowerCase()}`}
          className="text-primary -my-2 -mr-2 inline-flex min-h-11 shrink-0 items-center rounded-md px-2 text-sm font-semibold hover:underline"
        >
          Ubah
        </button>
      )}
    </div>
  );
}
