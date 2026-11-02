-- =============================================================================
-- Kanal masuk pesanan (`web` / `linkaja`)
--
-- Pesanan dari mini app LinkAja tampil dengan merek "Aqiqah Aja" tapi masuk ke
-- tabel yang sama. Kolom ini memisahkannya untuk laporan per mitra.
--
-- Diisi trigger, bukan argumen RPC: server action mengirim header
-- `x-order-channel` (lihat `server/actions/checkout.ts`), dan PostgREST
-- meneruskan header permintaan ke `request.headers`. Dengan begitu
-- `create_guest_order` dan `create_catering_order` tidak perlu ditulis ulang.
-- Nilai di luar daftar, atau tanpa header (order dari dashboard), jadi `web`.
-- =============================================================================

alter table public.orders
  add column channel text not null default 'web'
  check (channel in ('web', 'linkaja'));

create index orders_channel_idx on public.orders (channel) where channel <> 'web';

create or replace function public.set_order_channel()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_channel text;
begin
  v_channel := coalesce(current_setting('request.headers', true), '{}')::jsonb ->> 'x-order-channel';
  new.channel := case when v_channel in ('web', 'linkaja') then v_channel else 'web' end;
  return new;
end $$;

create trigger set_order_channel_before_insert
  before insert on public.orders
  for each row execute function public.set_order_channel();
