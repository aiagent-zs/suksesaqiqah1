-- =============================================================================
-- Tahap 1 — Database · 07 Row Level Security (kebijakan dasar)
-- Acuan: docs/05_DATABASE_DESIGN.md section 8, docs/07_USER_ROLES.md section 3-5
--
-- Cakupan Tahap 1: RLS AKTIF di semua tabel + kebijakan dasar per role.
-- Tahap 3 (RBAC/RLS) memperketat & menguji positif/negatif lintas cabang.
--
-- Semua helper di bawah SECURITY DEFINER supaya tidak terjadi rekursi kebijakan
-- (kebijakan pada profiles yang membaca profiles akan looping bila invoker).
-- =============================================================================

-- --- Helper: identitas & scope pemanggil ------------------------------------

create or replace function public.auth_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid() and p.is_active and p.deleted_at is null;
$$;

create or replace function public.auth_branch_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.branch_id
  from public.profiles p
  where p.id = auth.uid() and p.is_active and p.deleted_at is null;
$$;

-- Role pusat: melihat seluruh cabang (docs/07 section 4).
create or replace function public.is_central()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_role() in ('direktur', 'manager_program', 'admin_pusat'), false);
$$;

-- Supervisor validasi tingkat-1: manager_program / admin_cabang "yang ditunjuk".
create or replace function public.is_supervisor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.is_supervisor and p.role in ('manager_program', 'admin_cabang')
      from public.profiles p
      where p.id = auth.uid() and p.is_active and p.deleted_at is null
    ),
    false
  );
$$;

-- --- Helper: akses per order ------------------------------------------------

create or replace function public.can_read_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case public.auth_role()
    when 'direktur'         then true
    when 'manager_program'  then true
    when 'admin_pusat'      then true
    when 'admin_cabang'     then exists (
      select 1 from public.orders o
      where o.id = p_order_id and o.branch_id = public.auth_branch_id()
    )
    when 'petugas_lapangan' then exists (
      select 1 from public.schedules s
      where s.order_id = p_order_id and s.pic_user_id = auth.uid()
    )
    else false
  end;
$$;

comment on function public.can_read_order is
  'Scope baca per order: pusat = semua, admin_cabang = cabangnya, petugas = order yang di-PIC-i.';

create or replace function public.can_write_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case public.auth_role()
    when 'manager_program'  then true
    when 'admin_cabang'     then exists (
      select 1 from public.orders o
      where o.id = p_order_id and o.branch_id = public.auth_branch_id()
    )
    when 'petugas_lapangan' then exists (
      select 1 from public.schedules s
      where s.order_id = p_order_id and s.pic_user_id = auth.uid()
    )
    else false
  end;
$$;

comment on function public.can_write_order is
  'Scope tulis per order. Direktur & admin_pusat sengaja read-only di jalur operasional (docs/07 section 4).';

-- =============================================================================
-- Aktifkan RLS
-- =============================================================================

alter table public.branches          enable row level security;
alter table public.locations         enable row level security;
alter table public.profiles          enable row level security;
alter table public.services          enable row level security;
alter table public.participants      enable row level security;
alter table public.app_settings      enable row level security;
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.animals           enable row level security;
alter table public.payments          enable row level security;
alter table public.schedules         enable row level security;
alter table public.slaughter_records enable row level security;
alter table public.distributions     enable row level security;
alter table public.documentations    enable row level security;
alter table public.reports           enable row level security;
alter table public.notifications     enable row level security;
alter table public.issues            enable row level security;
alter table public.audit_logs        enable row level security;
alter table public.order_counters    enable row level security;

-- =============================================================================
-- Master data
-- =============================================================================

-- branches / locations / services: dibaca semua user internal, ditulis Manager Program.
create policy branches_select on public.branches
  for select to authenticated using (true);
create policy branches_write on public.branches
  for all to authenticated
  using (public.auth_role() = 'manager_program')
  with check (public.auth_role() = 'manager_program');

