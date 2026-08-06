-- =============================================================================
-- Perbaikan RLS: kebijakan `orders` tidak boleh membaca ulang `orders`
--
-- MASALAH
-- Kebijakan orders_select memakai can_read_order(id), dan fungsi itu melakukan
-- SELECT ke tabel orders lagi. Pada `INSERT ... RETURNING` PostgreSQL menerapkan
-- kebijakan SELECT terhadap baris yang baru dibuat, sementara fungsi STABLE
-- tersebut membaca snapshot sebelum insert sehingga barisnya belum terlihat.
-- Akibatnya setiap pembuatan order gagal dengan
--   "new row violates row-level security policy for table orders"
-- padahal role dan cabangnya sudah benar. Ini memblokir PostgREST (Prefer:
-- return=representation) maupun RPC create_order.
--
-- SOLUSI
-- Kebijakan pada tabel orders mengevaluasi kolom barisnya sendiri (branch_id),
-- bukan lewat fungsi yang men-query orders. Penelusuran ke tabel LAIN (schedules)
-- tetap aman karena bukan self-reference.
--
-- can_read_order()/can_write_order() tetap dipakai oleh tabel anak (order_items,
-- animals, payments, ...) — di sana orders memang tabel lain dan barisnya sudah ada.
-- =============================================================================

-- Petugas Lapangan hanya menyentuh order yang di-PIC-i (docs/07 section 2.5).
create or replace function public.is_order_pic(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.schedules s
    where s.order_id = p_order_id and s.pic_user_id = auth.uid()
  );
$$;

comment on function public.is_order_pic is
  'True bila pemanggil adalah PIC jadwal order tersebut. Hanya membaca schedules, aman dipakai di kebijakan orders.';

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select to authenticated
  using (
    public.is_central()
    or (public.auth_role() = 'admin_cabang' and branch_id = public.auth_branch_id())
    or (public.auth_role() = 'petugas_lapangan' and public.is_order_pic(id))
  );

drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders
  for update to authenticated
  using (
    public.auth_role() = 'manager_program'
    or (public.auth_role() = 'admin_cabang' and branch_id = public.auth_branch_id())
    or (public.auth_role() = 'petugas_lapangan' and public.is_order_pic(id))
  )
  with check (
    public.auth_role() = 'manager_program'
    or (public.auth_role() = 'admin_cabang' and branch_id = public.auth_branch_id())
    or (public.auth_role() = 'petugas_lapangan' and public.is_order_pic(id))
  );
