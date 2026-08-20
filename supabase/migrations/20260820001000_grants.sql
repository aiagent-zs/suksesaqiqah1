-- =============================================================================
-- Desain ulang skema · 10 Grant
--
-- RLS tidak berlaku sebelum ada GRANT: keduanya lapisan yang berbeda. Tanpa
-- grant eksplisit, `anon` dan `authenticated` tidak bisa menyentuh apa pun —
-- itu keadaan awal yang memang diinginkan, lalu dibuka sepotong demi sepotong.
--
-- Permukaan `anon` sengaja sangat sempit: hanya katalog, wilayah, dan dua RPC.
-- Seluruh tabel operasional tertutup rapat untuknya.
-- =============================================================================

grant usage on schema public to anon, authenticated;

-- --- authenticated ----------------------------------------------------------
--
-- Kewenangan sesungguhnya ditentukan RLS di migration 08; grant ini hanya
-- membuka pintunya.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- --- anon -------------------------------------------------------------------
--
-- Pengunjung anonim hanya boleh membaca katalog dan daftar wilayah. Keduanya
-- memang data publik: harga yang dipajang di landing, dan wilayah administratif
-- Kemendagri yang dibaca langsung peramban saat mengisi alamat.
--
-- Yang TIDAK diberikan, dan itu disengaja: seluruh tabel operasional. Satu-
-- satunya jalan tulis milik `anon` adalah RPC `create_guest_order` yang
-- SECURITY DEFINER — bentuk dan batasnya terkunci di level database, bukan di
-- kebenaran kode TypeScript.
grant select on public.services to anon;
grant select on public.regions  to anon;

-- --- Default untuk tabel yang dibuat kemudian -------------------------------
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
