-- =============================================================================
-- Tahap 4 — Order Management · Alasan transisi status & akses timeline cabang
-- Acuan: docs/16_API_SPEC.md section 3 (POST /orders/{id}/status membawa `reason`)
-- =============================================================================

-- Alasan transisi disimpan di kolom order, bukan baris audit terpisah, supaya
-- ikut terekam otomatis oleh trigger audit_row() sebagai bagian before/after.
alter table public.orders
  add column if not exists status_reason text;

comment on column public.orders.status_reason is
  'Alasan transisi status terakhir (mis. sebab order ditahan/dibatalkan).';

-- Admin Cabang berhak membaca audit trail cabangnya (docs/07 section 3: audit_logs
-- = "R (branch)"). Kebijakan Tahap 1 baru membuka akses untuk role pusat, sehingga
-- timeline pada halaman detail order kosong bagi Admin Cabang.
create policy audit_logs_select_branch on public.audit_logs
  for select to authenticated
  using (
    public.auth_role() = 'admin_cabang'
    and entity = 'orders'
    and exists (
      select 1
      from public.orders o
      where o.id = audit_logs.entity_id
        and o.branch_id = public.auth_branch_id()
    )
  );
