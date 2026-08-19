'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { reviewDocumentation } from '@/server/actions/documentation';

type Outcome = { ok: boolean; error?: { message: string } };

/**
 * Tombol setujui/tolak untuk satu dokumentasi — dipakai panel order maupun
 * halaman antrian validasi.
 *
 * Status tujuan tidak pernah dikirim dari sini; server yang menentukannya dari
 * role pemanggil (docs/10 section 4).
 */
export function DocReviewActions({
  documentationId,
  disabled,
  onRun,
}: {
  documentationId: string;
  disabled: boolean;
  onRun: (fn: () => Promise<Outcome>) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');

  // Satu tingkat sejak 19 Agustus 2026, jadi tombolnya tidak lagi perlu
  // menyebutkan tingkat mana yang sedang dijalankan.
  const approveLabel = 'Setujui';

  return (
    <div className="border-border mt-3 border-t pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={disabled}
          onClick={() =>
            onRun(() =>
              reviewDocumentation({ documentation_id: documentationId, decision: 'approve' }),
            )
          }
        >
          <Check className="size-3.5" />
          {approveLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => {
            setRejecting((v) => !v);
            setNote('');
          }}
        >
          <X className="size-3.5" />
          Tolak
        </Button>
      </div>

      {rejecting && (
        <div className="border-border bg-muted/30 mt-2 rounded-xl border p-3">
          <Label htmlFor={`doc-reject-${documentationId}`}>Alasan penolakan</Label>
          <Textarea
            id={`doc-reject-${documentationId}`}
            rows={2}
            value={note}
            placeholder="Mis. foto buram, wajah penerima tidak terlihat"
            onChange={(e) => setNote(e.target.value)}
            className="bg-card mt-1.5"
          />
          <p className="text-muted-foreground mt-1 text-xs">
            Alasan dikirim ke petugas agar dapat diunggah ulang.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={disabled || !note.trim()}
              onClick={() =>
                onRun(async () => {
                  const result = await reviewDocumentation({
                    documentation_id: documentationId,
                    decision: 'reject',
                    review_note: note,
                  });
                  if (result.ok) setRejecting(false);
                  return result;
                })
              }
            >
              Tolak dokumentasi
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => setRejecting(false)}
            >
              Batal
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
