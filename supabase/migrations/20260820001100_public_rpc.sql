-- =============================================================================
-- Desain ulang skema · 11 RPC untuk pengunjung anonim
-- create_guest_order, get_public_report, confirm_delivery
--
-- `anon` ditolak RLS di setiap tabel operasional, jadi seluruh penulisan dari
-- checkout publik lewat satu fungsi SECURITY DEFINER yang mengunci bentuk dan
-- batasnya **di level database**. Pilihan ini diambil ketimbang memakai service
-- role di halaman publik, karena dengan service role seluruh pembatasan
-- bergantung pada kebenaran kode TypeScript.
--
-- Yang berubah dari versi lama:
--   - `branch_id` hilang sepenuhnya (cabang dibuang)
--   - `distribution_mode` kini **wajib** — ia menentukan tahapan vendor
--   - batas pemesanan jadi satu konstanta yang juga dibaca sisi klien
--   - `confirm_delivery` baru: pembeli mengonfirmasi penerimaan sendiri
-- =============================================================================

-- Batas jendela pemesanan. Ditaruh di app_settings supaya bisa digeser tanpa
-- migration, dan supaya sisi klien membaca angka yang sama — di skema lama
-- keduanya sempat berselisih (form 30 hari, RPC 7 hari), dan pemesan lolos
-- seluruh validasi form lalu ditolak database.
create or replace function public.booking_max_days()
returns int
language sql stable security definer set search_path = public as $$
  select coalesce((value ->> 'days')::int, 7)
  from public.app_settings where key = 'booking_max_days';
$$;

grant execute on function public.booking_max_days() to anon, authenticated;

-- --- create_guest_order -----------------------------------------------------
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
  if v_req_date < v_today then
    raise exception 'Tanggal pelaksanaan sudah lewat' using errcode = 'check_violation';
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
  'Checkout mandiri. Harga dibaca dari services — nilai harga/status/terbayar dari klien diabaikan. Cara penyaluran wajib: ia menentukan tahapan yang harus dilaporkan vendor.';

revoke execute on function public.create_guest_order(jsonb) from public;
grant execute on function public.create_guest_order(jsonb) to anon, authenticated;

-- --- get_public_report ------------------------------------------------------
create or replace function public.get_public_report(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_order  public.orders%rowtype;
  v_report public.reports%rowtype;
  v_result jsonb;
begin
  -- Token 16 byte acak = 32 karakter hex. Menolak yang lebih pendek memangkas
  -- percobaan tebakan sebelum menyentuh indeks.
  if p_token is null or length(p_token) <> 32 then return null; end if;

  select * into v_order from public.orders where public_token = p_token;
  if not found then return null; end if;

  -- Halaman publik baru terbuka setelah laporan pertama dibuat; tanpa syarat
  -- ini, token yang bocor lebih awal sudah memperlihatkan order yang berjalan.
  select * into v_report from public.reports
  where order_id = v_order.id order by version desc limit 1;
  if not found then return null; end if;

  select jsonb_build_object(
    'order_number', v_order.order_number,
    'status',       v_order.status,
    'created_at',   v_order.created_at,
    'distribution_mode', v_order.distribution_mode,
    -- Sengaja hanya nama peserta: telepon, email, dan alamat tidak pernah ikut.
    'participant_name', (
      select p.name from public.participants p where p.id = v_order.participant_id
    ),
    'vendor_name', (select v.name from public.vendors v where v.id = v_order.vendor_id),
    'child_birth_place', v_order.child_birth_place,
    'child_birth_date',  v_order.child_birth_date,
    'delivery_confirmed_at', v_order.delivery_confirmed_at,
    'services', coalesce((
      select jsonb_agg(jsonb_build_object('name', s.name, 'qty', oi.qty) order by s.name)
      from public.order_items oi join public.services s on s.id = oi.service_id
      where oi.order_id = v_order.id
    ), '[]'::jsonb),
    'animals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'species', a.species, 'tag_code', a.tag_code,
        'on_behalf_of', a.on_behalf_of, 'status', a.status) order by a.tag_code)
      from public.animals a where a.order_id = v_order.id
    ), '[]'::jsonb),
    -- Tahapan yang sudah tervalidasi — inilah yang membuat halaman ini bercerita
    -- runtut kepada pemesan, bukan sekadar "selesai".
    'stages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'stage', e.stage, 'occurred_at', e.occurred_at, 'notes', e.notes
      ) order by e.seq, e.occurred_at)
      from public.order_stage_events e
      where e.order_id = v_order.id and e.status = 'validated'
    ), '[]'::jsonb),
    'schedule', (
      select jsonb_build_object(
        'scheduled_date', sc.scheduled_date,
        'scheduled_time', sc.scheduled_time,
        'location_name',  l.name)
      from public.schedules sc
      left join public.locations l on l.id = sc.location_id
      where sc.order_id = v_order.id
    ),
    -- Hanya dokumentasi tervalidasi penuh yang boleh tampil.
    'documentations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', dc.type, 'stage', dc.stage,
        'caption', dc.caption, 'storage_path', dc.storage_path
      ) order by dc.created_at)
      from public.documentations dc
      where dc.order_id = v_order.id and dc.status = 'approved'
    ), '[]'::jsonb),
    'report', jsonb_build_object(
      'version', v_report.version, 'pdf_path', v_report.pdf_path,
      'generated_at', v_report.generated_at)
  ) into v_result;

  return v_result;
