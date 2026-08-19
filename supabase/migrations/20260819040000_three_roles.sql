-- =============================================================================
-- Tahap 3 (revisi) — Tiga role: superadmin, admin, vendor
--
-- Lima role lama (direktur, manager_program, admin_pusat, admin_cabang,
-- petugas_lapangan) dirancang untuk organisasi bercabang. Kenyataannya operasi
-- berjalan **satu tempat**; yang banyak adalah vendornya. Alurnya:
--
--   pesanan masuk -> admin memvalidasi -> admin mencari vendor yang siap ->
--   vendor mengerjakan & mengunggah bukti -> admin memvalidasi bukti itu
--
--   superadmin  akses penuh atas segalanya
--   admin       penghubung pembeli & vendor: verifikasi order, verifikasi
--               pembayaran, penugasan vendor, validasi bukti dari vendor
--   vendor      pelaksana lapangan; hanya melihat order yang ditugaskan padanya
--
-- Empat akibat yang perlu dicatat, karena tidak terlihat dari daftar role saja:
--
-- 1. **Scope per cabang pensiun.** `can_read_order` / `can_write_order` tidak
--    lagi membandingkan `branch_id`. Tabel `branches` dan `orders.branch_id`
--    tetap ada — dipakai penomoran order dan path Storage — tapi tidak lagi
--    membatasi siapa melihat apa. Membongkarnya sekalian menyentuh view KPI,
--    penomoran order, dan seluruh path berkas; itu pekerjaan tersendiri.
--
-- 2. **Validasi dokumentasi jadi satu tingkat.** `pending -> approved` oleh
--    admin/superadmin. `approved_supervisor` tetap ada di enum sebagai jalur
--    warisan supaya baris lama tidak terjebak; tidak ada lagi yang membuatnya.
--
-- 3. **`profiles.is_supervisor` dibuang.** Penanda itu hanya berarti dalam
--    tangga dua tingkat.
--
-- 4. **Enum ditukar, bukan ditambah.** `alter type ... add value` akan
--    meninggalkan lima nilai lama yang masih sah dipakai. Menukar tipenya
--    memaksa setiap baris dipetakan ulang sekarang juga.
-- =============================================================================

-- --- 1. Lepas kebijakan & fungsi yang menyebut nilai enum lama ---------------
--
-- Sengaja tanpa CASCADE: kalau masih ada yang bergantung pada `auth_role()` di
-- luar daftar ini, migration harus gagal dengan berisik — bukan diam-diam
-- menghapus kebijakan yang tidak ikut dibangun ulang di bawah.

drop policy if exists branches_write            on public.branches;
drop policy if exists locations_write           on public.locations;
drop policy if exists services_write            on public.services;
drop policy if exists app_settings_write        on public.app_settings;
drop policy if exists profiles_select           on public.profiles;
drop policy if exists profiles_manage           on public.profiles;
drop policy if exists participants_write        on public.participants;
drop policy if exists orders_select             on public.orders;
drop policy if exists orders_insert             on public.orders;
drop policy if exists orders_update             on public.orders;
drop policy if exists orders_delete             on public.orders;
drop policy if exists payments_select           on public.payments;
drop policy if exists payments_write            on public.payments;
drop policy if exists schedules_write           on public.schedules;
drop policy if exists documentations_update     on public.documentations;
drop policy if exists documentations_delete     on public.documentations;
drop policy if exists reports_write             on public.reports;
drop policy if exists notifications_write       on public.notifications;
drop policy if exists audit_logs_select         on public.audit_logs;
drop policy if exists audit_logs_select_branch  on public.audit_logs;

drop policy if exists storage_documentation_insert   on storage.objects;
drop policy if exists storage_documentation_modify   on storage.objects;
drop policy if exists storage_documentation_delete   on storage.objects;
drop policy if exists storage_payment_proofs_read    on storage.objects;
drop policy if exists storage_payment_proofs_write   on storage.objects;
drop policy if exists storage_payment_proofs_delete  on storage.objects;
drop policy if exists storage_reports_write          on storage.objects;
drop policy if exists storage_public_assets_write    on storage.objects;

drop function if exists public.is_central();
drop function if exists public.is_supervisor();
drop function if exists public.auth_role();

-- --- 2. Tukar tipe enum ------------------------------------------------------

create type public.user_role_new as enum ('superadmin', 'admin', 'vendor');

