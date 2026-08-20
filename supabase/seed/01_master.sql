-- =============================================================================
-- Seed 01 — Data organisasi (LOKAL / NON-PRODUKSI)
--
-- Dijalankan otomatis oleh `supabase db reset` (config.toml: db.seed.sql_paths).
-- **Tidak ikut `supabase db push`** — jadi isi berkas ini tidak akan pernah
-- sampai ke cloud. Katalog program & app_settings sengaja bukan di sini
-- melainkan di migration 20260820001200_reference_data.sql, karena keduanya
-- memang harus ada di semua environment.
--
-- Mitra & lokasi di bawah adalah contoh untuk pengembangan saja; di produksi
-- keduanya diisi lewat halaman /vendors.
-- =============================================================================

-- --- Mitra pelaksana --------------------------------------------------------
--
-- Dua mitra dengan kemampuan berbeda, supaya penyaringan mode benar-benar
-- teruji saat dipakai: mitra kedua tidak melayani "kirim", jadi ia tidak boleh
-- muncul sebagai pilihan untuk order Aqiqah Kirim.
insert into public.vendors (
  id, code, name, legal_name, owner_name, phone, whatsapp, email,
  province_code, province, city_code, city,
  address_detail, address, postal_code,
  agreement_number, agreement_start, daily_capacity, service_modes,
  bank_name, bank_account_no, bank_account_name, is_active
) values
  (
    'c0000000-0000-4000-8000-000000000001', 'DAPURBDG', 'Dapur Berkah Bandung',
    'CV Dapur Berkah Sejahtera', 'Hendra Kusuma',
    '022-1234567', '6281200000001', 'dapurberkah@example.test',
    '32', 'JAWA BARAT', '32.73', 'KOTA BANDUNG',
    'Jl. Soekarno Hatta No. 12',
    'Jl. Soekarno Hatta No. 12, KOTA BANDUNG, JAWA BARAT 40286', '40286',
    'PKS-2026-001', '2026-01-15', 20, '{salur,kirim}',
    'BSI', '7001234567', 'CV Dapur Berkah Sejahtera', true
  ),
  (
    'c0000000-0000-4000-8000-000000000002', 'RPHJKT', 'RPH Amanah Jakarta',
    null, 'Slamet Riyadi',
    '021-7654321', '6281200000002', null,
    '31', 'DKI JAKARTA', '31.74', 'KOTA ADM. JAKARTA SELATAN',
    'Jl. Warung Buncit Raya No. 8',
    'Jl. Warung Buncit Raya No. 8, KOTA ADM. JAKARTA SELATAN, DKI JAKARTA 12510', '12510',
    'PKS-2026-002', '2026-02-01', 12, '{salur}',
    'BCA', '2110009988', 'Slamet Riyadi', true
  )
on conflict (id) do nothing;

-- --- Wilayah layanan --------------------------------------------------------
insert into public.vendor_coverage (vendor_id, region_code, region_name, level) values
  ('c0000000-0000-4000-8000-000000000001', '32.73', 'KOTA BANDUNG', 2),
  ('c0000000-0000-4000-8000-000000000001', '32.04', 'KABUPATEN BANDUNG', 2),
  ('c0000000-0000-4000-8000-000000000002', '31.74', 'KOTA ADM. JAKARTA SELATAN', 2)
on conflict (vendor_id, region_code) do nothing;

-- --- Modal per paket --------------------------------------------------------
--
-- Angka internal: pembeli tetap melihat `services.price`. Margin sebuah order
-- adalah selisih keduanya. Sengaja berbeda antar mitra — itulah gunanya
-- disimpan per mitra, bukan satu kolom di `services` seperti skema lama.
insert into public.vendor_services (vendor_id, service_id, vendor_price, is_offered) values
  -- Dapur Berkah: acuan docs/28 (margin 20%)
  ('c0000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 1840000, true),
  ('c0000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002', 2325000, true),
  ('c0000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000003', 2975000, true),
  ('c0000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000011',   17500, true),
  ('c0000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000012',   22500, true),
  ('c0000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000013',   26500, true),
  -- RPH Amanah: modal sedikit lebih tinggi, margin karenanya lebih tipis
  ('c0000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001', 1950000, true),
  ('c0000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002', 2450000, true),
  ('c0000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000021', 2600000, true)
on conflict (vendor_id, service_id) do nothing;

-- --- Lokasi pemotongan ------------------------------------------------------
--
-- Milik mitra, bukan milik cabang. Dengan begitu pemeriksaan "lokasi harus
-- milik mitra order ini" di `saveSchedule` benar-benar punya arti.
insert into public.locations (id, vendor_id, name, address, lat, lng) values
  (
    'a1000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
    'RPH Dapur Berkah', 'Jl. Rancasari No. 5, Bandung', -6.945000, 107.680000
  ),
  (
    'a1000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002',
    'RPH Amanah Pejaten', 'Jl. Pejaten Raya No. 17, Jakarta', -6.290000, 106.835000
  ),
  (
    -- Lokasi tanpa mitra: milik Sukses Aqiqah sendiri, boleh dipakai siapa pun.
    'a1000000-0000-4000-8000-000000000003', null,
    'Masjid Al-Ikhlas Bandung', 'Jl. Cikutra No. 21, Bandung', -6.898000, 107.634000
  )
on conflict (id) do nothing;
