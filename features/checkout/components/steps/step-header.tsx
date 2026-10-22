'use client';

import { Check } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

export type WizardStep = { id: number; title: string; shortTitle: string };

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
    <div className="sticky top-16 z-30 -mx-4 border-b border-neutral-200 bg-white/95 px-4 py-3.5 backdrop-blur-sm sm:-mx-6 sm:px-6">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium text-neutral-500">
          Langkah <span className="font-semibold text-neutral-900">{current}</span> dari{' '}
          {steps.length}
          <span className="ml-2 hidden text-neutral-500 sm:inline">
            · {steps[current - 1]?.title}
          </span>
        </p>
        <p aria-live="polite" className="text-right text-sm">
          <span className="text-neutral-500">Total </span>
          <span className="font-bold text-neutral-900 tabular-nums">{formatCurrency(total)}</span>
        </p>
      </div>

      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-neutral-200">
        <div
          className="bg-primary h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${(current / steps.length) * 100}%` }}
        />
      </div>

      <nav aria-label="Langkah pemesanan" className="mt-3 flex gap-1">
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
                'flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-1.5 text-xs transition-colors sm:justify-start sm:px-2.5',
                isCurrent
                  ? 'text-primary bg-primary/8 font-semibold'
                  : isPassed
                    ? 'font-medium text-neutral-700 hover:bg-neutral-100'
                    : 'text-neutral-500',
              )}
            >
              {isPassed ? (
                <Check className="size-3.5 shrink-0 stroke-[2.5]" />
              ) : (
                <span className="shrink-0 tabular-nums">{step.id}.</span>
              )}
              <span className="truncate">
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
      <h2 className="text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl">{title}</h2>
      {children && <p className="mt-1.5 text-sm leading-6 text-neutral-600">{children}</p>}
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
  title,
  hint,
}: {
  id?: string;
  htmlFor?: string;
  title: React.ReactNode;
  hint?: React.ReactNode;
}) {
  const Tag = htmlFor ? 'label' : 'p';
  return (
    <div className="mb-3">
      <Tag id={id} htmlFor={htmlFor} className="block text-base font-semibold text-neutral-900">
        {title}
      </Tag>
      {hint && <p className="mt-0.5 text-sm text-neutral-500">{hint}</p>}
    </div>
  );
}
