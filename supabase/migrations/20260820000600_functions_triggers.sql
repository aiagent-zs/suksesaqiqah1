-- =============================================================================
-- Desain ulang skema · 06 Fungsi & trigger
--
-- Perubahan pokok pada `handle_new_user`: **role tidak lagi diambil dari
-- `raw_user_meta_data`.** Di skema lama, selama pendaftaran mandiri terbuka di
-- Supabase, siapa pun bisa mendaftar sambil menyisipkan `{"role":"admin"}` dan
-- langsung jadi admin. Sekarang akun baru selalu lahir sebagai vendor
-- non-aktif; role hanya bisa dinaikkan lewat jalur superadmin.
-- =============================================================================

-- --- Nomor order ------------------------------------------------------------
--
-- Global per bulan, tidak per mitra: nomor adalah identitas order di mata
-- pembeli, dan order bisa dipindah ke mitra lain tanpa nomornya berubah.
create or replace function public.next_order_number()
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_period text := to_char(now() at time zone 'Asia/Jakarta', 'YYYYMM');
  v_next   int;
begin
  insert into public.order_counters (period, last_value)
  values (v_period, 1)
  on conflict (period) do update set last_value = public.order_counters.last_value + 1
  returning last_value into v_next;

  return 'IA-' || v_period || '-' || lpad(v_next::text, 4, '0');
end $$;

create or replace function public.set_order_number()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := public.next_order_number();
  end if;
  return new;
end $$;

create trigger set_orders_order_number
  before insert on public.orders
  for each row execute function public.set_order_number();

-- --- Akun baru --------------------------------------------------------------
--
-- Role sengaja TIDAK dibaca dari metadata. `vendor_id` boleh, karena jalur
-- superadmin memang menautkan akun ke mitranya saat membuat akun lewat Admin
-- API — dan tautan itu tidak memberi wewenang apa pun, hanya menentukan order
-- mana yang kelak terlihat.
--
-- Akun lahir non-aktif: kerja sama dengan mitra dimulai dari kesepakatan, bukan
-- dari pendaftaran. `auth_role()` mengembalikan NULL selama non-aktif, jadi
-- akunnya belum bisa apa-apa.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_vendor uuid;
begin
  begin
    v_vendor := nullif(new.raw_user_meta_data ->> 'vendor_id', '')::uuid;
  exception when others then
    v_vendor := null;
  end;

  insert into public.profiles (id, email, full_name, phone, role, vendor_id, is_active)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    'vendor',
    v_vendor,
    false
  )
  on conflict (id) do nothing;

  return new;
end $$;

comment on function public.handle_new_user is
  'Membuat profil saat akun auth dibuat. Role TIDAK dibaca dari metadata — akun selalu lahir vendor non-aktif; kenaikan role hanya lewat jalur superadmin.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --- Peran & akses ----------------------------------------------------------
create or replace function public.auth_role()
returns public.user_role
language sql stable security definer set search_path = public as $$
  select p.role from public.profiles p
  where p.id = auth.uid() and p.is_active and p.deleted_at is null;
$$;

create or replace function public.auth_vendor_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select p.vendor_id from public.profiles p
  where p.id = auth.uid() and p.is_active and p.deleted_at is null;
$$;

create or replace function public.is_superadmin()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.auth_role() = 'superadmin';
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.auth_role() in ('superadmin', 'admin');
$$;

