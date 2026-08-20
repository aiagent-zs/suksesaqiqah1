-- =============================================================================
-- Desain ulang skema · 08 Row Level Security
--
-- Pembagian wewenang yang ditegakkan di sini:
--
--   superadmin  segalanya, termasuk master data, mitra, dan pengelolaan akun
--   admin       penghubung pembeli & vendor: verifikasi order, pembayaran,
--               penugasan mitra, validasi laporan tahap & bukti
--   vendor      hanya order yang ditugaskan padanya; melapor, tidak menilai
--
-- Empat batas yang sengaja tajam:
--
-- 1. **Vendor di luar urusan uang.** `payments` menuntut `is_staff()`, jadi
--    panel pembayaran tidak dirender untuk mitra dan barisnya pun tidak
--    terbaca.
-- 2. **Vendor tidak bisa menugaskan dirinya sendiri.** `orders.vendor_id` hanya
--    bisa disentuh staf; kalau tidak, menulis penugasan berarti bisa membuka
--    order mana pun.
-- 3. **Vendor tidak menilai pekerjaannya sendiri.** Perpindahan ke `validated`
--    dijaga trigger, dan `is_staff()` yang menjaga barisnya.
-- 4. **Pengelolaan akun berhenti di superadmin.** Siapa pun yang bisa mengubah
--    role bisa mengangkat dirinya sendiri.
-- =============================================================================

alter table public.vendors             enable row level security;
alter table public.vendor_services     enable row level security;
alter table public.vendor_coverage     enable row level security;
alter table public.locations           enable row level security;
alter table public.profiles            enable row level security;
alter table public.services            enable row level security;
alter table public.participants        enable row level security;
alter table public.app_settings        enable row level security;
alter table public.stage_requirements  enable row level security;
alter table public.order_counters      enable row level security;
alter table public.orders              enable row level security;
alter table public.order_items         enable row level security;
alter table public.animals             enable row level security;
alter table public.payments            enable row level security;
alter table public.schedules           enable row level security;
alter table public.order_stage_events  enable row level security;
alter table public.documentations      enable row level security;
alter table public.reports             enable row level security;
alter table public.notifications       enable row level security;
alter table public.issues              enable row level security;
alter table public.audit_logs          enable row level security;
alter table public.regions             enable row level security;

-- --- Master data ------------------------------------------------------------

-- Mitra: staf boleh membaca (admin perlu memilih saat menugaskan); vendor hanya
-- melihat dirinya sendiri — daftar mitra lain bukan urusannya.
create policy vendors_select on public.vendors
  for select to authenticated
  using (public.is_staff() or id = public.auth_vendor_id());

create policy vendors_write on public.vendors
  for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- Daftar modal: hanya staf. Ini angka internal — bahkan mitra tidak perlu
-- melihat bagaimana marginnya dihitung.
create policy vendor_services_select on public.vendor_services
  for select to authenticated using (public.is_staff());
create policy vendor_services_write on public.vendor_services
  for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

create policy vendor_coverage_select on public.vendor_coverage
  for select to authenticated
  using (public.is_staff() or vendor_id = public.auth_vendor_id());
create policy vendor_coverage_write on public.vendor_coverage
  for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

create policy locations_select on public.locations
  for select to authenticated using (true);
create policy locations_write on public.locations
  for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- Katalog: dibaca siapa pun termasuk pengunjung anonim (checkout publik).
create policy services_select_public on public.services
  for select to anon, authenticated
  using (is_active and deleted_at is null);
create policy services_write on public.services
  for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- Wilayah administratif: terbuka. Isinya memang data publik, dan pemilih alamat
-- di checkout membacanya langsung dari peramban.
create policy regions_select_public on public.regions
  for select to anon, authenticated using (true);

create policy participants_select on public.participants
  for select to authenticated using (public.is_staff());
create policy participants_write on public.participants
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy app_settings_select on public.app_settings
  for select to authenticated using (true);
create policy app_settings_write on public.app_settings
  for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

create policy stage_requirements_select on public.stage_requirements
  for select to authenticated using (true);
create policy stage_requirements_write on public.stage_requirements
  for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

create policy order_counters_select on public.order_counters
  for select to authenticated using (public.is_staff());

-- --- Profil -----------------------------------------------------------------
--
-- Staf melihat semua; vendor hanya dirinya sendiri.
create policy profiles_select on public.profiles
  for select to authenticated
  using (public.is_staff() or id = auth.uid());

-- Perubahan role & penautan mitra berhenti di superadmin. Admin sengaja tidak
-- ikut: siapa pun yang bisa mengubah role bisa mengangkat dirinya sendiri.
create policy profiles_manage on public.profiles
  for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- --- Order ------------------------------------------------------------------
create policy orders_select on public.orders
  for select to authenticated
  using (
    public.is_staff()
    or (vendor_id is not null and vendor_id = public.auth_vendor_id())
  );

create policy orders_insert on public.orders
  for insert to authenticated with check (public.is_staff());

