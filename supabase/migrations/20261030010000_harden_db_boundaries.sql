-- =============================================================================
-- Pengerasan batas database (audit 30 Oktober 2026)
--
-- Aturan yang sebelumnya hanya dijaga TypeScript kini ditegakkan di sini,
-- karena anon key + PostgREST bisa melewati server action sepenuhnya.
--
-- 1. EXECUTE fungsi: default Supabase memberi `anon`/`authenticated` hak
--    menjalankan SEMUA fungsi baru di `public`, termasuk helper internal
--    (`next_order_number`, `enqueue_notification`, `close_*`). `revoke ... from
--    public` di migration lama tidak mencabut grant per-role itu.
-- 2. `next_order_number`: `lpad(…, 4)` memotong order ke-10.000 dalam sebulan
--    menjadi nomor yang sudah ada.
-- 3. `orders`: transisi status (cermin `features/orders/state-machine.ts`)
--    dan kolom yang tidak boleh ditulis vendor.
-- 4. `order_stage_events`: hanya staf yang memvalidasi, `reported_by` dari sesi.
-- 5. `documentations`: unggahan non-staf selalu masuk sebagai `pending`.
-- 6. `sync_order_payment`: kunci baris order supaya dua pembayaran yang
--    diverifikasi bersamaan tidak saling menimpa jumlahnya.
-- 7. `handle_new_user`: `vendor_id` dari metadata pendaftaran diabaikan.
-- 8. `get_order_tracking`: rem tebakan per nomor pesanan di database, dan
--    hanya bisa dipanggil server (service role).
-- =============================================================================

-- --- 1. EXECUTE fungsi -------------------------------------------------------

alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
-- Revoke menyeluruh + grant eksplisit ada di akhir berkas, supaya ikut
-- mencakup fungsi yang dibuat di migration ini.

-- --- 2. Nomor order ----------------------------------------------------------

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

  -- Minimal 4 digit, tapi tidak pernah dipotong: order ke-10.000 = …-10000.
  return 'IA-' || v_period || '-' || lpad(v_next::text, greatest(4, length(v_next::text)), '0');
end $$;

-- --- 3. Orders: transisi status & kolom terlarang ----------------------------

-- Cermin `ORDER_TRANSITIONS` (peran saja; gerbang bukti/pembayaran tetap di
-- server action karena butuh view progres). Jaga keduanya tetap sama.
create or replace function public.order_transition_allowed(
  p_from public.order_status,
  p_to   public.order_status,
  p_role public.user_role
) returns boolean
language sql immutable as $$
  select case
    when p_role in ('superadmin', 'admin') then (p_from, p_to) in (
      ('new', 'verified'), ('new', 'on_hold'), ('new', 'cancelled'),
      ('verified', 'paid'), ('verified', 'on_hold'), ('verified', 'cancelled'),
      ('paid', 'assigned'), ('paid', 'on_hold'), ('paid', 'cancelled'),
      ('assigned', 'in_progress'), ('assigned', 'on_hold'),
      ('in_progress', 'validation'), ('in_progress', 'on_hold'),
      ('validation', 'reporting'), ('validation', 'on_hold'),
      ('reporting', 'completed'), ('reporting', 'on_hold'),
      ('on_hold', 'new'), ('on_hold', 'verified'), ('on_hold', 'paid'),
      ('on_hold', 'assigned'), ('on_hold', 'in_progress'), ('on_hold', 'cancelled')
    )
    when p_role = 'vendor' then (p_from, p_to) in (
      ('assigned', 'in_progress'), ('in_progress', 'validation')
    )
    else false
  end;
$$;

create or replace function public.enforce_vendor_assignment()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role public.user_role := public.auth_role();
begin
  -- Tanpa sesi pengguna (service role, trigger lain, RPC security definer):
  -- jalur server yang sudah memeriksa sendiri.
  if auth.uid() is null then
    return new;
  end if;

  if new.status is distinct from old.status
     and not public.order_transition_allowed(old.status, new.status, v_role) then
    raise exception 'Transisi status % -> % tidak diizinkan untuk peran ini.', old.status, new.status
      using errcode = 'insufficient_privilege';
  end if;

  -- Uang hanya ditulis `sync_order_payment` (pembayaran terverifikasi).
  -- Trigger itu berjalan tanpa `auth.uid()` palsu, jadi pg_trigger_depth > 1.
  if pg_trigger_depth() = 1 and (
    new.paid_amount is distinct from old.paid_amount
    or new.payment_status is distinct from old.payment_status
  ) then
    raise exception 'Status pembayaran hanya berubah lewat pembayaran terverifikasi.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Pengecualian `created_at = now()`: RPC `create_order` menyisipkan order
  -- lalu menulis totalnya dari harga katalog dalam transaksi yang sama.
  -- PostgREST tidak bisa menyisipkan lalu meng-update dalam satu transaksi.
  if new.total_amount is distinct from old.total_amount
     and v_role is distinct from 'superadmin'
     and old.created_at <> now() then
    raise exception 'Nilai tagihan hanya dapat diubah superadmin.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Konfirmasi terima hanya lewat `confirm_delivery` (penanda transaksi di
  -- bawah); pg_catalog tidak diekspos PostgREST, jadi klien tidak bisa
  -- menyetel penandanya sendiri.
  if (new.delivery_confirmed_at is distinct from old.delivery_confirmed_at
      or new.delivery_confirmed_ip is distinct from old.delivery_confirmed_ip)
     and coalesce(current_setting('app.confirm_delivery', true), '') <> 'on' then
    raise exception 'Konfirmasi penerimaan hanya dari halaman pembeli.'
      using errcode = 'insufficient_privilege';
  end if;

  if new.public_token is distinct from old.public_token
     or new.created_by is distinct from old.created_by
     or new.order_number is distinct from old.order_number then
    raise exception 'Kolom ini tidak dapat diubah langsung.'
      using errcode = 'insufficient_privilege';
  end if;

  if not public.is_staff() and (
    new.vendor_id is distinct from old.vendor_id
    or new.guest_verified_at is distinct from old.guest_verified_at
    or new.guest_verified_by is distinct from old.guest_verified_by
  ) then
    raise exception 'Penugasan mitra dan verifikasi hanya dapat diubah admin.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end $$;

