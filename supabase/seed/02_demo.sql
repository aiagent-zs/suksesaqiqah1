-- =============================================================================
-- Seed 02 — Data demo (LOKAL / NON-PRODUKSI)
--
-- Tujuannya dua: view KPI mengembalikan angka yang bukan nol, dan tersedia satu
-- akun per role untuk menguji Auth & RLS.
--
-- **Password semua akun demo: Password123!**
-- Berkas ini TIDAK ikut `supabase db push`, jadi akun-akun ini tidak akan
-- pernah sampai ke cloud. Superadmin pertama di produksi dibuat lewat dashboard
-- Supabase, lalu sisanya lewat halaman /users.
-- =============================================================================

-- --- Akun demo --------------------------------------------------------------
--
-- Trigger `handle_new_user` membuat baris `profiles` otomatis — selalu sebagai
-- **vendor non-aktif**, apa pun isi metadata. Itu disengaja: kalau role dibaca
-- dari metadata, siapa pun yang bisa mendaftar mandiri bisa menyisipkan
-- `{"role":"admin"}`. Peran sesungguhnya disetel lewat UPDATE di bawah.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  u.id,
  'authenticated',
  'authenticated',
  u.email,
  extensions.crypt('Password123!', extensions.gen_salt('bf')),
  now(), now(), now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  jsonb_strip_nulls(jsonb_build_object('full_name', u.full_name, 'vendor_id', u.vendor_id)),
  '', '', '', ''
from (
  values
    (
      'd0000000-0000-4000-8000-000000000001'::uuid,
      'superadmin@suksesaqiqah.test', 'Sholahuddin (Superadmin)', null::uuid
    ),
    (
      'd0000000-0000-4000-8000-000000000002'::uuid,
      'admin@suksesaqiqah.test', 'Rani Admin', null::uuid
    ),
    (
      'd0000000-0000-4000-8000-000000000003'::uuid,
      'dapurberkah@suksesaqiqah.test', 'Hendra Kusuma', 'c0000000-0000-4000-8000-000000000001'::uuid
    ),
    (
      'd0000000-0000-4000-8000-000000000004'::uuid,
      'rphamanah@suksesaqiqah.test', 'Slamet Riyadi', 'c0000000-0000-4000-8000-000000000002'::uuid
    )
) as u(id, email, full_name, vendor_id)
on conflict (id) do nothing;

-- Setel peran & aktifkan. Sama persis dengan yang dikerjakan
-- `server/actions/users.ts` sesudah memanggil Admin API.
update public.profiles set role = 'superadmin', is_active = true
  where id = 'd0000000-0000-4000-8000-000000000001';
update public.profiles set role = 'admin', is_active = true
  where id = 'd0000000-0000-4000-8000-000000000002';
update public.profiles set role = 'vendor', is_active = true
  where id in (
    'd0000000-0000-4000-8000-000000000003',
    'd0000000-0000-4000-8000-000000000004'
  );

-- --- Peserta ----------------------------------------------------------------
insert into public.participants (id, name, phone, email, address) values
  (
    'e0000000-0000-4000-8000-000000000001', 'Budi Santoso', '081234567890',
    'budi@example.test', 'Jl. Merdeka No. 1, Bandung'
  ),
  (
    'e0000000-0000-4000-8000-000000000002', 'Siti Aminah', '081298765432',
    null, 'Jl. Kenanga No. 5, Jakarta Selatan'
  ),
  (
    'e0000000-0000-4000-8000-000000000003', 'Ahmad Fauzi', '081211112222',
    'ahmad@example.test', null
  )
on conflict (id) do nothing;

-- =============================================================================
-- Order 1 — Aqiqah KIRIM, sudah berjalan sampai tahap masak
--
-- Menempuh percabangan `kirim`: persiapan -> sembelih -> masak -> kirim ->
-- terkirim. Dua tahap pertama tervalidasi, masak menunggu keputusan admin —
-- keadaan yang paling berguna untuk menguji layar validasi.
-- =============================================================================
insert into public.orders (
  id, order_number, participant_id, vendor_id, created_by,
  status, payment_status, total_amount, paid_amount,
  distribution_mode, aqiqah_for, child_birth_place, child_birth_date,
  requested_date, requested_time,
  delivery_province_code, delivery_province, delivery_city_code, delivery_city,
  delivery_district_code, delivery_district, delivery_village_code, delivery_village,
  delivery_postal_code, delivery_detail, delivery_address,
  guest_verified_at, guest_verified_by
) values (
  'f0000000-0000-4000-8000-000000000001', 'IA-202608-0001',
  'e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', null,
  'in_progress'::public.order_status, 'paid'::public.payment_status, 2800000, 2800000,
  'kirim'::public.distribution_mode, 'laki_laki', 'Bandung', '2026-07-28',
  current_date + 2, '09:00',
  '32', 'JAWA BARAT', '32.73', 'KOTA BANDUNG',
  '32.73.11', 'ANTAPANI', '32.73.11.1001', 'ANTAPANI KIDUL',
  '40291', 'Jl. Purwakarta No. 88',
  'Jl. Purwakarta No. 88, Kel. ANTAPANI KIDUL, Kec. ANTAPANI, KOTA BANDUNG, JAWA BARAT 40291',
  now() - interval '3 days', 'd0000000-0000-4000-8000-000000000002'
) on conflict (id) do nothing;

