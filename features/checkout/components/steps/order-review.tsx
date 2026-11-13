'use client';

import { ANIMAL_SPECIES_LABEL } from '@/lib/constants/order';
import { formatDate } from '@/lib/format';
import type { Draft } from '../../draft';
import type { CheckoutPackage, NasiBoxPackage } from '../../queries';
import { SummaryRow, SummarySection } from './summary-row';

/**
 * Isi layar periksa sebelum pesanan dikirim (PRD FR-C3).
 *
 * Tombol kirim langsung mencatat pesanan, dan nama serta tanggal lahir anak
 * tercetak di sertifikat: ini kesempatan terakhir menangkap salah ketik.
 * Totalnya tidak diulang di sini karena bilah kirim di bawahnya sudah memuatnya.
 * "Belum diisi" hanya jaring pengaman; layar periksa baru terbuka sesudah
 * seluruh isian wajib lolos validasi.
 */
export function OrderReview({
  draft,
  selected,
  selectedBox,
  packageSubtotal,
  boxSubtotal,
  onEdit,
}: {
  draft: Draft;
  selected: CheckoutPackage | undefined;
  selectedBox: NasiBoxPackage | undefined;
  packageSubtotal: number;
  boxSubtotal: number;
  /** Menggulir ke bagian form dengan id ini. */
  onEdit: (sectionId: string) => void;
}) {
  const empty = <span className="text-ink-muted font-normal">Belum diisi</span>;
  const a = draft.delivery;

  return (
    <div className="border-line overflow-hidden rounded-lg border">
      <SummarySection title="Pesanan" onEdit={() => onEdit('bagian-pesanan')}>
        <SummaryRow label="Aqiqah untuk">
          {draft.aqiqah_for === 'laki_laki'
            ? 'Anak Laki-laki'
            : draft.aqiqah_for === 'perempuan'
              ? 'Anak Perempuan'
              : empty}
        </SummaryRow>
        <SummaryRow label="Paket" amount={selected ? packageSubtotal : undefined}>
          {selected
            ? `${selected.name}, ${draft.qty} ${
                ANIMAL_SPECIES_LABEL[draft.species as keyof typeof ANIMAL_SPECIES_LABEL] ?? 'ekor'
              }`
            : empty}
        </SummaryRow>
        {selectedBox && draft.nasi_box_qty > 0 && (
          <SummaryRow label="Nasi box" amount={boxSubtotal}>
            {selectedBox.name}, {draft.nasi_box_qty} box
          </SummaryRow>
        )}
      </SummarySection>

      <SummarySection title="Jadwal & penyaluran" onEdit={() => onEdit('bagian-jadwal')}>
        <SummaryRow label="Pelaksanaan">
          {draft.requested_date ? (
            <>
              {formatDate(draft.requested_date)}
              {draft.requested_time && `, ${draft.requested_time} WIB`}
              <span className="text-ink-muted block text-xs font-normal">
                Menunggu konfirmasi tim kami
              </span>
            </>
          ) : (
            empty
          )}
        </SummaryRow>
        <SummaryRow label="Penyaluran">
          {draft.distribution_mode === 'kirim'
            ? 'Aqiqah Kirim'
            : draft.distribution_mode
              ? 'Aqiqah Salur'
              : empty}
          {/* Bagian alamat ditampilkan terpisah. Bentuk satu barisnya dirakit
              `create_guest_order` dan hanya di sana. */}
          {draft.distribution_mode === 'kirim' && a.village_code && (
            <span className="text-ink-muted mt-1 block text-xs leading-5 font-normal">
              {a.detail}
              <br />
              Kel. {a.village_name}, Kec. {a.district_name}
              <br />
              {a.city_name}, {a.province_name} {a.postal_code}
            </span>
          )}
        </SummaryRow>
      </SummarySection>

      <SummarySection title="Data pemesan & anak" onEdit={() => onEdit('bagian-data')}>
        <SummaryRow label="Atas nama anak">
          {[draft.child_name, draft.bin_binti].filter(Boolean).join(' ') || empty}
          {(draft.child_birth_place || draft.child_birth_date) && (
            <span className="text-ink-muted block text-xs font-normal">
              Lahir di {draft.child_birth_place || '-'}
              {draft.child_birth_date && `, ${formatDate(draft.child_birth_date)}`}
            </span>
          )}
        </SummaryRow>
        <SummaryRow label="Pemesan">
          {draft.name || empty}
          {(draft.phone || draft.email) && (
            <span className="text-ink-muted block text-xs font-normal wrap-break-word">
              {draft.phone}
              {draft.phone && draft.email && <br />}
              {draft.email}
            </span>
          )}
        </SummaryRow>
      </SummarySection>

      {(draft.referral_code || draft.notes) && (
        <SummarySection title="Catatan" onEdit={() => onEdit('bagian-catatan')}>
          {draft.referral_code && (
            <SummaryRow label="Kode referral">{draft.referral_code.toUpperCase()}</SummaryRow>
          )}
          {draft.notes && <SummaryRow label="Catatan">{draft.notes}</SummaryRow>}
        </SummarySection>
      )}
    </div>
  );
}
