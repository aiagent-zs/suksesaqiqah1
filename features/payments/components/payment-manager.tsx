'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, FileText, Plus, Trash2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PaymentVerificationBadge } from '@/components/data/status-badge';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL, type PaymentMethod } from '@/lib/constants/order';
import { deletePayment, recordPayment, verifyPayment } from '@/server/actions/payments';
import { PROOF_BUCKET, buildProofPath, checkProofFile } from '../storage';
import type { PaymentSummary } from '../queries';

type ActionOutcome = { ok: boolean; error?: { message: string } };

/**
 * Pencatatan & verifikasi pembayaran per order (`prd.md` section 7.4).
 *
 * Bukti transfer diunggah **langsung dari browser ke Supabase Storage**, baru
 * path-nya dikirim ke Server Action. Ini bukan pilihan gaya: badan Server
 * Action dibatasi 1 MB secara default, sementara bucket `payment-proofs`
 * menerima sampai 5 MB — foto dari kamera ponsel rutin melewati batas 1 MB itu
 * dan akan gagal kalau dikirim lewat action.
 */
export function PaymentManager({
  orderId,
  orderNumber,
  summary,
  totalAmount,
  paidAmount,
  minDpRatio,
  canRecord,
  canVerify,
}: {
  orderId: string;
  orderNumber: string;
  summary: PaymentSummary;
  totalAmount: number;
  paidAmount: number;
  minDpRatio: number;
  canRecord: boolean;
  canVerify: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  // Input file tidak bisa dikosongkan lewat prop `value`; menaikkan key ini
  // memasang ulang elemennya sehingga nama berkas lama hilang dari layar.
  const [fileKey, setFileKey] = useState(0);
  const [draft, setDraft] = useState({
    amount: '',
    method: 'transfer_bank' as PaymentMethod,
    note: '',
  });

  const outstanding = Math.max(0, totalAmount - paidAmount);
  const dpTarget = totalAmount * minDpRatio;
  const dpMet = paidAmount >= dpTarget && totalAmount > 0;
  const busy = pending || uploading;

  function run(fn: () => Promise<ActionOutcome>) {
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
    setDraft({ amount: '', method: 'transfer_bank', note: '' });
    setFile(null);
    setFileKey((k) => k + 1);
    setShowForm(false);
  }

  async function handleSubmit() {
    setError(null);

    let proofPath = '';

    if (file) {
      // Divalidasi di klien untuk umpan balik cepat; bucket dan server action
      // memeriksa ulang hal yang sama.
      const check = checkProofFile(file);
      if (!check.ok) {
        setError(check.message);
        return;
      }

      setUploading(true);
      try {
        const supabase = createClient();
        proofPath = buildProofPath(orderNumber, crypto.randomUUID(), check.ext);

        const { error: uploadError } = await supabase.storage
          .from(PROOF_BUCKET)
          .upload(proofPath, file, { contentType: file.type, upsert: false });

        if (uploadError) {
          setError(`Gagal mengunggah bukti transfer: ${uploadError.message}`);
          return;
        }
      } finally {
        setUploading(false);
      }
    }

    // Bila pencatatan gagal setelah unggah berhasil, berkasnya menjadi yatim di
    // Storage. Dibiarkan dengan sengaja — role pencatat tidak punya hak hapus di
    // bucket, dan berkas yatim sudah punya jadwal pembersihan (docs/17 §5).
    run(async () => {
      const result = await recordPayment({
        order_id: orderId,
        amount: draft.amount,
        method: draft.method,
        proof_path: proofPath,
        note: draft.note,
      });
      if (result.ok) resetForm();
      return result;
    });
  }

  return (
    <section className="border-border bg-card rounded-lg border shadow-sm">
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-base font-semibold">Pembayaran</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {summary.payments.length} catatan
            {summary.pendingCount > 0 && (
              <span className="text-amber-700">
                {' · '}
                {summary.pendingCount} menunggu verifikasi ({formatCurrency(summary.pendingTotal)})
              </span>
            )}
          </p>
        </div>

        {canRecord && outstanding > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="size-3.5" />
            Catat pembayaran
          </Button>
        )}
      </div>

      {/* Ringkasan angka: dasar gate DP pada state machine (docs/08). */}
      <dl className="border-border bg-border grid grid-cols-2 gap-px border-b sm:grid-cols-4">
        {[
          { label: 'Nilai Order', value: formatCurrency(totalAmount) },
          { label: 'Terverifikasi', value: formatCurrency(summary.verifiedTotal) },
          { label: 'Menunggu', value: formatCurrency(summary.pendingTotal) },
          { label: 'Sisa Tagihan', value: formatCurrency(outstanding) },
        ].map((cell) => (
          <div key={cell.label} className="bg-card px-4 py-3">
            <dt className="text-muted-foreground text-xs">{cell.label}</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{cell.value}</dd>
          </div>
        ))}
      </dl>

      <p
        className={`border-border border-b px-5 py-2.5 text-xs ${
          dpMet ? 'bg-emerald-50 text-emerald-800' : 'bg-muted/40 text-muted-foreground'
        }`}
      >
        {dpMet
          ? `Gate DP terpenuhi — order dapat dijadwalkan (minimal ${Math.round(minDpRatio * 100)}% dari nilai order).`
          : `Gate DP: butuh minimal ${formatCurrency(dpTarget)} terverifikasi (${Math.round(minDpRatio * 100)}%) agar order dapat dijadwalkan.`}
      </p>

      {error && (
        <p className="border-destructive/20 bg-destructive/5 text-destructive flex items-start gap-2 border-b px-5 py-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {showForm && canRecord && (
        <div className="border-border bg-muted/30 grid gap-3 border-b p-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="pay-amount">Nominal</Label>
            <Input
              id="pay-amount"
              type="number"
              min={1}
              step="0.01"
              inputMode="decimal"
              placeholder={String(outstanding)}
              value={draft.amount}
              onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
              className="bg-card mt-1.5 tabular-nums"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Sisa tagihan {formatCurrency(outstanding)}
            </p>
          </div>

          <div>
            <Label htmlFor="pay-method">Metode</Label>
            <Select
              id="pay-method"
              value={draft.method}
              onChange={(e) => setDraft({ ...draft, method: e.target.value as PaymentMethod })}
              className="bg-card mt-1.5"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABEL[m]}
                </option>
              ))}
            </Select>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="pay-proof">Bukti transfer</Label>
            <Input
              key={fileKey}
              id="pay-proof"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="bg-card mt-1.5"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              JPG, PNG, WebP, atau PDF · maksimal 5 MB · opsional
            </p>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="pay-note">Catatan</Label>
            <Textarea
              id="pay-note"
              rows={2}
              value={draft.note}
              placeholder="Mis. nomor referensi transfer"
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              className="bg-card mt-1.5"
            />
          </div>

          <div className="flex items-center gap-2 sm:col-span-2">
            <Button type="button" disabled={busy || !draft.amount} onClick={handleSubmit}>
              {uploading ? (
                <>
                  <Upload className="size-3.5 animate-pulse" />
                  Mengunggah bukti…
                </>
              ) : (
                'Simpan pembayaran'
              )}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={resetForm}>
              Batal
            </Button>
          </div>
        </div>
      )}

      {summary.payments.length === 0 ? (
        <p className="text-muted-foreground px-5 py-10 text-center text-sm">
          Belum ada pembayaran tercatat pada order ini.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {summary.payments.map((payment) => (
            <li key={payment.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold tabular-nums">{formatCurrency(payment.amount)}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {payment.method
                      ? (PAYMENT_METHOD_LABEL[payment.method as PaymentMethod] ?? payment.method)
                      : 'Metode tidak dicatat'}
                    {' · '}
                    {formatDateTime(payment.createdAt)}
                  </p>
                  {payment.note && (
                    <p className="text-muted-foreground mt-1 text-xs">{payment.note}</p>
                  )}
                  {payment.status === 'verified' && payment.verifiedAt && (
                    <p className="mt-1 text-xs text-emerald-700">
                      Diverifikasi {formatDateTime(payment.verifiedAt)}
                      {payment.verifierName ? ` oleh ${payment.verifierName}` : ''}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {payment.proofUrl && (
                    <a
                      href={payment.proofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary inline-flex items-center gap-1.5 text-xs hover:underline"
                    >
                      <FileText className="size-3.5" />
                      Lihat bukti
                    </a>
                  )}
                  <PaymentVerificationBadge status={payment.status} />
                </div>
              </div>

              {payment.status === 'pending' && (canVerify || canRecord) && (
                <div className="border-border mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                  {canVerify && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          run(() => verifyPayment({ payment_id: payment.id, decision: 'verified' }))
                        }
                      >
                        <Check className="size-3.5" />
                        Verifikasi
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          setRejectingId(rejectingId === payment.id ? null : payment.id);
                          setRejectNote('');
                        }}
                      >
                        <X className="size-3.5" />
                        Tolak
                      </Button>
                    </>
                  )}

                  {canRecord && (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => run(() => deletePayment({ payment_id: payment.id }))}
                    >
                      <Trash2 className="size-3.5" />
                      Hapus
                    </Button>
                  )}
                </div>
              )}

              {rejectingId === payment.id && (
                <div className="border-border bg-muted/30 mt-3 rounded-xl border p-3">
                  <Label htmlFor={`reject-${payment.id}`}>Alasan penolakan</Label>
                  <Textarea
                    id={`reject-${payment.id}`}
                    rows={2}
                    value={rejectNote}
                    placeholder="Mis. nominal tidak sesuai bukti transfer"
                    onChange={(e) => setRejectNote(e.target.value)}
                    className="bg-card mt-1.5"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={busy || !rejectNote.trim()}
                      onClick={() =>
                        run(async () => {
                          const result = await verifyPayment({
                            payment_id: payment.id,
                            decision: 'rejected',
                            note: rejectNote,
                          });
                          if (result.ok) setRejectingId(null);
                          return result;
                        })
                      }
                    >
                      Tolak pembayaran
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setRejectingId(null)}
                    >
                      Batal
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