create policy locations_select on public.locations
  for select to authenticated using (true);
create policy locations_write on public.locations
  for all to authenticated
  using (public.auth_role() = 'manager_program')
  with check (public.auth_role() = 'manager_program');

create policy services_select on public.services
  for select to authenticated using (true);
create policy services_write on public.services
  for all to authenticated
  using (public.auth_role() = 'manager_program')
  with check (public.auth_role() = 'manager_program');

-- Katalog program juga dibaca pengunjung publik (landing/katalog, Tahap 10).
create policy services_public_select on public.services
  for select to anon using (is_active and deleted_at is null);

-- app_settings: dibaca user internal, diubah Direktur/Manager.
create policy app_settings_select on public.app_settings
  for select to authenticated using (true);
create policy app_settings_write on public.app_settings
  for all to authenticated
  using (public.auth_role() in ('direktur', 'manager_program'))
  with check (public.auth_role() in ('direktur', 'manager_program'));

-- profiles: diri sendiri, atau pusat, atau sesama cabang untuk admin cabang.
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_central()
    or (public.auth_role() = 'admin_cabang' and branch_id = public.auth_branch_id())
  );

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Pengelolaan user (role, branch, aktif) dipegang Manager Program.
create policy profiles_manage on public.profiles
  for all to authenticated
  using (public.auth_role() = 'manager_program')
  with check (public.auth_role() = 'manager_program');

-- participants: tidak ter-scope cabang; dibaca user internal, ditulis operator.
create policy participants_select on public.participants
  for select to authenticated using (true);
create policy participants_write on public.participants
  for all to authenticated
  using (public.auth_role() in ('manager_program', 'admin_cabang'))
  with check (public.auth_role() in ('manager_program', 'admin_cabang'));

-- =============================================================================
-- Order & turunannya
-- =============================================================================

create policy orders_select on public.orders
  for select to authenticated using (public.can_read_order(id));

create policy orders_insert on public.orders
  for insert to authenticated
  with check (
    public.auth_role() = 'manager_program'
    or (public.auth_role() = 'admin_cabang' and branch_id = public.auth_branch_id())
  );

create policy orders_update on public.orders
  for update to authenticated
  using (public.can_write_order(id))
  with check (public.can_write_order(id));

create policy orders_delete on public.orders
  for delete to authenticated
  using (
    public.auth_role() = 'manager_program'
    or (public.auth_role() = 'admin_cabang' and branch_id = public.auth_branch_id())
  );

-- Tabel anak: scope mengikuti order induknya.
create policy order_items_select on public.order_items
  for select to authenticated using (public.can_read_order(order_id));
create policy order_items_write on public.order_items
  for all to authenticated
  using (public.can_write_order(order_id))
  with check (public.can_write_order(order_id));

create policy animals_select on public.animals
  for select to authenticated using (public.can_read_order(order_id));
create policy animals_write on public.animals
  for all to authenticated
  using (public.can_write_order(order_id))
  with check (public.can_write_order(order_id));

-- payments: petugas lapangan tidak boleh menyentuh pembayaran (docs/07 section 3).
create policy payments_select on public.payments
  for select to authenticated
  using (
    public.can_read_order(order_id)
    and public.auth_role() <> 'petugas_lapangan'
  );
create policy payments_write on public.payments
  for all to authenticated
  using (
    public.can_write_order(order_id)
    and public.auth_role() in ('manager_program', 'admin_cabang')
  )
  with check (
    public.can_write_order(order_id)
    and public.auth_role() in ('manager_program', 'admin_cabang')
  );

create policy schedules_select on public.schedules
  for select to authenticated using (public.can_read_order(order_id));
create policy schedules_write on public.schedules
  for all to authenticated
  using (
    public.can_write_order(order_id)
    and public.auth_role() in ('manager_program', 'admin_cabang')
  )
  with check (
    public.can_write_order(order_id)
    and public.auth_role() in ('manager_program', 'admin_cabang')
  );

