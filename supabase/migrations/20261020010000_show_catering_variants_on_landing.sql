-- =============================================================================
-- Tampilkan varian katering di halaman depan
--
-- Keenam paket varian katering (20261007020000) masuk dengan
-- show_on_landing = false, sementara paket 'katering' lama sudah dinonaktifkan
-- (20261007030000). Akibatnya halaman depan tidak memajang katering sama
-- sekali. Pemilik tetap bisa mematikannya per paket lewat halaman katalog.
-- =============================================================================

update public.services
set show_on_landing = true
where type in ('katering_ayam', 'katering_daging', 'katering_kebuli')
  and is_active
  and deleted_at is null;