create or replace function public.confirm_delivery(p_token text, p_ip text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_order public.orders%rowtype;
begin
  if p_token is null or length(p_token) <> 32 then
    return jsonb_build_object('ok', false, 'reason', 'token_invalid');
  end if;

  select * into v_order from public.orders where public_token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'token_invalid');
  end if;

  if v_order.distribution_mode <> 'kirim' then
    return jsonb_build_object('ok', false, 'reason', 'bukan_order_kirim');
  end if;

  if v_order.delivery_confirmed_at is not null then
    return jsonb_build_object('ok', true, 'confirmed_at', v_order.delivery_confirmed_at);
  end if;

  perform set_config('app.confirm_delivery', 'on', true);
  update public.orders
  set delivery_confirmed_at = now(),
      delivery_confirmed_ip = left(p_ip, 64)
  where id = v_order.id;
  perform set_config('app.confirm_delivery', '', true);

  return jsonb_build_object('ok', true, 'confirmed_at', now());
end $$;

-- --- 4. Tahap: hanya staf yang memvalidasi -----------------------------------

create or replace function public.enforce_stage_review()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid();
begin
  if old.status = new.status then
    return new;
  end if;

  -- Pelapor dicatat dari sesi, bukan dari kiriman klien. Tanpa sesi (service
  -- role, seed) nilai kirimannya dipakai.
  if new.status = 'reported' then
    new.reported_by := coalesce(v_actor, new.reported_by);
    return new;
  end if;

  if new.status not in ('validated', 'rejected') then
    return new;
  end if;

  if v_actor is not null and not public.is_staff() then
    raise exception 'Hanya admin yang dapat memvalidasi laporan tahap.'
      using errcode = 'insufficient_privilege';
  end if;

  if old.reported_by is not null and old.reported_by = v_actor then
    raise exception 'Pelapor tidak boleh memvalidasi laporannya sendiri.'
      using errcode = 'insufficient_privilege';
  end if;

  new.validated_by := v_actor;
  new.validated_at := case when new.status = 'validated' then now() else null end;

  return new;
end $$;

-- --- 5. Dokumentasi: unggahan non-staf selalu pending ------------------------

create or replace function public.enforce_documentation_insert()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_staff() then
    return new;
  end if;

  new.status      := 'pending';
  new.uploaded_by := auth.uid();
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.review_note := null;
  return new;
end $$;

drop trigger if exists enforce_documentation_insert_before_insert on public.documentations;
create trigger enforce_documentation_insert_before_insert
  before insert on public.documentations
  for each row execute function public.enforce_documentation_insert();

-- --- 6. Sinkron pembayaran dengan kunci baris --------------------------------

create or replace function public.sync_order_payment()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_order uuid := coalesce(new.order_id, old.order_id);
  v_paid  numeric(14, 2);
  v_total numeric(14, 2);
begin
  -- Dua pembayaran yang diverifikasi bersamaan menunggu giliran di sini,
  -- jadi penjumlahan berikut selalu melihat baris pembayaran yang lain.
  select total_amount into v_total from public.orders where id = v_order for update;

  select coalesce(sum(p.amount), 0) into v_paid
  from public.payments p
  where p.order_id = v_order and p.status = 'verified';

  update public.orders
  set paid_amount = v_paid,
      payment_status = (case
        when v_paid <= 0 then 'unpaid'
        when v_paid >= v_total then 'paid'
        else 'partial'
      end)::public.payment_status
  where id = v_order;

  return null;
end $$;

-- --- 7. Pendaftaran tidak bisa mengklaim mitra -------------------------------

-- Akun mitra dibuat superadmin lewat `createUser`, yang menulis `vendor_id`
-- sesudahnya lewat update profil. Metadata pendaftaran bisa diisi siapa pun.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone, role, vendor_id, is_active)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    'vendor',
    null,
    false
  )
  on conflict (id) do nothing;

  return new;
end $$;

-- --- 8. Lacak pesanan: rem tebakan per nomor ---------------------------------

