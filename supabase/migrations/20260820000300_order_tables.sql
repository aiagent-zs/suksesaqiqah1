-- =============================================================================
-- Desain ulang skema · 03 Tabel order
-- order_counters, orders, order_items, animals, payments, schedules
--
-- Tiga perubahan yang tidak terbaca dari DDL-nya:
--
-- 1. **`orders.vendor_id` menggantikan `schedules.pic_user_id` sebagai gerbang
--    akses.** Dulu vendor bisa melihat order hanya lewat baris `schedules`,
--    jadi penugasan mitra tidak bisa dipisahkan dari penjadwalan — dan
--    `schedules` merangkap dua tugas sekaligus. Sekarang penugasan berdiri
--    sendiri; jadwal kembali jadi sekadar jadwal.
--
-- 2. **`branch_id` hilang sama sekali.** Nomor order tidak pernah memakainya
--    (lihat `next_order_number`), RLS berhenti memakainya sejak 19 Agustus, dan
--    path Storage kini memakai `order_number`.
--
-- 3. **`delivery_confirmed_at` — konfirmasi dari pembeli.** Vendor melaporkan
--    "terkirim", admin memvalidasi fotonya, tapi keduanya bukan pihak yang
--    menerima. Kolom ini disiapkan sekarang supaya halaman laporan bertoken
--    bisa menampung tombol "pesanan sudah saya terima" tanpa migration lagi.
-- =============================================================================

-- --- order_counters ---------------------------------------------------------
--
-- Nomor order IA-YYYYMM-#### bersifat global per bulan. Sengaja TIDAK per
-- mitra: nomor adalah identitas order di mata pembeli, dan order bisa dipindah
-- ke mitra lain tanpa nomornya ikut berubah.
create table public.order_counters (
  period     text primary key,
  last_value int not null default 0
);

comment on table public.order_counters is
  'Penghitung nomor order per periode YYYYMM. Atomik lewat update ... returning.';

-- --- orders -----------------------------------------------------------------
create table public.orders (
  id             uuid primary key default gen_random_uuid(),
  order_number   text not null unique,
  participant_id uuid not null references public.participants (id) on delete restrict,

  -- Mitra pelaksana. NULL sampai admin menugaskan — dan selama NULL, tidak ada
  -- satu pun vendor yang bisa melihat order ini.
  vendor_id      uuid references public.vendors (id) on delete restrict,

  -- NULL = order dari checkout publik (tamu). Dipakai penanda "perlu verifikasi".
  created_by     uuid references public.profiles (id) on delete set null,

  status         public.order_status not null default 'new',
  payment_status public.payment_status not null default 'unpaid',
  total_amount   numeric(14, 2) not null default 0,
  paid_amount    numeric(14, 2) not null default 0,

  -- Cara penyaluran menentukan tahapan mana yang wajib dilaporkan vendor.
  distribution_mode public.distribution_mode,
  aqiqah_for        text,

  -- Data anak yang diaqiqahi. Di `orders`, bukan `animals`: satu order satu
  -- anak, sementara ekornya bisa dua.
  child_birth_place text,
  child_birth_date  date,

  -- Permintaan pemesan, bukan jadwal sungguhan (jadwal disusun admin di
  -- `schedules` sesudah verifikasi).
  requested_date date,
  requested_time time,

  -- Alamat pengiriman. Nama wilayah ikut disimpan karena alamat pada order
  -- adalah **rekaman sejarah**: revisi Kemendagri berikutnya tidak boleh
  -- diam-diam mengubah alamat order lama. Karena alasan yang sama, sengaja
  -- tanpa FK ke `regions`.
  delivery_address       text,
  delivery_province_code text, delivery_province text,
  delivery_city_code     text, delivery_city     text,
  delivery_district_code text, delivery_district text,
  delivery_village_code  text, delivery_village  text,
  delivery_postal_code   text,
  delivery_detail        text,
  recipient_institution  text,

  -- Konfirmasi penerimaan oleh pembeli lewat halaman laporan bertoken.
  -- Laporan vendor adalah cadangan, bukan sumber utama.
  delivery_confirmed_at timestamptz,
  delivery_confirmed_ip text,

  referral_code text,
  notes         text,
  status_reason text,

  -- Verifikasi order tamu oleh admin.
  guest_verified_at timestamptz,
  guest_verified_by uuid references public.profiles (id) on delete set null,

  public_token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint orders_amount_check check (total_amount >= 0 and paid_amount >= 0),
  constraint orders_aqiqah_for_check check (
    aqiqah_for is null or aqiqah_for in ('laki_laki', 'perempuan')
  ),
  -- Tanggal tanpa jam (atau sebaliknya) adalah permintaan yang tidak bisa
  -- dijadwalkan. Batas 7 harinya sendiri tidak bisa jadi CHECK: acuannya now(),
  -- sementara CHECK menuntut ekspresi immutable.
  constraint orders_requested_slot_check check (
    (requested_date is null and requested_time is null)
    or (requested_date is not null and requested_time is not null)
  ),
  constraint orders_child_birth_date_check check (
    child_birth_date is null or child_birth_date >= date '1900-01-01'
  ),
  constraint orders_delivery_postal_check check (
    delivery_postal_code is null or delivery_postal_code ~ '^[0-9]{5}$'
  ),
  -- Konfirmasi penerimaan hanya berlaku untuk order yang memang dikirim.
  constraint orders_delivery_confirmed_check check (
    delivery_confirmed_at is null or distribution_mode = 'kirim'
  )
);

