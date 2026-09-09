'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BusyButton } from '@/components/ui/busy-button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { DocStatusBadge } from '@/components/data/status-badge';
import { formatDateTime } from '@/lib/format';
import { reportStage, reviewStage } from '@/server/actions/stages';
import { uploadDocumentation } from '@/server/actions/documentation';
import { createClient } from '@/lib/supabase/client';
import { DOC_BUCKET, buildDocPath, checkDocFile } from '@/features/documentation/storage';
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
  /** Foto yang dipilih di form laporan, diunggah bersamaan saat Simpan. */
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  // Input file tidak bisa dikosongkan lewat prop `value`; menaikkan key ini
  // memasang ulang elemennya sehingga nama berkas lama hilang dari layar.
  const [fileKey, setFileKey] = useState(0);
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
      setFiles([]);
      setFileKey((k) => k + 1);
      router.refresh();
    });
  }

  /**
   * Simpan laporan **beserta fotonya**, dalam satu tekan.
   *
   * Urutannya foto dulu, laporan kemudian. Kalau dibalik, laporan tersimpan
   * lebih dulu dan kegagalan unggah meninggalkan tahap yang tampak selesai
   * tanpa bukti — persis keadaan yang paling sulit disadari, karena baru
   * ketahuan saat gerbang Pelaporan menolaknya berhari-hari kemudian.
   *
   * Berkasnya diunggah **langsung dari browser ke Storage**: badan Server
   * Action dibatasi 1 MB sementara bucket menerima 25 MB, dan foto dari kamera
   * ponsel rutin melewati batas itu.
   */
  async function submitReport(row: StageEventRow) {
    setError(null);

    // `note` tidak mungkin muncul di sini — `checkDocFile` menurunkannya dari
    // MIME berkas, dan catatan tertulis tidak punya berkas sama sekali.
    const paths: Array<{ path: string; type: 'photo' | 'video' | 'note' }> = [];

    if (files.length > 0) {
      for (const file of files) {
        const check = checkDocFile(file);
        if (!check.ok) {
          setError(`${file.name}: ${check.message}`);
          return;
        }
      }

      setUploading(true);
      try {
        const supabase = createClient();
        for (const file of files) {
          const check = checkDocFile(file);
          if (!check.ok) return;

          const path = buildDocPath({
            orderNumber,
            orderCreatedAt,
            stage: row.stage,
            uuid: crypto.randomUUID(),
            ext: check.ext,
          });

          const { error: uploadError } = await supabase.storage
            .from(DOC_BUCKET)
            .upload(path, file, { contentType: file.type, upsert: false });

          if (uploadError) {
            // Penyebab tersering justru bukan berkasnya, melainkan sesi yang
            // kedaluwarsa — pesannya dibawa apa adanya supaya terbaca.
            setError(`Gagal mengunggah ${file.name}: ${uploadError.message}`);
            return;
          }
          paths.push({ path, type: check.type });
        }
      } finally {
        setUploading(false);
      }
    }

    run(async () => {
      const reported = await reportStage({
        stage_event_id: row.id,
        occurred_at: new Date(draft.occurred_at).toISOString(),
        notes: draft.notes,
        packages_count: draft.packages_count ? Number(draft.packages_count) : undefined,
        recipient_name: draft.recipient_name,
        recipient_phone: draft.recipient_phone,
        recipient_area: draft.recipient_area,
        weight_kg: draft.weight_kg ? Number(draft.weight_kg) : undefined,
        lat: draft.lat ? Number(draft.lat) : undefined,
        lng: draft.lng ? Number(draft.lng) : undefined,
      });
      if (!reported.ok) return reported;

      // Berkasnya sudah di Storage; yang tersisa mencatatkan barisnya. Satu
      // yang gagal dilaporkan apa adanya — laporannya sendiri sudah tersimpan,
      // jadi menggagalkan keseluruhannya justru menyesatkan.
      for (const { path, type } of paths) {
        const saved = await uploadDocumentation({
          stage_event_id: row.id,
          type,
          storage_path: path,
          caption: '',
        });
        if (!saved.ok) return saved;
      }

      return reported;
    });
  }

  function openForm(row: StageEventRow) {
    setOpenId(row.id);
    setError(null);
    setFiles([]);
    setFileKey((k) => k + 1);
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

          // Penomoran ekor untuk tahap yang terbit per hewan (`sembelih`).
          //
          // `tag_code` dipakai bila ada, tapi ia opsional — dan pada kenyataannya
          // hampir selalu kosong: formulir hewan tidak mewajibkannya. Tanpa
          // penomoran ini kedua baris "Sembelih" tampak identik, dan ketika yang
          // satu punya tombol Laporkan sementara yang lain tidak (karena sudah
          // dilaporkan), itu terbaca sebagai tombol yang hilang — bukan sebagai
          // dua ekor berbeda.
          const sameStage = stages.filter((s) => s.stage === row.stage);
          const perAnimal = sameStage.length > 1 && row.animalId !== null;
          const animalLabel = perAnimal
            ? (row.animalTag ?? `Ekor ${sameStage.findIndex((s) => s.id === row.id) + 1}`)
            : row.animalTag;

          // Tahap mana yang sedang menahan baris ini — cerminan `canReportStage`
          // dan trigger `enforce_stage_order`: yang `pending` atau `rejected`.
          const blockedBy = unlocked
            ? []
            : [
                ...new Set(
                  stages
                    .filter(
                      (s) => s.seq < row.seq && s.status !== 'reported' && s.status !== 'validated',
                    )
                    .map((s) => STAGE_META[s.stage].label),
                ),
              ];

          // Per `stageEventId`, bukan per `stage` — lihat catatan di docblock
          // komponen: mengelompokkan per tahap menempelkan bukti ekor kedua ke
          // baris ekor pertama.
          const rowDocs = docs.filter((d) => d.stageEventId === row.id);
          /**
           * Bukti yang sudah tersimpan pada baris ini.
           *
           * Yang ditolak sengaja tidak dihitung: admin sudah menyatakannya
           * kurang, jadi memperlakukannya sebagai bukti yang sah membuat mitra
           * bisa menyimpan ulang laporan tanpa memperbaiki apa pun.
           */
          const hasEvidence = rowDocs.some((d) => d.status !== 'rejected');
          /**
           * "Tambah bukti" hanya muncul untuk tahap yang **sudah dilaporkan**.
           *
           * Selama tahapnya masih `pending`, satu-satunya jalan yang benar
           * adalah tombol Laporkan — dan form-nya sudah memuat medan foto.
           * Menampilkan dua tombol di situ menawarkan dua jalan untuk satu
           * pekerjaan, dan yang menempuh jalan bukti duluan meninggalkan foto
           * yang menggantung tanpa laporan yang menerangkannya.
           *
           * Sesudah dilaporkan ia berguna: foto menyusul dari lapangan, atau
           * mengganti yang ditolak admin. Berhenti begitu tahapnya tervalidasi
           * — yang sudah disetujui tidak lagi menerima tambahan.
           */
          const canAddDoc =
            canUpload && row.status !== 'pending' && row.status !== 'validated' && unlocked;

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
                    {animalLabel && (
                      <Badge className="border-slate-200 bg-slate-100 text-slate-700 tabular-nums">
                        {animalLabel}
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

                  {/* Menyebut tahap mana yang menahannya, bukan sekadar "tahap
                      sebelumnya". Pada order dua ekor, yang menahan `masak`
                      biasanya satu baris `sembelih` yang belum disentuh —
                      sementara baris sembelih satunya sudah dilaporkan dan
                      terlihat selesai. Tanpa menyebut namanya, layar hanya
                      berkata "belum bisa" tanpa memberi tahu apa yang kurang. */}
                  {!unlocked && row.status === 'pending' && (
                    <p className="text-muted-foreground mt-1.5 text-xs">
                      {blockedBy.length > 0
                        ? `Menunggu ${blockedBy.join(' & ')} dilaporkan lebih dulu.`
                        : 'Menunggu tahap sebelumnya dilaporkan.'}
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

                      {/* Menambah bukti SESUDAH melapor — mis. foto menyusul
                          dari lapangan, atau mengganti yang ditolak admin.
                          Disembunyikan selama form laporan terbuka: di sana
                          fotonya sudah jadi medan tersendiri, dan dua jalan
                          unggah di layar yang sama membingungkan. */}
                      {canAddDoc && openId !== row.id && (
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
                      <NumberInput
                        id={`weight-${row.id}`}
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
                      <NumberInput
                        id={`pkg-${row.id}`}
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

                  {/* Foto bagian dari laporan, bukan aksi terpisah.
                      Sebelumnya bukti diunggah lewat tombol sendiri di luar
                      form — jadi mitra harus mengingat dua langkah untuk satu
                      pekerjaan, dan yang lupa langkah kedua meninggalkan
                      laporan tanpa bukti yang baru ketahuan saat gerbang
                      Pelaporan menolaknya berhari-hari kemudian.

                      Boleh lebih dari satu: satu tahap sering perlu beberapa
                      sudut pengambilan. */}
                  <div className="sm:col-span-2">
                    <Label htmlFor={`photo-${row.id}`}>Foto dokumentasi</Label>
                    <Input
                      key={`${row.id}-${fileKey}`}
                      id={`photo-${row.id}`}
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,video/mp4"
                      disabled={pending || uploading}
                      onChange={(e) => setFiles([...(e.target.files ?? [])])}
                      className="bg-card mt-1.5"
                    />
                    <p className="text-muted-foreground mt-1 text-xs">
                      {hasEvidence
                        ? `${rowDocs.length} bukti sudah terlampir — tambahkan lagi bila perlu.`
                        : 'Wajib — laporan tanpa foto tidak bisa disimpan. JPG, PNG, WebP, atau MP4 · maksimal 25 MB per berkas.'}
                    </p>
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor={`notes-${row.id}`}>Catatan (opsional)</Label>
                    <Textarea
                      id={`notes-${row.id}`}
                      rows={2}
                      value={draft.notes}
                      placeholder="Keterangan tambahan bila ada"
                      onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                      className="bg-card mt-1.5"
                    />
                  </div>

                  <div className="flex items-center gap-2 sm:col-span-2">
                    <BusyButton
                      type="button"
                      size="sm"
                      busy={pending || uploading}
                      busyLabel={uploading ? 'Mengunggah foto…' : 'Menyimpan…'}
                      // Foto wajib. Baris yang sudah punya bukti terlampir
                      // boleh disimpan ulang tanpa memilih berkas lagi —
                      // memperbaiki bobot atau catatan tidak menuntut memotret
                      // ulang apa yang sudah terbukti.
                      disabled={!draft.occurred_at || (!hasEvidence && files.length === 0)}
                      onClick={() => submitReport(row)}
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