create policy slaughter_records_select on public.slaughter_records
  for select to authenticated
  using (
    exists (
      select 1 from public.animals a
      where a.id = slaughter_records.animal_id and public.can_read_order(a.order_id)
    )
  );
create policy slaughter_records_write on public.slaughter_records
  for all to authenticated
  using (
    exists (
      select 1 from public.animals a
      where a.id = slaughter_records.animal_id and public.can_write_order(a.order_id)
    )
  )
  with check (
    exists (
      select 1 from public.animals a
      where a.id = slaughter_records.animal_id and public.can_write_order(a.order_id)
    )
  );

create policy distributions_select on public.distributions
  for select to authenticated using (public.can_read_order(order_id));
create policy distributions_write on public.distributions
  for all to authenticated
  using (public.can_write_order(order_id))
  with check (public.can_write_order(order_id));

-- =============================================================================
-- Dokumentasi, laporan, notifikasi, issue, audit
-- =============================================================================

create policy documentations_select on public.documentations
  for select to authenticated using (public.can_read_order(order_id));

create policy documentations_insert on public.documentations
  for insert to authenticated
  with check (public.can_write_order(order_id));

-- Update dipakai untuk validasi: tingkat-1 Supervisor, tingkat-akhir Admin Pusat.
-- Pengupload boleh memperbaiki dokumennya sendiri selama belum divalidasi.
create policy documentations_update on public.documentations
  for update to authenticated
  using (
    public.auth_role() = 'admin_pusat'
    or (public.is_supervisor() and public.can_read_order(order_id))
    or (uploaded_by = auth.uid() and status in ('pending', 'rejected'))
  )
  with check (
    public.auth_role() = 'admin_pusat'
    or (public.is_supervisor() and public.can_read_order(order_id))
    or (uploaded_by = auth.uid() and status in ('pending', 'rejected'))
  );

create policy documentations_delete on public.documentations
  for delete to authenticated
  using (
    public.auth_role() in ('manager_program', 'admin_cabang')
    and public.can_write_order(order_id)
  );

create policy reports_select on public.reports
  for select to authenticated using (public.can_read_order(order_id));
create policy reports_write on public.reports
  for all to authenticated
  using (
    public.auth_role() in ('manager_program', 'admin_pusat', 'admin_cabang')
    and public.can_read_order(order_id)
  )
  with check (
    public.auth_role() in ('manager_program', 'admin_pusat', 'admin_cabang')
    and public.can_read_order(order_id)
  );

create policy notifications_select on public.notifications
  for select to authenticated
  using (order_id is null or public.can_read_order(order_id));
create policy notifications_write on public.notifications
  for all to authenticated
  using (public.auth_role() in ('manager_program', 'admin_pusat'))
  with check (public.auth_role() in ('manager_program', 'admin_pusat'));

create policy issues_select on public.issues
  for select to authenticated using (public.can_read_order(order_id));
create policy issues_insert on public.issues
  for insert to authenticated with check (public.can_write_order(order_id));
create policy issues_update on public.issues
  for update to authenticated
  using (public.can_write_order(order_id))
  with check (public.can_write_order(order_id));

-- audit_logs: read-only bagi user; penulisan hanya lewat trigger SECURITY DEFINER.
create policy audit_logs_select on public.audit_logs
  for select to authenticated using (public.is_central());

-- order_counters: internal, tidak diekspos ke klien (tanpa policy = deny all).

-- =============================================================================
-- Catatan akses publik (peserta)
-- =============================================================================
-- Peserta TIDAK diberi policy langsung ke tabel. Akses laporan publik lewat
-- fungsi keamanan bertoken + signed URL (docs/07 section 5, docs/11, docs/20),
-- dibangun pada Tahap 6 (Reporting).
