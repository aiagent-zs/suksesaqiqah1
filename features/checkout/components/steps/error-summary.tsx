'use client';

import { AlertCircle } from 'lucide-react';

/**
 * Ringkasan seluruh medan yang ditolak, menetap di atas form.
 *
 * Pesan per medan hanya menolong kalau medannya kebetulan terlihat. Form ini
 * panjang: menekan "Lanjut" di bawah layar bisa menolak sesuatu jauh di atas,
 * dan yang tertangkap pemesan cuma "tombolnya tidak berfungsi". Tiap baris bisa
 * diklik dan membawa ke medannya; daftar yang tidak bisa diklik hanya
 * memindahkan pekerjaan mencari ke pemesan.
 */
export function ErrorSummary({
  errors,
  labels,
  onJump,
}: {
  errors: Record<string, string>;
  labels: Record<string, string>;
  onJump: (field: string) => void;
}) {
  const entries = Object.entries(errors).filter(([, message]) => Boolean(message));
  if (entries.length === 0) return null;

  return (
    <div
      role="alert"
      className="animate-in fade-in slide-in-from-top-2 mt-4 rounded-lg border border-red-200 bg-red-50 p-4 duration-300"
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-red-900">
            {entries.length === 1
              ? '1 isian perlu diperbaiki'
              : `${entries.length} isian perlu diperbaiki`}
          </p>
          <ul className="mt-2 space-y-1">
            {entries.map(([field, message]) => (
              <li key={field}>
                <button
                  type="button"
                  onClick={() => onJump(field)}
                  className="flex min-h-11 w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm leading-5 text-red-800 transition-colors hover:bg-red-100 sm:min-h-0"
                >
                  <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-red-400" />
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{labels[field] ?? field}</span>
                    <span className="text-red-700">: {message}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
