-- =============================================================================
-- Tahap 4 — Order Management · RPC pembuatan order atomik
--
-- Membuat order menyentuh 4 tabel (participants, orders, order_items, animals).
-- Lewat PostgREST keempatnya akan menjadi request terpisah — kalau salah satu
-- gagal, order menggantung setengah jadi. Fungsi ini membungkusnya dalam satu
-- transaksi.
--
-- SECURITY INVOKER: RLS tetap berlaku atas nama pemanggil, jadi admin cabang
-- tidak bisa membuat order untuk cabang lain (policy orders_insert).
-- Acuan: docs/16_API_SPEC.md section 3, docs/05_DATABASE_DESIGN.md section 4.6-4.8
-- =============================================================================

create or replace function public.create_order(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_participant_id uuid;
  v_order_id       uuid;
  v_total          numeric(14, 2);
  v_result         jsonb;
begin
  -- --- Peserta: pakai yang ada, atau buat baru ---
  if (p_payload -> 'participant' ->> 'mode') = 'existing' then
    v_participant_id := (p_payload -> 'participant' ->> 'participant_id')::uuid;

    if not exists (select 1 from public.participants p where p.id = v_participant_id) then
      raise exception 'Peserta tidak ditemukan' using errcode = 'no_data_found';
    end if;
  else
    insert into public.participants (name, phone, email, address)
    values (
      p_payload -> 'participant' ->> 'name',
      nullif(p_payload -> 'participant' ->> 'phone', ''),
      nullif(p_payload -> 'participant' ->> 'email', ''),
      nullif(p_payload -> 'participant' ->> 'address', '')
    )
    returning participants.id into v_participant_id;
  end if;

  -- --- Total dihitung di server, bukan dipercaya dari klien ---
  select coalesce(sum((i ->> 'qty')::int * (i ->> 'unit_price')::numeric), 0)
  into v_total
  from jsonb_array_elements(p_payload -> 'items') i;

  -- order_number diisi trigger set_orders_order_number
  insert into public.orders (participant_id, branch_id, created_by, total_amount, notes)
  values (
    v_participant_id,
    (p_payload ->> 'branch_id')::uuid,
    auth.uid(),
    v_total,
    nullif(p_payload ->> 'notes', '')
  )
  returning orders.id into v_order_id;

  insert into public.order_items (order_id, service_id, qty, unit_price, meta)
  select
    v_order_id,
    (i ->> 'service_id')::uuid,
    (i ->> 'qty')::int,
    (i ->> 'unit_price')::numeric,
    case
      when nullif(i ->> 'on_behalf_of', '') is null then '{}'::jsonb
      else jsonb_build_object('on_behalf_of', i ->> 'on_behalf_of')
    end
  from jsonb_array_elements(p_payload -> 'items') i;

  insert into public.animals (order_id, species, tag_code, weight_kg, on_behalf_of)
  select
    v_order_id,
    (a ->> 'species')::public.animal_species,
    nullif(a ->> 'tag_code', ''),
    nullif(a ->> 'weight_kg', '')::numeric,
    nullif(a ->> 'on_behalf_of', '')
  from jsonb_array_elements(coalesce(p_payload -> 'animals', '[]'::jsonb)) a;

  select jsonb_build_object(
           'id', o.id,
           'order_number', o.order_number,
           'status', o.status,
           'payment_status', o.payment_status,
           'total_amount', o.total_amount
         )
  into v_result
  from public.orders o
  where o.id = v_order_id;

  return v_result;
end;
$$;

comment on function public.create_order is
  'Membuat order beserta peserta/item/hewan dalam satu transaksi. RLS pemanggil tetap berlaku.';

grant execute on function public.create_order(jsonb) to authenticated;
