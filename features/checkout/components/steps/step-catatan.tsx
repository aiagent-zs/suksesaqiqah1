'use client';

import { Tag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Draft } from '../../draft';
import { FieldError } from './field-error';

/**
 * Bagian terakhir isian checkout aqiqah: dua isian opsional. Galat server dan
 * apa yang terjadi sesudah kirim tampil di layar periksa (`ReviewScreen`).
 */
export function StepCatatan({
  draft,
  set,
  fieldErrors,
}: {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  fieldErrors: Record<string, string>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label
          htmlFor="co-referral"
          className="text-ink flex items-center gap-1.5 text-sm font-semibold"
        >
          <Tag aria-hidden className="text-primary size-4" />
          Kode referral <span className="text-ink-muted font-normal">(opsional)</span>
        </Label>
        <Input
          id="co-referral"
          autoComplete="off"
          autoCapitalize="characters"
          value={draft.referral_code}
          aria-invalid={Boolean(fieldErrors.referral_code)}
          aria-describedby={fieldErrors.referral_code ? 'referral_code-error' : undefined}
          placeholder="Mis. SA-BUDI"
          onChange={(e) => set('referral_code', e.target.value)}
          className="field mt-2 h-12 uppercase"
        />
        {fieldErrors.referral_code && (
          <FieldError id="referral_code-error" message={fieldErrors.referral_code} />
        )}
      </div>

      <div>
        <Label htmlFor="co-notes" className="text-ink text-sm font-semibold">
          Catatan <span className="text-ink-muted font-normal">(opsional)</span>
        </Label>
        <Textarea
          id="co-notes"
          value={draft.notes}
          placeholder="Permintaan khusus untuk tim kami"
          onChange={(e) => set('notes', e.target.value)}
          className="border-line mt-2 rounded-lg text-base"
        />
      </div>
    </div>
  );
}
