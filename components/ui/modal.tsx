'use client';

import type { ReactElement, ReactNode } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { AlertCircle, AlertTriangle, X } from 'lucide-react';
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
  'fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-[2px] transition-opacity duration-200 ' +
  'data-ending-style:opacity-0 data-starting-style:opacity-0';

/**
 * Kerangka popup — **tiga bagian, bukan satu kotak yang menggulir seluruhnya.**
 *
 * ## Kenapa strukturnya begini
 *
 * Versi pertama menggulirkan seluruh isi popup. Pada formulir panjang (paket
 * punya 14 medan) akibatnya dua hal yang sama-sama mengganggu: judulnya hilang
 * begitu digulir, jadi tidak ada lagi penanda sedang menyunting apa; dan tombol
 * simpan harus dicari di dasar gulungan, padahal ia aksi yang paling sering
 * dituju.
 *
 * Sekarang header dan footer **tetap di tempatnya**, hanya badan yang menggulir.
 * `flex` + `min-h-0` pada badannya yang membuat itu bekerja — tanpa `min-h-0`,
 * anak flex menolak menyusut lebih kecil dari isinya dan gulirannya pindah ke
 * popup lagi.
 *
 * `max-h-[90dvh]` memakai `dvh`, bukan `vh`: `dvh` mengikuti tinggi layar yang
 * **benar-benar terlihat** di ponsel, sementara `vh` menghitung bilah alamat
 * sebagai ruang yang ada — dan tombol simpan mendarat di bawahnya.
 *
 * Di ponsel popup menempel ke dasar layar (`max-sm:bottom-0`) alih-alih
 * melayang di tengah: itu pola yang sudah dikenal sebagai lembar-bawah, dan
 * jempol menjangkau tombolnya tanpa meraih ke tengah layar.
 */
const POPUP =
  'border-border bg-card fixed z-50 flex flex-col overflow-hidden outline-none ' +
  'shadow-2xl transition-all duration-200 ' +
  // Ponsel: lembar yang menempel di dasar, sudut atas membulat.
  'max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[92dvh] max-sm:rounded-t-2xl max-sm:border-x-0 max-sm:border-b-0 ' +
  'max-sm:data-ending-style:translate-y-4 max-sm:data-starting-style:translate-y-4 ' +
  // Layar lebar: melayang di tengah.
  'sm:top-1/2 sm:left-1/2 sm:max-h-[88dvh] sm:w-[calc(100vw-3rem)] ' +
  'sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border ' +
  'sm:data-ending-style:scale-[0.98] sm:data-starting-style:scale-[0.98] ' +
  'data-ending-style:opacity-0 data-starting-style:opacity-0';

/** Judul & keterangan — tetap terlihat meski badannya digulir. */
const HEADER = 'border-border shrink-0 border-b px-5 py-4 pr-12 sm:px-6';

/** Badan yang menggulir. `min-h-0` wajib, lihat catatan pada `POPUP`. */
const BODY = 'min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6';

/** Baris tombol — tetap di dasar, tidak ikut tergulir. */
const FOOTER = 'border-border bg-muted/30 shrink-0 border-t px-5 py-3.5 sm:px-6';

/**
 * Lebar per kebutuhan, bukan per selera.
 *
 * `sm` untuk penegasan (satu kalimat + dua tombol), `md` untuk formulir
 * sekolom, `lg` untuk formulir yang punya blok dua kolom pada layar lebar —
 * memaksa yang terakhir ke `md` membuat kolomnya menumpuk tanpa alasan.
 */
const WIDTH = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
} as const;

export type ModalWidth = keyof typeof WIDTH;

