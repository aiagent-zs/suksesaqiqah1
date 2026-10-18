-- =============================================================================
-- Nonaktifkan paket katering lama
--
-- Tiga varian katering baru (katering_ayam, katering_daging, katering_kebuli)
-- menggantikan paket 'katering' biasa. Paket katering biasa dinonaktifkan
-- dan di-soft-delete agar tidak lagi muncul di katalog maupun checkout.
-- =============================================================================

update public.services
set is_active = false,
    show_on_landing = false,
    deleted_at = coalesce(deleted_at, now())
where type = 'katering';
