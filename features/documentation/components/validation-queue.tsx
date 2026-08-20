'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { DocStatusBadge } from '@/components/data/status-badge';
import { formatDateTime, formatRelative } from '@/lib/format';
import { DOC_STAGE_LABEL, DOC_TYPE_LABEL } from '@/lib/constants/order';
import type { ValidationQueueItem } from '../queries';
import { DocPreview } from './doc-preview';
import { DocReviewActions } from './doc-review-actions';

/**
 * Antrian validasi lintas order (docs/10 section 6, docs/09 section 4b).
 * Urutan tertua lebih dulu — ditentukan di query, bukan di sini.
 */
export function ValidationQueue({
  items,
  currentUserId,
}: {
  items: ValidationQueueItem[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error?.message ?? 'Terjadi kesalahan.');
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="border-destructive/20 bg-destructive/5 text-destructive flex items-start gap-2 rounded-xl border px-4 py-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      <ul className="space-y-3">
        {items.map((item) => {
          // Pemisahan tugas (docs/10 section 4) — server memeriksa ulang.
          const isOwnUpload = item.uploaderId === currentUserId;

          return (
            <li key={item.id} className="border-border bg-card rounded-2xl border p-4 shadow-sm">
              <div className="flex gap-4">
                <DocPreview doc={item} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/orders/${item.orderId}`}
                        className="text-primary font-medium tabular-nums hover:underline"
                      >
                        {item.orderNumber}
                      </Link>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {item.participantName}
                      </p>
                    </div>
                    <DocStatusBadge status={item.status} />
                  </div>

                  <p className="mt-2 text-sm">
                    {DOC_STAGE_LABEL[item.stage]}
                    <span className="text-muted-foreground">
                      {' · '}
                      {DOC_TYPE_LABEL[item.type]}
                      {item.animalTag ? ` · ${item.animalTag}` : ''}
                    </span>
                  </p>

                  {item.caption && (
                    <p className="text-muted-foreground mt-1 text-sm">{item.caption}</p>
                  )}

                  <p className="text-muted-foreground mt-1 text-xs">
                    Diunggah {formatRelative(item.createdAt)}
                    {item.uploaderName ? ` oleh ${item.uploaderName}` : ''} ·{' '}
                    {formatDateTime(item.createdAt)}
                  </p>

                  {isOwnUpload ? (
                    <p className="border-border text-muted-foreground mt-3 border-t pt-3 text-xs">
                      Anda mengunggah berkas ini, jadi tidak dapat memvalidasinya sendiri. Minta
                      validator lain menanganinya.
                    </p>
                  ) : (
                    <DocReviewActions documentationId={item.id} disabled={pending} onRun={run} />
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