alter table public.profiles alter column role drop default;

-- Pemetaan yang dipakai:
--   direktur, manager_program        -> superadmin  (pemegang wewenang penuh)
--   admin_pusat, admin_cabang        -> admin       (penghubung & pemvalidasi)
--   petugas_lapangan                 -> vendor      (pelaksana lapangan)
alter table public.profiles
  alter column role type public.user_role_new
  using (
    case role::text
      when 'direktur'         then 'superadmin'
      when 'manager_program'  then 'superadmin'
      when 'admin_pusat'      then 'admin'
      when 'admin_cabang'     then 'admin'
      when 'petugas_lapangan' then 'vendor'
      else 'vendor'
    end
  )::public.user_role_new;

drop type public.user_role;
alter type public.user_role_new rename to user_role;

-- Nilai bawaan paling tidak berbahaya: akun baru tidak bisa apa-apa sampai
-- seseorang menaikkannya.
alter table public.profiles alter column role set default 'vendor';

comment on column public.profiles.role is
  'superadmin = akses penuh; admin = verifikasi order, pembayaran, dan bukti vendor; vendor = pelaksana, hanya order yang ditugaskan padanya.';

-- Penanda tingkat validasi hanya berarti pada tangga dua tingkat yang kini
-- ditiadakan.
alter table public.profiles drop column if exists is_supervisor;

comment on column public.profiles.branch_id is
  'Keterangan asal, bukan pembatas akses. Sejak 19 Agustus 2026 tidak ada satu pun kebijakan RLS yang membandingkannya.';

-- --- 3. Fungsi bantu ---------------------------------------------------------

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

comment on function public.auth_role is
  'Role pemanggil. NULL bila tidak login, non-aktif, atau terhapus — bukan berarti tanpa hak, tapi tanpa identitas.';

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_role() = 'superadmin', false);
$$;

comment on function public.is_superadmin is
  'Akses penuh: master data, penghapusan, dan nilai order.';

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_role() in ('superadmin', 'admin'), false);
$$;

comment on function public.is_staff is
  'Pihak internal (superadmin atau admin) — lawan dari vendor, yang hanya melihat order yang ditugaskan padanya.';

-- `create or replace`, bukan drop: kebijakan RLS di banyak tabel bergantung pada
-- kedua fungsi ini, dan menghapusnya berarti ikut menghapus kebijakannya.
create or replace function public.can_read_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case public.auth_role()
    when 'superadmin' then true
    when 'admin'      then true
    when 'vendor'     then exists (
      select 1 from public.schedules s
      where s.order_id = p_order_id and s.pic_user_id = auth.uid()
    )
    else false
  end;
$$;

comment on function public.can_read_order is
  'Scope baca per order: superadmin & admin = semua, vendor = order yang ditugaskan padanya lewat schedules.pic_user_id.';

create or replace function public.can_write_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case public.auth_role()
    when 'superadmin' then true
    when 'admin'      then true
    when 'vendor'     then exists (
      select 1 from public.schedules s
      where s.order_id = p_order_id and s.pic_user_id = auth.uid()
    )
    else false
  end;
$$;

comment on function public.can_write_order is
  'Scope tulis per order. Sama dengan can_read_order — pembatasan per aksi (pembayaran, jadwal, validasi) ditegakkan kebijakan masing-masing tabel, bukan di sini.';

comment on function public.auth_branch_id is
  'Cabang pemanggil. Tidak lagi dipakai membatasi akses sejak 19 Agustus 2026; disimpan karena orders.branch_id masih menyusun nomor order dan path Storage.';

-- --- 4. Akun baru ------------------------------------------------------------

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
      'vendor'
    );
  exception
    when others then v_role := 'vendor';
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
    -- Vendor menunggu diaktifkan: kerja sama dengan vendor dimulai dari
    -- kesepakatan, bukan dari pendaftaran. `auth_role()` mengembalikan NULL
    -- selama `is_active` masih false, jadi akunnya belum bisa apa-apa.
    v_role in ('superadmin', 'admin')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user is
  'Membuat profil saat akun auth dibuat. Role diambil dari user metadata (jalur admin) dan jatuh ke vendor bila kosong atau tidak dikenali; vendor lahir non-aktif.';

-- --- 5. Kebijakan: master data ----------------------------------------------

create policy branches_write on public.branches
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

create policy locations_write on public.locations
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

