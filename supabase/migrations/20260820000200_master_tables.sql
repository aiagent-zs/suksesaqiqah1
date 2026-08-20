-- =============================================================================
-- Desain ulang skema · 02 Tabel master
-- vendors, vendor_services, vendor_coverage, locations, profiles, services,
-- participants, app_settings, stage_requirements
--
-- Perubahan terbesar: **`branches` dibuang, `vendors` lahir.**
--
-- Cabang dirancang untuk organisasi bercabang; kenyataannya operasi berjalan
-- satu tempat dan yang banyak justru mitranya. Klaim lama bahwa cabang
-- menyusun nomor order ternyata **keliru** — `next_order_number()` hanya
-- mengunci pada YYYYMM, tidak pernah menyentuh cabang. Satu-satunya
-- ketergantungan nyata adalah path Storage, dan itu kini memakai `order_number`
-- yang unik global (lihat migration 09).
--
-- Jejak paling telak: seed lama menyimpan "RPH Mitra Bandung" sebagai baris
-- `locations` — mitra yang menyamar jadi lokasi, karena tempatnya belum ada.
-- =============================================================================

-- --- set_updated_at ---------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- --- vendors ----------------------------------------------------------------
create table public.vendors (
  id             uuid primary key default gen_random_uuid(),

  -- Identitas
  code           text not null unique,
  name           text not null,
  legal_name     text,
  owner_name     text,
  npwp           text,

  -- Kontak
  phone          text not null,
  whatsapp       text,
  email          text,

  -- Alamat. Bentuknya meniru `orders.delivery_*` (kode + nama, tanpa FK ke
  -- `regions`), tapi **alasannya berbeda dan itu penting**:
  --
  --   Alamat pada ORDER adalah rekaman sejarah — harus terbaca persis seperti
  --   saat dipesan, selamanya. Alamat MITRA adalah master data yang berlaku
  --   kini: kalau Kemendagri mengganti nama kecamatan, alamat mitra memang
  --   seharusnya ikut berubah.
  --
  -- Namanya tetap disimpan karena dua hal lain: alamat mitra tampil di hampir
  -- setiap layar penugasan (join empat tingkat ke tabel 91.599 baris terlalu
  -- mahal untuk dilakukan tiap render), dan tanpa FK sebuah baris vendor tidak
  -- pernah menghalangi pembaruan data wilayah.
  --
  -- Halaman master mitra menyediakan aksi "segarkan nama wilayah" yang membaca
  -- ulang dari `regions` berdasarkan kode. Order tidak boleh punya tombol itu.
  province_code  text, province  text,
  city_code      text, city      text,
  district_code  text, district  text,
  village_code   text, village   text,
  postal_code    text,
  address_detail text,
  address        text,
  lat            numeric(9, 6),
  lng            numeric(9, 6),

  -- Kesepakatan kerja sama
  agreement_number text,
  agreement_start  date,
  agreement_end    date,
  daily_capacity   int,
  service_modes    public.distribution_mode[] not null default '{salur,kirim}',

  -- Rekening pembayaran ke mitra
  bank_name         text,
  bank_account_no   text,
  bank_account_name text,

  is_active  boolean not null default true,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint vendors_code_format_check check (code ~ '^[A-Z0-9]{2,12}$'),
  constraint vendors_postal_check check (postal_code is null or postal_code ~ '^[0-9]{5}$'),
  constraint vendors_capacity_check check (daily_capacity is null or daily_capacity > 0),
  constraint vendors_agreement_period_check check (
    agreement_end is null or agreement_start is null or agreement_end >= agreement_start
  ),
  constraint vendors_modes_nonempty_check check (array_length(service_modes, 1) >= 1)
);

comment on table public.vendors is
  'Mitra pelaksana. Dikelola superadmin. Alamatnya master data yang berlaku kini — bukan rekaman sejarah seperti orders.delivery_*.';
