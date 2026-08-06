-- =============================================================================
-- Tahap 1 — Database · 03 Tabel operasional order
-- orders, order_items, animals, payments, schedules, slaughter_records, distributions
-- Acuan: docs/05_DATABASE_DESIGN.md section 4.6-4.12 & section 7, docs/08_WORKFLOW_MAP.md
-- =============================================================================

-- --- orders (docs/05 section 4.6) -------------------------------------------
create table public.orders (
  id             uuid primary key default gen_random_uuid(),
  -- Diisi otomatis oleh trigger set_order_number (format IA-YYYYMM-####).
  order_number   text not null unique,
  participant_id uuid not null references public.participants (id) on delete restrict,
  branch_id      uuid not null references public.branches (id) on delete restrict,
  created_by     uuid references public.profiles (id) on delete set null,
  status         public.order_status not null default 'new',
  payment_status public.payment_status not null default 'unpaid',
  total_amount   numeric(14, 2) not null default 0,
  paid_amount    numeric(14, 2) not null default 0,
  notes          text,
  -- Token laporan publik; di-generate acak agar tidak bisa ditebak (docs/20).
  public_token   text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint orders_amount_nonnegative_check check (total_amount >= 0 and paid_amount >= 0)
);

comment on table public.orders is 'Order inti dengan state machine (docs/05 section 4.6, docs/08 section 2).';
comment on column public.orders.paid_amount is
  'Akumulasi pembayaran terverifikasi. Dipakai untuk gate DP (paid_amount >= min_dp_ratio * total_amount).';

-- docs/05 section 7
create index orders_branch_status_idx on public.orders (branch_id, status);
create index orders_payment_status_idx on public.orders (payment_status);
create index orders_created_at_idx on public.orders (created_at desc);
create index orders_participant_idx on public.orders (participant_id);

create trigger set_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- --- order_items (docs/05 section 4.7) --------------------------------------
create table public.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  qty        int not null default 1,
  unit_price numeric(14, 2) not null default 0,
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_items_qty_positive_check check (qty > 0),
  constraint order_items_price_nonnegative_check check (unit_price >= 0)
);

comment on column public.order_items.meta is 'Preferensi item, mis. atas nama, catatan khusus.';

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_service_id_idx on public.order_items (service_id);

create trigger set_order_items_updated_at
  before update on public.order_items
  for each row execute function public.set_updated_at();

-- --- animals (docs/05 section 4.8) ------------------------------------------
create table public.animals (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  tag_code     text,
  species      public.animal_species not null default 'kambing',
  weight_kg    numeric(6, 2),
  status       public.animal_status not null default 'registered',
  on_behalf_of text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint animals_weight_positive_check check (weight_kg is null or weight_kg > 0)
);

comment on column public.animals.on_behalf_of is 'Atas nama (aqiqah/qurban).';

create index animals_order_status_idx on public.animals (order_id, status);
create index animals_tag_code_idx on public.animals (tag_code);

create trigger set_animals_updated_at
  before update on public.animals
  for each row execute function public.set_updated_at();

-- --- payments (docs/05 section 4.9) -----------------------------------------
create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  amount      numeric(14, 2) not null,
  method      text,
  proof_path  text,
  status      public.payment_verification_status not null default 'pending',
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

comment on table public.payments is
  'Pembayaran & verifikasi (docs/05 section 4.9). Status memakai payment_verification_status — lihat catatan deviasi di migration 01.';
comment on column public.payments.proof_path is 'Path di bucket Storage `payment-proofs` (docs/17 section 1).';

create index payments_order_status_idx on public.payments (order_id, status);

create trigger set_payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- --- schedules (docs/05 section 4.10) ---------------------------------------
create table public.schedules (
  id             uuid primary key default gen_random_uuid(),
  -- 1 order : 1 jadwal aktif (docs/05 section 4.10)
  order_id       uuid not null unique references public.orders (id) on delete cascade,
  location_id    uuid not null references public.locations (id) on delete restrict,
  pic_user_id    uuid references public.profiles (id) on delete set null,
  scheduled_date date not null,
  scheduled_time time,
  status         public.schedule_status not null default 'planned',
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on column public.schedules.pic_user_id is 'Petugas Lapangan penanggung jawab (docs/09 section 6).';

create index schedules_scheduled_date_idx on public.schedules (scheduled_date);
create index schedules_pic_user_id_idx on public.schedules (pic_user_id);
create index schedules_location_id_idx on public.schedules (location_id);

create trigger set_schedules_updated_at
  before update on public.schedules
  for each row execute function public.set_updated_at();

-- --- slaughter_records (docs/05 section 4.11) -------------------------------
create table public.slaughter_records (
  id           uuid primary key default gen_random_uuid(),
  animal_id    uuid not null references public.animals (id) on delete cascade,
  performed_by uuid references public.profiles (id) on delete set null,
  performed_at timestamptz not null default now(),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index slaughter_records_animal_id_idx on public.slaughter_records (animal_id);
create index slaughter_records_performed_at_idx on public.slaughter_records (performed_at desc);

create trigger set_slaughter_records_updated_at
  before update on public.slaughter_records
  for each row execute function public.set_updated_at();

-- --- distributions (docs/05 section 4.12) -----------------------------------
create table public.distributions (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders (id) on delete cascade,
  slaughter_record_id uuid references public.slaughter_records (id) on delete set null,
  recipient_name      text,
  recipient_area      text,
  packages_count      int not null default 0,
  distributed_by      uuid references public.profiles (id) on delete set null,
  distributed_at      timestamptz not null default now(),
  lat                 numeric(9, 6),
  lng                 numeric(9, 6),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint distributions_packages_nonnegative_check check (packages_count >= 0)
);

create index distributions_order_id_idx on public.distributions (order_id);
create index distributions_distributed_at_idx on public.distributions (distributed_at desc);

create trigger set_distributions_updated_at
  before update on public.distributions
  for each row execute function public.set_updated_at();
