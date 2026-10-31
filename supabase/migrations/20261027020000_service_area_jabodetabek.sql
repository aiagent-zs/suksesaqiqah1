-- =============================================================================
-- Jangkauan pengiriman pesanan tamu: Jabodetabek dulu
--
-- Form dan zod sudah membatasinya (`features/checkout/service-area.ts`), tapi
-- `create_guest_order` dan `create_catering_order` bisa dipanggil langsung
-- dengan anon key. Pagar terakhirnya di sini, untuk pesanan tamu
-- (`created_by is null`) yang punya alamat kirim. Pesanan yang dibuat staf dari
-- dashboard tidak dibatasi: admin boleh menerima pengecualian.
--
-- Daftar kotanya harus sama dengan `SERVICE_AREA_CITIES`.
-- Kode 23514 diteruskan apa adanya ke pemesan oleh server action.
-- =============================================================================

create or replace function public.enforce_guest_service_area()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.created_by is null
     and new.delivery_city_code is not null
     and new.delivery_city_code not in (
       '31.71', '31.72', '31.73', '31.74', '31.75',
       '32.01', '32.71', '32.76', '32.16', '32.75',
       '36.03', '36.71', '36.74'
     ) then
    raise exception 'Saat ini pengiriman baru melayani Jabodetabek.'
      using errcode = '23514';
  end if;
  return new;
end $$;

create trigger enforce_guest_service_area_before_insert
  before insert on public.orders
  for each row execute function public.enforce_guest_service_area();
