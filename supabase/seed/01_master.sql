-- =============================================================================
-- Seed 01 — Data organisasi (LOKAL / NON-PRODUKSI)
-- Dijalankan otomatis oleh `supabase db reset` (config.toml: db.seed.sql_paths).
--
-- Katalog program & app_settings TIDAK ada di sini — keduanya sudah menjadi
-- migration 20260806010900_reference_data.sql supaya ikut `supabase db push`
-- ke staging/produksi. Cabang & lokasi di bawah adalah contoh untuk dev saja;
-- di produksi diisi lewat dashboard.
-- =============================================================================

-- --- Cabang -----------------------------------------------------------------
insert into public.branches (id, name, code, address, phone) values
  ('a0000000-0000-4000-8000-000000000001', 'Sukses Aqiqah Bandung', 'BDG', 'Jl. Soekarno Hatta No. 12, Bandung', '022-1234567'),
  ('a0000000-0000-4000-8000-000000000002', 'Sukses Aqiqah Jakarta', 'JKT', 'Jl. Warung Buncit Raya No. 8, Jakarta Selatan', '021-7654321'),
  ('a0000000-0000-4000-8000-000000000003', 'Sukses Aqiqah Bekasi',  'BKS', 'Jl. Ahmad Yani No. 45, Bekasi', '021-8899000')
on conflict (id) do nothing;

-- --- Lokasi pemotongan ------------------------------------------------------
insert into public.locations (id, branch_id, name, address, lat, lng) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Masjid Al-Ikhlas Bandung',   'Jl. Cikutra No. 21, Bandung',        -6.898000, 107.634000),
  ('a1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'RPH Mitra Bandung',          'Jl. Rancasari No. 5, Bandung',       -6.945000, 107.680000),
  ('a1000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002', 'Masjid Nurul Iman Jakarta',  'Jl. Mampang Prapatan No. 3, Jakarta', -6.245000, 106.822000),
  ('a1000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002', 'RPH Mitra Jakarta',          'Jl. Pejaten Raya No. 17, Jakarta',   -6.290000, 106.835000),
  ('a1000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000003', 'Masjid Baiturrahman Bekasi', 'Jl. Kemang Pratama No. 9, Bekasi',   -6.248000, 106.998000)
on conflict (id) do nothing;
