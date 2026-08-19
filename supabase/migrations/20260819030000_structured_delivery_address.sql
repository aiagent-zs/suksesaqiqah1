-- =============================================================================
-- Tahap 10 — Alamat pengiriman terstruktur
--
-- Sebelumnya `orders.delivery_address` satu kolom teks bebas: kurir dapat
-- tulisan apa adanya, dan tidak ada satu pun cara menghitung "berapa order ke
-- Kota Bekasi" atau memvalidasi bahwa wilayahnya benar-benar ada.
--
-- Kini pemesan memilih Provinsi -> Kabupaten/Kota -> Kecamatan -> Kelurahan dari
-- `regions` (20260819020000), lalu menulis kode pos dan detail jalan.
--
-- Dua hal yang sengaja diputuskan begini:
--
-- 1. **Nama wilayah ikut disimpan, bukan hanya kodenya.** Alamat pada order
--    adalah rekaman sejarah — harus tetap terbaca persis seperti saat dipesan.
--    Kalau hanya kodenya yang disimpan, revisi Kemendagri berikutnya (nama
--    berubah, wilayah dimekarkan) akan diam-diam mengubah alamat order lama.
--
-- 2. **Tidak ada foreign key ke `regions`.** Alasan yang sama: FK akan menahan
--    pembaruan data wilayah, atau memaksa order lama ikut berubah. Kebenaran
--    kodenya ditegakkan saat penulisan — `create_guest_order` menolak kode yang
--    tidak ada, salah tingkat, atau tidak sejalur dengan induknya.
-- =============================================================================

alter table public.orders
  add column if not exists delivery_province_code text,
  add column if not exists delivery_province      text,
  add column if not exists delivery_city_code     text,
  add column if not exists delivery_city          text,
  add column if not exists delivery_district_code text,
  add column if not exists delivery_district      text,
  add column if not exists delivery_village_code  text,
  add column if not exists delivery_village       text,
  add column if not exists delivery_postal_code   text,
  add column if not exists delivery_detail        text;

comment on column public.orders.delivery_village_code is
  'Kode Kemendagri kelurahan/desa tujuan (regions.code, level 4). Tiga kode di atasnya tersirat di dalamnya, tapi tetap disimpan terpisah supaya bisa diagregasi tanpa manipulasi string.';

comment on column public.orders.delivery_detail is
  'Nama jalan, nomor rumah, RT/RW, patokan — bagian alamat yang tidak ada di daftar wilayah.';

comment on column public.orders.delivery_address is
  'Alamat pengiriman utuh dalam satu baris, dirakit `create_guest_order` dari kolom terstruktur di atas. Dipakai tampilan & laporan supaya tidak ada dua tempat yang merakit teks yang sama. Order sebelum 19 Agustus 2026 hanya punya kolom ini.';

-- Kode pos Indonesia selalu 5 digit. Dilonggarkan untuk NULL: order yang dibuat
-- staf dan order lama tidak mengisinya.
alter table public.orders
  drop constraint if exists orders_delivery_postal_code_check;
alter table public.orders
  add constraint orders_delivery_postal_code_check
  check (delivery_postal_code is null or delivery_postal_code ~ '^[0-9]{5}$');

-- Agregasi "berapa order ke wilayah ini" — alasan utama alamatnya dipecah.
create index if not exists orders_delivery_city_idx
  on public.orders (delivery_city_code)
  where delivery_city_code is not null;

-- =============================================================================
-- create_guest_order — versi dengan alamat pengiriman terstruktur
-- =============================================================================

