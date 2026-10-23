-- =============================================================================
-- Lacak pesanan publik (`/lacak`)
--
-- Pemesan tamu tidak punya akun, jadi satu-satunya yang ia pegang setelah
-- memesan adalah nomor pesanan. Nomor itu **berurutan** (IA-YYYYMM-####) dan
-- karena itu bisa ditebak: kunci tunggal berarti siapa pun bisa mengintip
-- pesanan orang lain. Pasangannya 4 digit terakhir nomor telepon pemesan,
-- yang hanya diketahui pemiliknya.
--
-- Pola yang sama dengan `get_public_report`: SECURITY DEFINER, satu pintu
-- masuk, dan bentuk keluarannya dikunci di sini. Data pribadi (telepon, email,
-- alamat) tidak pernah ikut keluar. Pasangan yang salah dan nomor yang tidak
-- ada sama-sama mengembalikan null, jadi penanya tidak bisa membedakan "nomor
-- ini ada" dari "nomor ini tidak ada".
--
-- Rem tebakan (10.000 kombinasi per nomor) ada di server action, per IP.
-- =============================================================================

create or replace function public.get_order_tracking(p_order_number text, p_phone_last4 text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_order  public.orders%rowtype;
  v_phone  text;
  v_token  text;
begin
  if p_order_number is null or p_phone_last4 is null or p_phone_last4 !~ '^[0-9]{4}$' then
    return null;
  end if;

  select * into v_order
  from public.orders
  where order_number = upper(btrim(p_order_number))
    and deleted_at is null;
  if not found then
    return null;
  end if;

  select regexp_replace(coalesce(p.phone, ''), '[^0-9]', '', 'g') into v_phone
  from public.participants p
  where p.id = v_order.participant_id;

  if v_phone is null or length(v_phone) < 4 or right(v_phone, 4) <> p_phone_last4 then
    return null;
  end if;

  -- Tautan laporan hanya bila laporannya sudah terbit; syarat yang sama dengan
  -- `get_public_report`, jadi tautan ini tidak pernah membuka halaman kosong.
  if exists (select 1 from public.reports r where r.order_id = v_order.id) then
    v_token := v_order.public_token;
  end if;

  return jsonb_build_object(
    'order_number',      v_order.order_number,
    'status',            v_order.status,
    'payment_status',    v_order.payment_status,
    'created_at',        v_order.created_at,
    'requested_date',    v_order.requested_date,
    'distribution_mode', v_order.distribution_mode,
    'is_catering',       public.is_catering_order(v_order.id),
    'report_token',      v_token,
    'services', coalesce((
      select jsonb_agg(jsonb_build_object('name', s.name, 'qty', oi.qty) order by s.name)
      from public.order_items oi
      join public.services s on s.id = oi.service_id
      where oi.order_id = v_order.id
    ), '[]'::jsonb),
    -- Satu baris per tahap. `sembelih` dicatat per ekor, jadi dirangkum: ia
    -- baru selesai ketika seluruh ekornya tervalidasi.
    'stages', coalesce((
      select jsonb_agg(
        jsonb_build_object('stage', t.stage, 'done', t.done, 'started', t.started, 'at', t.at)
        order by t.seq
      )
      from (
        select
          e.stage,
          min(e.seq) as seq,
          bool_and(e.status = 'validated') as done,
          bool_or(e.status <> 'pending') as started,
          max(e.validated_at) as at
        from public.order_stage_events e
        where e.order_id = v_order.id
        group by e.stage
      ) t
    ), '[]'::jsonb)
  );
end $$;

comment on function public.get_order_tracking is
  'Lacak pesanan publik: nomor pesanan + 4 digit terakhir telepon. Tanpa data pribadi; pasangan salah = null.';

revoke execute on function public.get_order_tracking(text, text) from public;
grant execute on function public.get_order_tracking(text, text) to anon, authenticated;
