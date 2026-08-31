'use client';

import { AlertCircle } from 'lucide-react';

/**
 * Pesan galat satu medan.
 *
 * **`role="alert"` supaya galatnya terdengar, bukan hanya terlihat.** Tanpa ini
 * pemakai pembaca layar hanya mendengar "invalid" dari `aria-invalid` — tahu
 * ada yang salah, tanpa pernah tahu apa. Pesannya juga ditautkan ke input lewat
 * `aria-describedby` pada inputnya, jadi ia terbaca lagi setiap kali
 * fokus kembali ke medan itu.
 *
 * Ikonnya bukan hiasan: warna merah saja tidak sampai pada ~8% laki-laki yang
 * buta warna merah-hijau (`design.md §9`), dan bentuk memberi tanda kedua yang
 * tidak bergantung pada warna sama sekali.
 */
export function FieldError({ id, message }: { id?: string; message: string }) {
  return (
    <p
      id={id}
      role="alert"
      className="animate-in fade-in slide-in-from-top-1 mt-1.5 flex items-start gap-1.5 text-xs font-medium text-red-600 duration-200"
    >
      <AlertCircle className="mt-px size-3.5 shrink-0" />
      <span>{message}</span>
    </p>
  );
}
