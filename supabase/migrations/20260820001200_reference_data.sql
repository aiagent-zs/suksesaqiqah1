-- =============================================================================
-- Desain ulang skema · 12 Data referensi
--
-- Ikut ke SEMUA environment lewat `supabase db push` — berbeda dari
-- `supabase/seed/` yang hanya jalan lokal saat `db reset`. Yang masuk ke sini
-- hanya data yang memang harus ada di mana pun: katalog program dan setting
-- sistem. Data organisasi (mitra, lokasi) dan akun demo tetap di seed.
--
-- Harga acuan: docs/28_HARGA_PROGRAM.md. Yang tersimpan di sini **hanya harga
-- jual** — modal per mitra tinggal di `vendor_services`, karena satu paket bisa
-- dikerjakan beberapa mitra dengan modal berbeda.
-- =============================================================================

-- --- Program Aqiqah ---------------------------------------------------------
insert into public.services (id, type, name, slug, description, price, sort_order, meta) values
  (
    'a2000000-0000-4000-8000-000000000001', 'aqiqah', 'Aqiqah Ekonomi', 'aqiqah-ekonomi',
    'Paket aqiqah kambing dengan olahan standar, hemat namun tetap syar''i.',
    2300000, 1,
    '{"hasil": {"porsi": 80, "jenis": "gulai & sate"}, "cocok_untuk": "keluarga kecil"}'::jsonb
  ),
  (
    'a2000000-0000-4000-8000-000000000002', 'aqiqah', 'Aqiqah Favorit', 'aqiqah-favorit',
    'Paket paling banyak dipilih: kambing lebih besar dengan variasi olahan lengkap.',
    2800000, 2,
    '{"hasil": {"porsi": 110, "jenis": "gulai, sate, tongseng"}, "cocok_untuk": "syukuran keluarga"}'::jsonb
  ),
  (
    'a2000000-0000-4000-8000-000000000003', 'aqiqah', 'Aqiqah Premium', 'aqiqah-premium',
    'Paket premium dengan kambing pilihan dan penyajian terbaik.',
    3600000, 3,
    '{"hasil": {"porsi": 150, "jenis": "gulai, sate, tongseng, krengsengan"}, "cocok_untuk": "acara besar"}'::jsonb
  )
on conflict (id) do nothing;

-- --- Paket Nasi Box ---------------------------------------------------------
insert into public.services (id, type, name, slug, description, price, sort_order, meta) values
  ('a2000000-0000-4000-8000-000000000011', 'nasi_box', 'Paket A', 'paket-a',
   'Nasi box aqiqah paket dasar.', 21000, 11,
   '{"items": ["nasi putih", "gulai kambing", "acar", "kerupuk"]}'::jsonb),
  ('a2000000-0000-4000-8000-000000000012', 'nasi_box', 'Paket B', 'paket-b',
   'Nasi box aqiqah dengan tambahan sate.', 27000, 12,
   '{"items": ["nasi putih", "gulai kambing", "sate", "acar", "kerupuk"]}'::jsonb),
  ('a2000000-0000-4000-8000-000000000013', 'nasi_box', 'Paket C', 'paket-c',
   'Nasi box favorit dengan lauk lebih lengkap.', 32000, 13,
   '{"items": ["nasi putih", "gulai kambing", "sate", "tongseng", "acar", "kerupuk"], "favorit": true}'::jsonb),
  ('a2000000-0000-4000-8000-000000000014', 'nasi_box', 'Paket D', 'paket-d',
   'Nasi box dengan porsi dan lauk lebih besar.', 45000, 14,
   '{"items": ["nasi putih", "gulai kambing", "sate", "tongseng", "buah", "acar", "kerupuk"]}'::jsonb),
  ('a2000000-0000-4000-8000-000000000015', 'nasi_box', 'Paket E', 'paket-e',
   'Nasi box premium dengan penyajian terbaik.', 70000, 15,
   '{"items": ["nasi putih", "gulai kambing", "sate", "tongseng", "krengsengan", "buah", "puding", "acar", "kerupuk"], "premium": true}'::jsonb)
on conflict (id) do nothing;

-- --- Qurban -----------------------------------------------------------------
insert into public.services (id, type, name, slug, description, price, sort_order, meta) values
  ('a2000000-0000-4000-8000-000000000021', 'qurban', 'Qurban Kambing', 'qurban-kambing',
   'Kambing qurban beserta penyaluran daging.', 3000000, 21, '{}'::jsonb),
  ('a2000000-0000-4000-8000-000000000022', 'qurban', 'Qurban Sapi (1/7)', 'qurban-sapi-patungan',
   'Satu bagian dari sapi qurban patungan tujuh orang.', 3500000, 22, '{}'::jsonb)
on conflict (id) do nothing;

-- --- Setting sistem ---------------------------------------------------------
insert into public.app_settings (key, value, description) values
  (
    'min_dp_ratio',
    '{"ratio": 0.5}'::jsonb,
    'Rasio DP minimum sebelum order boleh dijadwalkan. 0.5 = 50%.'
  ),
  (
    'booking_max_days',
    '{"days": 7}'::jsonb,
    'Batas jendela pemesanan dari checkout publik, dalam hari. Dibaca RPC create_guest_order DAN sisi klien — satu angka supaya form dan database tidak pernah berselisih.'
  )
on conflict (key) do nothing;
