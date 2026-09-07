-- Hapus semua dummy order data
-- Related data akan terhapus otomatis via CASCADE

delete from public.orders;

-- Reset order counter ke 0
delete from public.order_counters;

-- Reset sequence nomor order
select setval(
  pg_get_serial_sequence('public.order_counters', 'id'),
  (select max(id) from public.order_counters) + 1,
  true
) where exists (select 1 from public.order_counters);
