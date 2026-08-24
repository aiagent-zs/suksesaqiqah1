-- =============================================================================
-- Jendela pemesanan: jeda persiapan minimum + batas atas dilonggarkan
--
-- Sebelumnya pemesan boleh memilih **hari ini** sebagai tanggal pelaksanaan.
-- Hewan perlu dicari, disiapkan, dan mitra perlu dijadwalkan — order untuk hari
-- yang sama tidak pernah benar-benar bisa dikerjakan, jadi yang terjadi hanya
-- admin menelepon balik untuk memundurkan tanggal.
--
-- Aturan barunya: hari pengisian form dan 3 hari sesudahnya ditolak. Pemesan
-- yang mengisi tanggal 10 paling cepat mendapat tanggal 14.
--
-- Batas atas naik dari 7 ke 30 hari. Jendela lama tidak menyisakan pilihan yang
-- masuk akal setelah 4 hari pertama ditutup — hanya tersisa 3 tanggal.
--
-- Keduanya di `app_settings` dengan alasan yang sama seperti `booking_max_days`
-- sejak awal: sisi klien membaca angka yang sama, jadi form dan database tidak
-- bisa berselisih dan menolak pemesan setelah ia melewati seluruh validasi.
-- =============================================================================

create or replace function public.booking_min_days()
returns int
language sql stable security definer set search_path = public as $$
  select coalesce((value ->> 'days')::int, 4)
  from public.app_settings where key = 'booking_min_days';
$$;

comment on function public.booking_min_days is
  'Jeda persiapan minimum sebelum tanggal pelaksanaan, dalam hari. 4 = hari pengisian + 3 hari sesudahnya ditolak. Dibaca create_guest_order DAN sisi klien.';

grant execute on function public.booking_min_days() to anon, authenticated;

insert into public.app_settings (key, value, description) values
  (
    'booking_min_days',
    '{"days": 4}'::jsonb,
    'Jeda persiapan minimum dari hari pemesanan ke tanggal pelaksanaan, dalam hari. 4 = hari pengisian form dan 3 hari sesudahnya tidak bisa dipilih.'
  )
on conflict (key) do update set value = excluded.value, description = excluded.description;

update public.app_settings
set value = '{"days": 30}'::jsonb
where key = 'booking_max_days';

