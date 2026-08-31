'use client';

import { AlertCircle, Tag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ANIMAL_SPECIES_LABEL } from '@/lib/constants/order';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Draft } from '../../draft';
import type { CheckoutPackage, NasiBoxPackage } from '../../queries';
import { FieldError } from './field-error';
import { SummaryRow } from './summary-row';

/** Langkah 4 — ringkasan sebelum pesanan dikirim. */
export function StepRingkasan({
  draft,
  set,
  fieldErrors,
  selected,
  selectedBox,
  packageSubtotal,
  boxSubtotal,
  total,
  error,
}: {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  fieldErrors: Record<string, string>;
  selected: CheckoutPackage | undefined;
  selectedBox: NasiBoxPackage | undefined;
  packageSubtotal: number;
  boxSubtotal: number;
  total: number;
  /** Galat tingkat-form dari server (rem laju, paket keburu nonaktif). */
  error: string | null;
}) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-[420ms] ease-out">
      <div className="overflow-hidden rounded-lg border border-neutral-200">
        <div className="border-b border-neutral-100 bg-neutral-50/80 px-5 py-3">
          <p className="text-sm font-bold text-neutral-900">Rincian Pesanan</p>
        </div>

        <dl className="divide-y divide-neutral-100">
          <SummaryRow label="Aqiqah untuk">
            {draft.aqiqah_for === 'laki_laki' ? 'Anak Laki-laki' : 'Anak Perempuan'}
          </SummaryRow>
          <SummaryRow label="Atas nama">
            {[draft.child_name, draft.bin_binti].filter(Boolean).join(' ') || '-'}
            {/* Tempat & tanggal lahir ikut ditampilkan di sini, bukan
                      sebagai barisnya sendiri: keduanya menerangkan anak yang
                      sama, dan inilah kesempatan terakhir pemesan mengoreksi
                      salah ketik sebelum keduanya tercetak di sertifikat. */}
            {(draft.child_birth_place || draft.child_birth_date) && (
              <span className="block text-xs text-neutral-500">
                Lahir di {draft.child_birth_place || '-'}
                {draft.child_birth_date && `, ${formatDate(draft.child_birth_date)}`}
              </span>
            )}
          </SummaryRow>
          <SummaryRow label="Paket">
            {selected?.name ?? '-'} · {draft.qty}{' '}
            {ANIMAL_SPECIES_LABEL[draft.species as keyof typeof ANIMAL_SPECIES_LABEL]}
            <span className="block text-xs text-neutral-500 tabular-nums">
              {formatCurrency(packageSubtotal)}
            </span>
          </SummaryRow>
          {selectedBox && draft.nasi_box_qty > 0 && (
            <SummaryRow label="Nasi box">
              {selectedBox.name} · {draft.nasi_box_qty} box
              <span className="block text-xs text-neutral-500 tabular-nums">
                {formatCurrency(boxSubtotal)}
              </span>
            </SummaryRow>
          )}
          <SummaryRow label="Pelaksanaan">
            {formatDate(draft.requested_date)}
            {draft.requested_time && ` · ${draft.requested_time} WIB`}
            <span className="block text-xs text-neutral-500">Menunggu konfirmasi tim kami</span>
          </SummaryRow>
          <SummaryRow label="Penyaluran">
            {draft.distribution_mode === 'kirim' ? 'Aqiqah Kirim' : 'Aqiqah Salur'}
            {/* Bagian alamat ditampilkan terpisah, tidak dirangkai jadi
                      satu baris. Bentuk satu barisnya dirakit `create_guest_order`
                      dan hanya di sana — merakitnya lagi di sini berarti dua
                      tempat menyusun teks yang sama dengan hasil bisa berbeda. */}
            {draft.distribution_mode === 'kirim' && draft.delivery.village_code && (
              <span className="mt-1 block text-xs leading-5 text-neutral-500">
                {draft.delivery.detail}
                <br />
                Kel. {draft.delivery.village_name}, Kec. {draft.delivery.district_name}
                <br />
                {draft.delivery.city_name}, {draft.delivery.province_name}{' '}
                {draft.delivery.postal_code}
              </span>
            )}
          </SummaryRow>
          <SummaryRow label="Pemesan">
            {draft.name}
            <span className="block text-xs text-neutral-500">
              {draft.phone} · {draft.email}
            </span>
          </SummaryRow>
        </dl>

        <div className="bg-primary/5 flex items-center justify-between border-b border-neutral-200 px-5 py-3.5">
          <span className="text-sm font-bold text-neutral-900">Total Tagihan:</span>
          <span className="text-primary text-xl font-extrabold tabular-nums">
            {formatCurrency(total)}
          </span>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="co-referral" className="text-sm font-semibold text-neutral-800">
            <Tag className="mr-1 inline size-3.5" />
            Kode Referral <span className="font-normal text-neutral-500">(opsional)</span>
          </Label>
          <Input
            id="co-referral"
            value={draft.referral_code}
            aria-invalid={Boolean(fieldErrors.referral_code)}
            aria-describedby={fieldErrors.referral_code ? 'referral_code-error' : undefined}
            placeholder="Mis. SA-BUDI"
            onChange={(e) => set('referral_code', e.target.value)}
            className="mt-2 h-12 rounded-lg border-neutral-200 text-sm uppercase shadow-sm"
          />
          {fieldErrors.referral_code && (
            <FieldError id="referral_code-error" message={fieldErrors.referral_code} />
          )}
        </div>

        <div>
          <Label htmlFor="co-notes" className="text-sm font-semibold text-neutral-800">
            Catatan <span className="font-normal text-neutral-500">(opsional)</span>
          </Label>
          <Textarea
            id="co-notes"
            value={draft.notes}
            placeholder="Permintaan khusus, waktu yang diharapkan, dan sebagainya"
            onChange={(e) => set('notes', e.target.value)}
            className="mt-2 rounded-xl border-neutral-200 text-sm shadow-sm"
          />
        </div>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      <p className="text-center text-xs leading-5 text-neutral-500">
        Tidak ada pembayaran di halaman ini. Tim kami menghubungi Anda lebih dulu untuk konfirmasi.
      </p>
    </div>
  );
}