create policy services_write on public.services
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

create policy app_settings_write on public.app_settings
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- Vendor hanya melihat profilnya sendiri: daftar vendor lain bukan urusannya.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff());

-- Pengelolaan user (role, aktif/non-aktif) dipegang superadmin. Admin sengaja
-- tidak ikut: siapa pun yang bisa mengubah role bisa mengangkat dirinya sendiri.
create policy profiles_manage on public.profiles
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- Data pemesan: vendor tidak perlu — dan tidak boleh — menyunting kontak pembeli.
create policy participants_write on public.participants
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- --- 6. Kebijakan: order & turunannya ---------------------------------------

create policy orders_select on public.orders
  for select to authenticated
  using (public.is_staff() or public.is_order_pic(id));

create policy orders_insert on public.orders
  for insert to authenticated
  with check (public.is_staff());

create policy orders_update on public.orders
  for update to authenticated
  using (public.is_staff() or public.is_order_pic(id))
  with check (public.is_staff() or public.is_order_pic(id));

-- Menghapus order membuang jejak pembayaran & bukti lapangan sekaligus
-- (`on delete cascade`), jadi haknya berhenti di superadmin.
create policy orders_delete on public.orders
  for delete to authenticated
  using (public.is_superadmin());

-- Pembayaran adalah urusan pembeli dengan kami; vendor sama sekali di luar itu.
create policy payments_select on public.payments
  for select to authenticated
  using (public.can_read_order(order_id) and public.is_staff());

create policy payments_write on public.payments
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Penugasan vendor: yang menentukan siapa mengerjakan apa adalah admin.
create policy schedules_write on public.schedules
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- --- 7. Kebijakan: dokumentasi, laporan, notifikasi, audit -------------------

-- Validasi kini satu tingkat, jadi yang berhak menyunting baris orang lain
-- adalah staf. Pengunggah tetap boleh memperbaiki miliknya sendiri selama
-- belum divalidasi. Urutan statusnya sendiri dijaga trigger di bawah.
create policy documentations_update on public.documentations
  for update to authenticated
  using (
    public.is_staff()
    or (uploaded_by = auth.uid() and status in ('pending', 'rejected'))
  )
  with check (
    public.is_staff()
    or (uploaded_by = auth.uid() and status in ('pending', 'rejected'))
  );

create policy documentations_delete on public.documentations
  for delete to authenticated
  using (public.is_staff());

create policy reports_write on public.reports
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy notifications_write on public.notifications
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (public.is_staff());

-- --- 8. Kebijakan Storage ----------------------------------------------------

create policy storage_documentation_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentation' and public.auth_role() is not null);

create policy storage_documentation_modify on storage.objects
  for update to authenticated
  using (bucket_id = 'documentation' and public.is_staff())
  with check (bucket_id = 'documentation' and public.is_staff());

create policy storage_documentation_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'documentation' and public.is_staff());

create policy storage_payment_proofs_read on storage.objects
  for select to authenticated
  using (bucket_id = 'payment-proofs' and public.is_staff());

create policy storage_payment_proofs_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'payment-proofs' and public.is_staff());

create policy storage_payment_proofs_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'payment-proofs' and public.is_superadmin());

create policy storage_reports_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'reports' and public.is_staff());

create policy storage_public_assets_write on storage.objects
  for all to authenticated
  using (bucket_id = 'public-assets' and public.is_superadmin())
  with check (bucket_id = 'public-assets' and public.is_superadmin());

-- --- 9. Trigger verifikasi order tamu ---------------------------------------

