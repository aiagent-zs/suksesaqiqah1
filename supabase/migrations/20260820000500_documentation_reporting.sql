-- =============================================================================
-- Desain ulang skema · 05 Dokumentasi, laporan, notifikasi, kendala, audit
--
-- Perubahan pokok: `documentations.stage` kini bercermin pada
-- `fulfilment_stage`, dan tiap bukti boleh bertaut ke baris tahap yang
-- dilaporkan. Dengan begitu gerbang kelengkapan bisa menuntut bukti **per
-- tahap** menurut `stage_requirements` — bukan lagi dua tahap yang ditulis
-- keras di dua tempat berbeda dalam kode.
-- =============================================================================

-- --- documentations ---------------------------------------------------------
create table public.documentations (
  id       uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id)   on delete cascade,
  animal_id uuid references public.animals (id) on delete set null,
  -- Bukti untuk satu laporan tahap tertentu. NULL untuk bukti umum.
  stage_event_id uuid references public.order_stage_events (id) on delete set null,

  stage    public.doc_stage  not null default 'umum',
  type     public.doc_type   not null default 'photo',
  status   public.doc_status not null default 'pending',

  storage_path text not null,
  caption      text,

  uploaded_by uuid references public.profiles (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint documentations_reviewed_consistency_check check (
    (status = 'pending' and reviewed_at is null)
    or (status <> 'pending' and reviewed_at is not null)
  ),
  constraint documentations_reject_reason_check check (
    status <> 'rejected' or review_note is not null
  )
);

comment on column public.documentations.stage_event_id is
  'Laporan tahap yang dibuktikan berkas ini. NULL untuk bukti umum yang tidak menempel pada satu tahap.';

create index documentations_order_stage_idx on public.documentations (order_id, stage, status);
create index documentations_stage_event_idx on public.documentations (stage_event_id);
create index documentations_pending_idx on public.documentations (created_at)
  where status = 'pending';

create trigger set_documentations_updated_at
  before update on public.documentations
  for each row execute function public.set_updated_at();

-- Tahap pada bukti harus sama dengan tahap yang dibuktikannya, dan keduanya
-- harus milik order yang sama. Tanpa ini, bukti masak bisa menempel pada
-- laporan sembelih dan gerbang kelengkapan ikut tertipu.
create or replace function public.enforce_documentation_stage_match()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_order uuid; v_stage public.fulfilment_stage;
begin
  if new.stage_event_id is null then
    return new;
  end if;

  select e.order_id, e.stage into v_order, v_stage
  from public.order_stage_events e where e.id = new.stage_event_id;

  if v_order is null then
    raise exception 'Laporan tahap tidak ditemukan.' using errcode = 'no_data_found';
  end if;
  if v_order <> new.order_id then
    raise exception 'Bukti dan laporan tahap milik order yang berbeda.'
      using errcode = 'check_violation';
  end if;
  if new.stage::text <> v_stage::text then
    raise exception 'Tahap bukti (%) tidak cocok dengan tahap laporan (%).', new.stage, v_stage
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

create trigger enforce_documentation_stage_match_before_write
  before insert or update on public.documentations
  for each row execute function public.enforce_documentation_stage_match();

-- Validasi satu tingkat + pemisahan tugas, ditegakkan di database — bukan
-- hanya di server action, karena PostgREST bisa dipanggil langsung.
create or replace function public.enforce_documentation_review()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid();
begin
  if new.status = old.status then
    return new;
  end if;

  -- Jalur sah: pending -> approved|rejected, dan rejected -> pending
  -- (pengunggah memperbaiki lalu mengajukan ulang).
  if not (
    (old.status = 'pending'  and new.status in ('approved', 'rejected'))
    or (old.status = 'rejected' and new.status = 'pending')
  ) then
    raise exception 'Perpindahan status dokumentasi % -> % tidak sah.', old.status, new.status
      using errcode = 'check_violation';
  end if;

  if new.status in ('approved', 'rejected') then
    if old.uploaded_by is not null and old.uploaded_by = v_actor then
      raise exception 'Pengunggah tidak boleh memvalidasi buktinya sendiri.'
        using errcode = 'insufficient_privilege';
    end if;
    new.reviewed_by := v_actor;
    new.reviewed_at := now();
  else
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.review_note := null;
  end if;

  return new;
end $$;

create trigger enforce_documentation_review_before_update
  before update on public.documentations
  for each row execute function public.enforce_documentation_review();

-- --- reports ----------------------------------------------------------------
create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  version      int not null default 1,
  pdf_path     text,
  generated_by uuid references public.profiles (id) on delete set null,
  generated_at timestamptz not null default now(),
  sent_at      timestamptz,
  sent_channel public.notif_channel,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint reports_version_unique unique (order_id, version)
);

comment on table public.reports is
  'Versi laporan peserta. Generate ulang menambah versi tanpa mengubah orders.public_token — tautan yang sudah dibagikan tetap sama.';

create index reports_order_id_idx on public.reports (order_id, version desc);

create trigger set_reports_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

-- --- notifications ----------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid references public.orders (id) on delete cascade,
  channel    public.notif_channel not null,
  status     public.notif_status not null default 'queued',
  recipient  text not null,
  template   text,
  payload    jsonb not null default '{}'::jsonb,
  sent_at    timestamptz,
  error_text text,
  attempts   int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notifications_status_idx on public.notifications (status, created_at)
  where status = 'queued';

create trigger set_notifications_updated_at
  before update on public.notifications
  for each row execute function public.set_updated_at();

-- --- issues -----------------------------------------------------------------
create table public.issues (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  title       text not null,
  description text,
  severity    public.issue_severity not null default 'medium',
  status      public.issue_status not null default 'open',
  reported_by uuid references public.profiles (id) on delete set null,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint issues_resolved_consistency_check check (
    (status = 'resolved' and resolved_at is not null)
    or (status <> 'resolved' and resolved_at is null)
  )
);

create index issues_order_status_idx on public.issues (order_id, status);
create index issues_open_idx on public.issues (severity, created_at)
  where status in ('open', 'in_progress');

create trigger set_issues_updated_at
  before update on public.issues
  for each row execute function public.set_updated_at();

-- --- audit_logs -------------------------------------------------------------
create table public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id  uuid not null,
  action     text not null,
  actor_id   uuid references public.profiles (id) on delete set null,
  old_data   jsonb,
  new_data   jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_record_idx on public.audit_logs (table_name, record_id, created_at desc);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
