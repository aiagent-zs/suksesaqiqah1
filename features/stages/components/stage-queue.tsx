'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DocStatusBadge } from '@/components/data/status-badge';
import { DocPreview } from '@/features/documentation/components/doc-preview';
import { formatDateTime, formatRelative } from '@/lib/format';
import { reviewStage } from '@/server/actions/stages';
import { STAGE_META } from '../sequence';
import type { StageQueueItem } from '../queries';

/**
 * Antrean laporan tahap yang menunggu keputusan admin — **beserta buktinya**.
 *
 * Menggantikan antrean per-foto lintas order. Di sana admin menyetujui sebuah
 * foto tanpa melihat laporan yang dibuktikannya, lalu memvalidasi laporannya
 * di halaman lain tanpa melihat fotonya. Dua keputusan terpisah untuk satu
 * pekerjaan, dan tidak satu pun dari keduanya punya konteks yang utuh.
 *
 * Satu kartu = satu laporan tahap. Memvalidasi tahapnya sekaligus menyetujui
 * bukti yang menyertainya (`reviewStage` yang mengerjakannya), jadi yang
 * ditekan admin cuma satu tombol.
 */
export function StageQueue({
  items,
  currentUserId,
}: {
  items: StageQueueItem[];
  /** Pelapor tidak boleh memvalidasi laporannya sendiri (docs/10 §4). */
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  function run(fn: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error?.message ?? 'Terjadi kesalahan.');
        return;
      }
      setRejectId(null);
      setRejectNote('');
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
          const meta = STAGE_META[item.stage];
          // Ditegakkan juga trigger `enforce_stage_review`; di sini supaya
          // tombolnya tidak menawarkan sesuatu yang pasti ditolak.
          const isOwnReport = item.reportedBy === currentUserId;

          return (
            <li key={item.id} className="border-border bg-card rounded-lg border p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{meta.label}</span>
                    {/* Tag hewan ikut di antrean: `sembelih` terbit satu baris
                        per ekor, jadi dua laporan dari satu order bisa terbaca
                        identik tanpa pembeda ini. */}
                    {item.animalTag && (
                      <Badge className="border-slate-200 bg-slate-100 text-slate-700 tabular-nums">
                        {item.animalTag}
                      </Badge>
                    )}
                    <Link
                      href={`/orders/${item.orderId}#tahap`}
                      className="text-primary text-sm font-medium tabular-nums hover:underline"
                    >
                      {item.orderNumber}
                    </Link>
                  </div>

                  <p className="text-muted-foreground mt-1 text-xs">
                    {item.vendorName ?? 'Mitra belum ditetapkan'}
                    {item.reporterName ? ` · dilaporkan ${item.reporterName}` : ''}
                    {item.reportedAt ? ` · ${formatRelative(item.reportedAt)}` : ''}
                  </p>
                </div>
              </div>

              {/* Isi laporannya — inilah yang sedang dinilai. */}
              <dl className="text-muted-foreground mt-3 space-y-0.5 text-xs">
                {item.occurredAt && <div>Dilaksanakan {formatDateTime(item.occurredAt)}</div>}
                {item.packagesCount !== null && <div>{item.packagesCount} paket</div>}
                {item.recipientName && <div>Penerima: {item.recipientName}</div>}
                {item.recipientArea && <div>Area: {item.recipientArea}</div>}
                {item.weightKg !== null && <div>Bobot: {item.weightKg} kg</div>}
                {item.notes && <div className="whitespace-pre-wrap">{item.notes}</div>}
              </dl>

              {/* Bukti yang menyertainya. Kosong pun tetap ditampilkan
                  keterangannya: tahap yang menuntut bukti tapi tidak
                  menyertakannya adalah alasan yang sah untuk menolak. */}
              <div className="border-border mt-3 border-t pt-3">
                {item.docs.length === 0 ? (
                  <p className="text-muted-foreground text-xs">Tanpa bukti terlampir.</p>
                ) : (
                  <ul className="flex flex-wrap gap-3">
                    {item.docs.map((doc) => (
                      <li key={doc.id} className="flex items-start gap-2">
                        <DocPreview doc={doc} />
                        <div className="max-w-40 min-w-0">
                          <DocStatusBadge status={doc.status} />
                          {doc.caption && (
                            <p className="text-muted-foreground mt-1 text-xs">{doc.caption}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {isOwnReport ? (
                <p className="text-muted-foreground border-border mt-3 border-t pt-3 text-xs">
                  Anda yang melaporkan tahap ini — validasinya menunggu admin lain.
                </p>
              ) : (
                <div className="border-border mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      run(() => reviewStage({ stage_event_id: item.id, decision: 'validate' }))
                    }
                  >
                    <Check className="size-3.5" />
                    Validasi
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => {
                      setRejectId(rejectId === item.id ? null : item.id);
                      setRejectNote('');
                    }}
                  >
                    <X className="size-3.5" />
                    Tolak
                  </Button>
                </div>
              )}

              {rejectId === item.id && (
                <div className="border-border bg-muted/30 mt-3 rounded-xl border p-3">
                  <Label htmlFor={`stage-reject-${item.id}`}>Alasan penolakan</Label>
                  <Textarea
                    id={`stage-reject-${item.id}`}
                    rows={2}
                    value={rejectNote}
                    placeholder="Mis. foto tidak menunjukkan proses penyembelihan"
                    onChange={(e) => setRejectNote(e.target.value)}
                    className="bg-card mt-1.5"
                  />
                  <p className="text-muted-foreground mt-1 text-xs">
                    Alasan dikirim ke mitra agar tahapnya bisa dilaporkan ulang.
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={pending || !rejectNote.trim()}
                      onClick={() =>
                        run(() =>
                          reviewStage({
                            stage_event_id: item.id,
                            decision: 'reject',
                            review_note: rejectNote,
                          }),
                        )
                      }
                    >
                      Kirim penolakan
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => setRejectId(null)}
                    >
                      Batal
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