create or replace function public.create_guest_order(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name        text := btrim(p_payload -> 'participant' ->> 'name');
  v_phone       text := btrim(p_payload -> 'participant' ->> 'phone');
  v_email       text := nullif(btrim(coalesce(p_payload -> 'participant' ->> 'email', '')), '');
  v_address     text := nullif(btrim(coalesce(p_payload -> 'participant' ->> 'address', '')), '');
  v_req_branch  uuid := nullif(p_payload ->> 'branch_id', '')::uuid;
  v_branch_id   uuid;
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
  v_mode        text := nullif(btrim(coalesce(p_payload ->> 'distribution_mode', '')), '');
  v_req_date    date;
  v_req_time    time;
  -- Alamat pengiriman terstruktur.
  v_prov_code   text := nullif(btrim(coalesce(p_payload ->> 'delivery_province_code', '')), '');
  v_city_code   text := nullif(btrim(coalesce(p_payload ->> 'delivery_city_code', '')), '');
  v_dist_code   text := nullif(btrim(coalesce(p_payload ->> 'delivery_district_code', '')), '');
  v_vill_code   text := nullif(btrim(coalesce(p_payload ->> 'delivery_village_code', '')), '');
  v_postal      text := nullif(btrim(coalesce(p_payload ->> 'delivery_postal_code', '')), '');
  v_detail      text := nullif(btrim(coalesce(p_payload ->> 'delivery_detail', '')), '');
  v_prov_name   text;
  v_city_name   text;
  v_dist_name   text;
  v_vill_name   text;
  v_delivery    text;
  -- Hari ini menurut jam operasional, bukan menurut UTC. `now()` di Supabase
  -- berjalan di UTC: sejak pukul 07:00 WIB keduanya masih satu tanggal, tapi
  -- pemesanan pukul 00:30 WIB akan dinilai terhadap tanggal kemarin dan
  -- "hari ini" milik pemesan tertolak sebagai masa lalu.
  v_today       date := (now() at time zone 'Asia/Jakarta')::date;
  v_participant uuid;
  v_order_id    uuid;
  v_total       numeric(14, 2);
  v_recent      int;
begin
  -- --- Identitas pemesan ------------------------------------------------------
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

  -- --- Paket ibadah: harga & kelayakan dari database ---------------------------
  select * into v_service
  from public.services s
  where s.id = (p_payload ->> 'service_id')::uuid
    and s.is_active
    and s.deleted_at is null;

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

  -- --- Aqiqah untuk siapa ------------------------------------------------------
  if v_aqiqah_for is not null and v_aqiqah_for not in ('laki_laki', 'perempuan') then
    raise exception 'Pilihan aqiqah untuk tidak dikenali' using errcode = 'check_violation';
  end if;
  if v_service.type = 'aqiqah' and v_aqiqah_for is null then
    raise exception 'Pilih aqiqah untuk anak laki-laki atau perempuan'
      using errcode = 'check_violation';
  end if;

  -- --- Nasi box sebagai tambahan -----------------------------------------------
  --
  -- Tidak berdiri sendiri: hanya boleh menempel pada paket ibadah, dan harganya
  -- tetap dibaca dari tabel `services` seperti paket utamanya.
  if nullif(p_payload ->> 'nasi_box_service_id', '') is not null then
    select * into v_box
    from public.services s
    where s.id = (p_payload ->> 'nasi_box_service_id')::uuid
      and s.is_active
      and s.deleted_at is null;

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

  -- --- Jadwal yang diminta -----------------------------------------------------
  begin
    v_req_date := nullif(btrim(coalesce(p_payload ->> 'requested_date', '')), '')::date;
    v_req_time := nullif(btrim(coalesce(p_payload ->> 'requested_time', '')), '')::time;
  exception
    when invalid_datetime_format or datetime_field_overflow then
      raise exception 'Tanggal atau jam pelaksanaan tidak dikenali'
        using errcode = 'check_violation';
  end;

  if v_req_date is null or v_req_time is null then
    raise exception 'Pilih tanggal dan jam pelaksanaan' using errcode = 'check_violation';
  end if;

  if v_req_date < v_today then
    raise exception 'Tanggal pelaksanaan sudah lewat' using errcode = 'check_violation';
  end if;

  -- Batas 7 hari: di luar itu harga & ketersediaan hewan sudah tidak bisa
  -- dipegang dari halaman publik.
  if v_req_date > v_today + 7 then
    raise exception 'Pemesanan hanya bisa untuk 7 hari ke depan. Untuk tanggal yang lebih jauh, hubungi admin.'
      using errcode = 'check_violation';
  end if;

  -- Jendela operasional, sengaja lebih longgar daripada pilihan jam di form:
  -- yang dikunci di sini batas luarnya, sementara slot yang benar-benar
  -- ditawarkan bisa digeser dari UI tanpa migration.
  if v_req_time < time '06:00' or v_req_time > time '20:00' then
    raise exception 'Jam pelaksanaan di luar jam layanan (06:00-20:00)'
      using errcode = 'check_violation';
  end if;

  -- --- Penyaluran & alamat pengiriman ------------------------------------------
  if v_mode is not null and v_mode not in ('salur', 'kirim') then
    raise exception 'Mode penyaluran tidak dikenali' using errcode = 'check_violation';
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

    -- Sejalur atau tidak diperiksa dari kodenya sendiri, sebelum menyentuh
    -- tabel: kode Kemendagri bersarang ('32' -> '32.04' -> '32.04.01'), jadi
    -- kelurahan di provinsi lain langsung ketahuan tanpa query tambahan.
    -- Tanpa ini, empat kode yang masing-masing sah bisa merakit alamat yang
    -- tidak pernah ada di dunia nyata.
    if v_city_code not like v_prov_code || '.%'
       or v_dist_code not like v_city_code || '.%'
       or v_vill_code not like v_dist_code || '.%' then
      raise exception 'Wilayah tujuan tidak sejalur — pilih ulang dari provinsi'
        using errcode = 'check_violation';
    end if;

    -- Nama diambil dari database, tidak pernah dari klien: nama yang dikirim
    -- pemesan bisa berbeda dari kodenya, dan yang dibaca kurir adalah namanya.
    select r.name into v_prov_name from public.regions r
      where r.code = v_prov_code and r.level = 1;
    select r.name into v_city_name from public.regions r
      where r.code = v_city_code and r.level = 2;
    select r.name into v_dist_name from public.regions r
      where r.code = v_dist_code and r.level = 3;
    select r.name into v_vill_name from public.regions r
      where r.code = v_vill_code and r.level = 4;

    if v_prov_name is null or v_city_name is null
       or v_dist_name is null or v_vill_name is null then
      raise exception 'Wilayah tujuan tidak dikenali — pilih ulang dari provinsi'
        using errcode = 'no_data_found';
    end if;

    -- Satu-satunya tempat alamat dirakit jadi satu baris. Tampilan, panel admin,
    -- dan PDF laporan membacanya dari sini, bukan merakit ulang sendiri.
    v_delivery := concat_ws(', ',
      v_detail,
      'Kel. ' || v_vill_name,
      'Kec. ' || v_dist_name,
      v_city_name,
      v_prov_name || ' ' || v_postal
    );
  else
    -- Aqiqah Salur tidak diantar ke mana pun. Alamat yang sempat terisi sebelum
    -- pemesan berpindah pilihan sengaja dibuang, bukan disimpan diam-diam.
    v_prov_code := null; v_city_code := null; v_dist_code := null; v_vill_code := null;
    v_postal := null; v_detail := null; v_delivery := null;
    v_prov_name := null; v_city_name := null; v_dist_name := null; v_vill_name := null;
  end if;

  -- --- Cabang -----------------------------------------------------------------
  --
  -- Form publik tidak lagi mengirim `branch_id`. Kalau toh datang (pemanggil
  -- lain, mis. impor), tetap dihormati; kalau tidak, jatuh ke cabang default.
  -- `order by` menjamin ada hasil sekalipun tidak satu pun cabang ditandai.
  if v_req_branch is not null then
    select b.id into v_branch_id
    from public.branches b
    where b.id = v_req_branch and b.deleted_at is null;
  else
    select b.id into v_branch_id
    from public.branches b
    where b.deleted_at is null
    order by b.is_default desc, b.created_at, b.code
    limit 1;
  end if;

  if v_branch_id is null then
    raise exception 'Cabang tidak ditemukan' using errcode = 'no_data_found';
  end if;

  -- --- Jenis hewan ------------------------------------------------------------
  begin
    v_species := (p_payload ->> 'species')::public.animal_species;
  exception
    when invalid_text_representation then
      raise exception 'Jenis hewan tidak dikenali' using errcode = 'check_violation';
  end;

  -- Domba tetap ada di enum `animal_species` — order yang dibuat staf masih
  -- boleh memakainya. Yang berubah hanya apa yang dilayani checkout publik.
  if v_species = 'domba' then
    raise exception 'Pemesanan mandiri melayani kambing (dan sapi untuk qurban). Untuk domba, hubungi admin.'
      using errcode = 'check_violation';
  end if;

  if v_service.type = 'aqiqah' and v_species <> 'kambing' then
    raise exception 'Aqiqah hanya melayani kambing' using errcode = 'check_violation';
  end if;

  -- --- Rem kiriman ganda (lihat catatan di migration sebelumnya) ---------------
  select count(*) into v_recent
  from public.orders o
  join public.participants p on p.id = o.participant_id
  where o.created_by is null
    and p.phone = v_phone
    and o.created_at > now() - interval '1 hour';

  if v_recent >= 5 then
    raise exception 'Terlalu banyak pesanan dari nomor ini dalam satu jam. Hubungi admin bila ini keliru.'
      using errcode = 'too_many_rows';
  end if;

  -- --- Peserta ---------------------------------------------------------------
  insert into public.participants (name, phone, email, address)
  values (v_name, v_phone, v_email, v_address)
  returning participants.id into v_participant;

  -- --- Order ------------------------------------------------------------------
  v_total := v_service.price * v_qty
           + case when v_box_qty > 0 then v_box.price * v_box_qty else 0 end;

  insert into public.orders (
    participant_id, branch_id, created_by, total_amount, notes,
    referral_code, delivery_address, recipient_institution,
    aqiqah_for, distribution_mode, requested_date, requested_time,
    delivery_province_code, delivery_province,
    delivery_city_code, delivery_city,
    delivery_district_code, delivery_district,
    delivery_village_code, delivery_village,
    delivery_postal_code, delivery_detail
  )
  values (
    v_participant, v_branch_id, null, v_total, v_notes,
    left(v_referral, 40), v_delivery, left(v_institution, 200),
    v_aqiqah_for, v_mode, v_req_date, v_req_time,
    v_prov_code, v_prov_name,
    v_city_code, v_city_name,
    v_dist_code, v_dist_name,
    v_vill_code, v_vill_name,
    v_postal, v_detail
  )
  returning orders.id into v_order_id;

  insert into public.order_items (order_id, service_id, qty, unit_price, meta)
  values (
    v_order_id,
    v_service.id,
    v_qty,
    v_service.price,
    case
      when v_on_behalf is null then '{}'::jsonb
      else jsonb_build_object('on_behalf_of', v_on_behalf)
    end
  );

  if v_box_qty > 0 then
    insert into public.order_items (order_id, service_id, qty, unit_price, meta)
    values (v_order_id, v_box.id, v_box_qty, v_box.price, '{}'::jsonb);
  end if;

  -- Hewan hanya dari paket ibadah — nasi box tidak menambah ekor.
  insert into public.animals (order_id, species, on_behalf_of)
  select v_order_id, v_species, left(v_on_behalf, 150)
  from generate_series(1, v_qty);

  return (
    select jsonb_build_object(
      'order_number',   o.order_number,
      'public_token',   o.public_token,
      'total_amount',   o.total_amount,
      'status',         o.status,
      'payment_status', o.payment_status
    )
    from public.orders o
    where o.id = v_order_id
  );
end;
$$;

comment on function public.create_guest_order is
  'Checkout mandiri (prd.md FR-C2). Harga paket & nasi box dibaca dari services — nilai harga/status/terbayar dari klien diabaikan. Tanggal pelaksanaan dibatasi 7 hari ke depan, jenis hewan dibatasi kambing (sapi hanya untuk qurban), cabang jatuh ke branches.is_default bila tidak dikirim. Alamat Aqiqah Kirim divalidasi terhadap regions (ada, benar tingkatnya, sejalur) dan nama wilayahnya diambil dari database, bukan dari klien. Order tamu ditandai created_by IS NULL.';

revoke execute on function public.create_guest_order(jsonb) from public;
grant execute on function public.create_guest_order(jsonb) to anon, authenticated;