-- --- create_guest_order: hanya blok jadwal yang berubah ----------------------
--
-- Fungsinya ditulis ulang utuh (create or replace tidak bisa menambal sebagian).
-- Yang berbeda dari 20260820001100 cuma dua baris pemeriksaan tanggal di blok
-- "Jadwal yang diminta"; sisanya identik.
create or replace function public.create_guest_order(p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_name        text := btrim(p_payload -> 'participant' ->> 'name');
  v_phone       text := btrim(p_payload -> 'participant' ->> 'phone');
  v_email       text := nullif(btrim(coalesce(p_payload -> 'participant' ->> 'email', '')), '');
  v_address     text := nullif(btrim(coalesce(p_payload -> 'participant' ->> 'address', '')), '');
  v_service     public.services%rowtype;
  v_box         public.services%rowtype;
  v_box_qty     int  := coalesce((p_payload ->> 'nasi_box_qty')::int, 0);
  v_qty         int  := coalesce((p_payload ->> 'qty')::int, 1);
  v_species     public.animal_species;
  v_on_behalf   text := nullif(btrim(coalesce(p_payload ->> 'on_behalf_of', '')), '');
  v_institution text := nullif(btrim(coalesce(p_payload ->> 'recipient_institution', '')), '');
  v_referral    text := nullif(upper(btrim(coalesce(p_payload ->> 'referral_code', ''))), '');
  v_notes       text := nullif(btrim(coalesce(p_payload ->> 'notes', '')), '');
  v_aqiqah_for  text := nullif(btrim(coalesce(p_payload ->> 'aqiqah_for', '')), '');
  v_mode        public.distribution_mode;
  v_req_date    date;
  v_req_time    time;
  v_birth_place text := nullif(btrim(coalesce(p_payload ->> 'child_birth_place', '')), '');
  v_birth_date  date;
  v_prov_code   text := nullif(btrim(coalesce(p_payload ->> 'delivery_province_code', '')), '');
  v_city_code   text := nullif(btrim(coalesce(p_payload ->> 'delivery_city_code', '')), '');
  v_dist_code   text := nullif(btrim(coalesce(p_payload ->> 'delivery_district_code', '')), '');
  v_vill_code   text := nullif(btrim(coalesce(p_payload ->> 'delivery_village_code', '')), '');
  v_postal      text := nullif(btrim(coalesce(p_payload ->> 'delivery_postal_code', '')), '');
  v_detail      text := nullif(btrim(coalesce(p_payload ->> 'delivery_detail', '')), '');
  v_prov_name   text; v_city_name text; v_dist_name text; v_vill_name text;
  v_delivery    text;
  -- Hari ini menurut jam operasional, bukan UTC: pemesanan pukul 00:30 WIB
  -- akan dinilai terhadap tanggal kemarin kalau acuannya UTC, dan "hari ini"
  -- milik pemesan tertolak sebagai masa lalu.
  v_today       date := (now() at time zone 'Asia/Jakarta')::date;
  v_min_days    int  := public.booking_min_days();
  v_max_days    int  := public.booking_max_days();
  v_participant uuid;
  v_order_id    uuid;
  v_total       numeric(14, 2);
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

  -- --- Paket: harga & kelayakan dibaca dari database ------------------------
  select * into v_service from public.services s
  where s.id = (p_payload ->> 'service_id')::uuid and s.is_active and s.deleted_at is null;

  if not found then
    raise exception 'Paket tidak ditemukan atau sedang tidak tersedia'
      using errcode = 'no_data_found';
  end if;
  if v_service.type not in ('aqiqah', 'qurban') then
    raise exception 'Paket ini tidak tersedia untuk pemesanan mandiri'
      using errcode = 'check_violation';
  end if;
  if v_qty < 1 or v_qty > 20 then
    raise exception 'Jumlah pesanan di luar batas yang wajar (1-20)'
      using errcode = 'check_violation';
  end if;

  -- --- Aqiqah untuk siapa ---------------------------------------------------
  if v_aqiqah_for is not null and v_aqiqah_for not in ('laki_laki', 'perempuan') then
    raise exception 'Pilihan aqiqah untuk tidak dikenali' using errcode = 'check_violation';
  end if;
  if v_service.type = 'aqiqah' and v_aqiqah_for is null then
    raise exception 'Pilih aqiqah untuk anak laki-laki atau perempuan'
      using errcode = 'check_violation';
  end if;

  -- --- Data lahir anak ------------------------------------------------------
  begin
    v_birth_date := nullif(btrim(coalesce(p_payload ->> 'child_birth_date', '')), '')::date;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception 'Tanggal lahir anak tidak dikenali' using errcode = 'check_violation';
  end;

  if v_service.type = 'aqiqah' then
    if v_birth_place is null or length(v_birth_place) < 2 then
      raise exception 'Tempat lahir anak wajib diisi' using errcode = 'check_violation';
    end if;
    if v_birth_date is null then
      raise exception 'Tanggal lahir anak wajib diisi' using errcode = 'check_violation';
    end if;
  end if;
  if length(coalesce(v_birth_place, '')) > 100 then
    raise exception 'Tempat lahir anak terlalu panjang' using errcode = 'check_violation';
  end if;
  if v_birth_date is not null then
    -- Acuannya `v_today`, BUKAN batas bawah pemesanan: sejak ada jeda persiapan
    -- keduanya berbeda 4 hari, dan memakai batas pemesanan di sini akan
    -- meloloskan tanggal lahir yang belum terjadi.
    if v_birth_date > v_today then
      raise exception 'Tanggal lahir anak tidak boleh di masa depan'
        using errcode = 'check_violation';
    end if;
    if v_birth_date < date '1900-01-01' then
      raise exception 'Tanggal lahir anak tidak masuk akal' using errcode = 'check_violation';
    end if;
  end if;

  -- --- Nasi box -------------------------------------------------------------
  if nullif(p_payload ->> 'nasi_box_service_id', '') is not null then
    select * into v_box from public.services s
    where s.id = (p_payload ->> 'nasi_box_service_id')::uuid
      and s.is_active and s.deleted_at is null;

    if not found then
      raise exception 'Paket nasi box tidak ditemukan atau sedang tidak tersedia'
        using errcode = 'no_data_found';
    end if;
    if v_box.type <> 'nasi_box' then
      raise exception 'Pilihan nasi box tidak valid' using errcode = 'check_violation';
    end if;
    if v_box_qty < 1 or v_box_qty > 5000 then
      raise exception 'Jumlah nasi box di luar batas yang wajar (1-5000)'
        using errcode = 'check_violation';
    end if;
  else
    v_box_qty := 0;
  end if;

  -- --- Jadwal yang diminta --------------------------------------------------
  begin
    v_req_date := nullif(btrim(coalesce(p_payload ->> 'requested_date', '')), '')::date;
    v_req_time := nullif(btrim(coalesce(p_payload ->> 'requested_time', '')), '')::time;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception 'Tanggal atau jam pelaksanaan tidak dikenali'
      using errcode = 'check_violation';
  end;

  if v_req_date is null or v_req_time is null then
    raise exception 'Pilih tanggal dan jam pelaksanaan' using errcode = 'check_violation';
  end if;
  -- Jeda persiapan. Tanggal yang sudah lewat jatuh ke sini juga, tapi pesannya
  -- dipisah: "sudah lewat" dan "terlalu mepet" adalah dua kekeliruan berbeda,
  -- dan pemesan yang memilih besok perlu tahu berapa hari yang dibutuhkan.
  if v_req_date < v_today then
    raise exception 'Tanggal pelaksanaan sudah lewat' using errcode = 'check_violation';
  end if;
  if v_req_date < v_today + v_min_days then
    raise exception 'Pelaksanaan paling cepat % hari setelah pemesanan, yaitu tanggal %. Untuk yang lebih mendesak, hubungi admin.',
      v_min_days, to_char(v_today + v_min_days, 'DD-MM-YYYY')
      using errcode = 'check_violation';
  end if;
  if v_req_date > v_today + v_max_days then
    raise exception 'Pemesanan hanya bisa untuk % hari ke depan. Untuk tanggal yang lebih jauh, hubungi admin.', v_max_days
      using errcode = 'check_violation';
  end if;
  -- Jendela operasional, sengaja lebih longgar daripada pilihan jam di form:
  -- slot yang ditawarkan bisa digeser dari UI tanpa migration.
  if v_req_time < time '06:00' or v_req_time > time '20:00' then
    raise exception 'Jam pelaksanaan di luar jam layanan (06:00-20:00)'
      using errcode = 'check_violation';
  end if;

  -- --- Cara penyaluran & alamat --------------------------------------------
  --
  -- Kini WAJIB: ia menentukan rangkaian tahap yang harus dilaporkan vendor,
  -- jadi order tanpa mode adalah order yang tidak bisa dikerjakan.
  begin
    v_mode := nullif(btrim(coalesce(p_payload ->> 'distribution_mode', '')), '')::public.distribution_mode;
  exception when invalid_text_representation then
    raise exception 'Cara penyaluran tidak dikenali' using errcode = 'check_violation';
  end;

  if v_mode is null then
    raise exception 'Pilih cara penyaluran: disalurkan atau dikirim ke alamat Anda'
      using errcode = 'check_violation';
  end if;

  if v_mode = 'kirim' then
    if v_prov_code is null or v_city_code is null
       or v_dist_code is null or v_vill_code is null then
      raise exception 'Lengkapi provinsi, kabupaten/kota, kecamatan, dan kelurahan tujuan'
        using errcode = 'check_violation';
    end if;
    if v_detail is null then
      raise exception 'Isi nama jalan dan nomor rumah tujuan pengiriman'
        using errcode = 'check_violation';
    end if;
    if length(v_detail) > 500 then
      raise exception 'Detail alamat terlalu panjang' using errcode = 'check_violation';
    end if;
    if v_postal is null or v_postal !~ '^[0-9]{5}$' then
      raise exception 'Kode pos harus 5 digit angka' using errcode = 'check_violation';
    end if;

    -- Sejalur diperiksa dari kodenya sendiri sebelum menyentuh tabel: kode
    -- Kemendagri bersarang (32 -> 32.04 -> 32.04.01), jadi empat kode yang
    -- masing-masing sah tetap tidak bisa merakit alamat yang tak pernah ada.
    if v_city_code not like v_prov_code || '.%'
       or v_dist_code not like v_city_code || '.%'
       or v_vill_code not like v_dist_code || '.%' then
      raise exception 'Wilayah tujuan tidak sejalur — pilih ulang dari provinsi'
        using errcode = 'check_violation';
    end if;

    -- Nama diambil dari database, tidak pernah dari klien: yang dibaca kurir
    -- adalah namanya, jadi nama kiriman sendiri bisa berbeda dari kodenya.
    select r.name into v_prov_name from public.regions r where r.code = v_prov_code and r.level = 1;
    select r.name into v_city_name from public.regions r where r.code = v_city_code and r.level = 2;
    select r.name into v_dist_name from public.regions r where r.code = v_dist_code and r.level = 3;
    select r.name into v_vill_name from public.regions r where r.code = v_vill_code and r.level = 4;

    if v_prov_name is null or v_city_name is null
       or v_dist_name is null or v_vill_name is null then
      raise exception 'Wilayah tujuan tidak dikenali — pilih ulang dari provinsi'
        using errcode = 'no_data_found';
    end if;

    -- Satu-satunya tempat alamat dirakit jadi satu baris.
    v_delivery := concat_ws(', ',
      v_detail, 'Kel. ' || v_vill_name, 'Kec. ' || v_dist_name,
      v_city_name, v_prov_name || ' ' || v_postal);
  else
    -- Aqiqah Salur tidak diantar ke mana pun; alamat yang sempat terisi sebelum
    -- pemesan berpindah pilihan dibuang, bukan disimpan diam-diam.
    v_prov_code := null; v_city_code := null; v_dist_code := null; v_vill_code := null;
    v_postal := null; v_detail := null; v_delivery := null;
    v_prov_name := null; v_city_name := null; v_dist_name := null; v_vill_name := null;
  end if;

  -- --- Jenis hewan ----------------------------------------------------------
  begin
    v_species := (p_payload ->> 'species')::public.animal_species;
  exception when invalid_text_representation then
    raise exception 'Jenis hewan tidak dikenali' using errcode = 'check_violation';
  end;

  if v_species = 'domba' then
    raise exception 'Pemesanan mandiri melayani kambing (dan sapi untuk qurban). Untuk domba, hubungi admin.'
      using errcode = 'check_violation';
  end if;
  if v_service.type = 'aqiqah' and v_species <> 'kambing' then
    raise exception 'Aqiqah hanya melayani kambing' using errcode = 'check_violation';
  end if;

  -- --- Rem kiriman ganda ----------------------------------------------------
  --
  -- Per nomor telepon. Kuncinya dikirim pengirimnya sendiri, jadi ini hanya
  -- rem kasar; rem per alamat IP ada di lapisan aplikasi.
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

  -- Harga dibaca dari `services`, tidak pernah dari klien.
  v_total := v_service.price * v_qty
           + case when v_box_qty > 0 then v_box.price * v_box_qty else 0 end;

  insert into public.orders (
    participant_id, created_by, total_amount, notes,
    referral_code, delivery_address, recipient_institution,
    aqiqah_for, distribution_mode, requested_date, requested_time,
    child_birth_place, child_birth_date,
    delivery_province_code, delivery_province,
    delivery_city_code, delivery_city,
    delivery_district_code, delivery_district,
    delivery_village_code, delivery_village,
    delivery_postal_code, delivery_detail
  ) values (
    v_participant, null, v_total, v_notes,
    left(v_referral, 40), v_delivery, left(v_institution, 200),
    v_aqiqah_for, v_mode, v_req_date, v_req_time,
    left(v_birth_place, 100), v_birth_date,
    v_prov_code, v_prov_name, v_city_code, v_city_name,
    v_dist_code, v_dist_name, v_vill_code, v_vill_name,
    v_postal, v_detail
  )
  returning orders.id into v_order_id;

  insert into public.order_items (order_id, service_id, qty, unit_price, meta)
  values (
    v_order_id, v_service.id, v_qty, v_service.price,
    case when v_on_behalf is null then '{}'::jsonb
         else jsonb_build_object('on_behalf_of', v_on_behalf) end
  );

  if v_box_qty > 0 then
    insert into public.order_items (order_id, service_id, qty, unit_price, meta)
    values (v_order_id, v_box.id, v_box_qty, v_box.price, '{}'::jsonb);
  end if;

  -- Hewan hanya dari paket ibadah — nasi box tidak menambah ekor.
  insert into public.animals (order_id, species, on_behalf_of)
  select v_order_id, v_species, left(v_on_behalf, 150) from generate_series(1, v_qty);

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

comment on function public.create_guest_order is
  'Checkout mandiri. Harga dibaca dari services — nilai harga/status/terbayar dari klien diabaikan. Cara penyaluran wajib: ia menentukan tahapan yang harus dilaporkan vendor. Tanggal pelaksanaan dibatasi jendela booking_min_days..booking_max_days.';

revoke execute on function public.create_guest_order(jsonb) from public;
grant execute on function public.create_guest_order(jsonb) to anon, authenticated;
