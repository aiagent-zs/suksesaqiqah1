-- =============================================================================
-- Tahap 1 — Database · 09 GRANT untuk role PostgREST
--
-- Supabase versi baru TIDAK lagi memberi SELECT/INSERT/UPDATE/DELETE otomatis
-- kepada `anon`/`authenticated` (default privileges hanya REFERENCES/TRIGGER/
-- TRUNCATE). Tanpa grant eksplisit, semua query lewat PostgREST menghasilkan
-- 42501 "permission denied" meskipun kebijakan RLS sudah benar.
--
-- Pembatasan BARIS tetap dikerjakan RLS (migration 07). GRANT di sini hanya
-- membuka akses di level tabel/kolom.
-- =============================================================================

grant usage on schema public to anon, authenticated;

-- --- authenticated: akses operasional penuh, dibatasi RLS per baris ---------
grant select, insert, update, delete on
  public.branches,
  public.locations,
  public.profiles,
  public.services,
  public.participants,
  public.app_settings,
  public.orders,
  public.order_items,
  public.animals,
  public.payments,
  public.schedules,
  public.slaughter_records,
  public.distributions,
  public.documentations,
  public.reports,
  public.notifications,
  public.issues
to authenticated;

-- Audit trail read-only; penulisan hanya lewat trigger SECURITY DEFINER.
grant select on public.audit_logs to authenticated;

-- Views KPI (docs/09). RLS tetap berlaku karena view memakai security_invoker.
grant select on
  public.v_order_progress,
  public.v_branch_kpi,
  public.v_open_orders
to authenticated;

-- --- anon: hanya katalog program publik (landing/katalog, Tahap 10) --------
grant select on public.services to anon;

-- public.order_counters sengaja TIDAK diberi grant apa pun: internal generator
-- nomor order, hanya diakses lewat public.next_order_number() (SECURITY DEFINER).