insert into public.order_items (order_id, service_id, qty, unit_price, vendor_unit_price, meta) values
  (
    'f0000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002',
    1, 2800000, 2325000, '{"on_behalf_of": "Muhammad Al-Fatih bin Budi Santoso"}'::jsonb
  )
on conflict do nothing;

insert into public.animals (id, order_id, species, tag_code, weight_kg, on_behalf_of) values
  (
    'a9000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001',
    'kambing'::public.animal_species, 'KMB-001', 28.5, 'Muhammad Al-Fatih bin Budi Santoso'
  )
on conflict (id) do nothing;

insert into public.payments (order_id, amount, method, status, recorded_by, verified_by, verified_at, note) values
  (
    'f0000000-0000-4000-8000-000000000001', 2800000, 'transfer', 'verified'::public.payment_verification_status,
    'd0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001',
    now() - interval '3 days', 'Lunas di muka'
  )
on conflict do nothing;

insert into public.schedules (order_id, location_id, scheduled_date, scheduled_time, notes) values
  (
    'f0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
    current_date + 2, '09:00', 'Pemesan minta dikabari sebelum berangkat'
  )
on conflict (order_id) do nothing;

-- Daftar tahap: dibuat manual di sini karena trigger `generate_stage_checklist`
-- hanya menyala pada transisi status ke `assigned`, sementara seed menyisipkan
-- order yang sudah berstatus `in_progress`.
insert into public.order_stage_events (
  order_id, stage, seq, animal_id, status,
  reported_by, reported_at, occurred_at, notes,
  validated_by, validated_at
) values
  (
    'f0000000-0000-4000-8000-000000000001', 'persiapan'::public.fulfilment_stage, 1, null, 'validated'::public.stage_event_status,
    'd0000000-0000-4000-8000-000000000003', now() - interval '2 days',
    now() - interval '2 days', 'Kambing tiba di RPH, kondisi sehat',
    'd0000000-0000-4000-8000-000000000002', now() - interval '2 days'
  ),
  (
    'f0000000-0000-4000-8000-000000000001', 'sembelih'::public.fulfilment_stage, 2,
    'a9000000-0000-4000-8000-000000000001', 'validated'::public.stage_event_status,
    'd0000000-0000-4000-8000-000000000003', now() - interval '1 day',
    now() - interval '1 day', 'Disembelih sesuai syariat, disaksikan petugas',
    'd0000000-0000-4000-8000-000000000002', now() - interval '1 day'
  ),
  (
    -- Menunggu keputusan admin — inilah yang mengisi antrian validasi.
    'f0000000-0000-4000-8000-000000000001', 'masak'::public.fulfilment_stage, 3, null, 'reported'::public.stage_event_status,
    'd0000000-0000-4000-8000-000000000003', now() - interval '4 hours',
    now() - interval '5 hours', 'Diolah jadi gulai dan sate, 110 porsi',
    null, null
  ),
  ('f0000000-0000-4000-8000-000000000001', 'kirim'::public.fulfilment_stage, 4, null, 'pending'::public.stage_event_status, null, null, null, null, null, null),
  ('f0000000-0000-4000-8000-000000000001', 'terkirim'::public.fulfilment_stage, 5, null, 'pending'::public.stage_event_status, null, null, null, null, null, null)
on conflict do nothing;

-- =============================================================================
-- Order 2 — Aqiqah SALUR, baru ditugaskan
--
-- Percabangan `salur`: persiapan -> sembelih -> masak -> salur. Seluruh
-- tahapnya masih menunggu, jadi layar vendor menampilkan daftar kerja kosong
-- yang siap diisi — dan tombol tahap kedua seharusnya mati.
-- =============================================================================
insert into public.orders (
  id, order_number, participant_id, vendor_id, created_by,
  status, payment_status, total_amount, paid_amount,
  distribution_mode, aqiqah_for, child_birth_place, child_birth_date,
  requested_date, requested_time, recipient_institution,
  guest_verified_at, guest_verified_by
) values (
  'f0000000-0000-4000-8000-000000000002', 'IA-202608-0002',
  'e0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', null,
  'assigned'::public.order_status, 'partial'::public.payment_status, 2300000, 1200000,
  'salur'::public.distribution_mode, 'perempuan', 'Jakarta', '2026-08-05',
  current_date + 4, '08:00', 'Pesantren Nurul Iman',
  now() - interval '1 day', 'd0000000-0000-4000-8000-000000000002'
) on conflict (id) do nothing;

