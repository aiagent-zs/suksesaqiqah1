'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Plus, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DocStatusBadge } from '@/components/data/status-badge';
import { createClient } from '@/lib/supabase/client';
import { formatDateTime } from '@/lib/format';
import { DOC_STAGE_LABEL, DOC_TYPE_LABEL, type DocStage } from '@/lib/constants/order';
import { deleteDocumentation, uploadDocumentation } from '@/server/actions/documentation';
import { DOC_BUCKET, buildDocPath, checkDocFile } from '../storage';
import { missingDocumentationStages, REVIEWABLE_DOC_STATUSES } from '../review';
import type { DocumentationSummary } from '../queries';
import { DocPreview } from './doc-preview';
import { DocReviewActions } from './doc-review-actions';

export type DocAnimalOption = { id: string; tagCode: string | null };

/**
 * Dokumentasi lapangan satu order: unggah + validasi 2 tingkat (docs/10).
 *
 * Sama seperti bukti transfer, berkas diunggah **langsung dari browser ke
 * Storage** lalu path-nya dikirim ke Server Action — badan Server Action
 * dibatasi 1 MB sementara bucket ini menerima sampai 25 MB.
 */
export function DocumentationManager({
  orderId,
  orderNumber,
  branchCode,
  orderCreatedAt,
  summary,
  animals,
  canUpload,
  canDelete,
  canValidate,
  currentUserId,
}: {
  orderId: string;
  orderNumber: string;
  branchCode: string;
  orderCreatedAt: string;
  summary: DocumentationSummary;
  animals: DocAnimalOption[];
  canUpload: boolean;
  canDelete: boolean;
  /** Apakah pengguna ini berhak memvalidasi dokumentasi sama sekali. */
  canValidate: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [draft, setDraft] = useState({
    stage: 'slaughter' as DocStage,
    animal_id: '',
    caption: '',
    isNote: false,
  });

  const missing = missingDocumentationStages({
    approvedSlaughter: summary.approvedSlaughter,
    approvedDistribution: summary.approvedDistribution,
  });
  const busy = pending || uploading;

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

  function resetForm() {
    setDraft({ stage: 'slaughter', animal_id: '', caption: '', isNote: false });
    setFile(null);
    setFileKey((k) => k + 1);
    setNotice(null);
    setShowForm(false);
  }

  async function handleSubmit() {
    setError(null);
    setNotice(null);

    let storagePath = '';
    let type: 'photo' | 'video' | 'note' = 'note';

    if (!draft.isNote) {
      if (!file) {
        setError('Pilih berkas foto atau video lebih dulu.');
        return;
      }

      const check = checkDocFile(file);
      if (!check.ok) {
        setError(check.message);
        return;
      }
      type = check.type;

      if (check.oversizePhoto) {
        setNotice('Foto lebih besar dari 2 MB — pertimbangkan memperkecilnya untuk hemat kuota.');
      }

      setUploading(true);
      try {
        const supabase = createClient();
        storagePath = buildDocPath({
          branchCode,
          orderNumber,
          orderCreatedAt,
          stage: draft.stage,
          uuid: crypto.randomUUID(),
          ext: check.ext,
        });

        const { error: uploadError } = await supabase.storage
          .from(DOC_BUCKET)
          .upload(storagePath, file, { contentType: file.type, upsert: false });

        if (uploadError) {
          setError(`Gagal mengunggah berkas: ${uploadError.message}`);
          return;
        }
      } finally {
        setUploading(false);
      }
    }

    run(async () => {
      const result = await uploadDocumentation({
        order_id: orderId,
        animal_id: draft.animal_id,
        stage: draft.stage,
        type,
        storage_path: storagePath,
        caption: draft.caption,
      });
      if (result.ok) resetForm();
      return result;
    });
  }

  return (
    <section className="border-border bg-card rounded-2xl border shadow-sm">
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-base font-semibold">Dokumentasi</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {summary.rows.length} berkas
            {summary.pendingReview > 0 && (
              <span className="text-amber-700"> · {summary.pendingReview} menunggu validasi</span>
            )}
          </p>
        </div>

        {canUpload && (
          <Button type="button" variant="outline" size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="size-3.5" />
            Unggah dokumentasi
          </Button>
        )}
      </div>

      {/* Kelengkapan minimum — dasar gate menuju Pelaporan (docs/10 section 5). */}
      <p
        className={`border-border border-b px-5 py-2.5 text-xs ${
          missing.length === 0
            ? 'bg-emerald-50 text-emerald-800'
            : 'bg-muted/40 text-muted-foreground'
        }`}
      >
        {missing.length === 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5" />
            Kelengkapan minimum terpenuhi — order dapat naik ke Pelaporan.
          </span>
        ) : (
          `Belum lengkap: butuh minimal 1 bukti ${missing.join(' & ')} yang sudah tervalidasi.`
        )}
      </p>

      {error && (
        <p className="border-destructive/20 bg-destructive/5 text-destructive flex items-start gap-2 border-b px-5 py-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {notice && (
        <p className="border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-xs text-amber-800">
          {notice}
        </p>
      )}

      {showForm && canUpload && (
        <div className="border-border bg-muted/30 grid gap-3 border-b p-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="doc-stage">Tahap</Label>
            <Select
              id="doc-stage"
              value={draft.stage}
              onChange={(e) => setDraft({ ...draft, stage: e.target.value as DocStage })}
              className="bg-card mt-1.5"
            >
              {(Object.keys(DOC_STAGE_LABEL) as DocStage[]).map((s) => (
                <option key={s} value={s}>
                  {DOC_STAGE_LABEL[s]}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="doc-animal">Hewan (opsional)</Label>
            <Select
              id="doc-animal"
              value={draft.animal_id}
              onChange={(e) => setDraft({ ...draft, animal_id: e.target.value })}
              className="bg-card mt-1.5"
            >
              <option value="">Tidak ditautkan ke hewan tertentu</option>
              {animals.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.tagCode ?? 'Tanpa kode'}
                </option>
              ))}
            </Select>
          </div>

          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.isNote}
                onChange={(e) => setDraft({ ...draft, isNote: e.target.checked })}
                className="border-border accent-primary size-4 rounded"
              />
              Catatan teks saja (tanpa berkas)
            </label>
          </div>

          {!draft.isNote && (
            <div className="sm:col-span-2">
              <Label htmlFor="doc-file">Foto atau video</Label>
              <Input
                key={fileKey}
                id="doc-file"
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="bg-card mt-1.5"
              />
              <p className="text-muted-foreground mt-1 text-xs">
                JPG, PNG, WebP, atau MP4 · maksimal 25 MB · target foto ≤ 2 MB
              </p>
            </div>
          )}

          <div className="sm:col-span-2">
            <Label htmlFor="doc-caption">{draft.isNote ? 'Isi catatan' : 'Keterangan'}</Label>
            <Textarea
              id="doc-caption"
              rows={2}
              value={draft.caption}
              placeholder={
                draft.isNote
                  ? 'Mis. 3 dari 3 hewan sehat, disaksikan peserta'
                  : 'Mis. proses pemotongan hewan BDG-K-001'
              }
              onChange={(e) => setDraft({ ...draft, caption: e.target.value })}
              className="bg-card mt-1.5"
            />
          </div>

          <div className="flex items-center gap-2 sm:col-span-2">
            <Button type="button" disabled={busy} onClick={handleSubmit}>
              {uploading ? (
                <>
                  <Upload className="size-3.5 animate-pulse" />
                  Mengunggah…
                </>
              ) : (
                'Simpan dokumentasi'
              )}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={resetForm}>
              Batal
            </Button>
          </div>
        </div>
      )}

      {summary.rows.length === 0 ? (
        <p className="text-muted-foreground px-5 py-10 text-center text-sm">
          Belum ada dokumentasi pada order ini.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {summary.rows.map((doc) => {
            // Pemisahan tugas (docs/10 section 4): pengupload tidak boleh
            // memvalidasi unggahannya sendiri. Server memeriksa ulang.
            const isOwnUpload = doc.uploaderId === currentUserId;
            const awaitingReview = REVIEWABLE_DOC_STATUSES.includes(doc.status);
            const canReview = canValidate && !isOwnUpload && awaitingReview;

            return (
              <li key={doc.id} className="px-5 py-4">
                <div className="flex gap-4">
                  <DocPreview doc={doc} />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {DOC_STAGE_LABEL[doc.stage]}
                          <span className="text-muted-foreground font-normal">
                            {' · '}
                            {DOC_TYPE_LABEL[doc.type]}
                            {doc.animalTag ? ` · ${doc.animalTag}` : ''}
                          </span>
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {formatDateTime(doc.createdAt)}
                          {doc.uploaderName ? ` · ${doc.uploaderName}` : ''}
                        </p>
                      </div>
                      <DocStatusBadge status={doc.status} />
                    </div>

                    {doc.caption && <p className="mt-2 text-sm">{doc.caption}</p>}

                    {doc.status === 'rejected' && doc.reviewNote && (
                      <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-800">
                        <span className="font-medium">Alasan penolakan:</span> {doc.reviewNote}
                      </p>
                    )}

                    {doc.status === 'approved' && doc.reviewerName && (
                      <p className="mt-1 text-xs text-emerald-700">
                        Divalidasi {doc.reviewedAt ? formatDateTime(doc.reviewedAt) : ''} oleh{' '}
                        {doc.reviewerName}
                      </p>
                    )}

                    {canValidate && isOwnUpload && awaitingReview && (
                      <p className="text-muted-foreground mt-2 text-xs">
                        Anda mengunggah berkas ini, jadi tidak dapat memvalidasinya sendiri.
                      </p>
                    )}

                    {canReview && (
                      <DocReviewActions documentationId={doc.id} disabled={busy} onRun={run} />
                    )}

                    {canDelete && doc.status !== 'approved' && (
                      <div className="mt-3">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            run(() => deleteDocumentation({ documentation_id: doc.id }))
                          }
                        >
                          <Trash2 className="size-3.5" />
                          Hapus
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
