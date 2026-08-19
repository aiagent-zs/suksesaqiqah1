'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Copy, Download, FileText, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/format';
import { generateReport, markReportSent } from '@/server/actions/reports';
import type { ReportListItem } from '../queries';

/**
 * Pembuatan & pengiriman laporan peserta (docs/11).
 *
 * Tautan publiknya melekat pada order, bukan pada versi laporan — generate
 * ulang menambah versi baru tanpa mengubah tautan yang sudah dibagikan.
 */
export function ReportManager({
  orderId,
  publicToken,
  appUrl,
  reports,
  canGenerate,
  documentationReady,
  missingDocumentation,
}: {
  orderId: string;
  publicToken: string;
  appUrl: string;
  reports: ReportListItem[];
  canGenerate: boolean;
  documentationReady: boolean;
  missingDocumentation: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const publicUrl = `${appUrl.replace(/\/$/, '')}/r/${publicToken}`;
  const latest = reports[0] ?? null;

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

  const waMessage = encodeURIComponent(
    `Assalamu'alaikum. Laporan pelaksanaan aqiqah/qurban Anda sudah tersedia:\n${publicUrl}`,
  );

  return (
    <section className="border-border bg-card rounded-2xl border shadow-sm">
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-base font-semibold">Laporan Peserta</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {reports.length === 0 ? 'Belum pernah dibuat' : `${reports.length} versi tersimpan`}
          </p>
        </div>

        {canGenerate && (
          <Button
            type="button"
            size="sm"
            disabled={pending || !documentationReady}
            title={
              documentationReady
                ? undefined
                : `Butuh bukti ${missingDocumentation.join(' & ')} yang tervalidasi`
            }
            onClick={() => run(() => generateReport({ order_id: orderId }))}
          >
            <Sparkles className="size-3.5" />
            {reports.length === 0 ? 'Buat laporan' : 'Buat versi baru'}
          </Button>
        )}
      </div>

      {!documentationReady && (
        <p className="border-border bg-muted/40 text-muted-foreground border-b px-5 py-2.5 text-xs">
          Laporan baru dapat dibuat setelah ada minimal 1 bukti {missingDocumentation.join(' & ')}{' '}
          yang sudah tervalidasi.
        </p>
      )}

      {error && (
        <p className="border-destructive/20 bg-destructive/5 text-destructive flex items-start gap-2 border-b px-5 py-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {reports.length === 0 ? (
        <p className="text-muted-foreground px-5 py-10 text-center text-sm">
          Belum ada laporan pada order ini.
        </p>
      ) : (
        <>
          <div className="border-border border-b px-5 py-4">
            <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Tautan publik peserta
            </p>
            <p className="bg-muted/50 mt-1.5 rounded-lg px-3 py-2 text-xs break-all">{publicUrl}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(publicUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                <Copy className="size-3.5" />
                {copied ? 'Tersalin' : 'Salin tautan'}
              </Button>

              <a
                href={`https://wa.me/?text=${waMessage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border hover:bg-muted inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors"
              >
                <Send className="size-3.5" />
                Kirim via WhatsApp
              </a>

              {latest && !latest.sentAt && (
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => markReportSent({ report_id: latest.id }))}
                >
                  Tandai sudah dikirim
                </Button>
              )}
            </div>
            {latest?.sentAt && (
              <p className="mt-2 text-xs text-emerald-700">
                Ditandai terkirim {formatDateTime(latest.sentAt)}
              </p>
            )}
          </div>

          <ul className="divide-border divide-y">
            {reports.map((report) => (
              <li key={report.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <FileText className="text-muted-foreground size-4 shrink-0" />
                <div className="min-w-32 flex-1">
                  <p className="text-sm font-medium">Versi {report.version}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatDateTime(report.generatedAt)}
                    {report.generatedBy ? ` · ${report.generatedBy}` : ''}
                  </p>
                </div>

                {report.pdfUrl && (
                  <a
                    href={report.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary inline-flex items-center gap-1.5 text-xs hover:underline"
                  >
                    <Download className="size-3.5" />
                    Unduh PDF
                  </a>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
