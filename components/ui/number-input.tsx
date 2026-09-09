'use client';

import { Input } from './input';

/**
 * Input angka yang **tidak berubah saat halaman digulir**.
 *
 * `<input type="number">` menangkap roda tetikus selama ia terfokus, dan
 * peramban menaikkan/menurunkan nilainya alih-alih menggulir halaman. Jadi
 * mengetik 100, lalu menggulir turun untuk membaca sisa formulir, diam-diam
 * mengubahnya jadi 90 — tanpa satu pun tanda di layar. Yang tersimpan angka
 * yang tidak pernah diketik siapa pun.
 *
 * Akibatnya nyata di sini: jumlah paket menentukan isi laporan peserta, bobot
 * hasil ikut tercetak di situ, dan harga modal mitra menentukan margin. Ketiga
 * angka itu diketik di formulir panjang yang memang harus digulir.
 *
 * **`blur()` sebelum `preventDefault()`**, dan urutan itu bukan kebetulan:
 * mencegah kejadiannya saja menghentikan gulir halaman juga — jadi rodanya
 * mati total di atas medan itu. Melepas fokus lebih dulu membuat peramban
 * memperlakukan roda sebagai gulir biasa, sehingga halaman tetap bergerak
 * sementara angkanya tidak tersentuh.
 *
 * Tombol panah papan ketik sengaja **tidak** disentuh: menaikkan angka dengan
 * ↑/↓ adalah tindakan yang memang disengaja pengetiknya.
 */
export function NumberInput({
  onWheel,
  ...props
}: Omit<React.ComponentProps<typeof Input>, 'type'>) {
  return (
    <Input
      {...props}
      type="number"
      onWheel={(e) => {
        e.currentTarget.blur();
        onWheel?.(e);
      }}
    />
  );
}
