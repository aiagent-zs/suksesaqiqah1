-- =============================================================================
-- Katering Ayam · Katering Daging · Katering Kebuli — Paket awal & fungsi
--
-- Dua hal yang harus berada di berkas TERPISAH dari `20261007010000`:
-- ketiganya **memakai** nilai enum baru, dan Postgres menolak itu dalam
-- transaksi yang sama dengan yang menambahkannya.
--
-- Pola yang sama persis dengan `20260921020000_catering_packages.sql`.
-- =============================================================================

-- --- Perbarui penanda order katering -----------------------------------------
--
-- Sebelumnya hanya memeriksa `type = 'katering'`. Sekarang tiga jenis baru
-- ikut dianggap katering sehingga semua keistimewaan yang berlaku untuk katering
-- (bebas bukti masak, tanpa panel hewan, dll.) otomatis berlaku untuk ketiganya.
create or replace function public.is_catering_order(p_order_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.order_items oi
    join public.services s on s.id = oi.service_id
    where oi.order_id = p_order_id
      and s.type in ('katering', 'katering_ayam', 'katering_daging', 'katering_kebuli')
  );
$$;

comment on function public.is_catering_order is
  'Order katering dikenali dari jenis item yang dipesan. Mencakup katering, katering_ayam, katering_daging, dan katering_kebuli.';

grant execute on function public.is_catering_order(uuid) to authenticated;

-- --- Paket awal katering ayam ------------------------------------------------
insert into public.services (
  id, type, name, slug, description, price, sort_order, meta,
  tagline, landing_features, is_popular, show_on_landing
) values
  (
    'a2000000-0000-4000-8000-000000000041', 'katering_ayam',
    'Katering Ayam Sederhana', 'katering-ayam-sederhana',
    'Nasi kotak dengan lauk ayam untuk acara pengajian dan rapat.',
    28000, 41,
    '{"items": ["nasi putih", "ayam goreng", "tempe orek", "sambal", "lalapan", "kerupuk"]}'::jsonb,
    'Pilihan hemat berbasis ayam untuk acara sehari-hari.',
    '{}', false, false
  ),
  (
    'a2000000-0000-4000-8000-000000000042', 'katering_ayam',
    'Katering Ayam Spesial', 'katering-ayam-spesial',
    'Nasi kotak ayam dengan olahan lebih lengkap dan tambahan buah.',
    38000, 42,
    '{"items": ["nasi putih", "ayam bakar", "ayam goreng", "capcay", "sambal", "lalapan", "buah", "kerupuk"]}'::jsonb,
    'Ayam dua olahan dengan lengkap untuk acara keluarga.',
    '{}', true, false
  )
on conflict (id) do nothing;

-- --- Paket awal katering daging ----------------------------------------------
insert into public.services (
  id, type, name, slug, description, price, sort_order, meta,
  tagline, landing_features, is_popular, show_on_landing
) values
  (
    'a2000000-0000-4000-8000-000000000051', 'katering_daging',
    'Katering Daging Sederhana', 'katering-daging-sederhana',
    'Nasi kotak dengan olahan daging sapi untuk acara formal.',
    45000, 51,
    '{"items": ["nasi putih", "semur daging", "tempe bacem", "sambal", "lalapan", "kerupuk"]}'::jsonb,
    'Cita rasa daging sapi untuk acara yang lebih berkesan.',
    '{}', false, false
  ),
  (
    'a2000000-0000-4000-8000-000000000052', 'katering_daging',
    'Katering Daging Lengkap', 'katering-daging-lengkap',
    'Nasi kotak daging sapi dengan lauk lengkap dan sup.',
    62000, 52,
    '{"items": ["nasi putih", "rendang", "semur daging", "sup sapi", "capcay", "sambal", "lalapan", "buah", "kerupuk"]}'::jsonb,
    'Sajian daging lengkap untuk tamu kehormatan.',
    '{}', true, false
  )
on conflict (id) do nothing;

