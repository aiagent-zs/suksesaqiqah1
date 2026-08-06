-- =============================================================================
-- Tahap 1 — Database · 04 Dokumentasi, laporan, notifikasi, issue, audit
-- Acuan: docs/05_DATABASE_DESIGN.md section 4.13-4.17, docs/10, docs/11, docs/12
-- =============================================================================

-- --- documentations (docs/05 section 4.13, docs/10) -------------------------
create table public.documentations (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  animal_id    uuid references public.animals (id) on delete set null,
  type         public.doc_type not null default 'photo',
  storage_path text,
  caption      text,
  stage        public.doc_stage not null default 'general',
  status       public.doc_status not null default 'pending',
  uploaded_by  uuid references public.profiles (id) on delete set null,
  reviewed_by  uuid references public.profiles (id) on delete set null,
  review_note  text,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- type 'note' tidak butuh file; photo/video wajib punya storage_path
  constraint documentations_storage_path_check check (
    type = 'note' or storage_path is not null
  ),
  -- alasan wajib saat reject (docs/10)
  constraint documentations_reject_reason_check check (
    status <> 'rejected' or review_note is not null
  )
);

comment on table public.documentations is
  'Bukti lapangan + validasi 2 tingkat: pending -> approved_supervisor -> approved (docs/10).';
comment on column public.documentations.storage_path is
  'Path di bucket privat `documentation` (docs/17 section 3).';

create index documentations_order_status_idx on public.documentations (order_id, status);
create index documentations_status_idx on public.documentations (status);
create index documentations_uploaded_by_idx on public.documentations (uploaded_by);
create index documentations_animal_id_idx on public.documentations (animal_id);

create trigger set_documentations_updated_at
  before update on public.documentations
  for each row execute function public.set_updated_at();

-- --- reports (docs/05 section 4.14, docs/11) --------------------------------
create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  pdf_path     text,
  public_token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  generated_by text,
  generated_at timestamptz not null default now(),
  sent_at      timestamptz,
  version      int not null default 1,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint reports_version_positive_check check (version > 0),
  constraint reports_order_version_unique unique (order_id, version)
);

comment on column public.reports.generated_by is 'Sumber generate: `n8n` atau id/nama user (docs/05 section 4.14).';
comment on column public.reports.pdf_path is 'Path di bucket privat `reports` (docs/17 section 3).';

create index reports_order_id_idx on public.reports (order_id);

create trigger set_reports_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

-- --- notifications (docs/05 section 4.15, docs/12) --------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid references public.orders (id) on delete cascade,
  channel    public.notif_channel not null,
  target     text,
  payload    jsonb not null default '{}'::jsonb,
  status     public.notif_status not null default 'queued',
  error      text,
  attempts   int not null default 0,
  sent_at    timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.notifications is 'Outbox notifikasi untuk worker n8n (docs/12, docs/18).';

create index notifications_status_idx on public.notifications (status);
create index notifications_channel_idx on public.notifications (channel);
create index notifications_order_id_idx on public.notifications (order_id);

create trigger set_notifications_updated_at
  before update on public.notifications
  for each row execute function public.set_updated_at();

-- --- issues (docs/05 section 4.16, docs/08 section 6) -----------------------
create table public.issues (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  reported_by uuid references public.profiles (id) on delete set null,
  severity    public.issue_severity not null default 'medium',
  title       text not null,
  description text,
  status      public.issue_status not null default 'open',
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint issues_resolved_consistency_check check (
    (status = 'resolved' and resolved_at is not null)
    or (status <> 'resolved' and resolved_at is null)
  )
);

comment on table public.issues is
  'Kendala pada order. Issue terbuka adalah bagian "apa kendalanya" pada litmus test (docs/08 section 8).';

create index issues_order_status_idx on public.issues (order_id, status);
create index issues_status_severity_idx on public.issues (status, severity);

create trigger set_issues_updated_at
  before update on public.issues
  for each row execute function public.set_updated_at();

-- --- audit_logs (docs/05 section 4.17) --------------------------------------
create table public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references public.profiles (id) on delete set null,
  entity     text not null,
  entity_id  uuid,
  action     text not null,
  "before"   jsonb,
  "after"    jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_logs is 'Jejak audit; diisi trigger public.audit_row() (docs/05 section 4.17).';
comment on column public.audit_logs.actor_id is 'null untuk aksi sistem (n8n/seed/migration).';

create index audit_logs_entity_idx on public.audit_logs (entity, entity_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id);
