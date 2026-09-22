'use client';

import type { ReactElement, ReactNode } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { AlertCircle } from 'lucide-react';
import { Button } from './button';

/**
 * Modal — satu tempat untuk seluruh formulir & penegasan yang melayang.
 *
 * ## Kenapa primitif ini ada
 *
 * Markup base-ui untuk backdrop dan popup tersalin **delapan kali** di
 * `features/` sebelum berkas ini lahir: kelas yang sama persis, 1–2 baris utilitas
 * masing-masing, berikut animasi `data-starting-style` / `data-ending-style` yang
 * mudah terlewat sebagian. Salinan kesembilan dan kesepuluh sedang menunggu —
 * lima layar masih memakai formulir yang mekar di dalam halaman.
 *
 * Yang dihindari bukan pengulangan hurufnya, melainkan **penyimpangan**: satu
 * salinan yang lupa `max-h-[90dvh] overflow-y-auto` menghasilkan dialog yang
 * isinya terpotong di layar pendek, tanpa satu pun galat.
 *
 * ## Kenapa modal, bukan formulir di dalam halaman
 *
 * Keluhan yang berulang di proyek ini: formulir yang mekar di tengah daftar
 * **mendorong seluruh isi di bawahnya**, sehingga baris yang sedang dikerjakan
 * berpindah dari tempat yang tadi dilihat operator. Pada daftar panjang,
 * formulirnya bahkan terbuka di luar layar — tombol ditekan, tidak ada yang
 * tampak berubah, dan tombolnya terbaca sebagai rusak.
 *
 * `fixed` + `translate` membuatnya melayang di atas halaman: tidak ikut aliran
 * isi, jadi tidak ada yang bergeser.
 */

const BACKDROP =
  'fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 ' +
  'data-ending-style:opacity-0 data-starting-style:opacity-0';

/**
 * `max-h-[90dvh]` + `overflow-y-auto` bukan hiasan: `dvh` mengikuti tinggi layar
 * yang **benar-benar terlihat** di ponsel — `vh` menghitung bilah alamat sebagai
 * ruang yang ada, sehingga tombol simpan mendarat di bawah bilah itu dan tidak
 * bisa ditekan.
 */
const POPUP =
  'border-border bg-card fixed top-1/2 left-1/2 z-50 max-h-[90dvh] ' +
  'w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto ' +
  'rounded-lg border p-5 shadow-lg transition-all duration-150 outline-none ' +
  'data-ending-style:scale-95 data-ending-style:opacity-0 ' +
  'data-starting-style:scale-95 data-starting-style:opacity-0';

/**
 * Lebar per kebutuhan, bukan per selera.
 *
 * `sm` untuk penegasan (satu kalimat + dua tombol), `md` untuk formulir
 * sekolom, `lg` untuk formulir yang punya blok dua kolom pada layar lebar —
 * memaksa yang terakhir ke `md` membuat kolomnya menumpuk tanpa alasan.
 */
const WIDTH = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
} as const;

export type ModalWidth = keyof typeof WIDTH;

export function Modal({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  width = 'md',
  children,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** Elemen pemicu; base-ui menyatukan propsnya lewat `render`. */
  trigger: ReactElement;
  title: ReactNode;
  description?: ReactNode;
  width?: ModalWidth;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger render={trigger} />

      <Dialog.Portal>
        <Dialog.Backdrop className={BACKDROP} />

        <Dialog.Popup className={`${POPUP} ${WIDTH[width]}`}>
          <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
          {description && (
            <Dialog.Description className="text-muted-foreground mt-0.5 text-sm">
              {description}
            </Dialog.Description>
          )}

          {/* Isi baru dirender saat terbuka. Itu memaksa formulir di dalamnya
              dibangun ulang tiap kali dibuka — tanpa itu, penyuntingan yang
              dibatalkan meninggalkan sisa ketikan yang muncul lagi berikutnya,
              dan terbaca seperti data tersimpan. */}
          <div className="mt-4">{open && children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Penegasan aksi yang tidak bisa dibatalkan.
 *
 * `AlertDialog`, bukan `Dialog`: ia **tidak** bisa ditutup dengan klik di luar
 * atau Escape. Itu tepat untuk aksi yang tidak punya jalan kembali — menutup
 * tanpa sadar pada formulir biasa hanya kehilangan ketikan, di sini ia bisa
 * berarti data yang hilang.
 */
export function ConfirmModal({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  /** Kalimat kuning: jalan keluar yang lebih ringan, bila ada. */
  hint,
  error,
  confirmLabel,
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  trigger: ReactElement;
  title: ReactNode;
  description?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Trigger render={trigger} />

      <AlertDialog.Portal>
        <AlertDialog.Backdrop className={BACKDROP} />

        <AlertDialog.Popup className={`${POPUP} ${WIDTH.sm}`}>
          <AlertDialog.Title className="text-base font-semibold">{title}</AlertDialog.Title>
          {description && (
            <AlertDialog.Description className="text-muted-foreground mt-1.5 text-sm">
              {description}
            </AlertDialog.Description>
          )}

          {hint && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {hint}
            </p>
          )}

          {/* Galat ditampilkan **di dalam** dialog, bukan lewat toast: dialognya
              tetap terbuka, jadi pesannya ada di tempat mata operator sudah
              berada. */}
          {error && (
            <p className="border-destructive/20 bg-destructive/5 text-destructive mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <AlertDialog.Close
              render={
                <Button type="button" variant="outline" disabled={pending}>
                  Batal
                </Button>
              }
            />
            <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
