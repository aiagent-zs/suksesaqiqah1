-- =============================================================================
-- Jeda persiapan diturunkan: 4 hari → 1 hari
--
-- `20260824010000` menutup hari pengisian form dan 3 hari sesudahnya, supaya
-- order tidak masuk untuk tanggal yang mustahil disiapkan. Yang terbukti dari
-- pemakaian: jeda selebar itu ikut menolak pemesan yang sebetulnya masih bisa
-- dilayani — dan sanggup-tidaknya sebuah tanggal adalah penilaian admin saat
-- konfirmasi, bukan sesuatu yang layak ditutup form sebelum siapa pun bertanya.
--
-- Aturan barunya: hanya **hari pengisian** yang tertutup. Mengisi tanggal 10
-- paling cepat mendapat tanggal 11. Yang dijaga tinggal satu hal, dan itu yang
-- memang tidak pernah bisa dikerjakan: aqiqah untuk hari yang sama.
--
-- Batas atas tidak ikut berubah. `20260824010000` melonggarkannya 7 → 30 karena
-- jendela lama nyaris habis dimakan jeda 4 hari; jeda yang menyusut tidak
-- menuntutnya kembali menyempit.
--
-- `create_guest_order` sengaja TIDAK ditulis ulang: ia membaca
-- `booking_min_days()` saat dipanggil, dan pesan penolakannya sudah memakai
-- `%` atas nilai itu — bukan angka yang diketik ke dalam teks. Jadi menyetel
-- `app_settings` di sini sudah cukup untuk mengubah perilakunya, dan tidak ada
-- salinan fungsi baru yang harus dijaga tetap sama dengan yang lama.
-- =============================================================================

-- Fallback-nya ikut turun. Ia hanya terpakai bila baris `app_settings`-nya
-- hilang — tapi bila sampai terjadi, yang berlaku diam-diam haruslah aturan
-- yang sekarang, bukan jeda 4 hari yang sudah dicabut.
create or replace function public.booking_min_days()
returns int
language sql stable security definer set search_path = public as $$
  select coalesce((value ->> 'days')::int, 1)
  from public.app_settings where key = 'booking_min_days';
$$;

comment on function public.booking_min_days is
  'Jeda persiapan minimum sebelum tanggal pelaksanaan, dalam hari. 1 = hanya hari pengisian yang ditolak. Dibaca create_guest_order DAN sisi klien.';

update public.app_settings
set
  value = '{"days": 1}'::jsonb,
  description = 'Jeda persiapan minimum dari hari pemesanan ke tanggal pelaksanaan, dalam hari. 1 = hanya hari pengisian form yang tidak bisa dipilih.'
where key = 'booking_min_days';