comment on column public.vendors.code is
  'Kode singkat mitra. Sengaja TIDAK dipakai path Storage: kode bisa berubah dan order bisa dipindah ke mitra lain.';
comment on column public.vendors.service_modes is
  'Mode yang sanggup dilayani. Mitra tanpa kirim tidak ditawarkan untuk order Aqiqah Kirim.';

create index vendors_active_idx on public.vendors (is_active) where deleted_at is null;
create index vendors_city_idx on public.vendors (city_code) where city_code is not null;

create trigger set_vendors_updated_at
  before update on public.vendors
  for each row execute function public.set_updated_at();

-- --- services ---------------------------------------------------------------
--
-- `vendor_price` & `margin_amount` TIDAK dibangun ulang di sini. Keduanya ada
-- di skema lama tapi tidak dibaca satu baris kode pun, dan modal sesungguhnya
-- berbeda per mitra — tempatnya di `vendor_services`. Yang tersisa `price`:
-- harga jual, satu-satunya harga yang dilihat pembeli.
create table public.services (
  id          uuid primary key default gen_random_uuid(),
  type        public.service_type not null,
  name        text not null,
  slug        text not null unique,
  description text,
  price       numeric(14, 2) not null default 0,
  meta        jsonb not null default '{}'::jsonb,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  constraint services_slug_format_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint services_price_nonnegative_check check (price >= 0)
);

comment on column public.services.price is
  'Harga jual ke pembeli. Modal per mitra ada di vendor_services.vendor_price; margin = selisih keduanya.';

create trigger set_services_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

-- --- vendor_services --------------------------------------------------------
--
-- Daftar modal per mitra, bertaut ke katalog yang sama dengan yang dilihat
-- pembeli — bukan paket bebas milik vendor.
--
-- Kenapa begitu: checkout publik memilih paket **sebelum** vendornya ada
-- (vendor ditetapkan admin sesudah verifikasi). Paket milik vendor akan
-- membalik urutan itu. Lagipula `create_guest_order` membaca harga dari
-- `services` dan mengabaikan harga kiriman klien — itu pertahanan inti
-- checkout, dan harga milik vendor akan meruntuhkannya.
create table public.vendor_services (
  id           uuid primary key default gen_random_uuid(),
  vendor_id    uuid not null references public.vendors (id)  on delete cascade,
  service_id   uuid not null references public.services (id) on delete restrict,

  vendor_price numeric(14, 2) not null,
  is_offered   boolean not null default true,
  lead_time_hours int,
  min_qty      int not null default 1,
  max_qty      int,
  -- Rincian modal: {"harga_kambing":1400000,"biaya_masak":440000,"biaya_antar":0}
  meta         jsonb not null default '{}'::jsonb,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint vendor_services_unique unique (vendor_id, service_id),
  constraint vendor_services_price_check check (vendor_price >= 0),
  constraint vendor_services_qty_check check (
    min_qty >= 1 and (max_qty is null or max_qty >= min_qty)
  )
);

comment on table public.vendor_services is
  'Daftar modal per mitra. Harga JUAL tetap milik services.price — pembeli tidak pernah melihat tabel ini.';

create index vendor_services_service_idx on public.vendor_services (service_id) where is_offered;

create trigger set_vendor_services_updated_at
  before update on public.vendor_services
  for each row execute function public.set_updated_at();

-- --- vendor_coverage --------------------------------------------------------
--
-- Wilayah layanan, dipakai mencocokkan order "kirim" dengan mitra yang sanggup
-- mengantar ke sana. Tanpa FK ke `regions`, alasan yang sama seperti di atas.
create table public.vendor_coverage (
  vendor_id   uuid not null references public.vendors (id) on delete cascade,
  region_code text not null,
  region_name text not null,
  level       smallint not null,
  created_at  timestamptz not null default now(),
  primary key (vendor_id, region_code),
  constraint vendor_coverage_level_check check (level between 1 and 4)
);

