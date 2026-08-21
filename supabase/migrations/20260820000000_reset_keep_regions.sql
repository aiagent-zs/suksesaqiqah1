-- =============================================================================
-- Desain ulang skema — 20 Agustus 2026 · 00 Reset
--
-- Membuang seluruh tabel operasional, fungsi, dan enum lama, lalu membangun
-- ulang dari nol lewat migration 20260820000100 dan seterusnya.
--
-- **`public.regions` sengaja tidak disentuh.** Isinya 91.599 wilayah Kemendagri
-- (±3 MB) yang tidak berubah oleh desain ulang ini; membangunnya ulang berarti
-- push 3 MB lagi tanpa satu pun manfaat.
--
-- Kenapa migration destruktif, bukan squash riwayat: `supabase db push` bersifat
-- append-only, dan squash menuntut `migration repair --status reverted` pada
-- belasan versi di tabel pembukuan **produksi** — tanpa staging untuk
-- melatihnya lebih dulu. Menambah berkas adalah jalur yang memang dirancang
-- alatnya. Konsekuensi yang diterima: 23 berkas lama tetap ada sebagai riwayat.
--
-- Satu berkas migration berjalan dalam satu transaksi, jadi reset ini
-- seluruhnya berhasil atau seluruhnya batal.
--
-- `auth.users` sengaja tidak disentuh: akun superadmin Anda hidup di sana.
-- Akun demo `*@suksesaqiqah.test` dihapus terpisah lewat dashboard.
-- =============================================================================

-- Trigger pada auth.users harus lepas duluan — fungsinya ikut di-drop di bawah.
drop trigger if exists on_auth_user_created on auth.users;

-- Kebijakan Storage disapu, bukan didaftar satu per satu: namanya sudah dua
-- kali berganti, dan daftar yang ketinggalan meninggalkan kebijakan yatim yang
-- menunjuk fungsi yang sudah tidak ada.
do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'storage_%'
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

drop view if exists
  public.v_open_orders,
  public.v_branch_kpi,
  public.v_order_progress
cascade;

drop table if exists
  public.audit_logs,
  public.issues,
  public.notifications,
  public.reports,
  public.documentations,
  public.distributions,
  public.slaughter_records,
  public.schedules,
  public.payments,
  public.animals,
  public.order_items,
  public.orders,
  public.order_counters,
  public.app_settings,
  public.participants,
  public.services,
  public.profiles,
  public.locations,
  public.branches
cascade;

-- Seluruh fungsi di schema public disapu. Daftar manual akan meninggalkan
-- fungsi yang namanya sempat berubah lintas migration.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('drop function if exists %s cascade', r.sig);
  end loop;
end $$;

drop type if exists
  public.user_role,
  public.service_type,
  public.order_status,
  public.payment_status,
  public.payment_verification_status,
  public.animal_species,
  public.animal_status,
  public.schedule_status,
  public.doc_type,
  public.doc_stage,
  public.doc_status,
  public.notif_channel,
  public.notif_status,
  public.issue_severity,
  public.issue_status
cascade;

-- --- Penjaga ----------------------------------------------------------------
--
-- Reset yang menyisakan tabel harus gagal berisik, bukan diam-diam membiarkan
-- sisa skema lama bertabrakan dengan yang baru. Dan `regions` harus tetap utuh
-- — kalau ia ikut terhapus, seluruh alasan memakai reset selektif hilang.
do $$
declare v_left text;
begin
  select string_agg(tablename, ', ') into v_left
  from pg_tables
  where schemaname = 'public' and tablename <> 'regions';

  if v_left is not null then
    raise exception 'Reset tidak bersih — masih tersisa: %', v_left;
  end if;

  if not exists (select 1 from public.regions limit 1) then
    raise exception 'Tabel regions kosong setelah reset — pembatalan.';
  end if;
end $$;