create table if not exists public.tracking_failures (
  order_number text not null,
  failed_at    timestamptz not null default now()
);
create index if not exists tracking_failures_lookup_idx
  on public.tracking_failures (order_number, failed_at desc);
alter table public.tracking_failures enable row level security;
revoke all on public.tracking_failures from anon, authenticated;

create or replace function public.get_order_tracking(p_order_number text, p_phone_last4 text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order  public.orders%rowtype;
  v_phone  text;
  v_token  text;
  v_fails  int;
begin
  if p_order_number is null or p_phone_last4 is null or p_phone_last4 !~ '^[0-9]{4}$' then
    return null;
  end if;

  -- Rem tebakan per nomor pesanan, bukan per IP: 4 digit = 10.000 pasangan,
  -- dan IP bisa dirotasi. 10 salah per jam membuat satu nomor butuh
  -- berminggu-minggu untuk ditebak dari jaringan mana pun.
  select count(*) into v_fails
  from public.tracking_failures f
  where f.order_number = upper(btrim(p_order_number))
    and f.failed_at > now() - interval '1 hour';
  if v_fails >= 10 then
    return null;
  end if;

  select * into v_order
  from public.orders
  where order_number = upper(btrim(p_order_number))
    and deleted_at is null;
  if not found then
    return null;
  end if;

  select regexp_replace(coalesce(p.phone, ''), '[^0-9]', '', 'g') into v_phone
  from public.participants p
  where p.id = v_order.participant_id;

  if v_phone is null or length(v_phone) < 4 or right(v_phone, 4) <> p_phone_last4 then
    insert into public.tracking_failures (order_number) values (v_order.order_number);
    return null;
  end if;

  -- Tautan laporan hanya bila laporannya sudah terbit; syarat yang sama dengan
  -- `get_public_report`, jadi tautan ini tidak pernah membuka halaman kosong.
  if exists (select 1 from public.reports r where r.order_id = v_order.id) then
    v_token := v_order.public_token;
  end if;

  return jsonb_build_object(
    'order_number',      v_order.order_number,
    'status',            v_order.status,
    'payment_status',    v_order.payment_status,
    'created_at',        v_order.created_at,
    'requested_date',    v_order.requested_date,
    'distribution_mode', v_order.distribution_mode,
    'is_catering',       public.is_catering_order(v_order.id),
    'report_token',      v_token,
    'services', coalesce((
      select jsonb_agg(jsonb_build_object('name', s.name, 'qty', oi.qty) order by s.name)
      from public.order_items oi
      join public.services s on s.id = oi.service_id
      where oi.order_id = v_order.id
    ), '[]'::jsonb),
    -- Satu baris per tahap. `sembelih` dicatat per ekor, jadi dirangkum: ia
    -- baru selesai ketika seluruh ekornya tervalidasi.
    'stages', coalesce((
      select jsonb_agg(
        jsonb_build_object('stage', t.stage, 'done', t.done, 'started', t.started, 'at', t.at)
        order by t.seq
      )
      from (
        select
          e.stage,
          min(e.seq) as seq,
          bool_and(e.status = 'validated') as done,
          bool_or(e.status <> 'pending') as started,
          max(e.validated_at) as at
        from public.order_stage_events e
        where e.order_id = v_order.id
        group by e.stage
      ) t
    ), '[]'::jsonb)
  );
end $$;

-- Baris lama tidak berguna sesudah sejam; dibuang oportunistik oleh siapa pun
-- yang mencatat kegagalan baru supaya tabel tidak tumbuh tanpa batas.
create or replace function public.prune_tracking_failures()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.tracking_failures where failed_at < now() - interval '1 day';
  return null;
end $$;

drop trigger if exists prune_tracking_failures on public.tracking_failures;
create trigger prune_tracking_failures
  after insert on public.tracking_failures
  for each statement execute function public.prune_tracking_failures();

-- --- Grant tabel service_role -------------------------------------------------
--
-- Webhook Durianpay dan halaman laporan memakai service role. Di proyek cloud
-- grant ini sudah ada dari Supabase; di lokal tidak, jadi dinyatakan di sini.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- --- EXECUTE: revoke menyeluruh, lalu buka satu per satu ----------------------

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.auth_role(), public.auth_vendor_id(), public.is_staff(), public.is_superadmin(),
  public.can_read_order(uuid), public.can_write_order(uuid), public.is_catering_order(uuid),
  public.fulfilment_sequence(public.distribution_mode)
to authenticated;
grant execute on function public.create_guest_order(jsonb)    to anon, authenticated;
grant execute on function public.create_catering_order(jsonb) to anon, authenticated;
grant execute on function public.get_public_report(text)      to anon, authenticated;
grant execute on function public.confirm_delivery(text, text) to anon, authenticated;
grant execute on function public.booking_min_days()           to anon, authenticated;
grant execute on function public.booking_max_days()           to anon, authenticated;
grant execute on function public.create_order(jsonb)          to authenticated;
-- Tanpa anon: dipanggil server dengan service role setelah rem tebakan.
grant execute on function public.get_order_tracking(text, text) to service_role;
