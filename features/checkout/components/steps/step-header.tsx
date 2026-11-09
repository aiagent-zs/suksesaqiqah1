'use client';

import { Check } from 'lucide-react';

/**
 * Judul satu kelompok isian di dalam bagian. Petunjuknya di bawah judul,
 * bukan rata kanan di seberangnya, karena yang rata kanan mudah terlewat.
 */
export function SectionLabel({
  id,
  htmlFor,
  index,
  done,
  title,
  hint,
}: {
  id?: string;
  htmlFor?: string;
  /** Tidak lagi ditampilkan; dipertahankan supaya pemanggil tidak berubah. */
  index?: number;
  /** Bagian ini sudah terisi: nomornya berganti centang. */
  done?: boolean;
  title: React.ReactNode;
  hint?: React.ReactNode;
}) {
  const Tag = htmlFor ? 'label' : 'p';
  // Tanpa nomor: nomor kini milik bagian (`CheckoutSection`). Nomor sub-judul
  // di dalamnya membuat "1" tampil dua kali bertumpuk. Centang tetap muncul
  // begitu terisi, sebagai tanda kecil di samping judul.
  void index;
  return (
    <div className="mb-3">
      <div className="min-w-0">
        <Tag
          id={id}
          htmlFor={htmlFor}
          className="text-ink flex items-center gap-2 text-base font-semibold"
        >
          {title}
          {done && (
            <Check aria-label="sudah diisi" className="text-primary size-4 shrink-0 stroke-[3]" />
          )}
        </Tag>
        {hint && <p className="text-ink-muted mt-0.5 text-sm">{hint}</p>}
      </div>
    </div>
  );
}
