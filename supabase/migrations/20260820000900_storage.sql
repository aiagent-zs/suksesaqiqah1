-- =============================================================================
-- Desain ulang skema · 09 Supabase Storage
--
-- **Path berubah: segmen cabang dibuang, tidak diganti kode mitra.**
--
--   lama : {branch_code}/{YYYY}/{MM}/{order_number}/{stage}/{uuid}.{ext}
--   baru : {YYYY}/{MM}/{order_number}/{stage}/{uuid}.{ext}
--
-- Kenapa bukan kode mitra, padahal yang mengunggah memang mitra: kode mitra
-- bisa berubah, dan admin bisa memindahkan order ke mitra lain — keduanya
-- membuat prefix jadi yatim, menunjuk pemilik yang sudah tidak relevan.
-- `order_number` unik global dan tidak pernah berubah seumur hidup order.
--
-- Ini justru **memperkuat** pemeriksaan kepemilikan path: dulu bersandar pada
-- kode cabang yang tidak pernah unik per order, sekarang pada nilai yang unik
-- dan beku. Bukti umum juga bisa diunggah admin sebelum mitranya ada.
--
-- Seluruh bucket operasional privat; aksesnya lewat signed URL berdurasi
-- pendek. Kebijakan di bawah hanya membatasi bucket, tidak folder — karena itu
-- kepemilikan path diperiksa ulang di server action (`isDocPathForOrder`).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'documentation', 'documentation', false,
    26214400, -- 25 MB, batas klip video
    array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
  ),
  (
    'payment-proofs', 'payment-proofs', false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  ),
  (
    'reports', 'reports', false,
    10485760,
    array['application/pdf']
  ),
  (
    'public-assets', 'public-assets', true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/x-icon']
  )
on conflict (id) do nothing;

-- --- documentation ----------------------------------------------------------
--
-- Diunggah vendor dari lapangan, dibaca seluruh pengguna internal berwenang.
-- Halaman laporan publik tidak memakai kebijakan ini: pembacanya anonim, dan
-- berkasnya ditandatangani service role setelah RPC mengembalikan path-nya.
create policy storage_documentation_read on storage.objects
  for select to authenticated
  using (bucket_id = 'documentation');

create policy storage_documentation_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentation' and public.auth_role() is not null);

create policy storage_documentation_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'documentation' and public.is_superadmin());

-- --- payment-proofs ---------------------------------------------------------
--
-- Vendor sama sekali di luar urusan uang — sejalan dengan RLS `payments`.
create policy storage_payment_proofs_read on storage.objects
  for select to authenticated
  using (bucket_id = 'payment-proofs' and public.is_staff());

create policy storage_payment_proofs_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'payment-proofs' and public.is_staff());

create policy storage_payment_proofs_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'payment-proofs' and public.is_superadmin());

-- --- reports ----------------------------------------------------------------
create policy storage_reports_read on storage.objects
  for select to authenticated
  using (bucket_id = 'reports' and public.is_staff());

create policy storage_reports_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'reports' and public.is_staff());

-- --- public-assets ----------------------------------------------------------
create policy storage_public_assets_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'public-assets');

create policy storage_public_assets_write on storage.objects
  for all to authenticated
  using (bucket_id = 'public-assets' and public.is_superadmin())
  with check (bucket_id = 'public-assets' and public.is_superadmin());
