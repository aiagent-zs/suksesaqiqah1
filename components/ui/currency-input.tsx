'use client';

import { useId } from 'react';
import { Input } from './input';
import { cn } from '@/lib/utils';

/**
 * Ambil hanya digitnya. Titik, koma, spasi, dan "Rp" yang ikut tertempel saat
 * orang menyalin angka dari WhatsApp semuanya dibuang.
 */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/** "5600000" → "5.600.000". String kosong tetap kosong, bukan "0". */
export function groupThousands(digits: string): string {
  if (digits === '') return '';
  // `Number` aman di sini: nilainya sudah dipastikan hanya digit, dan nominal
  // rupiah tidak pernah mendekati batas presisi yang jadi masalah.
  return Number(digits).toLocaleString('id-ID');
}

/**
 * Input nominal rupiah yang menampilkan pemisah ribuan sambil diketik.
 *
 * ## Kenapa bukan `type="number"`
 *
 * Peramban tidak mengizinkan pemisah ribuan di dalam `type="number"` — nilainya
 * wajib berupa angka yang sah, jadi "5.600.000" ditolak dan yang tersisa hanya
 * `5600000` polos. Pada nominal jutaan itu benar-benar sulit dibaca: `5600000`
 * dan `56000000` berbeda satu nol dan terlihat nyaris sama, sementara salah
 * ketiknya berakibat langsung — nominal ikut menentukan gate DP, dan
 * `recordPayment` menolak angka yang melebihi sisa tagihan.
 *
 * Karena itu di sini `inputMode="numeric"` pada input teks: papan ketik ponsel
 * tetap muncul sebagai angka, tapi tampilannya bebas kita atur.
 *
 * ## Yang dikirim tetap angka polos
 *
 * `onValueChange` selalu menerima digit tanpa pemisah (`"5600000"`), jadi schema
 * Zod dan server action tidak perlu tahu soal format sama sekali. Yang berformat
 * hanya yang terlihat.
 *
 * ## Kenapa `Rp` sebagai awalan di dalam kotak
 *
 * Menaruhnya di label membuat orang mengetik "Rp" lagi — kebiasaan yang wajar,
 * dan hasilnya tertolak sunyi karena huruf dibuang oleh penyaring digit.
 * Sebagai awalan yang menempel, satuannya terbaca tanpa mengundang diketik.
 */
export function CurrencyInput({
  id,
  value,
  onValueChange,
  placeholder,
  disabled,
  className,
  'aria-describedby': describedBy,
}: {
  id?: string;
  /** Digit polos tanpa pemisah, mis. `"5600000"`. */
  value: string;
  /** Menerima digit polos, bukan yang berformat. */
  onValueChange: (digits: string) => void;
  /** Digit polos juga — ikut diformat sebelum ditampilkan. */
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  'aria-describedby'?: string;
}) {
  const prefixId = useId();

  return (
    <div className={cn('relative', className)}>
      <span
        id={prefixId}
        aria-hidden
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm"
      >
        Rp
      </span>

      <Input
        id={id}
        type="text"
        // Papan ketik angka di ponsel, tanpa memakai `type="number"` yang
        // melarang pemisah ribuan.
        inputMode="numeric"
        autoComplete="off"
        value={groupThousands(value)}
        placeholder={placeholder ? groupThousands(placeholder) : undefined}
        disabled={disabled}
        // Satuannya sudah terbaca sebagai teks di dalam kotak, tapi `aria-hidden`
        // menyembunyikannya dari pembaca layar — jadi dikaitkan lewat sini.
        aria-describedby={[prefixId, describedBy].filter(Boolean).join(' ')}
        onChange={(e) => onValueChange(digitsOnly(e.target.value))}
        className="pl-9 tabular-nums"
      />
    </div>
  );
}
