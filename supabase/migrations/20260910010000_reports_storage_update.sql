-- Bucket `reports`: izinkan menimpa berkas yang sudah ada.
--
-- `generateReport` mengunggah dengan `upsert: true`
-- (`server/actions/reports.ts:132`), dan `upsert` di Storage adalah UPDATE
-- terhadap baris `storage.objects` yang sudah ada — bukan INSERT. Bucket ini
-- hanya punya policy SELECT dan INSERT, jadi setiap penimpaan ditolak RLS.
--
-- Akibatnya di produksi: PDF versi 1 order IA-202609-0002 sudah terunggah
-- (2.5 MB), tetapi barisnya tidak pernah masuk tabel `reports` karena aksinya
-- berhenti di unggah. Percobaan berikutnya menghitung `nextVersion` dari tabel
-- yang kosong, jadi selalu v1 — path yang sama, ditolak lagi. Order yang
-- pekerjaannya sudah lengkap terkunci permanen dengan pesan "Gagal menyimpan
-- PDF laporan".
--
-- Dibuktikan terhadap produksi sebagai superadmin sungguhan:
--   POST x-upsert ke path baru        -> 200
--   POST x-upsert ke path yang ada    -> 403 "new row violates RLS policy"
--
-- Kewenangannya sama dengan INSERT-nya (`is_staff()`): yang boleh membuat
-- laporan boleh pula membuatnya ulang. Menaikkannya ke superadmin akan
-- membuat admin bisa membuat v1 tapi tidak bisa mengulanginya saat render
-- pertama menghasilkan berkas yang keliru.
create policy storage_reports_update on storage.objects
  for update to authenticated
  using (bucket_id = 'reports' and public.is_staff())
  with check (bucket_id = 'reports' and public.is_staff());