-- Vendor melihat order lewat `orders.vendor_id`, bukan lagi lewat jadwal.
-- Dengan begitu penugasan mitra berdiri sendiri dan jadwal kembali jadi jadwal.
create or replace function public.can_read_order(p_order_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select case public.auth_role()
    when 'superadmin' then true
    when 'admin'      then true
    when 'vendor'     then exists (
      select 1 from public.orders o
      where o.id = p_order_id
        and o.vendor_id is not null
        and o.vendor_id = public.auth_vendor_id()
    )
    else false
  end;
$$;

create or replace function public.can_write_order(p_order_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_read_order(p_order_id);
$$;

-- --- Gate pembayaran --------------------------------------------------------
create or replace function public.min_dp_ratio()
returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((value ->> 'ratio')::numeric, 0.5)
  from public.app_settings where key = 'min_dp_ratio';
$$;

-- Menyinkronkan paid_amount & payment_status dari pembayaran TERVERIFIKASI
-- saja. Pembayaran yang baru dicatat tidak menggerakkan apa pun.
create or replace function public.sync_order_payment()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_order uuid := coalesce(new.order_id, old.order_id);
  v_paid  numeric(14, 2);
  v_total numeric(14, 2);
begin
  select coalesce(sum(p.amount), 0) into v_paid
  from public.payments p
  where p.order_id = v_order and p.status = 'verified';

  select total_amount into v_total from public.orders where id = v_order;

  update public.orders
  set paid_amount = v_paid,
      -- Cast eksplisit: `case` yang mengembalikan literal teks tidak otomatis
      -- jadi enum, dan Postgres menolaknya dengan galat yang menyebut kolomnya
      -- — bukan trigger-nya, jadi asal-usulnya tidak langsung terlihat.
      payment_status = (case
        when v_paid <= 0 then 'unpaid'
        when v_paid >= v_total then 'paid'
        else 'partial'
      end)::public.payment_status
  where id = v_order;

  return null;
end $$;

create trigger sync_order_payment_after_change
  after insert or update or delete on public.payments
  for each row execute function public.sync_order_payment();

-- --- Penahan order tamu -----------------------------------------------------
--
-- Order dari checkout publik tertahan di `new` sampai admin memverifikasinya.
-- Ditegakkan di database, bukan di server action: RLS memberi admin wewenang
-- penuh atas baris order, jadi penjaga di lapisan aplikasi saja bisa dilewati
-- lewat PostgREST langsung.
create or replace function public.enforce_guest_order_verification()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Order internal tidak bisa dicap terverifikasi-tamu.
  if new.created_by is not null and new.guest_verified_at is not null then
    raise exception 'Verifikasi tamu hanya berlaku untuk order dari checkout publik.'
      using errcode = 'check_violation';
  end if;

  -- Verifikasi tidak dapat dicabut.
  if old.guest_verified_at is not null and new.guest_verified_at is null then
    raise exception 'Verifikasi order tamu tidak dapat dibatalkan.'
      using errcode = 'check_violation';
  end if;

  -- Pesanan iseng atau ganda tetap boleh ditutup tanpa verifikasi lebih dulu.
  if new.status <> old.status
     and new.created_by is null
     and new.guest_verified_at is null
     and new.status not in ('new', 'cancelled') then
    raise exception 'Order tamu harus diverifikasi admin sebelum diproses.'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

create trigger enforce_guest_order_verification_before_update
  before update on public.orders
  for each row execute function public.enforce_guest_order_verification();

-- --- Audit ------------------------------------------------------------------
create or replace function public.audit_row()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (table_name, record_id, action, actor_id, old_data, new_data)
  values (
    tg_table_name,
    coalesce(new.id, old.id),
    lower(tg_op),
    auth.uid(),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end $$;

create trigger audit_orders after insert or update or delete on public.orders
  for each row execute function public.audit_row();
create trigger audit_payments after insert or update or delete on public.payments
  for each row execute function public.audit_row();
create trigger audit_stage_events after insert or update or delete on public.order_stage_events
  for each row execute function public.audit_row();
create trigger audit_documentations after insert or update or delete on public.documentations
  for each row execute function public.audit_row();
create trigger audit_issues after insert or update or delete on public.issues
  for each row execute function public.audit_row();
create trigger audit_reports after insert or update or delete on public.reports
  for each row execute function public.audit_row();
create trigger audit_vendors after insert or update or delete on public.vendors
  for each row execute function public.audit_row();
create trigger audit_profiles after insert or update or delete on public.profiles
  for each row execute function public.audit_row();
