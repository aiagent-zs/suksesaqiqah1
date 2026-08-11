'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, AlertTriangle, Pencil, Plus, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IssueSeverityBadge, IssueStatusBadge } from '@/components/data/status-badge';
import { ISSUE_SEVERITY_META, ISSUE_STATUS_ORDER, type IssueStatus } from '@/lib/constants/order';
import { formatDateTime } from '@/lib/format';
import { updateIssueStatusAction } from '@/server/actions/issues';
import { IssueDialog } from './issue-dialog';
import type { IssueSummary } from '../queries';

/**
 * Label tombol perpindahan status — kalimat perintah, bukan nama status.
 * "Selesai" sebagai tombol terbaca seperti keterangan; "Tandai selesai" jelas
 * sebuah aksi.
 */
const ISSUE_STATUS_ACTION: Record<IssueStatus, string> = {
  open: 'Buka kembali',
  in_progress: 'Tandai ditangani',
  resolved: 'Tandai selesai',
};

/**
 * Panel riwayat kendala satu order (`prd.md` FR-SL4).
 *
 * Inilah satu-satunya jalur pembuatan kendala di UI. Sebelum panel ini ada,
 * "Kendala Terbuka" di dashboard selalu kosong: view-nya membaca tabel `issues`
 * yang tidak pernah terisi dari aplikasi.
 *
 * Panel memegang perpindahan status, dialog memegang isi teks. Pembagian itu
 * mengikuti pembagian di server: hanya jalur status yang boleh menulis
 * `resolved_by` / `resolved_at`.
 *
 * Tidak ada tombol hapus — tabelnya memang tanpa kebijakan RLS `delete`; salah
 * catat dikoreksi lewat Ubah, kendala yang beres ditutup lewat Tandai selesai.
 */
export function IssueListPanel({
  orderId,
  summary,
  canManage,
}: {
  orderId: string;
  summary: IssueSummary;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function moveStatus(id: string, status: IssueStatus) {
    setError(null);
    startTransition(async () => {
      const result = await updateIssueStatusAction({ id, status });
      if (!result.ok) {
        setError(result.error?.message ?? 'Terjadi kesalahan.');
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="border-border bg-card rounded-2xl border shadow-sm">
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <AlertTriangle className="text-muted-foreground size-4" />
            Kendala
          </h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {summary.openCount > 0 ? (
              <>
                {summary.openCount} kendala terbuka
                {summary.maxOpenSeverity
                  ? ` · terberat ${ISSUE_SEVERITY_META[summary.maxOpenSeverity].label.toLowerCase()}`
                  : ''}
              </>
            ) : (
              `Tidak ada kendala terbuka · ${summary.rows.length} tercatat`
            )}
          </p>
        </div>

        {canManage && (
          <IssueDialog
            orderId={orderId}
            trigger={
              <Button type="button" variant="outline" size="sm">
                <Plus className="size-3.5" />
                Laporkan kendala
              </Button>
            }
          />
        )}
      </div>

      {error && (
        <p className="border-destructive/20 bg-destructive/5 text-destructive flex items-start gap-2 border-b px-5 py-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {summary.rows.length === 0 ? (
        <p className="text-muted-foreground flex items-center justify-center gap-2 px-5 py-10 text-center text-sm">
          <ShieldCheck className="text-primary size-4" />
          Belum ada kendala tercatat pada order ini.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {summary.rows.map((row) => (
            <li key={row.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-40 flex-1 font-medium">{row.title}</p>
                <div className="flex shrink-0 items-center gap-2">
                  <IssueSeverityBadge severity={row.severity} />
                  <IssueStatusBadge status={row.status} />
                </div>
              </div>

              {row.description && (
                <p className="text-muted-foreground mt-1.5 text-sm whitespace-pre-wrap">
                  {row.description}
                </p>
              )}

              <p className="text-muted-foreground mt-1.5 text-xs">
                Dilaporkan {formatDateTime(row.createdAt)}
                {row.reporterName ? ` oleh ${row.reporterName}` : ''}
                {row.resolvedAt
                  ? ` · Selesai ${formatDateTime(row.resolvedAt)}${
                      row.resolverName ? ` oleh ${row.resolverName}` : ''
                    }`
                  : ''}
              </p>

              {canManage && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {/* Hanya status selain yang sekarang yang ditawarkan —
                      menulis ulang status yang sama ditolak server karena akan
                      menggeser waktu penyelesaian yang sudah tercatat. */}
                  {ISSUE_STATUS_ORDER.filter((status) => status !== row.status).map((status) => (
                    <Button
                      key={status}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => moveStatus(row.id, status)}
                    >
                      {ISSUE_STATUS_ACTION[status]}
                    </Button>
                  ))}

                  <IssueDialog
                    orderId={orderId}
                    issue={row}
                    trigger={
                      <Button type="button" variant="outline" size="sm">
                        <Pencil className="size-3.5" />
                        Ubah
                      </Button>
                    }
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