export function Modal({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  width = 'md',
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** Elemen pemicu; base-ui menyatukan propsnya lewat `render`. */
  trigger: ReactElement;
  title: ReactNode;
  description?: ReactNode;
  width?: ModalWidth;
  /**
   * Baris tombol yang **tetap di dasar**, tidak ikut tergulir.
   *
   * Opsional: formulir yang tombolnya sudah menyatu dengan isinya (mis.
   * `ServiceForm` yang membawa Batal & Simpan sendiri) cukup membiarkannya
   * kosong — dua baris tombol lebih membingungkan daripada satu yang harus
   * digulir.
   */
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger render={trigger} />

      <Dialog.Portal>
        <Dialog.Backdrop className={BACKDROP} />

        <Dialog.Popup className={`${POPUP} ${WIDTH[width]}`}>
          {/* Penanda geser khas lembar-bawah. Hanya di ponsel, dan murni
              penanda bahwa ini bisa ditutup — tidak ada gestur yang terpasang
              padanya, sebab menutup formulir dengan sentuhan tak sengaja jauh
              lebih mahal daripada satu ketukan tambahan pada tombol tutup. */}
          <div aria-hidden className="flex justify-center pt-2.5 sm:hidden">
            <span className="h-1 w-9 rounded-full bg-neutral-300" />
          </div>

          <div className={HEADER}>
            <Dialog.Title className="text-base leading-6 font-semibold">{title}</Dialog.Title>
            {description && (
              <Dialog.Description className="text-muted-foreground mt-1 text-sm leading-5">
                {description}
              </Dialog.Description>
            )}
          </div>

          {/* Tombol tutup melayang di pojok, di luar aliran header — supaya
              judul panjang tidak perlu berbagi baris dengannya. `pr-12` pada
              header yang menyediakan ruangnya. */}
          <Dialog.Close
            aria-label="Tutup"
            className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-3 right-3 inline-flex size-8 items-center justify-center rounded-lg transition-colors max-sm:top-5"
          >
            <X className="size-4" />
          </Dialog.Close>

          {/* Isi baru dirender saat terbuka. Itu memaksa formulir di dalamnya
              dibangun ulang tiap kali dibuka — tanpa itu, penyuntingan yang
              dibatalkan meninggalkan sisa ketikan yang muncul lagi berikutnya,
              dan terbaca seperti data tersimpan. */}
          <div className={BODY}>{open && children}</div>

          {footer && <div className={FOOTER}>{footer}</div>}
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
          {/* Tanpa penanda geser dan tanpa tombol tutup di pojok: keduanya
              menawarkan jalan keluar yang mudah, dan dialog ini justru menuntut
              keputusan yang disadari. Batal tetap ada — sebagai tombol. */}
          <div className={BODY}>
            <div className="flex gap-3.5">
              {/* Ikon peringatan berdampingan dengan teksnya: bentuk memberi
                  tanda kedua yang tidak bergantung warna — ~8% laki-laki buta
                  warna merah-hijau (`design.md §9`). */}
              <span className="bg-destructive/10 text-destructive mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full">
                <AlertTriangle className="size-4.5" />
              </span>

              <div className="min-w-0">
                <AlertDialog.Title className="text-base leading-6 font-semibold">
                  {title}
                </AlertDialog.Title>
                {description && (
                  <AlertDialog.Description className="text-muted-foreground mt-1.5 text-sm leading-6">
                    {description}
                  </AlertDialog.Description>
                )}
              </div>
            </div>

            {hint && (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900">
                {hint}
              </p>
            )}

            {/* Galat ditampilkan **di dalam** dialog, bukan lewat toast:
                dialognya tetap terbuka, jadi pesannya ada di tempat mata
                operator sudah berada. */}
            {error && (
              <p className="border-destructive/20 bg-destructive/5 text-destructive mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {error}
              </p>
            )}
          </div>

          {/* Aksi merusak di kanan, mengikuti urutan yang sama dengan seluruh
              dialog lain — pindah tempat antar dialog justru mengundang klik
              refleks yang keliru. */}
          <div className={FOOTER}>
            <div className="flex items-center justify-end gap-2">
              <AlertDialog.Close
                render={
                  <Button type="button" variant="outline" disabled={pending}>
                    Batal
                  </Button>
                }
              />
              <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
                {pending ? 'Memproses…' : confirmLabel}
              </Button>
            </div>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
