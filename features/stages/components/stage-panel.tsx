'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BusyButton } from '@/components/ui/busy-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { DocStatusBadge } from '@/components/data/status-badge';
import { formatDateTime } from '@/lib/format';
import { reportStage, reviewStage } from '@/server/actions/stages';
import { DocPreview } from '@/features/documentation/components/doc-preview';
import { DocReviewActions } from '@/features/documentation/components/doc-review-actions';
import { StageDocUpload } from '@/features/documentation/components/stage-doc-upload';
import { REVIEWABLE_DOC_STATUSES } from '@/features/documentation/review';
import type { DocumentationRow } from '@/features/documentation/queries';
import { STAGE_META, STAGE_EVENT_STATUS_META, canReportStage } from '../sequence';
import type { StageEventRow } from '../queries';

/**
 * `Date` → nilai `<input type="datetime-local">` dalam **waktu lokal**.
 *
 * `toISOString()` mengembalikan UTC, sementara `datetime-local` membaca apa pun
 * yang diberikan sebagai jam dinding setempat. Memakainya sebagai prasetel
 * membuat jamnya mundur sebesar offset zona waktu — di WIB, tujuh jam. Petugas
 * lalu membetulkannya manual, dan koreksi yang meleset sedikit ke depan ditolak
 * `occurred_at` dengan pesan "Data yang dikirim belum valid" yang tidak
 * menyebutkan medan mana.
 */
function localDateTimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Daftar kerja mitra untuk satu order — **beserta buktinya**.
 *
 * Tahapnya sudah terbit saat mitra ditugaskan, jadi panel ini menampilkan
 * daftar yang menunggu diisi, bukan formulir kosong. Urutan ditegakkan
 * database: tahap berikutnya terbuka begitu tahap sebelumnya **dilaporkan** —
 * tidak perlu menunggu admin memvalidasi (dilonggarkan 8 September; sebelumnya
 * admin jadi penghambat di tiap tahap). `canReportStage` di sini hanya
 * menonaktifkan tombolnya lebih dulu supaya mitra tidak menekan sesuatu yang
 * pasti ditolak.
 *
 * **Bukti hidup di dalam barisnya**, bukan di panel terpisah. Sebelumnya mitra
 * melapor di sini lalu mengunggah fotonya di panel Dokumentasi, dan admin
 * memutuskan keduanya di dua layar berbeda — dua antrean untuk satu pekerjaan.
 * Pengelompokannya lewat `stageEventId`, bukan `stage`: baris `sembelih` terbit
 * satu per ekor, jadi mengelompokkan per tahap akan menempelkan foto ekor kedua
 * ke ekor pertama tanpa ada yang bisa melihat kekeliruannya.
 */
