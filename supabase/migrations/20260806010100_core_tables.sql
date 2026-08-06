-- =============================================================================
-- Tahap 1 — Database · 02 Tabel master
-- branches, locations, profiles, services, participants, app_settings
-- Acuan: docs/05_DATABASE_DESIGN.md section 4.1-4.5, docs/28_HARGA_PROGRAM.md
-- =============================================================================

-- --- branches (docs/05 section 4.2) -----------------------------------------
create table public.branches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text not null unique,
  address     text,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

comment on table public.branches is 'Cabang Zakat Sukses (docs/05 section 4.2).';
comment on column public.branches.code is 'Kode singkat cabang, dipakai pada path Storage (docs/17 section 3).';

create trigger set_branches_updated_at
  before update on public.branches
  for each row execute function public.set_updated_at();

-- --- locations (docs/05 section 4.3) ----------------------------------------
create table public.locations (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null references public.branches (id) on delete restrict,
  name        text not null,
  address     text,
  lat         numeric(9, 6),
  lng         numeric(9, 6),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

comment on table public.locations is 'Titik/lokasi pemotongan beserta koordinat Google Maps (docs/05 section 4.3).';

create index locations_branch_id_idx on public.locations (branch_id);

create trigger set_locations_updated_at
  before update on public.locations
  for each row execute function public.set_updated_at();

-- --- profiles (docs/05 section 4.1 "users") ---------------------------------
-- Entity `users` pada docs/05 diimplementasikan sebagai `public.profiles` yang
-- meng-extend `auth.users` Supabase (lihat TEAM_PLAN.md section 6 & REBUILD_GUIDE.md section 5).
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text,
  email         text unique,
  phone         text,
  role          public.user_role not null default 'petugas_lapangan',
  branch_id     uuid references public.branches (id) on delete restrict,
  is_active     boolean not null default true,
  -- docs/07 section 1: validasi tingkat-1 dipegang admin_cabang/manager_program "yang ditunjuk"
  is_supervisor boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  -- Role pusat tidak terikat cabang; role cabang/petugas wajib punya branch_id agar
  -- bisa aktif. User baru yang belum diberi cabang tetap boleh ada, tapi non-aktif
  -- sampai admin menetapkan branch_id (least privilege, docs/07 section 6).
  constraint profiles_branch_scope_check check (
    is_active = false
    or role in ('direktur', 'manager_program', 'admin_pusat')
    or branch_id is not null
  )
);

comment on table public.profiles is
  'Pengguna internal; extend auth.users. Setara entity `users` pada docs/05 section 4.1.';
comment on column public.profiles.is_supervisor is
  'Ditunjuk sebagai Supervisor validasi dokumentasi tingkat-1 (docs/07 section 1).';

create index profiles_branch_id_idx on public.profiles (branch_id);
create index profiles_role_idx on public.profiles (role);

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- --- services (docs/05 section 4.4 + docs/28_HARGA_PROGRAM.md) --------------
create table public.services (
  id            uuid primary key default gen_random_uuid(),
  type          public.service_type not null,
  name          text not null,
  -- docs/28: slug wajib human readable & SEO friendly, UUID dilarang jadi URL publik
  slug          text not null unique,
  description   text,
  vendor_price  numeric(14, 2) not null default 0,
  margin_amount numeric(14, 2) not null default 0,
  price         numeric(14, 2) not null default 0,
  meta          jsonb not null default '{}'::jsonb,
  sort_order    int not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint services_slug_format_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint services_price_nonnegative_check check (
    vendor_price >= 0 and margin_amount >= 0 and price >= 0
  )
);

comment on table public.services is
  'Master layanan/paket. Harga acuan: docs/28_HARGA_PROGRAM.md. Editable dari /programs.';
comment on column public.services.price is
  'Harga jual. Boleh dihitung otomatis (vendor_price + margin_amount) atau diisi manual (docs/28).';
comment on column public.services.meta is
  'Rincian terstruktur: kambing {harga_kambing,biaya_masak,hasil{...},cocok_untuk}; nasi box {items[]}.';

create index services_type_idx on public.services (type);
create index services_active_sort_idx on public.services (is_active, sort_order);

create trigger set_services_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

-- --- participants (docs/05 section 4.5) -------------------------------------
create table public.participants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  email       text,
  address     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

comment on table public.participants is 'Peserta/donatur penerima laporan (docs/05 section 4.5).';

create index participants_phone_idx on public.participants (phone);
create index participants_email_idx on public.participants (email);

create trigger set_participants_updated_at
  before update on public.participants
  for each row execute function public.set_updated_at();

-- --- app_settings -----------------------------------------------------------
-- docs/05 section 5 & docs/08 section 2 menyebut `min_dp` "dikonfigurasi di settings".
create table public.app_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id) on delete set null
);

comment on table public.app_settings is
  'Konfigurasi sistem key/value. Berisi antara lain min_dp_ratio (gate DP, docs/08 section 2).';

create trigger set_app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();
