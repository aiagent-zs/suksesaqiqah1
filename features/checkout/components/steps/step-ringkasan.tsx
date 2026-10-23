'use client';

import {
  AlertCircle,
  Baby,
  Beef,
  CalendarDays,
  HandHeart,
  Package,
  ShieldCheck,
  Tag,
  Truck,
  User,
  Users,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ANIMAL_SPECIES_LABEL } from '@/lib/constants/order';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Draft } from '../../draft';
import type { CheckoutPackage, NasiBoxPackage } from '../../queries';
import { FieldError } from './field-error';
import { StepIntro } from './step-header';
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
  onEdit,
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
  /** Pindah ke langkah tertentu dari tombol "Ubah" di tiap baris. */
  onEdit: (step: number) => void;
}) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 duration-300 ease-out">
      <StepIntro title="Periksa sekali lagi sebelum dikirim">
        Ada yang keliru? Ketuk Ubah di baris yang ingin diganti.
      </StepIntro>

      <div className="border-line overflow-hidden rounded-lg border bg-white">
        <div className="border-line bg-surface-muted border-b px-5 py-3">
          <p className="text-ink text-base font-semibold">Rincian pesanan</p>
        </div>

        <dl className="divide-line divide-y">
          <SummaryRow label="Aqiqah untuk" icon={Users} onEdit={() => onEdit(1)}>
            {draft.aqiqah_for === 'laki_laki' ? 'Anak Laki-laki' : 'Anak Perempuan'}
          </SummaryRow>
          <SummaryRow label="Atas nama" icon={Baby} onEdit={() => onEdit(3)}>
            {[draft.child_name, draft.bin_binti].filter(Boolean).join(' ') || '-'}
            {/* Tempat & tanggal lahir ikut ditampilkan di sini, bukan
                      sebagai barisnya sendiri: keduanya menerangkan anak yang
                      sama, dan inilah kesempatan terakhir pemesan mengoreksi
                      salah ketik sebelum keduanya tercetak di sertifikat. */}
            {(draft.child_birth_place || draft.child_birth_date) && (
              <span className="text-ink-muted block text-xs">
                Lahir di {draft.child_birth_place || '-'}
                {draft.child_birth_date && `, ${formatDate(draft.child_birth_date)}`}
              </span>
            )}
          </SummaryRow>
          <SummaryRow label="Paket" icon={Beef} onEdit={() => onEdit(1)}>
            {selected?.name ?? '-'} · {draft.qty}{' '}
            {ANIMAL_SPECIES_LABEL[draft.species as keyof typeof ANIMAL_SPECIES_LABEL]}
            <span className="text-ink-muted block text-xs tabular-nums">
              {formatCurrency(packageSubtotal)}
            </span>
          </SummaryRow>
          {selectedBox && draft.nasi_box_qty > 0 && (
            <SummaryRow label="Nasi box" icon={Package} onEdit={() => onEdit(1)}>
              {selectedBox.name} · {draft.nasi_box_qty} box
              <span className="text-ink-muted block text-xs tabular-nums">
                {formatCurrency(boxSubtotal)}
              </span>
            </SummaryRow>
          )}
          <SummaryRow label="Pelaksanaan" icon={CalendarDays} onEdit={() => onEdit(2)}>
            {formatDate(draft.requested_date)}
            {draft.requested_time && ` · ${draft.requested_time} WIB`}
            <span className="text-ink-muted block text-xs">Menunggu konfirmasi tim kami</span>
          </SummaryRow>
          <SummaryRow
            label="Penyaluran"
            icon={draft.distribution_mode === 'kirim' ? Truck : HandHeart}
            onEdit={() => onEdit(2)}
          >
            {draft.distribution_mode === 'kirim' ? 'Aqiqah Kirim' : 'Aqiqah Salur'}
            {/* Bagian alamat ditampilkan terpisah, tidak dirangkai jadi
                      satu baris. Bentuk satu barisnya dirakit `create_guest_order`
                      dan hanya di sana — merakitnya lagi di sini berarti dua
                      tempat menyusun teks yang sama dengan hasil bisa berbeda. */}
            {draft.distribution_mode === 'kirim' && draft.delivery.village_code && (
              <span className="text-ink-muted mt-1 block text-xs leading-5">
                {draft.delivery.detail}
                <br />
                Kel. {draft.delivery.village_name}, Kec. {draft.delivery.district_name}
                <br />
                {draft.delivery.city_name}, {draft.delivery.province_name}{' '}
                {draft.delivery.postal_code}
              </span>
            )}
          </SummaryRow>
          <SummaryRow label="Pemesan" icon={User} onEdit={() => onEdit(3)}>
            {draft.name}
            <span className="text-ink-muted block text-xs">
              {draft.phone} · {draft.email}
            </span>
          </SummaryRow>
        </dl>

        <div className="bg-primary flex items-center justify-between gap-4 px-5 py-4 text-white">
          <span className="text-base font-semibold">Total tagihan</span>
          <span className="text-2xl font-bold tabular-nums">{formatCurrency(total)}</span>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
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
            placeholder="Permintaan khusus, waktu yang diharapkan, dan sebagainya"
            onChange={(e) => set('notes', e.target.value)}
            className="border-line mt-2 rounded-lg text-base"
          />
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="border-danger/30 text-danger flex items-start gap-2 rounded-lg border bg-red-50 px-4 py-3 text-sm"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      <p className="bg-surface-muted text-ink flex items-start gap-2.5 rounded-lg p-4 text-sm leading-6">
        <ShieldCheck aria-hidden className="text-primary mt-0.5 size-5 shrink-0" />
        Setelah Anda menekan Konfirmasi, kami menampilkan nomor pesanan dan cara pembayarannya.
        Simpan nomor itu untuk melacak pesanan.
      </p>
    </div>
  );
}