export function StagePanel({
  stages,
  docs,
  canReport,
  canValidate,
  canUpload,
  currentUserId,
  orderNumber,
  orderCreatedAt,
  deliveryAddress,
}: {
  stages: StageEventRow[];
  /** Seluruh bukti order ini; dikelompokkan per baris tahap di sini. */
  docs: DocumentationRow[];
  canReport: boolean;
  canValidate: boolean;
  canUpload: boolean;
  /** Pengunggah tidak boleh menyetujui unggahannya sendiri (docs/10 §4). */
  currentUserId: string;
  orderNumber: string;
  orderCreatedAt: string;
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

  function run(
    fn: () => Promise<{
      ok: boolean;
      error?: { message: string; fields?: Record<string, string> };
    }>,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        // Pesan per medan ikut ditampilkan. Tanpa ini yang terbaca cuma "Data
        // yang dikirim belum valid" — kalimat yang tidak menyebutkan satu pun
        // medan, sehingga tidak ada yang bisa dikerjakan pembacanya.
        const fields = Object.values(result.error?.fields ?? {});
        setError(
          [result.error?.message ?? 'Terjadi kesalahan.', ...fields].filter(Boolean).join(' — '),
        );
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
      occurred_at: localDateTimeValue(new Date()),
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

  // Judul dipegang `PhaseSection` di halaman detail order; yang tersisa di sini
  // keterangan yang benar-benar khas tahap.
  if (stages.length === 0) {
    return (
      <p className="text-muted-foreground px-5 py-6 text-sm">
        Daftar tahap terbit otomatis setelah mitra pelaksana ditetapkan.
      </p>
    );
  }

  return (
    <div>
      <p className="border-border text-muted-foreground border-b px-5 py-3 text-sm">
        Mitra melaporkan tiap tahap berurutan; admin memvalidasi menyusul, tanpa menahan pekerjaan
        berikutnya.
      </p>

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

          // Per `stageEventId`, bukan per `stage` — lihat catatan di docblock
          // komponen: mengelompokkan per tahap menempelkan bukti ekor kedua ke
          // baris ekor pertama.
          const rowDocs = docs.filter((d) => d.stageEventId === row.id);
          // Bukti masih bisa ditambahkan selama tahapnya belum tervalidasi.
          const canAddDoc = canUpload && row.status !== 'validated' && unlocked;

          return (
            <li key={row.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{meta.label}</span>
                    {/* Tag hewan jadi badge, bukan teks samar: `sembelih` terbit
                        satu baris per ekor, jadi order dua ekor menampilkan
                        "Sembelih" dua kali. Tanpa pembeda yang menonjol, kedua
                        baris itu terbaca seperti duplikat yang keliru. */}
                    {row.animalTag && (
                      <Badge className="border-slate-200 bg-slate-100 text-slate-700 tabular-nums">
                        {row.animalTag}
                      </Badge>
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
                      {row.occurredAt && <div>Dilaksanakan {formatDateTime(row.occurredAt)}</div>}
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
                    <p className="text-destructive mt-1.5 text-xs">Ditolak: {row.reviewNote}</p>
                  )}

                  {!unlocked && row.status === 'pending' && (
                    <p className="text-muted-foreground mt-1.5 text-xs">
                      Menunggu tahap sebelumnya dilaporkan.
                    </p>
                  )}

                  {/* --- Bukti tahap ini --------------------------------------
                      Menempel pada barisnya, bukan di panel terpisah: yang
                      memeriksa laporan dan yang memeriksa fotonya adalah orang
                      yang sama, pada saat yang sama. */}
                  {(rowDocs.length > 0 || canAddDoc) && (
                    <div className="border-border mt-3 border-t pt-3">
                      <p className="text-muted-foreground text-xs font-medium">
                        Bukti {rowDocs.length > 0 ? `(${rowDocs.length})` : ''}
                      </p>

                      {rowDocs.length > 0 && (
                        <ul className="mt-2 space-y-2">
                          {rowDocs.map((doc) => (
                            <li key={doc.id} className="flex items-start gap-3">
                              <DocPreview doc={doc} />

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <DocStatusBadge status={doc.status} />
                                  {doc.uploaderName && (
                                    <span className="text-muted-foreground text-xs">
                                      {doc.uploaderName}
                                    </span>
                                  )}
                                </div>

                                {doc.caption && (
                                  <p className="mt-1 text-xs whitespace-pre-wrap">{doc.caption}</p>
                                )}

                                {doc.status === 'rejected' && doc.reviewNote && (
                                  <p className="text-destructive mt-1 text-xs">
                                    Ditolak: {doc.reviewNote}
                                  </p>
                                )}

                                {/* Pemisahan tugas: pengunggah tidak menilai
                                    unggahannya sendiri. Ditegakkan juga oleh
                                    trigger `enforce_documentation_review`. */}
                                {canValidate &&
                                  REVIEWABLE_DOC_STATUSES.includes(doc.status) &&
                                  doc.uploaderId !== currentUserId && (
                                    <DocReviewActions
                                      documentationId={doc.id}
                                      disabled={pending}
                                      onRun={run}
                                    />
                                  )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}

                      {canAddDoc && (
                        <div className="mt-2">
                          <StageDocUpload
                            stageEventId={row.id}
                            stage={row.stage}
                            orderNumber={orderNumber}
                            orderCreatedAt={orderCreatedAt}
                            disabled={pending}
                            onRun={run}
                          />
                        </div>
                      )}
                    </div>
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
                      {/* Validasi menggerakkan tahap berikutnya sekaligus
                          menyetujui buktinya — aksi paling menentukan di panel
                          ini, jadi ia yang paling perlu mengatakan sedang
                          berjalan. */}
                      <BusyButton
                        type="button"
                        size="sm"
                        busy={pending}
                        busyLabel="Memvalidasi…"
                        onClick={() =>
                          run(() => reviewStage({ stage_event_id: row.id, decision: 'validate' }))
                        }
                      >
                        <Check className="size-3.5" />
                        Validasi
                      </BusyButton>
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
                    <BusyButton
                      type="button"
                      size="sm"
                      busy={pending}
                      busyLabel="Menyimpan…"
                      disabled={!draft.occurred_at}
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
                    </BusyButton>
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
    </div>
  );
}