insert into public.order_items (order_id, service_id, qty, unit_price, vendor_unit_price, meta) values
  (
    'f0000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001',
    1, 2300000, 1950000, '{"on_behalf_of": "Khadijah binti Siti Aminah"}'::jsonb
  )
on conflict do nothing;

insert into public.animals (id, order_id, species, tag_code, on_behalf_of) values
  (
    'a9000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000002',
    'kambing'::public.animal_species, 'KMB-002', 'Khadijah binti Siti Aminah'
  )
on conflict (id) do nothing;

insert into public.payments (order_id, amount, method, status, recorded_by, verified_by, verified_at) values
  (
    'f0000000-0000-4000-8000-000000000002', 1200000, 'transfer', 'verified'::public.payment_verification_status,
    'd0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001',
    now() - interval '1 day'
  )
on conflict do nothing;

insert into public.order_stage_events (order_id, stage, seq, animal_id, status) values
  ('f0000000-0000-4000-8000-000000000002', 'persiapan'::public.fulfilment_stage, 1, null, 'pending'::public.stage_event_status),
  ('f0000000-0000-4000-8000-000000000002', 'sembelih'::public.fulfilment_stage, 2, 'a9000000-0000-4000-8000-000000000002', 'pending'::public.stage_event_status),
  ('f0000000-0000-4000-8000-000000000002', 'masak'::public.fulfilment_stage, 3, null, 'pending'::public.stage_event_status),
  ('f0000000-0000-4000-8000-000000000002', 'salur'::public.fulfilment_stage, 4, null, 'pending'::public.stage_event_status)
on conflict do nothing;

-- =============================================================================
-- Order 3 — order tamu baru, belum diverifikasi
--
-- `created_by IS NULL` dan `guest_verified_at IS NULL`: inilah yang mengisi
-- kartu "Order Tamu Baru" di dashboard dan menguji trigger
-- `enforce_guest_order_verification` yang menahannya di status `new`.
-- =============================================================================
insert into public.orders (
  id, order_number, participant_id, created_by,
  status, payment_status, total_amount,
  distribution_mode, aqiqah_for, child_birth_place, child_birth_date,
  requested_date, requested_time, notes
) values (
  'f0000000-0000-4000-8000-000000000003', 'IA-202608-0003',
  'e0000000-0000-4000-8000-000000000003', null,
  'new'::public.order_status, 'unpaid'::public.payment_status, 3600000,
  'salur'::public.distribution_mode, 'laki_laki', 'Bekasi', '2026-08-12',
  current_date + 5, '10:00', 'Mohon dihubungi sore hari'
) on conflict (id) do nothing;

insert into public.order_items (order_id, service_id, qty, unit_price, meta) values
  (
    'f0000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003',
    1, 3600000, '{"on_behalf_of": "Yusuf bin Ahmad Fauzi"}'::jsonb
  )
on conflict do nothing;

insert into public.animals (order_id, species, tag_code, on_behalf_of) values
  (
    'f0000000-0000-4000-8000-000000000003', 'kambing'::public.animal_species, 'KMB-003',
    'Yusuf bin Ahmad Fauzi'
  )
on conflict do nothing;

-- --- Kendala ----------------------------------------------------------------
--
-- Satu kendala terbuka supaya panel dashboard dan pengurutan litmus test
-- ("yang paling parah dan paling lama menunggu naik ke atas") punya data.
insert into public.issues (order_id, title, description, severity, status, reported_by) values
  (
    'f0000000-0000-4000-8000-000000000001',
    'Pemesan minta ganti jam pengiriman',
    'Minta diantar sore, bukan siang. Perlu konfirmasi ke mitra.',
    'medium'::public.issue_severity, 'open'::public.issue_status, 'd0000000-0000-4000-8000-000000000002'
  )
on conflict do nothing;

-- --- Selaraskan penghitung nomor order --------------------------------------
--
-- Ketiga order di atas memakai nomor **hardcode** (`IA-202608-0001..0003`) agar
-- ID-nya stabil dan bisa diacu tes maupun dokumentasi. Konsekuensinya:
-- `next_order_number()` tidak pernah ikut terpanggil, jadi `order_counters`
-- tertinggal di 0 — dan order berikutnya yang dibuat lewat aplikasi akan
-- meminta nomor `0001` yang sudah terpakai, lalu ditolak
-- `orders_order_number_key`.
--
-- Baris ini menutup celah itu: penghitung disetel ke nomor tertinggi yang
-- benar-benar terpakai pada periodenya, diturunkan dari `orders` (bukan angka
-- yang ditulis ulang di sini) supaya tetap benar kalau order demo ditambah.
insert into public.order_counters (period, last_value)
select
  substring(order_number from 4 for 6),
  max(substring(order_number from 11 for 4)::int)
from public.orders
where order_number ~ '^IA-[0-9]{6}-[0-9]{4}$'
group by 1
on conflict (period) do update
  set last_value = greatest(public.order_counters.last_value, excluded.last_value);
