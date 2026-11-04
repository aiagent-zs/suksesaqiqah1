'use client';

import { Check, type LucideIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

export type WizardStep = { id: number; title: string; shortTitle: string; icon?: LucideIcon };

/**
 * Kepala wizard, dipakai checkout aqiqah dan katering.
 *
 * Satu komponen untuk dua form supaya pemesan yang pindah dari satu ke yang
 * lain tidak perlu belajar ulang cara membaca posisinya. Total ikut di sini
 * karena paket & jumlah diubah di langkah 1, jauh dari ringkasan.
 */
export function StepHeader({
  steps,
  current,
  total,
  onJump,
}: {
  steps: WizardStep[];
  current: number;
  total: number;
  /** Dipanggil saat penunjuk langkah diklik; form yang memutuskan boleh atau tidak. */
  onJump: (id: number) => void;
}) {
  return (
    // Menempel hanya mulai `sm`. Di ponsel kepala site (64px) ditambah kepala
    // ini (±125px) menyisakan kurang dari 3/4 layar untuk isian; total di
    // ponsel sudah ada di bar aksi bawah (`StepNav`).
    <div className="border-line -mx-4 border-b bg-white px-4 py-3 sm:sticky sm:top-16 sm:z-30 sm:-mx-6 sm:px-6">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-ink-muted text-sm font-medium">
          Langkah <span className="text-ink font-semibold">{current}</span> dari {steps.length}
          <span className="ml-2 hidden sm:inline">· {steps[current - 1]?.title}</span>
        </p>
        <p aria-live="polite" className="hidden text-right text-sm sm:block">
          <span className="text-ink-muted">Total </span>
          <span className="text-ink text-base font-bold tabular-nums">{formatCurrency(total)}</span>
        </p>
      </div>

      <nav aria-label="Langkah pemesanan" className="mt-2 flex gap-1">
        {steps.map((step) => {
          const isCurrent = step.id === current;
          const isPassed = step.id < current;
          return (
            <button
              key={step.id}
              type="button"
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={`Langkah ${step.id}: ${step.title}`}
              onClick={() => onJump(step.id)}
              className={cn(
                'flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-xs transition-colors duration-150 sm:flex-row sm:justify-start sm:gap-1.5 sm:px-2.5',
                isCurrent
                  ? 'text-primary bg-primary-light font-semibold'
                  : isPassed
                    ? 'text-ink hover:bg-surface-muted font-medium'
                    : 'text-ink-muted',
              )}
            >
              {isPassed ? (
                <Check aria-hidden className="text-success size-4 shrink-0 stroke-[2.5]" />
              ) : step.icon ? (
                <step.icon aria-hidden className="size-4 shrink-0" />
              ) : (
                <span className="shrink-0 tabular-nums">{step.id}.</span>
              )}
              <span className="max-w-full truncate">
                <span className="sm:hidden">{step.shortTitle}</span>
                <span className="hidden sm:inline">{step.title}</span>
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/**
 * Pembuka tiap langkah: satu pertanyaan dan satu kalimat alasannya.
 *
 * Tanpa ini pemesan yang tiba di langkah baru langsung berhadapan dengan
 * deretan kolom, dan nama langkahnya cuma tertulis kecil di kepala wizard.
 */
export function StepIntro({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-h3 text-ink font-bold tracking-tight">{title}</h2>
      {children && <p className="text-ink-muted mt-1.5 text-base leading-7">{children}</p>}
    </div>
  );
}

/**
 * Judul satu kelompok isian di dalam langkah. Petunjuknya di bawah judul,
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
  /** Nomor bagian di dalam langkah: memberi tahu urutan mengisinya. */
  index?: number;
  /** Bagian ini sudah terisi: nomornya berganti centang. */
  done?: boolean;
  title: React.ReactNode;
  hint?: React.ReactNode;
}) {
  const Tag = htmlFor ? 'label' : 'p';
  return (
    <div className="mb-4 flex items-start gap-3">
      {index !== undefined && (
        <span
          aria-hidden
          className={cn(
            'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums transition-colors duration-150',
            done ? 'bg-primary text-white' : 'bg-primary-light text-primary',
          )}
        >
          {done ? <Check className="size-4 stroke-[3]" /> : index}
        </span>
      )}
      <div className="min-w-0">
        <Tag id={id} htmlFor={htmlFor} className="text-ink block text-lg font-semibold">
          {title}
        </Tag>
        {hint && <p className="text-ink-muted mt-0.5 text-sm">{hint}</p>}
      </div>
    </div>
  );
}