comment on column public.vendor_coverage.level is
  'Tingkat wilayah Kemendagri: 1 provinsi, 2 kabupaten/kota, 3 kecamatan, 4 kelurahan. Lazimnya 2.';

-- --- locations --------------------------------------------------------------
--
-- Lokasi pemotongan kini milik mitra, bukan cabang. Dengan begitu pemeriksaan
-- "lokasi harus milik vendor order ini" jadi punya arti — dulu ia membandingkan
-- cabang, yang sejak 19 Agustus tidak membatasi apa pun.
create table public.locations (
  id         uuid primary key default gen_random_uuid(),
  vendor_id  uuid references public.vendors (id) on delete restrict,
  name       text not null,
  address    text,
  lat        numeric(9, 6),
  lng        numeric(9, 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on column public.locations.vendor_id is
  'Mitra pemilik lokasi. NULL = lokasi milik Sukses Aqiqah sendiri.';

create index locations_vendor_id_idx on public.locations (vendor_id);

create trigger set_locations_updated_at
  before update on public.locations
  for each row execute function public.set_updated_at();

-- --- profiles ---------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  email      text unique,
  phone      text,
  role       public.user_role not null default 'vendor',
  -- Akun vendor tertaut ke mitranya. Inilah yang memberi akses ke order:
  -- `can_read_order` membandingkan `orders.vendor_id` dengan kolom ini.
  vendor_id  uuid references public.vendors (id) on delete restrict,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  -- Vendor aktif wajib punya mitra: tanpa itu `can_read_order` tidak punya apa
  -- pun untuk dibandingkan, dan akunnya jadi hidup tapi buta.
  constraint profiles_vendor_scope_check check (
    is_active = false or role <> 'vendor' or vendor_id is not null
  ),
  -- Staf tidak boleh tertaut ke mitra — admin yang merangkap vendor akan bisa
  -- memvalidasi pekerjaannya sendiri.
  constraint profiles_staff_no_vendor_check check (
    role = 'vendor' or vendor_id is null
  )
);

-- Satu akun login per mitra. Kalau suatu saat mitra perlu beberapa petugas,
-- cukup buang indeks ini — tidak ada lagi yang perlu berubah. Itulah sebabnya
-- akses dialirkan lewat `vendor_id`, bukan lewat `profiles.id` langsung.
create unique index profiles_vendor_unique_idx on public.profiles (vendor_id)
  where vendor_id is not null;

create index profiles_role_idx on public.profiles (role) where deleted_at is null;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- --- participants -----------------------------------------------------------
create table public.participants (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text not null,
  email      text,
  address    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index participants_phone_idx on public.participants (phone);

create trigger set_participants_updated_at
  before update on public.participants
  for each row execute function public.set_updated_at();

-- --- app_settings -----------------------------------------------------------
create table public.app_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now()
);

create trigger set_app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

-- --- stage_requirements -----------------------------------------------------
--
-- Berapa bukti tervalidasi yang dituntut tiap tahap. Ditaruh di tabel, bukan
-- ditulis di kode, supaya gerbang kelengkapan punya **satu** sumber kebenaran.
-- Di skema lama aturannya tersalin di dua tempat (`review.ts` dan guard
-- transisi); dengan tahapan yang kini bercabang, salinannya akan jadi empat.
create table public.stage_requirements (
  stage        public.fulfilment_stage primary key,
  min_docs     int not null default 0,
  requires_geo boolean not null default false,
  label        text not null,
  constraint stage_requirements_min_docs_check check (min_docs >= 0)
);

insert into public.stage_requirements (stage, min_docs, requires_geo, label) values
  ('persiapan', 0, false, 'Persiapan'),
  ('sembelih',  1, false, 'Sembelih'),
  ('masak',     1, false, 'Masak'),
  ('salur',     1, true,  'Salur ke penerima manfaat'),
  ('kirim',     0, false, 'Pengiriman ke alamat pemesan'),
  ('terkirim',  1, false, 'Konfirmasi terkirim');
