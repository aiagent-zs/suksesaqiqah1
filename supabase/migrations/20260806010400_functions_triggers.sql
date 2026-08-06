-- =============================================================================
-- Tahap 1 — Database · 05 Function & trigger
-- order_number, profil otomatis dari auth.users, sinkronisasi pembayaran, audit trail
-- Acuan: docs/05_DATABASE_DESIGN.md section 4.6/4.17, docs/08_WORKFLOW_MAP.md section 2
-- =============================================================================

-- --- Nomor order: IA-YYYYMM-#### (docs/05 section 4.6) ----------------------
create table public.order_counters (
  period      text primary key,
  last_number int not null default 0
);

comment on table public.order_counters is
  'Counter nomor order per periode YYYYMM (Asia/Jakarta). Dipakai public.next_order_number().';

create or replace function public.next_order_number(p_at timestamptz default now())
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period text := to_char(p_at at time zone 'Asia/Jakarta', 'YYYYMM');
  v_num    int;
begin
  insert into public.order_counters as c (period, last_number)
  values (v_period, 1)
  on conflict (period) do update set last_number = c.last_number + 1
  returning c.last_number into v_num;

  return 'IA-' || v_period || '-' || lpad(v_num::text, 4, '0');
end;
$$;

comment on function public.next_order_number is
  'Mengembalikan nomor order berikutnya, atomik lewat UPSERT pada order_counters.';

create or replace function public.set_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := public.next_order_number(coalesce(new.created_at, now()));
  end if;
  return new;
end;
$$;

create trigger set_orders_order_number
  before insert on public.orders
  for each row execute function public.set_order_number();

-- --- Profil otomatis saat user auth dibuat ----------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role   public.user_role;
  v_branch uuid;
begin
  begin
    v_role := coalesce(
      nullif(new.raw_user_meta_data ->> 'role', '')::public.user_role,
      'petugas_lapangan'
    );
  exception
    when others then v_role := 'petugas_lapangan';
  end;

  begin
    v_branch := nullif(new.raw_user_meta_data ->> 'branch_id', '')::uuid;
  exception
    when others then v_branch := null;
  end;

  insert into public.profiles (id, email, full_name, phone, role, branch_id, is_active)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    v_role,
    v_branch,
    -- Non-aktif sampai admin menetapkan cabang untuk role yang ter-scope cabang.
    v_role in ('direktur', 'manager_program', 'admin_pusat') or v_branch is not null
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user is
  'Membuat baris public.profiles setiap auth.users baru; role/branch_id diambil dari user metadata.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --- Gate DP: rasio minimum dari app_settings (docs/08 section 2) -----------
create or replace function public.min_dp_ratio()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((value ->> 'ratio')::numeric, 0.5)
  from public.app_settings
  where key = 'min_dp_ratio';
$$;

comment on function public.min_dp_ratio is
  'Rasio DP minimum agar order boleh naik ke `scheduled`. Default 0.5 bila belum diset.';

-- --- Sinkronisasi pembayaran -> orders.paid_amount / payment_status ---------
-- Turunan murni: hanya menjumlahkan pembayaran berstatus `verified`.
-- Keputusan transisi order_status tetap milik state machine (Tahap 4).
create or replace function public.sync_order_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid := coalesce(new.order_id, old.order_id);
  v_paid     numeric(14, 2);
  v_total    numeric(14, 2);
begin
  select coalesce(sum(amount), 0) into v_paid
  from public.payments
  where order_id = v_order_id and status = 'verified';

  select total_amount into v_total from public.orders where id = v_order_id;

  update public.orders
  set paid_amount    = v_paid,
      payment_status = case
        when v_total > 0 and v_paid >= v_total then 'paid'::public.payment_status
        when v_paid > 0 then 'partial'::public.payment_status
        else 'unpaid'::public.payment_status
      end
  where id = v_order_id;

  return null;
end;
$$;

create trigger sync_order_payment_after_change
  after insert or update or delete on public.payments
  for each row execute function public.sync_order_payment();

-- --- Audit trail (docs/05 section 4.17) -------------------------------------
create or replace function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor  uuid := auth.uid();
  v_action text;
begin
  -- Aksi dari seed/migration/n8n tidak punya profil -> dicatat sebagai sistem (null).
  if v_actor is not null and not exists (select 1 from public.profiles where id = v_actor) then
    v_actor := null;
  end if;

  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, entity, entity_id, action, "before", "after")
    values (v_actor, tg_table_name, new.id, 'create', null, to_jsonb(new));
    return new;

  elsif tg_op = 'UPDATE' then
    v_action := case
      when to_jsonb(new) ->> 'status' is distinct from to_jsonb(old) ->> 'status' then 'status_change'
      else 'update'
    end;
    insert into public.audit_logs (actor_id, entity, entity_id, action, "before", "after")
    values (v_actor, tg_table_name, new.id, v_action, to_jsonb(old), to_jsonb(new));
    return new;

  else
    insert into public.audit_logs (actor_id, entity, entity_id, action, "before", "after")
    values (v_actor, tg_table_name, old.id, 'delete', to_jsonb(old), null);
    return old;
  end if;
end;
$$;

comment on function public.audit_row is
  'Trigger generik pencatat audit; membedakan `status_change` dari `update` biasa.';

create trigger audit_orders
  after insert or update or delete on public.orders
  for each row execute function public.audit_row();

create trigger audit_payments
  after insert or update or delete on public.payments
  for each row execute function public.audit_row();

create trigger audit_schedules
  after insert or update or delete on public.schedules
  for each row execute function public.audit_row();

create trigger audit_animals
  after insert or update or delete on public.animals
  for each row execute function public.audit_row();

create trigger audit_documentations
  after insert or update or delete on public.documentations
  for each row execute function public.audit_row();

create trigger audit_issues
  after insert or update or delete on public.issues
  for each row execute function public.audit_row();

create trigger audit_reports
  after insert or update or delete on public.reports
  for each row execute function public.audit_row();