end $$;

comment on function public.get_public_report is
  'Payload halaman laporan publik /r/{token} — satu order, dokumentasi approved saja, tanpa kontak peserta.';

grant execute on function public.get_public_report(text) to anon, authenticated;

-- --- confirm_delivery -------------------------------------------------------
--
-- Konfirmasi penerimaan oleh PEMBELI. Laporan "terkirim" dari vendor adalah
-- pernyataan pihak yang mengantar — bukan pengakuan pihak yang menerima. Fungsi
-- ini menutup celah itu: pemesan menekan tombolnya sendiri di halaman bertoken.
create or replace function public.confirm_delivery(p_token text, p_ip text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_order public.orders%rowtype;
begin
  if p_token is null or length(p_token) <> 32 then
    return jsonb_build_object('ok', false, 'reason', 'token_invalid');
  end if;

  select * into v_order from public.orders where public_token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'token_invalid');
  end if;

  if v_order.distribution_mode <> 'kirim' then
    return jsonb_build_object('ok', false, 'reason', 'bukan_order_kirim');
  end if;

  -- Idempoten: menekan dua kali tidak menggeser waktu yang sudah tercatat.
  if v_order.delivery_confirmed_at is not null then
    return jsonb_build_object('ok', true, 'confirmed_at', v_order.delivery_confirmed_at);
  end if;

  update public.orders
  set delivery_confirmed_at = now(),
      delivery_confirmed_ip = left(p_ip, 64)
  where id = v_order.id;

  return jsonb_build_object('ok', true, 'confirmed_at', now());
end $$;

comment on function public.confirm_delivery is
  'Pembeli mengonfirmasi pesanan diterima lewat halaman bertoken. Idempoten. Laporan terkirim dari vendor tetap tercatat terpisah sebagai cadangan.';

grant execute on function public.confirm_delivery(text, text) to anon, authenticated;

-- =============================================================================
-- create_order — order yang dibuat staf dari dalam aplikasi
--
-- Berbeda dari `create_guest_order`: pemanggilnya sudah login dan tunduk RLS,
-- jadi fungsi ini **tidak** SECURITY DEFINER. Gunanya menyatukan pembuatan
-- order + item + hewan dalam satu transaksi, supaya tidak ada order setengah
-- jadi ketika salah satu langkahnya gagal.
--
-- Harga tetap dibaca dari `services` di sisi pemanggil dan diverifikasi ulang
-- di sini — nilai kiriman klien tidak pernah dipercaya, sama seperti checkout.
-- =============================================================================

