'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';
import { reportStage, reviewStage } from '@/server/actions/stages';
import { STAGE_META, STAGE_EVENT_STATUS_META, canReportStage } from '../sequence';
import type { StageEventRow } from '../queries';

/**
 * Daftar kerja mitra untuk satu order.
 *
 * Tahapnya sudah terbit saat mitra ditugaskan, jadi panel ini menampilkan
 * **daftar yang menunggu diisi**, bukan formulir kosong. Urutan ditegakkan
 * database: tahap berikutnya baru terbuka setelah tahap sebelumnya tervalidasi
 * admin. `canReportStage` di sini hanya menonaktifkan tombolnya lebih dulu
 * supaya vendor tidak menekan sesuatu yang pasti ditolak.
 */
export function StagePanel({
  stages,
  canReport,
  canValidate,
  deliveryAddress,
}: {
  stages: StageEventRow[];
  canReport: boolean;
  canValidate: boolean;
  /** Alamat tujuan order — ditampilkan pada tahap kirim, tidak diketik ulang vendor. */
  deliveryAddress: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [draft, setDraft] = useState({
    occurred_at: '',
    notes: '',
    packages_count: '',
    recipient_name: '',
    recipient_phone: '',
    recipient_area: '',
    weight_kg: '',
    lat: '',
    lng: '',
  });

  function run(fn: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error?.message ?? 'Terjadi kesalahan.');
        return;
      }
      setOpenId(null);
      setRejectId(null);
      setRejectNote('');
      router.refresh();
    });
  }

  function openForm(row: StageEventRow) {
    setOpenId(row.id);
    setError(null);
    setDraft({
      // Prasetel waktu sekarang: yang dilaporkan hampir selalu baru terjadi.
      occurred_at: new Date().toISOString().slice(0, 16),
      notes: row.notes ?? '',
      packages_count: row.packagesCount?.toString() ?? '',
      recipient_name: row.recipientName ?? '',
      recipient_phone: row.recipientPhone ?? '',
      recipient_area: row.recipientArea ?? '',
      weight_kg: row.weightKg?.toString() ?? '',
      lat: row.lat?.toString() ?? '',
      lng: row.lng?.toString() ?? '',
    });
  }

  if (stages.length === 0) {
    return (
      <section className="border-border bg-card rounded-lg border p-5 shadow-sm">
        <h2 className="text-base font-semibold">Tahap Pelaksanaan</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Daftar tahap terbit otomatis setelah mitra pelaksana ditetapkan.
        </p>
      </section>
    );
  }

  return (
    <section className="border-border bg-card rounded-lg border shadow-sm">
      <div className="border-border border-b px-5 py-4">
        <h2 className="text-base font-semibold">Tahap Pelaksanaan</h2>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Tiap tahap dilaporkan mitra, lalu divalidasi admin sebelum tahap berikutnya terbuka.
        </p>
      </div>

      {error && (
        <p className="border-destructive/20 bg-destructive/5 text-destructive flex items-start gap-2 border-b px-5 py-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      <ol className="divide-border divide-y">
        {stages.map((row) => {
          const meta = STAGE_META[row.stage];
          const statusMeta = STAGE_EVENT_STATUS_META[row.status];
          const unlocked = canReportStage(stages, row.seq);
          const editable = canReport && row.status !== 'validated' && unlocked;

          return (
            <li key={row.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{meta.label}</span>
                    {row.animalTag && (
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {row.animalTag}
                      </span>
                    )}
                    <Badge className={statusMeta.className}>{statusMeta.label}</Badge>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">{meta.hint}</p>

                  {/* Pada tahap kirim, alamat dibaca dari order — vendor tidak
                      mengetik ulang alamat pembeli, karena alamat yang diketik
                      ulang bisa berbeda dari yang dipesan. */}
                  {(row.stage === 'kirim' || row.stage === 'terkirim') && deliveryAddress && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-700">
                      <MapPin className="mt-0.5 size-3.5 shrink-0" />
                      {deliveryAddress}
                    </p>
                  )}

                  {row.status !== 'pending' && (
                    <dl className="text-muted-foreground mt-2 space-y-0.5 text-xs">
                      {row.occurredAt && (
                        <div>Dilaksanakan {formatDateTime(row.occurredAt)}</div>
                      )}
                      {row.reporterName && <div>Dilaporkan {row.reporterName}</div>}
                      {row.packagesCount !== null && <div>{row.packagesCount} paket</div>}
                      {row.recipientName && <div>Penerima: {row.recipientName}</div>}
                      {row.recipientArea && <div>Area: {row.recipientArea}</div>}
                      {row.weightKg !== null && <div>Bobot: {row.weightKg} kg</div>}
                      {row.notes && <div className="whitespace-pre-wrap">{row.notes}</div>}
                      {row.validatorName && row.validatedAt && (
                        <div>
                          Divalidasi {row.validatorName} · {formatDateTime(row.validatedAt)}
                        </div>
                      )}
                    </dl>
                  )}

                  {row.status === 'rejected' && row.reviewNote && (
                    <p className="text-destructive mt-1.5 text-xs">
                      Ditolak: {row.reviewNote}
                    </p>
                  )}

                  {!unlocked && row.status === 'pending' && (
                    <p className="text-muted-foreground mt-1.5 text-xs">
                      Menunggu tahap sebelumnya divalidasi.
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {editable && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => (openId === row.id ? setOpenId(null) : openForm(row))}
                    >
                      {row.status === 'pending' ? 'Laporkan' : 'Perbaiki'}
                    </Button>
                  )}

                  {canValidate && row.status === 'reported' && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          run(() => reviewStage({ stage_event_id: row.id, decision: 'validate' }))
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
                        onClick={() => setRejectId(rejectId === row.id ? null : row.id)}
                      >
                        <X className="size-3.5" />
                        Tolak
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {rejectId === row.id && (
                <div className="bg-muted/40 mt-3 space-y-2 rounded-xl p-3">
                  <Label htmlFor={`reject-${row.id}`}>Alasan penolakan</Label>
                  <Textarea
                    id={`reject-${row.id}`}
                    rows={2}
                    value={rejectNote}
                    placeholder="Mis. foto tidak memperlihatkan proses pemotongan"
                    onChange={(e) => setRejectNote(e.target.value)}
                    className="bg-card"
                  />
                  <p className="text-muted-foreground text-xs">
                    Wajib diisi — tanpa alasan, mitra tidak tahu apa yang harus diperbaiki.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending || !rejectNote.trim()}
                    onClick={() =>
                      run(() =>
                        reviewStage({
                          stage_event_id: row.id,
                          decision: 'reject',
                          review_note: rejectNote,
                        }),
                      )
                    }
                  >
                    Kirim penolakan
                  </Button>
                </div>
              )}

              {openId === row.id && (
                <div className="bg-muted/40 mt-3 grid gap-3 rounded-xl p-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`when-${row.id}`}>Waktu pelaksanaan</Label>
                    <Input
                      id={`when-${row.id}`}
                      type="datetime-local"
                      value={draft.occurred_at}
                      onChange={(e) => setDraft({ ...draft, occurred_at: e.target.value })}
                      className="bg-card mt-1.5"
                    />
                  </div>

                  {row.stage === 'sembelih' && (
                    <div>
                      <Label htmlFor={`weight-${row.id}`}>Bobot hasil (kg, opsional)</Label>
                      <Input
                        id={`weight-${row.id}`}
                        type="number"
                        step="0.1"
                        value={draft.weight_kg}
                        onChange={(e) => setDraft({ ...draft, weight_kg: e.target.value })}
                        className="bg-card mt-1.5"
                      />
                    </div>
                  )}

                  {(row.stage === 'salur' || row.stage === 'kirim' || row.stage === 'terkirim') && (
                    <div>
                      <Label htmlFor={`pkg-${row.id}`}>Jumlah paket</Label>
                      <Input
                        id={`pkg-${row.id}`}
                        type="number"
                        value={draft.packages_count}
                        onChange={(e) => setDraft({ ...draft, packages_count: e.target.value })}
                        className="bg-card mt-1.5"
                      />
                    </div>
                  )}

                  {(row.stage === 'salur' || row.stage === 'terkirim') && (
                    <>
                      <div>
                        <Label htmlFor={`rname-${row.id}`}>
                          {row.stage === 'salur' ? 'Nama penerima' : 'Diterima oleh'}
                        </Label>
                        <Input
                          id={`rname-${row.id}`}
                          value={draft.recipient_name}
                          onChange={(e) => setDraft({ ...draft, recipient_name: e.target.value })}
                          className="bg-card mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`rphone-${row.id}`}>Nomor penerima (opsional)</Label>
                        <Input
                          id={`rphone-${row.id}`}
                          value={draft.recipient_phone}
                          onChange={(e) => setDraft({ ...draft, recipient_phone: e.target.value })}
                          className="bg-card mt-1.5"
                        />
                      </div>
                    </>
                  )}

                  {row.stage === 'salur' && (
                    <>
                      <div>
                        <Label htmlFor={`area-${row.id}`}>Area penyaluran</Label>
                        <Input
                          id={`area-${row.id}`}
                          value={draft.recipient_area}
                          placeholder="Mis. Kampung Sukamaju RT 03"
                          onChange={(e) => setDraft({ ...draft, recipient_area: e.target.value })}
                          className="bg-card mt-1.5"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor={`lat-${row.id}`}>Lintang</Label>
                          <Input
                            id={`lat-${row.id}`}
                            value={draft.lat}
                            onChange={(e) => setDraft({ ...draft, lat: e.target.value })}
                            className="bg-card mt-1.5"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`lng-${row.id}`}>Bujur</Label>
                          <Input
                            id={`lng-${row.id}`}
                            value={draft.lng}
                            onChange={(e) => setDraft({ ...draft, lng: e.target.value })}
                            className="bg-card mt-1.5"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="sm:col-span-2">
                    <Label htmlFor={`notes-${row.id}`}>Catatan</Label>
                    <Textarea
                      id={`notes-${row.id}`}
                      rows={2}
                      value={draft.notes}
                      onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                      className="bg-card mt-1.5"
                    />
                  </div>

                  <div className="flex items-center gap-2 sm:col-span-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending || !draft.occurred_at}
                      onClick={() =>
                        run(() =>
                          reportStage({
                            stage_event_id: row.id,
                            occurred_at: new Date(draft.occurred_at).toISOString(),
                            notes: draft.notes,
                            packages_count: draft.packages_count
                              ? Number(draft.packages_count)
                              : undefined,
                            recipient_name: draft.recipient_name,
                            recipient_phone: draft.recipient_phone,
                            recipient_area: draft.recipient_area,
                            weight_kg: draft.weight_kg ? Number(draft.weight_kg) : undefined,
                            lat: draft.lat ? Number(draft.lat) : undefined,
                            lng: draft.lng ? Number(draft.lng) : undefined,
                          }),
                        )
                      }
                    >
                      Simpan laporan
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => setOpenId(null)}
                    >
                      Batal
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
