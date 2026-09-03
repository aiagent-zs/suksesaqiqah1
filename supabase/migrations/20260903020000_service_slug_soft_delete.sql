-- =============================================================================
-- Slug unik hanya di antara paket yang masih hidup
--
-- `services.slug` unik tanpa memandang `deleted_at`, dan `deleteService()`
-- memakai **soft delete**. Akibatnya slug bekas paket yang sudah dihapus
-- terkunci selamanya: mendaftarkan ulang paket dengan slug yang sama ditolak
-- `services_slug_key`.
--
-- Yang membuatnya menyesatkan bukan penolakannya, melainkan pesannya.
-- `createService()` menerjemahkan `23505` jadi *"Slug ini sudah dipakai paket
-- lain"* — dan paket itu **tidak tampil di layar mana pun**, sebab seluruh
-- query menyaring `deleted_at is null`. Operator diberi tahu ada bentrokan
-- dengan sesuatu yang tidak bisa ia lihat, cari, maupun hapus.
--
-- Indeks unik parsial menutupnya: keunikan tetap ditegakkan di antara paket
-- yang hidup — yang penting, sebab `?paket={slug}` mencocokkan slug dan dua
-- paket hidup berslug sama membuat pengunjung tidak bisa memilih salah satu —
-- sementara slug milik paket terhapus dilepaskan.
--
-- Pola yang sama sudah dipakai `notifications` untuk `event_key` (migration
-- `20260824020000`): indeks unik parsial, bukan constraint kolom.
-- =============================================================================

alter table public.services drop constraint if exists services_slug_key;

create unique index if not exists services_slug_active_key
  on public.services (slug)
  where deleted_at is null;

comment on index public.services_slug_active_key is
  'Slug unik di antara paket hidup saja. Paket ter-soft-delete melepaskan slugnya supaya bisa didaftarkan ulang.';
