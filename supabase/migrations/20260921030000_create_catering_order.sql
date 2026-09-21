-- =============================================================================
-- Katering · 03 RPC `create_catering_order`
--
-- Saudara `create_guest_order`, dan sengaja **fungsi terpisah** alih-alih
-- cabang di dalamnya. Alasannya sama dengan alasan formnya dipisah: aqiqah dan
-- katering berbeda di bawah permukaan, bukan hanya di atasnya. Pesanan aqiqah
-- melahirkan baris `animals` dan segala yang mengalir darinya — data lahir
-- anak, jenis kelamin, tahap penyembelihan, sertifikat. Katering tidak punya
-- satu pun dari itu.
--
-- Menyatukannya berarti tiap pemeriksaan jadi bersyarat, dan satu fungsi 300
-- baris dengan dua mode yang saling tidak menyentuh lebih sulit dibaca daripada
-- dua fungsi yang masing-masing mengerjakan satu hal.
--
-- Yang TETAP sama, dan memang harus sama — inilah pertahanan intinya:
--   * harga dibaca dari `services`, nilai kiriman klien diabaikan sepenuhnya
--   * nama wilayah dibaca dari `regions`, bukan dari klien
--   * SECURITY DEFINER, sebab `anon` ditolak RLS di setiap tabel operasional
--   * rem kiriman ganda per nomor telepon
--
-- Yang BERBEDA dari `create_guest_order`:
--   * **nol baris `animals`** — katering tidak menyembelih apa pun
--   * `distribution_mode` selalu `kirim`, tidak ditanyakan form
--   * **beberapa paket sekaligus** (K3): `items` berupa array, bukan satu paket
--   * tanpa data anak, tanpa `aqiqah_for`, tanpa `species`
-- =============================================================================

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
  -- Hari ini menurut jam operasional, bukan UTC — alasan yang sama seperti di
  -- `create_guest_order`: pemesanan pukul 00:30 WIB akan dinilai terhadap
  -- tanggal kemarin kalau acuannya UTC.
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
  --
  -- Selalu wajib: katering **selalu diantar**. Tidak ada mode `salur` yang bisa
  -- dipilih, jadi tidak ada cabang yang mengosongkan alamat seperti di
  -- `create_guest_order`.
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

  -- Sejalur diperiksa dari kodenya sendiri sebelum menyentuh tabel: kode
  -- Kemendagri bersarang (32 -> 32.04 -> 32.04.01).
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
  --
  -- Harga tiap baris dibaca ulang dari `services`. Payload klien hanya
  -- menyumbang `service_id` dan `qty`; berapa yang ditagih ditentukan database.
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
    if v_service.type <> 'katering' then
      raise exception 'Paket ini bukan paket katering' using errcode = 'check_violation';
    end if;

    v_qty := coalesce((v_item ->> 'qty')::int, 0);
    if v_qty < 1 or v_qty > 5000 then
      raise exception 'Jumlah box di luar batas yang wajar (1-5000)'
        using errcode = 'check_violation';
    end if;

    -- Paket yang sama dikirim dua kali adalah kekeliruan form, bukan pesanan
    -- sungguhan — dan membiarkannya menghasilkan dua baris item untuk paket
    -- yang sama, yang membingungkan di layar admin maupun laporan.
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
  -- Batas keseluruhan, bukan hanya per baris: sepuluh baris @5000 box adalah
  -- 50.000 box, dan itu bukan pesanan yang masuk lewat form.
  if v_total_boxes > 10000 then
    raise exception 'Total pesanan di atas 10.000 box — hubungi admin untuk penawaran khusus'
      using errcode = 'check_violation';
  end if;

  update public.orders set total_amount = v_total where id = v_order_id;

  -- Sengaja TIDAK ada `insert into public.animals`. Inilah pembeda pokoknya
  -- dari `create_guest_order`, dan ia punya akibat yang diinginkan:
  -- `generate_stage_checklist` mengambil baris `sembelih` dari tabel hewan,
  -- jadi order tanpa hewan menerbitkan tahap non-sembelih saja —
  -- persiapan -> masak -> kirim -> terkirim. Tidak ada tanda tangan fungsi yang
  -- perlu diubah untuk itu.

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
  'Checkout katering. Harga dibaca dari services — kiriman klien diabaikan. Selalu mode kirim, dan sengaja tidak membuat baris animals: itulah yang membuat tahapnya persiapan->masak->kirim->terkirim tanpa mengubah fulfilment_sequence().';

revoke execute on function public.create_catering_order(jsonb) from public;
grant execute on function public.create_catering_order(jsonb) to anon, authenticated;