create or replace function public.create_order(p_payload jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_participant uuid := nullif(p_payload ->> 'participant_id', '')::uuid;
  v_name        text := nullif(btrim(coalesce(p_payload -> 'participant' ->> 'name', '')), '');
  v_phone       text := nullif(btrim(coalesce(p_payload -> 'participant' ->> 'phone', '')), '');
  v_email       text := nullif(btrim(coalesce(p_payload -> 'participant' ->> 'email', '')), '');
  v_address     text := nullif(btrim(coalesce(p_payload -> 'participant' ->> 'address', '')), '');
  v_mode        public.distribution_mode;
  v_notes       text := nullif(btrim(coalesce(p_payload ->> 'notes', '')), '');
  v_order_id    uuid;
  v_total       numeric(14, 2) := 0;
  v_item        jsonb;
  v_animal      jsonb;
  v_service     public.services%rowtype;
begin
  -- Peserta: dipilih dari yang sudah ada, atau dibuat baru.
  if v_participant is null then
    if v_name is null or v_phone is null then
      raise exception 'Nama dan nomor telepon pemesan wajib diisi'
        using errcode = 'check_violation';
    end if;
    insert into public.participants (name, phone, email, address)
    values (v_name, v_phone, v_email, v_address)
    returning participants.id into v_participant;
  end if;

  begin
    v_mode := nullif(btrim(coalesce(p_payload ->> 'distribution_mode', '')), '')::public.distribution_mode;
  exception when invalid_text_representation then
    raise exception 'Cara penyaluran tidak dikenali' using errcode = 'check_violation';
  end;

  insert into public.orders (participant_id, created_by, distribution_mode, notes, total_amount)
  values (v_participant, auth.uid(), v_mode, v_notes, 0)
  returning orders.id into v_order_id;

  -- Item: harga dibaca ulang dari katalog, bukan dari payload.
  for v_item in select * from jsonb_array_elements(coalesce(p_payload -> 'items', '[]'::jsonb))
  loop
    select * into v_service from public.services s
    where s.id = (v_item ->> 'service_id')::uuid and s.is_active and s.deleted_at is null;

    if not found then
      raise exception 'Layanan tidak ditemukan atau sedang tidak aktif'
        using errcode = 'no_data_found';
    end if;

    insert into public.order_items (order_id, service_id, qty, unit_price, meta)
    values (
      v_order_id, v_service.id,
      greatest(coalesce((v_item ->> 'qty')::int, 1), 1),
      v_service.price,
      coalesce(v_item -> 'meta', '{}'::jsonb)
    );

    v_total := v_total + v_service.price * greatest(coalesce((v_item ->> 'qty')::int, 1), 1);
  end loop;

  for v_animal in select * from jsonb_array_elements(coalesce(p_payload -> 'animals', '[]'::jsonb))
  loop
    insert into public.animals (order_id, species, tag_code, weight_kg, on_behalf_of)
    values (
      v_order_id,
      (v_animal ->> 'species')::public.animal_species,
      nullif(btrim(coalesce(v_animal ->> 'tag_code', '')), ''),
      nullif(v_animal ->> 'weight_kg', '')::numeric,
      nullif(btrim(coalesce(v_animal ->> 'on_behalf_of', '')), '')
    );
  end loop;

  update public.orders set total_amount = v_total where id = v_order_id;

  return (
    select jsonb_build_object('id', o.id, 'order_number', o.order_number)
    from public.orders o where o.id = v_order_id
  );
end $$;

comment on function public.create_order is
  'Buat order dari dalam aplikasi (staf). Bukan SECURITY DEFINER — pemanggilnya tunduk RLS. Harga dibaca dari services, bukan dari payload.';

grant execute on function public.create_order(jsonb) to authenticated;
