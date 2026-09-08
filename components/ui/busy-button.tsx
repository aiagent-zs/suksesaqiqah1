'use client';

import { Loader2 } from 'lucide-react';
import { Button } from './button';

/**
 * Tombol yang **mengatakan** dirinya sedang bekerja.
 *
 * Sampai sekarang 78 tombol aksi di aplikasi ini memakai pola yang sama:
 * `disabled={pending}`. Tombolnya mati saat ditekan, tapi tidak mengatakan
 * apa-apa — dan mati tanpa berkata apa-apa terbaca sama persis dengan rusak.
 * Operator yang ragu menekannya lagi, dan pada aksi yang tidak idempoten
 * (mencatat pembayaran, mengunggah bukti) itu berarti data ganda.
 *
 * Tiga hal yang membuatnya tidak sekadar spinner:
 *
 *   1. **Ikonnya menggantikan ikon aslinya**, bukan menumpuk di sebelahnya —
 *      jadi lebar tombol tidak berubah dan barisnya tidak bergeser.
 *   2. **`busyLabel` opsional.** Pada tombol sempit, spinner saja sudah cukup;
 *      pada tombol yang menentukan (Simpan laporan, Validasi) kalimatnya
 *      menyebutkan apa yang sedang terjadi.
 *   3. **Spinner-nya tertunda 120ms** lewat `animate-working` — aksi yang
 *      selesai sekejap tidak menampilkan apa pun. Yang berkedip sekejap lebih
 *      gelisah daripada diam.
 *
 * `aria-busy` ikut disetel: tanpa itu, pembaca layar hanya mendengar tombolnya
 * berubah jadi tidak aktif — tanpa alasannya.
 */
export function BusyButton({
  busy,
  busyLabel,
  disabled,
  children,
  ...props
}: React.ComponentProps<typeof Button> & {
  busy: boolean;
  /** Teks pengganti selama berjalan. Dikosongkan = teks aslinya bertahan. */
  busyLabel?: string;
}) {
  return (
    <Button {...props} disabled={disabled || busy} aria-busy={busy || undefined}>
      {busy ? (
        <>
          <Loader2 className="animate-working size-3.5 animate-spin" aria-hidden />
          {busyLabel ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
