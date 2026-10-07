-- =============================================================================
-- Varian katering: katering_ayam, katering_daging, katering_kebuli
--
-- **Berkas ini sengaja hanya berisi tiga baris.** Postgres menolak nilai enum
-- baru *dipakai* dalam transaksi yang sama dengan yang menambahkannya, dan
-- `supabase db push` membungkus tiap berkas sebagai satu transaksi. Seed paket
-- dan perubahan fungsi karenanya tinggal di berkas berikutnya.
--
-- Pola ini sama persis dengan `20260921010000_service_type_katering.sql`.
-- =============================================================================

alter type public.service_type add value if not exists 'katering_ayam';
alter type public.service_type add value if not exists 'katering_daging';
alter type public.service_type add value if not exists 'katering_kebuli';