comment on column public.orders.vendor_id is
  'Mitra pelaksana. Sekaligus gerbang akses: can_read_order membandingkannya dengan profiles.vendor_id.';
comment on column public.orders.created_by is
  'NULL = order dari checkout publik. Dipakai antrian verifikasi admin.';
comment on column public.orders.delivery_confirmed_at is
  'Dikonfirmasi PEMBELI lewat halaman /r/{token}. Laporan terkirim dari vendor adalah cadangan, bukan pengakuan penerima.';

create index orders_status_idx on public.orders (status) where deleted_at is null;
create index orders_vendor_idx on public.orders (vendor_id) where vendor_id is not null;
create index orders_participant_idx on public.orders (participant_id);
create index orders_created_at_idx on public.orders (created_at desc);
create index orders_guest_pending_idx on public.orders (created_at desc)
  where created_by is null and guest_verified_at is null;

create trigger set_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- --- order_items ------------------------------------------------------------
create table public.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id)   on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  qty        int not null default 1,
  unit_price numeric(14, 2) not null default 0,

  -- Modal yang disepakati saat mitra ditugaskan. **Di sinilah prinsip rekaman
  -- sejarah benar-benar berlaku**: kalau daftar harga mitra direvisi bulan
  -- depan, margin order yang sudah berjalan tidak boleh ikut bergeser.
  vendor_unit_price numeric(14, 2),

  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_items_qty_check check (qty > 0),
  constraint order_items_price_check check (
    unit_price >= 0 and (vendor_unit_price is null or vendor_unit_price >= 0)
  )
);

create index order_items_order_id_idx on public.order_items (order_id);

create trigger set_order_items_updated_at
  before update on public.order_items
  for each row execute function public.set_updated_at();

-- --- animals ----------------------------------------------------------------
create table public.animals (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  species      public.animal_species not null,
  tag_code     text,
  -- Bobot hidup saat didaftarkan. Bobot hasil sembelih dicatat terpisah pada
  -- laporan tahap, karena keduanya angka yang berbeda.
  weight_kg    numeric(6, 2),
  on_behalf_of text,
  status       public.animal_status not null default 'registered',
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.animals
  add constraint animals_weight_check check (weight_kg is null or weight_kg > 0);

create index animals_order_id_idx on public.animals (order_id);
create index animals_status_idx on public.animals (status);

create trigger set_animals_updated_at
  before update on public.animals
  for each row execute function public.set_updated_at();

-- --- payments ---------------------------------------------------------------
--
-- Vendor sama sekali di luar urusan uang: uang mengalir antara pembeli dan
-- kami, bukan antara pembeli dan mitra. Ditegakkan RLS di migration 08.
create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  amount      numeric(14, 2) not null,
  method      text not null,
  proof_path  text,
  status      public.payment_verification_status not null default 'pending',
  recorded_by uuid references public.profiles (id) on delete set null,
  verified_by uuid references public.profiles (id) on delete set null,
  verified_at timestamptz,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint payments_amount_positive_check check (amount > 0),
  constraint payments_verified_consistency_check check (
    (status = 'verified' and verified_at is not null)
    or (status <> 'verified' and verified_at is null)
  )
);

create index payments_order_status_idx on public.payments (order_id, status);

create trigger set_payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- --- schedules --------------------------------------------------------------
--
-- Kembali jadi sekadar jadwal. Penugasan mitra pindah ke `orders.vendor_id`,
-- jadi tabel ini tidak lagi merangkap sebagai gerbang akses — dan `location_id`
-- boleh NULL, karena tanggal bisa ditetapkan sebelum lokasinya pasti.
create table public.schedules (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null unique references public.orders (id)    on delete cascade,
  location_id    uuid references public.locations (id) on delete restrict,
  scheduled_date date not null,
  scheduled_time time,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.schedules is
  'Jadwal pelaksanaan. Penugasan mitra ada di orders.vendor_id — tabel ini tidak lagi menentukan siapa boleh melihat order.';

create index schedules_scheduled_date_idx on public.schedules (scheduled_date);
create index schedules_location_id_idx on public.schedules (location_id);

create trigger set_schedules_updated_at
  before update on public.schedules
  for each row execute function public.set_updated_at();
