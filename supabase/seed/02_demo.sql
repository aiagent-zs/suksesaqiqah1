-- =============================================================================
-- Seed 02 — Data demo (NON-PRODUKSI)
-- Tujuan: views KPI (v_open_orders, v_branch_kpi, v_order_progress) mengembalikan
-- data, dan tersedia user tiap role untuk uji Auth (Tahap 2) & RLS (Tahap 3).
--
-- Password semua akun demo: Password123!
-- JANGAN dipakai di environment produksi.
-- =============================================================================

-- --- User demo (auth.users) -------------------------------------------------
-- Trigger public.handle_new_user() otomatis membuat baris public.profiles
-- dengan role & branch_id yang diambil dari raw_user_meta_data.
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
  jsonb_strip_nulls(
    jsonb_build_object('full_name', u.full_name, 'role', u.role, 'branch_id', u.branch_id)
  ),
  '', '', '', ''
from (
  values
    ('a3000000-0000-4000-8000-000000000001'::uuid, 'direktur@suksesaqiqah.test', 'Hasan Direktur',      'direktur',         null),
    ('a3000000-0000-4000-8000-000000000002'::uuid, 'manager@suksesaqiqah.test',  'Rina Manager Program','manager_program',  null),
    ('a3000000-0000-4000-8000-000000000003'::uuid, 'pusat@suksesaqiqah.test',    'Dewi Admin Pusat',    'admin_pusat',      null),
    ('a3000000-0000-4000-8000-000000000004'::uuid, 'admin.bdg@suksesaqiqah.test','Agus Admin Bandung',  'admin_cabang',     'a0000000-0000-4000-8000-000000000001'),
    ('a3000000-0000-4000-8000-000000000005'::uuid, 'admin.jkt@suksesaqiqah.test','Sari Admin Jakarta',  'admin_cabang',     'a0000000-0000-4000-8000-000000000002'),
    ('a3000000-0000-4000-8000-000000000006'::uuid, 'petugas.bdg@suksesaqiqah.test','Budi Petugas',      'petugas_lapangan', 'a0000000-0000-4000-8000-000000000001'),
    ('a3000000-0000-4000-8000-000000000007'::uuid, 'petugas.jkt@suksesaqiqah.test','Eko Petugas',       'petugas_lapangan', 'a0000000-0000-4000-8000-000000000002')
) as u(id, email, full_name, role, branch_id)
on conflict (id) do nothing;

