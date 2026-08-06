-- =============================================================================
-- Tahap 1 — Database · 10 Data referensi (ikut ke SEMUA environment)
--
-- Berbeda dari supabase/seed/ yang hanya jalan lokal saat `db reset`, isi file
-- ini ikut terbawa `supabase db push` ke staging/produksi. Yang masuk ke sini
-- hanya data yang memang harus ada di mana pun: katalog program & setting sistem.
--
-- Data organisasi (cabang, lokasi) dan data demo tetap di supabase/seed/.
-- Harga acuan: docs/28_HARGA_PROGRAM.md
-- =============================================================================

-- --- Program Aqiqah (docs/28) -----------------------------------------------
insert into public.services (id, type, name, slug, description, vendor_price, margin_amount, price, sort_order, meta) values
  (
    'a2000000-0000-4000-8000-000000000001', 'aqiqah', 'Aqiqah Ekonomi', 'aqiqah-ekonomi',
    'Paket aqiqah kambing dengan olahan standar, hemat namun tetap syar''i.',
    1840000, 368000, 2300000, 1,
    '{"harga_kambing": 1400000, "biaya_masak": 440000, "hasil": {"porsi": 80, "jenis": "gulai & sate"}, "cocok_untuk": "keluarga kecil"}'::jsonb
  ),
  (
    'a2000000-0000-4000-8000-000000000002', 'aqiqah', 'Aqiqah Favorit', 'aqiqah-favorit',
    'Paket paling banyak dipilih: kambing lebih besar dengan variasi olahan lengkap.',
    2325000, 465000, 2800000, 2,
    '{"harga_kambing": 1750000, "biaya_masak": 575000, "hasil": {"porsi": 110, "jenis": "gulai, sate, tongseng"}, "cocok_untuk": "syukuran keluarga"}'::jsonb
  ),
  (
    'a2000000-0000-4000-8000-000000000003', 'aqiqah', 'Aqiqah Premium', 'aqiqah-premium',
    'Paket premium dengan kambing pilihan dan penyajian terbaik.',
    2975000, 595000, 3600000, 3,
    '{"harga_kambing": 2200000, "biaya_masak": 775000, "hasil": {"porsi": 150, "jenis": "gulai, sate, tongseng, krengsengan"}, "cocok_untuk": "acara besar"}'::jsonb
  )
on conflict (id) do nothing;

-- --- Paket Nasi Box Aqiqah (docs/28) ----------------------------------------
insert into public.services (id, type, name, slug, description, vendor_price, margin_amount, price, sort_order, meta) values
  (
    'a2000000-0000-4000-8000-000000000011', 'nasi_box', 'Paket A', 'paket-a',
    'Nasi box aqiqah paket dasar.',
    17500, 3500, 21000, 11,
    '{"items": ["nasi putih", "gulai kambing", "acar", "kerupuk"]}'::jsonb
  ),
  (
    'a2000000-0000-4000-8000-000000000012', 'nasi_box', 'Paket B', 'paket-b',
    'Nasi box aqiqah dengan tambahan sate.',
    22500, 4500, 27000, 12,
    '{"items": ["nasi putih", "gulai kambing", "sate 3 tusuk", "acar", "kerupuk"]}'::jsonb
  ),
  (
    'a2000000-0000-4000-8000-000000000013', 'nasi_box', 'Paket C Favorit', 'paket-c-favorit',
    'Paket nasi box paling laris.',
    26500, 5300, 32000, 13,
    '{"items": ["nasi kebuli", "gulai kambing", "sate 5 tusuk", "acar", "kerupuk", "buah"]}'::jsonb
  ),
  (
    'a2000000-0000-4000-8000-000000000014', 'nasi_box', 'Paket D', 'paket-d',
    'Nasi box lengkap dengan tambahan lauk.',
    37000, 7400, 45000, 14,
    '{"items": ["nasi kebuli", "gulai kambing", "sate 5 tusuk", "tongseng", "acar", "kerupuk", "buah", "air mineral"]}'::jsonb
  ),
  (
    'a2000000-0000-4000-8000-000000000015', 'nasi_box', 'Paket E Premium', 'paket-e-premium',
    'Nasi box premium untuk tamu kehormatan.',
    58000, 11600, 70000, 15,
    '{"items": ["nasi briyani", "gulai kambing", "sate 8 tusuk", "tongseng", "krengsengan", "acar", "kerupuk", "buah potong", "air mineral", "dessert"]}'::jsonb
  )
on conflict (id) do nothing;

-- --- Pengaturan sistem ------------------------------------------------------
insert into public.app_settings (key, value, description) values
  (
    'min_dp_ratio',
    '{"ratio": 0.5}'::jsonb,
    'Rasio DP minimum agar order boleh naik ke `scheduled` (docs/08 section 2).'
  ),
  (
    'sla_hours',
    '{"payment_verification": 24, "distribution": 24, "documentation": 24, "report": 48}'::jsonb,
    'Target SLA per tahap dalam jam (docs/08 section 3).'
  ),
  (
    'report_link_ttl_minutes',
    '{"minutes": 15}'::jsonb,
    'Masa berlaku signed URL media & PDF laporan (docs/17 section 4).'
  )
on conflict (key) do nothing;
