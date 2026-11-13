-- =============================================================================
-- Email invoice ke pemesan saat pesanan lunas
--
-- Pemicunya `payment_status` berpindah ke `paid`, bukan webhook Durianpay:
-- pelunasan bisa datang dari Durianpay atau dari transfer yang diverifikasi
-- admin, dan keduanya bermuara di `sync_order_payment` yang menulis kolom ini.
--
-- Satu invoice per order (`event_key`). Pembayaran yang dibatalkan lalu lunas
-- lagi tidak mengirim invoice kedua.
--
-- Pengirimnya worker di aplikasi (`features/notifications/send-email.ts`,
-- lewat Resend), sama dengan email `order_verified` / `order_completed`.
-- =============================================================================

create or replace function public.notify_payment_paid_email()
returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  v_name   text;
  v_email  text;
  v_items  jsonb;
  v_method text;
  v_paid_at timestamptz;
begin
  select p.name, nullif(btrim(p.email), '') into v_name, v_email
  from public.participants p where p.id = new.participant_id;

  -- Sama dengan `notify_order_email`: tanpa alamat, tidak diantrekan.
  if v_email is null then
    return new;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'name', s.name, 'qty', i.qty, 'unit_price', i.unit_price
         ) order by i.created_at), '[]'::jsonb)
    into v_items
  from public.order_items i
  join public.services s on s.id = i.service_id
  where i.order_id = new.id;

  select pm.method, pm.verified_at into v_method, v_paid_at
  from public.payments pm
  where pm.order_id = new.id and pm.status = 'verified'
  order by pm.verified_at desc nulls last
  limit 1;

  perform public.enqueue_notification(
    new.id, 'email', 'payment_paid', v_email,
    'payment_paid_email:' || new.id::text,
    jsonb_build_object(
      'order_number', new.order_number,
      'public_token', new.public_token,
      'participant_name', v_name,
      'total_amount', new.total_amount,
      'paid_amount', new.paid_amount,
      'payment_method', v_method,
      'paid_at', coalesce(v_paid_at, now()),
      'is_catering', public.is_catering_order(new.id),
      'items', v_items
    )
  );
  return new;
end $fn$;

comment on function public.notify_payment_paid_email is
  'Mengantrekan email invoice ke pemesan saat payment_status order menjadi paid. Sekali per order.';

drop trigger if exists notify_payment_paid_email on public.orders;
create trigger notify_payment_paid_email
  after update of payment_status on public.orders
  for each row
  when (new.payment_status = 'paid' and old.payment_status is distinct from 'paid')
  execute function public.notify_payment_paid_email();
