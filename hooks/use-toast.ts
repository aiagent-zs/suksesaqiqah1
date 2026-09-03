'use client';

import { useCallback, useRef, useState } from 'react';
import type { ToastState } from '@/components/ui/toast';

/**
 * Toast sukses/gagal untuk halaman staf (`design.md §8` — "Aksi: toast
 * sukses/gagal").
 *
 * ## Kenapa ada
 *
 * `Toast` sudah lengkap sejak 24 Agustus — termasuk nada `success` — tetapi
 * **hanya checkout yang memakainya**, dan di sana pun hanya untuk galat.
 * Halaman staf tidak punya umpan balik sama sekali: menyimpan katalog
 * berhasil, `router.refresh()` memuat ulang data, dan **tidak ada satu pun
 * tanda bahwa sesuatu terjadi**. Yang tertangkap operator hanya form yang
 * tertutup — sama persis dengan tampilan gagal-diam.
 *
 * Itu keliru justru karena senyap: yang ragu akan menyimpan ulang, dan pada
 * aksi yang tidak idempoten (menambah paket) itu berarti data ganda.
 *
 * ## Penghitung, bukan pesan, sebagai kunci
 *
 * `id` naik tiap panggilan meski pesannya sama persis. Tanpa itu, menyimpan
 * dua kali berturut-turut dengan hasil yang sama tidak memunculkan toast kedua
 * — React melihat state yang identik dan tidak merender ulang, sehingga
 * penyimpanan kedua terbaca sebagai tidak terjadi. Pola yang sama sudah
 * dipakai `checkout-form.tsx`.
 *
 * `useRef`, bukan `useState`: penghitungnya tidak pernah dibaca saat render,
 * jadi menaikkannya tidak perlu memicu render tambahan.
 */
export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);
  const seq = useRef(0);

  const show = useCallback((tone: 'success' | 'error', message: string) => {
    seq.current += 1;
    setToast({ id: seq.current, tone, message });
  }, []);

  const dismiss = useCallback(() => setToast(null), []);

  return { toast, show, dismiss };
}