-- --- Paket awal katering kebuli ----------------------------------------------
insert into public.services (
  id, type, name, slug, description, price, sort_order, meta,
  tagline, landing_features, is_popular, show_on_landing
) values
  (
    'a2000000-0000-4000-8000-000000000061', 'katering_kebuli',
    'Katering Nasi Kebuli Kambing', 'katering-kebuli-kambing',
    'Nasi kebuli kambing rempah khas Timur Tengah untuk walimah dan acara adat.',
    75000, 61,
    '{"items": ["nasi kebuli", "daging kambing", "acar", "kerupuk emping", "sambal", "kurma"]}'::jsonb,
    'Nasi kebuli kambing rempah untuk walimah dan acara adat.',
    '{}', true, false
  ),
  (
    'a2000000-0000-4000-8000-000000000062', 'katering_kebuli',
    'Katering Nasi Kebuli Sapi', 'katering-kebuli-sapi',
    'Nasi kebuli daging sapi dengan pelengkap lengkap.',
    68000, 62,
    '{"items": ["nasi kebuli", "daging sapi", "acar", "kerupuk emping", "sambal", "kurma"]}'::jsonb,
    'Nasi kebuli sapi pilihan untuk acara resmi dan keluarga.',
    '{}', false, false
  )
on conflict (id) do nothing;

