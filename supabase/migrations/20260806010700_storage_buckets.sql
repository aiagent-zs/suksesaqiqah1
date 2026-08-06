-- =============================================================================
-- Tahap 1 — Database · 08 Supabase Storage
-- Acuan: docs/17_STORAGE_STRATEGY.md section 1, section 2, section 4
--
-- Semua bucket operasional PRIVATE; akses lewat signed URL berdurasi pendek.
-- Peserta tidak pernah menyentuh bucket langsung (docs/17 section 4).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'documentation', 'documentation', false,
    26214400, -- 25 MB, batas klip video (docs/17 section 2)
    array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
  ),
  (
    'payment-proofs', 'payment-proofs', false,
    5242880, -- 5 MB
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  ),
  (
    'reports', 'reports', false,
    10485760, -- 10 MB
    array['application/pdf']
  ),
  (
    'public-assets', 'public-assets', true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/x-icon']
  )
on conflict (id) do nothing;

-- --- documentation ----------------------------------------------------------
-- Upload oleh Petugas Lapangan (PWA), dibaca seluruh user internal berwenang.
create policy storage_documentation_read on storage.objects
  for select to authenticated
  using (bucket_id = 'documentation');

create policy storage_documentation_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentation' and public.auth_role() is not null);

create policy storage_documentation_modify on storage.objects
  for update to authenticated
  using (bucket_id = 'documentation' and public.auth_role() in ('manager_program', 'admin_cabang', 'admin_pusat'))
  with check (bucket_id = 'documentation' and public.auth_role() in ('manager_program', 'admin_cabang', 'admin_pusat'));

create policy storage_documentation_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'documentation' and public.auth_role() in ('manager_program', 'admin_cabang'));

-- --- payment-proofs ---------------------------------------------------------
-- Petugas lapangan tidak berurusan dengan pembayaran (docs/07 section 3).
create policy storage_payment_proofs_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and public.auth_role() in ('direktur', 'manager_program', 'admin_pusat', 'admin_cabang')
  );

create policy storage_payment_proofs_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and public.auth_role() in ('manager_program', 'admin_cabang')
  );

create policy storage_payment_proofs_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'payment-proofs' and public.auth_role() = 'manager_program');

-- --- reports ----------------------------------------------------------------
-- Ditulis oleh generator laporan (n8n/service role) & role berwenang.
create policy storage_reports_read on storage.objects
  for select to authenticated
  using (bucket_id = 'reports');

create policy storage_reports_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'reports'
    and public.auth_role() in ('manager_program', 'admin_pusat', 'admin_cabang')
  );

-- --- public-assets ----------------------------------------------------------
create policy storage_public_assets_read on storage.objects
  for select to public
  using (bucket_id = 'public-assets');

create policy storage_public_assets_write on storage.objects
  for all to authenticated
  using (bucket_id = 'public-assets' and public.auth_role() = 'manager_program')
  with check (bucket_id = 'public-assets' and public.auth_role() = 'manager_program');
