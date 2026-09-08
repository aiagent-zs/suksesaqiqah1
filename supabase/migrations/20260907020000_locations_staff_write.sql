-- =============================================================================
-- Lokasi bisa didaftarkan staf, bukan hanya superadmin
--
-- `locations` lahir dengan `locations_write` yang menuntut `is_superadmin()`,
-- dan sampai sekarang **tidak ada satu pun jalan masuk lewat aplikasi**: tidak
-- ada halaman, tidak ada server action, tidak ada form. Barisnya hanya lahir
-- dari seed. Menambah tempat baru berarti membuka dashboard Supabase.
--
-- Itu tidak berkelanjutan justru karena sifat datanya: lokasi salur berganti
-- hampir tiap order — masjid, panti, kampung penerima manfaat yang
-- berbeda-beda — sementara yang tahu tempatnya adalah admin yang sedang
-- menjadwalkan order itu. Yang terjadi selama pintunya tertutup bukan "admin
-- meminta tolong superadmin", melainkan alamat ditulis di kolom catatan jadwal:
-- di luar jangkauan `v_open_orders`, di luar laporan peserta, dan tidak bisa
-- dipakai ulang order berikutnya.
--
-- **Menghapus tetap berhenti di superadmin.** `orders` dan `schedules` menahan
-- lokasi lewat rujukan, dan menghapus tempat yang sudah dipakai order lama
-- memutus jejak ke mana hewan itu disalurkan. Karena itu kebijakannya dipecah
-- per operasi, bukan satu `for all` seperti sebelumnya:
--
--   insert / update  → staf (admin & superadmin)
--   delete           → superadmin
--
-- Penyuntingan ikut dibuka untuk staf: salah ketik nama tempat paling sering
-- ketahuan justru saat order berikutnya dijadwalkan di sana, oleh admin yang
-- sama yang tidak bisa membetulkannya sendiri.
--
-- `vendor_id` tetap tidak boleh datang dari klien — `createLocation` mengisinya
-- dari mitra order yang bersangkutan. Kebijakan ini tidak bisa menegakkan hal
-- itu (ia tidak tahu order mana yang sedang dijadwalkan), jadi penjagaannya ada
-- di server action, dan `saveSchedule` memeriksa kepemilikannya lagi saat
-- lokasi itu benar-benar dipasang ke sebuah order.
-- =============================================================================

drop policy if exists locations_write on public.locations;

create policy locations_insert on public.locations
  for insert to authenticated
  with check (public.is_staff());

create policy locations_update on public.locations
  for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy locations_delete on public.locations
  for delete to authenticated
  using (public.is_superadmin());