-- --- Perbarui RPC create_catering_order --------------------------------------
--
-- Mengizinkan jenis layanan katering_ayam, katering_daging, dan katering_kebuli
-- selain 'katering' yang lama.
create or replace function public.create_catering_order(p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_name        text := btrim(p_payload -> 'participant' ->> 'name');
  v_phone       text := btrim(p_payload -> 'participant' ->> 'phone');
  v_email       text := nullif(btrim(coalesce(p_payload -> 'participant' ->> 'email', '')), '');
  v_address     text := nullif(btrim(coalesce(p_payload -> 'participant' ->> 'address', '')), '');
  v_institution text := nullif(btrim(coalesce(p_payload ->> 'recipient_institution', '')), '');
  v_referral    text := nullif(upper(btrim(coalesce(p_payload ->> 'referral_code', ''))), '');
  v_notes       text := nullif(btrim(coalesce(p_payload ->> 'notes', '')), '');
  v_req_date    date;
  v_req_time    time;
  v_prov_code   text := nullif(btrim(coalesce(p_payload ->> 'delivery_province_code', '')), '');
  v_city_code   text := nullif(btrim(coalesce(p_payload ->> 'delivery_city_code', '')), '');
  v_dist_code   text := nullif(btrim(coalesce(p_payload ->> 'delivery_district_code', '')), '');
  v_vill_code   text := nullif(btrim(coalesce(p_payload ->> 'delivery_village_code', '')), '');
  v_postal      text := nullif(btrim(coalesce(p_payload ->> 'delivery_postal_code', '')), '');
  v_detail      text := nullif(btrim(coalesce(p_payload ->> 'delivery_detail', '')), '');
  v_prov_name   text; v_city_name text; v_dist_name text; v_vill_name text;
  v_delivery    text;
  v_today       date := (now() at time zone 'Asia/Jakarta')::date;
  v_min_days    int  := public.booking_min_days();
  v_max_days    int  := public.booking_max_days();
  v_participant uuid;
  v_order_id    uuid;
  v_total       numeric(14, 2) := 0;
  v_item        jsonb;
  v_service     public.services%rowtype;
  v_qty         int;
  v_item_count  int := 0;
  v_total_boxes int := 0;
  v_recent      int;
begin
  -- --- Identitas pemesan ----------------------------------------------------
  if v_name is null or length(v_name) < 2 then
    raise exception 'Nama pemesan wajib diisi' using errcode = 'check_violation';
  end if;
  if length(v_name) > 150 then
    raise exception 'Nama pemesan terlalu panjang' using errcode = 'check_violation';
  end if;
  if v_phone is null or length(v_phone) < 8 or length(v_phone) > 20 then
    raise exception 'Nomor telepon tidak valid' using errcode = 'check_violation';
  end if;
  if v_phone !~ '^[0-9+()\- ]+$' then
    raise exception 'Nomor telepon hanya boleh berisi angka dan tanda + ( ) -'
      using errcode = 'check_violation';
  end if;

  -- --- Jadwal yang diminta --------------------------------------------------
  begin
    v_req_date := nullif(btrim(coalesce(p_payload ->> 'requested_date', '')), '')::date;
    v_req_time := nullif(btrim(coalesce(p_payload ->> 'requested_time', '')), '')::time;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception 'Tanggal atau jam pengiriman tidak dikenali'
      using errcode = 'check_violation';
  end;

  if v_req_date is null or v_req_time is null then
    raise exception 'Pilih tanggal dan jam pengiriman' using errcode = 'check_violation';
  end if;
  if v_req_date < v_today + v_min_days then
    raise exception 'Pengiriman paling cepat % hari setelah pemesanan. Untuk yang lebih mendesak, hubungi admin.', v_min_days
      using errcode = 'check_violation';
  end if;
  if v_req_date > v_today + v_max_days then
    raise exception 'Pemesanan hanya bisa untuk % hari ke depan. Untuk tanggal yang lebih jauh, hubungi admin.', v_max_days
      using errcode = 'check_violation';
  end if;
  if v_req_time < time '06:00' or v_req_time > time '20:00' then
    raise exception 'Jam pengiriman di luar jam layanan (06:00-20:00)'
      using errcode = 'check_violation';
  end if;

  -- --- Alamat pengiriman ----------------------------------------------------
  if v_prov_code is null or v_city_code is null
     or v_dist_code is null or v_vill_code is null then
    raise exception 'Lengkapi provinsi, kabupaten/kota, kecamatan, dan kelurahan tujuan'
      using errcode = 'check_violation';
  end if;
  if v_detail is null then
    raise exception 'Isi nama jalan dan nomor bangunan tujuan pengiriman'
      using errcode = 'check_violation';
  end if;
  if length(v_detail) > 500 then
    raise exception 'Detail alamat terlalu panjang' using errcode = 'check_violation';
  end if;
  if v_postal is null or v_postal !~ '^[0-9]{5}$' then
    raise exception 'Kode pos harus 5 digit angka' using errcode = 'check_violation';
  end if;

  if v_city_code not like v_prov_code || '.%'
     or v_dist_code not like v_city_code || '.%'
     or v_vill_code not like v_dist_code || '.%' then
    raise exception 'Wilayah tujuan tidak sejalur — pilih ulang dari provinsi'
      using errcode = 'check_violation';
  end if;

  select r.name into v_prov_name from public.regions r where r.code = v_prov_code and r.level = 1;
  select r.name into v_city_name from public.regions r where r.code = v_city_code and r.level = 2;
  select r.name into v_dist_name from public.regions r where r.code = v_dist_code and r.level = 3;
  select r.name into v_vill_name from public.regions r where r.code = v_vill_code and r.level = 4;

  if v_prov_name is null or v_city_name is null
     or v_dist_name is null or v_vill_name is null then
    raise exception 'Wilayah tujuan tidak dikenali — pilih ulang dari provinsi'
      using errcode = 'no_data_found';
  end if;

  v_delivery := concat_ws(', ',
    v_detail, 'Kel. ' || v_vill_name, 'Kec. ' || v_dist_name,
    v_city_name, v_prov_name || ' ' || v_postal);

  -- --- Rem kiriman ganda ----------------------------------------------------
  select count(*) into v_recent
  from public.orders o
  join public.participants p on p.id = o.participant_id
  where o.created_by is null and p.phone = v_phone
    and o.created_at > now() - interval '1 hour';

  if v_recent >= 5 then
    raise exception 'Terlalu banyak pesanan dari nomor ini dalam satu jam. Hubungi admin bila ini keliru.'
      using errcode = 'too_many_rows';
  end if;

  -- --- Simpan ---------------------------------------------------------------
  insert into public.participants (name, phone, email, address)
  values (v_name, v_phone, v_email, v_address)
  returning participants.id into v_participant;

  insert into public.orders (
    participant_id, created_by, total_amount, notes,
    referral_code, delivery_address, recipient_institution,
    distribution_mode, requested_date, requested_time,
    delivery_province_code, delivery_province,
    delivery_city_code, delivery_city,
    delivery_district_code, delivery_district,
    delivery_village_code, delivery_village,
    delivery_postal_code, delivery_detail
  ) values (
    v_participant, null, 0, v_notes,
    left(v_referral, 40), v_delivery, left(v_institution, 200),
    'kirim', v_req_date, v_req_time,
    v_prov_code, v_prov_name, v_city_code, v_city_name,
    v_dist_code, v_dist_name, v_vill_code, v_vill_name,
    v_postal, v_detail
  )
  returning orders.id into v_order_id;

  -- --- Item: beberapa paket sekaligus (K3) ----------------------------------
  for v_item in select * from jsonb_array_elements(coalesce(p_payload -> 'items', '[]'::jsonb))
  loop
    v_item_count := v_item_count + 1;

    select * into v_service from public.services s
    where s.id = (v_item ->> 'service_id')::uuid
      and s.is_active and s.deleted_at is null;

    if not found then
      raise exception 'Paket katering tidak ditemukan atau sedang tidak tersedia'
        using errcode = 'no_data_found';
    end if;
    if v_service.type not in ('katering', 'katering_ayam', 'katering_daging', 'katering_kebuli') then
      raise exception 'Paket ini bukan paket katering' using errcode = 'check_violation';
    end if;

    v_qty := coalesce((v_item ->> 'qty')::int, 0);
    if v_qty < 1 or v_qty > 5000 then
      raise exception 'Jumlah box di luar batas yang wajar (1-5000)'
        using errcode = 'check_violation';
    end if;

    if exists (
      select 1 from public.order_items oi
      where oi.order_id = v_order_id and oi.service_id = v_service.id
    ) then
      raise exception 'Paket % dipilih lebih dari sekali — gabungkan jumlahnya', v_service.name
        using errcode = 'check_violation';
    end if;

    insert into public.order_items (order_id, service_id, qty, unit_price)
    values (v_order_id, v_service.id, v_qty, v_service.price);

    v_total := v_total + v_service.price * v_qty;
    v_total_boxes := v_total_boxes + v_qty;
  end loop;

  if v_item_count = 0 then
    raise exception 'Pilih minimal satu paket katering' using errcode = 'check_violation';
  end if;
  if v_item_count > 10 then
    raise exception 'Maksimal 10 jenis paket dalam satu pesanan. Untuk pesanan lebih beragam, hubungi admin.'
      using errcode = 'check_violation';
  end if;
  if v_total_boxes > 10000 then
    raise exception 'Total pesanan di atas 10.000 box — hubungi admin untuk penawaran khusus'
      using errcode = 'check_violation';
  end if;

  update public.orders set total_amount = v_total where id = v_order_id;

  return (
    select jsonb_build_object(
      'order_number',   o.order_number,
      'public_token',   o.public_token,
      'total_amount',   o.total_amount,
      'status',         o.status,
      'payment_status', o.payment_status
    ) from public.orders o where o.id = v_order_id
  );
end $$;

comment on function public.create_catering_order is
  'Checkout katering. Mendukung jenis katering, katering_ayam, katering_daging, dan katering_kebuli. Harga dibaca dari services — kiriman klien diabaikan. Selalu mode kirim, dan sengaja tidak membuat baris animals.';

revoke execute on function public.create_catering_order(jsonb) from public;
grant execute on function public.create_catering_order(jsonb) to anon, authenticated;