-- Vendor boleh menyentuh order yang ditugaskan padanya (mis. mengubah status
-- pelaksanaan), tapi TIDAK boleh memindahkan penugasan — itu dijaga trigger di
-- bawah, karena RLS tidak bisa membandingkan kolom lama dengan yang baru.
create policy orders_update on public.orders
  for update to authenticated
  using (
    public.is_staff()
    or (vendor_id is not null and vendor_id = public.auth_vendor_id())
  )
  with check (
    public.is_staff()
    or (vendor_id is not null and vendor_id = public.auth_vendor_id())
  );

create policy orders_delete on public.orders
  for delete to authenticated using (public.is_superadmin());

create policy order_items_select on public.order_items
  for select to authenticated using (public.can_read_order(order_id));
create policy order_items_write on public.order_items
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy animals_select on public.animals
  for select to authenticated using (public.can_read_order(order_id));
create policy animals_write on public.animals
  for all to authenticated
  using (public.can_write_order(order_id)) with check (public.can_write_order(order_id));

-- --- Pembayaran: staf saja --------------------------------------------------
create policy payments_select on public.payments
  for select to authenticated using (public.is_staff());
create policy payments_write on public.payments
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- --- Jadwal: disusun staf, dibaca vendor ------------------------------------
create policy schedules_select on public.schedules
  for select to authenticated using (public.can_read_order(order_id));
create policy schedules_write on public.schedules
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- --- Laporan tahap ----------------------------------------------------------
create policy stage_events_select on public.order_stage_events
  for select to authenticated using (public.can_read_order(order_id));

-- Baris tahap terbit otomatis lewat trigger saat penugasan; tidak ada yang
-- membuatnya manual kecuali staf (mis. menambah ekor setelah penugasan).
create policy stage_events_insert on public.order_stage_events
  for insert to authenticated with check (public.is_staff());

-- Vendor mengisi laporannya; staf memvalidasi. Batas siapa boleh mengubah ke
-- `validated` dijaga trigger `enforce_stage_review`.
create policy stage_events_update on public.order_stage_events
  for update to authenticated
  using (public.can_write_order(order_id))
  with check (public.can_write_order(order_id));

create policy stage_events_delete on public.order_stage_events
  for delete to authenticated using (public.is_superadmin());

-- --- Dokumentasi ------------------------------------------------------------
create policy documentations_select on public.documentations
  for select to authenticated using (public.can_read_order(order_id));
create policy documentations_insert on public.documentations
  for insert to authenticated with check (public.can_write_order(order_id));

-- Vendor boleh memperbaiki unggahannya yang ditolak; keputusan validasi dijaga
-- trigger `enforce_documentation_review`.
create policy documentations_update on public.documentations
  for update to authenticated
  using (public.is_staff() or uploaded_by = auth.uid())
  with check (public.is_staff() or uploaded_by = auth.uid());

-- Bukti tervalidasi tidak dapat dihapus: ia dipakai laporan peserta.
create policy documentations_delete on public.documentations
  for delete to authenticated
  using (public.is_superadmin() and status <> 'approved');

-- --- Laporan, notifikasi, kendala, audit ------------------------------------
create policy reports_select on public.reports
  for select to authenticated using (public.can_read_order(order_id));
create policy reports_write on public.reports
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy notifications_select on public.notifications
  for select to authenticated using (public.is_staff());
create policy notifications_write on public.notifications
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Kendala paling sering muncul di lapangan, jadi vendor harus bisa melapor
-- sendiri pada order yang ia kerjakan.
create policy issues_select on public.issues
  for select to authenticated using (public.can_read_order(order_id));
create policy issues_insert on public.issues
  for insert to authenticated with check (public.can_write_order(order_id));
create policy issues_update on public.issues
  for update to authenticated
  using (public.can_write_order(order_id)) with check (public.can_write_order(order_id));
-- Sengaja tanpa kebijakan delete: kendala dikoreksi atau ditutup, bukan dihapus.

create policy audit_logs_select on public.audit_logs
  for select to authenticated using (public.is_staff());

-- --- Penugasan mitra tidak bisa dipindah vendor -----------------------------
--
-- RLS tidak bisa membandingkan nilai lama dengan nilai baru, jadi larangan ini
-- ditegakkan trigger. Tanpa ini, vendor yang memegang satu order bisa menulis
-- `vendor_id` order lain ke dirinya sendiri lewat PostgREST langsung.
create or replace function public.enforce_vendor_assignment()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.vendor_id is distinct from old.vendor_id and not public.is_staff() then
    raise exception 'Penugasan mitra hanya dapat diubah admin.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Harga & status pembayaran tidak pernah datang dari vendor.
  if not public.is_staff() and (
    new.total_amount is distinct from old.total_amount
    or new.paid_amount is distinct from old.paid_amount
    or new.payment_status is distinct from old.payment_status
  ) then
    raise exception 'Nilai tagihan hanya dapat diubah admin.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end $$;

create trigger enforce_vendor_assignment_before_update
  before update on public.orders
  for each row execute function public.enforce_vendor_assignment();