create or replace function public.enforce_guest_order_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Order internal tidak mengenal verifikasi tamu.
  if new.created_by is not null or old.created_by is not null then
    if new.guest_verified_at is not null and old.created_by is not null then
      raise exception 'Order internal tidak dapat ditandai sebagai order tamu terverifikasi'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  -- Verifikasi tidak bisa dicabut: `guest_verified_at` yang sudah terisi adalah
  -- catatan bahwa seseorang benar-benar memeriksa order ini.
  if old.guest_verified_at is not null and new.guest_verified_at is null then
    raise exception 'Verifikasi order tamu tidak dapat dibatalkan'
      using errcode = 'check_violation';
  end if;

  -- Disamakan dengan kapabilitas VERIFY_GUEST_ORDER di
  -- server/auth/capabilities.ts. Dilewati saat auth.uid() kosong (service role,
  -- seed, migration) — di jalur itu RLS pun tidak berlaku.
  if old.guest_verified_at is null and new.guest_verified_at is not null then
    if auth.uid() is not null and not public.is_staff() then
      raise exception 'Role Anda tidak berhak memverifikasi order tamu'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  -- Inti penahannya: selama belum diverifikasi, status tidak boleh bergerak.
  -- `cancelled` dikecualikan supaya pesanan iseng atau ganda tetap bisa ditutup
  -- tanpa harus diverifikasi lebih dulu.
  if new.status is distinct from old.status
     and new.guest_verified_at is null
     and new.status <> 'cancelled' then
    raise exception 'Order tamu harus diverifikasi admin sebelum masuk alur operasional'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- --- 10. Tangga validasi dokumentasi: satu tingkat ---------------------------

create or replace function public.enforce_documentation_review_ladder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  -- Status tidak berubah: penyuntingan caption/berkas, bukan keputusan review.
  if new.status = old.status then
    return new;
  end if;

  -- Service role, seed, dan migration tidak punya `auth.uid()`. Di jalur itu RLS
  -- pun tidak berlaku, jadi tidak ada yang bisa ditegakkan di sini.
  if v_actor is null then
    return new;
  end if;

  -- `approved` adalah ujung tangga: bukti yang sudah dipakai laporan peserta
  -- tidak boleh dipindahkan diam-diam ke status lain.
  if old.status = 'approved' then
    raise exception 'Dokumentasi yang sudah tervalidasi tidak dapat diubah statusnya'
      using errcode = 'check_violation';
  end if;

  -- Pemisahan tugas (docs/10 section 4). Tetap berlaku meski tingkatnya tinggal
  -- satu: seorang admin yang ikut mengunggah tidak boleh meloloskan buktinya
  -- sendiri. Ditaruh sebelum pemeriksaan peran supaya ia ditolak lebih dulu
  -- pada barisnya sendiri.
  if new.status in ('approved', 'approved_supervisor', 'rejected')
     and old.uploaded_by is not null
     and old.uploaded_by = v_actor then
    raise exception 'Pengunggah tidak dapat memvalidasi dokumentasinya sendiri'
      using errcode = 'insufficient_privilege';
  end if;

  -- Atribusi review tidak boleh dialamatkan ke orang lain.
  if new.reviewed_by is distinct from old.reviewed_by
     and new.reviewed_by is distinct from v_actor then
    raise exception 'Hasil review hanya boleh dicatat atas nama pemanggil'
      using errcode = 'insufficient_privilege';
  end if;

  -- --- Tangga validasi satu tingkat -----------------------------------------
  --
  -- Cerminan checkReview di features/documentation/review.ts. Setiap perpindahan
  -- lain ditolak, termasuk `pending -> approved_supervisor` — status itu tidak
  -- lagi dibuat siapa pun.
  if old.status = 'pending' and new.status in ('approved', 'rejected') then
    if not public.is_staff() then
      raise exception 'Validasi dokumentasi hanya oleh admin atau superadmin'
        using errcode = 'insufficient_privilege';
    end if;

  elsif old.status = 'approved_supervisor' and new.status in ('approved', 'rejected') then
    -- Jalur warisan: baris yang sempat lolos tingkat-1 sebelum tangganya
    -- dipendekkan. Tanpa ini baris tersebut terjebak selamanya.
    if not public.is_staff() then
      raise exception 'Validasi dokumentasi hanya oleh admin atau superadmin'
        using errcode = 'insufficient_privilege';
    end if;

  elsif old.status = 'rejected' and new.status = 'pending' then
    -- Unggah ulang oleh pengunggahnya sendiri; sejalan dengan RLS
    -- `documentations_update` yang mengizinkan pemilik baris berstatus
    -- `pending` / `rejected`.
    if old.uploaded_by is distinct from v_actor then
      raise exception 'Hanya pengunggah yang dapat mengajukan ulang dokumentasi yang ditolak'
        using errcode = 'insufficient_privilege';
    end if;

  else
    raise exception 'Perpindahan status dokumentasi % -> % tidak sah', old.status, new.status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function public.enforce_documentation_review_ladder is
  'Menegakkan validasi satu tingkat & pemisahan tugas di bawah RLS. approved_supervisor hanya tersisa sebagai jalur warisan.';