-- Identity email agar login password berfungsi.
insert into auth.identities (
  id, provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  u.id::text,
  u.id,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(), now(), now()
from auth.users u
where u.email like '%@suksesaqiqah.test'
on conflict do nothing;

-- Penunjukan Supervisor validasi tingkat-1 (docs/07 section 1).
update public.profiles
set is_supervisor = true
where id in (
  'a3000000-0000-4000-8000-000000000002', -- Manager Program
  'a3000000-0000-4000-8000-000000000004'  -- Admin Cabang Bandung
);

update public.profiles
set phone = '0812' || right(id::text, 8)
where id::text like 'a3000000%';

-- --- Peserta ----------------------------------------------------------------
insert into public.participants (id, name, phone, email, address) values
  ('a4000000-0000-4000-8000-000000000001', 'Keluarga Bapak Ahmad',  '6281234567801', 'ahmad@example.test',  'Jl. Merdeka No. 10, Bandung'),
  ('a4000000-0000-4000-8000-000000000002', 'Keluarga Ibu Siti',     '6281234567802', 'siti@example.test',   'Jl. Kenanga No. 4, Jakarta'),
  ('a4000000-0000-4000-8000-000000000003', 'Keluarga Bapak Rahmat', '6281234567803', 'rahmat@example.test', 'Jl. Melati No. 22, Bandung'),
  ('a4000000-0000-4000-8000-000000000004', 'Keluarga Ibu Lestari',  '6281234567804', 'lestari@example.test','Jl. Anggrek No. 7, Bekasi')
on conflict (id) do nothing;

-- --- Order ------------------------------------------------------------------
-- order_number sengaja tidak diisi: di-generate trigger set_orders_order_number.
insert into public.orders (id, participant_id, branch_id, created_by, status, total_amount, notes, created_at) values
  ('a5000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000004', 'new',          2300000, 'Order baru, menunggu pembayaran.',        now() - interval '1 day'),
  ('a5000000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000004', 'paid',         2800000, 'DP 50% sudah masuk, menunggu penjadwalan.', now() - interval '3 days'),
  ('a5000000-0000-4000-8000-000000000003', 'a4000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000004', 'scheduled',    3600000, 'Terjadwal pekan ini.',                    now() - interval '5 days'),
  ('a5000000-0000-4000-8000-000000000004', 'a4000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000005', 'slaughtering', 2800000, 'Pemotongan berlangsung.',                 now() - interval '7 days'),
  ('a5000000-0000-4000-8000-000000000005', 'a4000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000005', 'documentation',2300000, 'Menunggu validasi dokumentasi.',          now() - interval '9 days'),
  ('a5000000-0000-4000-8000-000000000006', 'a4000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000003', 'a3000000-0000-4000-8000-000000000002', 'completed',    3600000, 'Selesai, laporan terkirim.',              now() - interval '20 days')
on conflict (id) do nothing;

-- --- Item order -------------------------------------------------------------
insert into public.order_items (order_id, service_id, qty, unit_price, meta) values
  ('a5000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 1, 2300000, '{"atas_nama": "Muhammad Fatih"}'::jsonb),
  ('a5000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002', 1, 2800000, '{"atas_nama": "Aisyah Nur"}'::jsonb),
  ('a5000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003', 1, 3600000, '{"atas_nama": "Umar Hafizh"}'::jsonb),
  ('a5000000-0000-4000-8000-000000000004', 'a2000000-0000-4000-8000-000000000002', 1, 2800000, '{"atas_nama": "Khadijah Zahra"}'::jsonb),
  ('a5000000-0000-4000-8000-000000000005', 'a2000000-0000-4000-8000-000000000001', 1, 2300000, '{"atas_nama": "Ali Ridwan"}'::jsonb),
  ('a5000000-0000-4000-8000-000000000006', 'a2000000-0000-4000-8000-000000000003', 1, 3600000, '{"atas_nama": "Fatimah Azzahra"}'::jsonb);

-- --- Hewan ------------------------------------------------------------------
insert into public.animals (id, order_id, tag_code, species, weight_kg, status, on_behalf_of) values
  ('a6000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000001', 'BDG-K-001', 'kambing', 28.50, 'registered',  'Muhammad Fatih'),
  ('a6000000-0000-4000-8000-000000000002', 'a5000000-0000-4000-8000-000000000002', 'BDG-K-002', 'kambing', 31.00, 'registered',  'Aisyah Nur'),
  ('a6000000-0000-4000-8000-000000000003', 'a5000000-0000-4000-8000-000000000003', 'BDG-K-003', 'kambing', 34.20, 'prepared',    'Umar Hafizh'),
  ('a6000000-0000-4000-8000-000000000004', 'a5000000-0000-4000-8000-000000000004', 'JKT-K-001', 'kambing', 30.10, 'slaughtered', 'Khadijah Zahra'),
  ('a6000000-0000-4000-8000-000000000005', 'a5000000-0000-4000-8000-000000000004', 'JKT-K-002', 'kambing', 29.80, 'prepared',    'Khadijah Zahra'),
  ('a6000000-0000-4000-8000-000000000006', 'a5000000-0000-4000-8000-000000000005', 'JKT-K-003', 'kambing', 27.40, 'distributed', 'Ali Ridwan'),
  ('a6000000-0000-4000-8000-000000000007', 'a5000000-0000-4000-8000-000000000005', 'JKT-K-004', 'kambing', 28.90, 'distributed', 'Ali Ridwan'),
  ('a6000000-0000-4000-8000-000000000008', 'a5000000-0000-4000-8000-000000000006', 'BKS-K-001', 'kambing', 33.00, 'distributed', 'Fatimah Azzahra'),
  ('a6000000-0000-4000-8000-000000000009', 'a5000000-0000-4000-8000-000000000006', 'BKS-K-002', 'kambing', 32.10, 'distributed', 'Fatimah Azzahra')
on conflict (id) do nothing;

-- --- Pembayaran (memicu sync orders.paid_amount & payment_status) -----------
insert into public.payments (order_id, amount, method, status, verified_by, verified_at, note) values
  ('a5000000-0000-4000-8000-000000000002', 1400000, 'transfer', 'verified', 'a3000000-0000-4000-8000-000000000004', now() - interval '3 days', 'DP 50%'),
  ('a5000000-0000-4000-8000-000000000003', 3600000, 'transfer', 'verified', 'a3000000-0000-4000-8000-000000000004', now() - interval '5 days', 'Lunas'),
  ('a5000000-0000-4000-8000-000000000004', 2800000, 'transfer', 'verified', 'a3000000-0000-4000-8000-000000000005', now() - interval '7 days', 'Lunas'),
  ('a5000000-0000-4000-8000-000000000005', 2300000, 'tunai',    'verified', 'a3000000-0000-4000-8000-000000000005', now() - interval '9 days', 'Lunas'),
  ('a5000000-0000-4000-8000-000000000006', 3600000, 'transfer', 'verified', 'a3000000-0000-4000-8000-000000000002', now() - interval '20 days', 'Lunas');

-- --- Jadwal + PIC -----------------------------------------------------------
insert into public.schedules (order_id, location_id, pic_user_id, scheduled_date, scheduled_time, status) values
  ('a5000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000006', (now() + interval '2 days')::date, '08:00', 'planned'),
  ('a5000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000003', 'a3000000-0000-4000-8000-000000000007', (now() - interval '1 day')::date,  '07:30', 'ongoing'),
  ('a5000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000004', 'a3000000-0000-4000-8000-000000000007', (now() - interval '3 days')::date, '07:00', 'done'),
  ('a5000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000005', 'a3000000-0000-4000-8000-000000000006', (now() - interval '18 days')::date,'06:30', 'done')
on conflict (order_id) do nothing;

-- --- Catatan pemotongan -----------------------------------------------------
insert into public.slaughter_records (id, animal_id, performed_by, performed_at, notes) values
  ('a8000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000004', 'a3000000-0000-4000-8000-000000000007', now() - interval '1 day',   'Pemotongan sesuai syariat, disaksikan keluarga.'),
  ('a8000000-0000-4000-8000-000000000002', 'a6000000-0000-4000-8000-000000000006', 'a3000000-0000-4000-8000-000000000007', now() - interval '3 days',  'Selesai tepat waktu.'),
  ('a8000000-0000-4000-8000-000000000003', 'a6000000-0000-4000-8000-000000000007', 'a3000000-0000-4000-8000-000000000007', now() - interval '3 days',  'Selesai tepat waktu.'),
  ('a8000000-0000-4000-8000-000000000004', 'a6000000-0000-4000-8000-000000000008', 'a3000000-0000-4000-8000-000000000006', now() - interval '18 days', 'Selesai.'),
  ('a8000000-0000-4000-8000-000000000005', 'a6000000-0000-4000-8000-000000000009', 'a3000000-0000-4000-8000-000000000006', now() - interval '18 days', 'Selesai.')
on conflict (id) do nothing;

-- --- Distribusi -------------------------------------------------------------
insert into public.distributions (order_id, slaughter_record_id, recipient_name, recipient_area, packages_count, distributed_by, distributed_at, lat, lng) values
  ('a5000000-0000-4000-8000-000000000005', 'a8000000-0000-4000-8000-000000000002', 'Panti Asuhan Nurul Hidayah', 'Pejaten, Jakarta Selatan', 45, 'a3000000-0000-4000-8000-000000000007', now() - interval '3 days',  -6.291000, 106.836000),
  ('a5000000-0000-4000-8000-000000000005', 'a8000000-0000-4000-8000-000000000003', 'Warga RW 05',                'Mampang, Jakarta Selatan', 40, 'a3000000-0000-4000-8000-000000000007', now() - interval '3 days',  -6.246000, 106.823000),
  ('a5000000-0000-4000-8000-000000000006', 'a8000000-0000-4000-8000-000000000004', 'Masjid Baiturrahman',        'Kemang Pratama, Bekasi',   60, 'a3000000-0000-4000-8000-000000000006', now() - interval '18 days', -6.248000, 106.998000),
  ('a5000000-0000-4000-8000-000000000006', 'a8000000-0000-4000-8000-000000000005', 'Warga RT 03',                'Kemang Pratama, Bekasi',   55, 'a3000000-0000-4000-8000-000000000006', now() - interval '18 days', -6.249000, 106.999000);

-- --- Dokumentasi ------------------------------------------------------------
insert into public.documentations (order_id, animal_id, type, storage_path, caption, stage, status, uploaded_by, reviewed_by, review_note, reviewed_at) values
  -- Order 4 (slaughtering): baru diunggah, menunggu Supervisor
  ('a5000000-0000-4000-8000-000000000004', 'a6000000-0000-4000-8000-000000000004', 'photo', 'documentation/JKT/2026/08/order-4/slaughter/11111111-1111-4111-8111-111111111111.jpg', 'Proses pemotongan hewan 1', 'slaughter', 'pending', 'a3000000-0000-4000-8000-000000000007', null, null, null),
  -- Order 5 (documentation): satu lolos Supervisor, satu masih pending
  ('a5000000-0000-4000-8000-000000000005', 'a6000000-0000-4000-8000-000000000006', 'photo', 'documentation/JKT/2026/08/order-5/slaughter/22222222-2222-4222-8222-222222222222.jpg', 'Pemotongan disaksikan keluarga', 'slaughter', 'approved_supervisor', 'a3000000-0000-4000-8000-000000000007', 'a3000000-0000-4000-8000-000000000002', null, now() - interval '2 days'),
  ('a5000000-0000-4000-8000-000000000005', 'a6000000-0000-4000-8000-000000000007', 'photo', 'documentation/JKT/2026/08/order-5/distribution/33333333-3333-4333-8333-333333333333.jpg', 'Distribusi ke panti asuhan', 'distribution', 'pending', 'a3000000-0000-4000-8000-000000000007', null, null, null),
  -- Order 6 (completed): dokumentasi final approved
  ('a5000000-0000-4000-8000-000000000006', 'a6000000-0000-4000-8000-000000000008', 'photo', 'documentation/BKS/2026/07/order-6/slaughter/44444444-4444-4444-8444-444444444444.jpg', 'Pemotongan hewan 1', 'slaughter', 'approved', 'a3000000-0000-4000-8000-000000000006', 'a3000000-0000-4000-8000-000000000003', null, now() - interval '17 days'),
  ('a5000000-0000-4000-8000-000000000006', 'a6000000-0000-4000-8000-000000000009', 'photo', 'documentation/BKS/2026/07/order-6/distribution/55555555-5555-4555-8555-555555555555.jpg', 'Penyerahan ke masjid', 'distribution', 'approved', 'a3000000-0000-4000-8000-000000000006', 'a3000000-0000-4000-8000-000000000003', null, now() - interval '17 days'),
  ('a5000000-0000-4000-8000-000000000006', null, 'note', null, 'Acara berjalan lancar, keluarga hadir lengkap.', 'general', 'approved', 'a3000000-0000-4000-8000-000000000006', 'a3000000-0000-4000-8000-000000000003', null, now() - interval '17 days');

-- --- Kendala ----------------------------------------------------------------
insert into public.issues (order_id, reported_by, severity, title, description, status, resolved_by, resolved_at) values
  ('a5000000-0000-4000-8000-000000000004', 'a3000000-0000-4000-8000-000000000007', 'medium', 'Timbangan hewan rusak',        'Timbangan di RPH tidak akurat, berat diestimasi manual.',      'in_progress', null, null),
  ('a5000000-0000-4000-8000-000000000005', 'a3000000-0000-4000-8000-000000000007', 'high',   'Akses jalan tergenang banjir', 'Distribusi ke RW 05 tertunda karena akses jalan tergenang.',   'open',        null, null),
  ('a5000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000004', 'low',    'Peserta minta ganti tanggal',  'Peserta meminta pergeseran jadwal ke pekan berikutnya.',       'open',        null, null),
  ('a5000000-0000-4000-8000-000000000006', 'a3000000-0000-4000-8000-000000000006', 'medium', 'Kekurangan box nasi',          'Jumlah box kurang 10, sudah ditambah oleh vendor.',            'resolved',    'a3000000-0000-4000-8000-000000000002', now() - interval '18 days');

-- --- Laporan ----------------------------------------------------------------
insert into public.reports (order_id, pdf_path, generated_by, generated_at, sent_at, version)
select
  'a5000000-0000-4000-8000-000000000006',
  'reports/' || o.order_number || '/v1/' || o.order_number || '.pdf',
  'n8n',
  now() - interval '17 days',
  now() - interval '17 days',
  1
from public.orders o
where o.id = 'a5000000-0000-4000-8000-000000000006';

-- --- Notifikasi (outbox) ----------------------------------------------------
insert into public.notifications (order_id, channel, target, payload, status, sent_at) values
  ('a5000000-0000-4000-8000-000000000006', 'whatsapp', '6281234567804', '{"template": "report_ready"}'::jsonb, 'sent',   now() - interval '17 days'),
  ('a5000000-0000-4000-8000-000000000006', 'email',    'lestari@example.test', '{"template": "report_ready"}'::jsonb, 'sent', now() - interval '17 days'),
  ('a5000000-0000-4000-8000-000000000005', 'dashboard','a3000000-0000-4000-8000-000000000003', '{"template": "doc_review_pending"}'::jsonb, 'queued', null);
