-- Foto anak untuk sertifikat aqiqah.
--
-- Sertifikat punya dua wujud: teks saja, dan teks beserta foto anaknya. Yang
-- kedua menuntut tempat menyimpan fotonya, dan sampai sekarang tidak ada satu
-- pun kolom untuk itu.
--
-- **Kolom di `orders`, bukan baris `documentations`.** Sejak
-- `20260908030000_documentation_requires_stage_event.sql`, tiap dokumentasi
-- wajib terikat satu laporan tahap — dan foto anak bukan bukti pelaksanaan
-- tahap mana pun. Memaksanya masuk ke sana berarti mengendurkan lagi
-- keterikatan yang baru saja diperketat.
--
-- Satu foto per order, bukan per ekor: aqiqah anak laki-laki memakai dua
-- kambing atas nama anak yang sama, jadi fotonya pun satu.
alter table public.orders
  add column if not exists child_photo_path text;

comment on column public.orders.child_photo_path is
  'Path foto anak di bucket documentation, untuk sertifikat aqiqah bervarian foto. Null = sertifikat teks saja.';

-- Path-nya mengikuti pola bucket `documentation` yang sudah ada:
--   {YYYY}/{MM}/{order_number}/anak/{uuid}.{ext}
-- Segmen ke-3 tetap nomor order, jadi `storage_documentation_read` yang
-- men-scope lewat `split_part(name, '/', 3)` ikut berlaku tanpa diubah —
-- mitra tetap hanya bisa membaca berkas ordernya sendiri.
