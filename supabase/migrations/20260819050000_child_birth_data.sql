-- =============================================================================
-- Tahap 11 — Tempat & tanggal lahir anak yang diaqiqahi
--
-- Sebelumnya satu-satunya jejak si anak adalah namanya, itu pun sudah terlanjur
-- dirakit jadi satu teks: `child_name` + `bin_binti` disatukan di server lalu
-- disimpan sebagai `animals.on_behalf_of`. Cukup untuk mencetak "atas nama",
-- tidak cukup untuk sertifikat aqiqah — yang lazimnya menyebut tempat dan
-- tanggal lahir.
--
-- Tiga hal yang diputuskan begini, dan alasannya tidak terbaca dari DDL-nya:
--
-- 1. **Kolomnya di `orders`, bukan di `animals`.** Satu order = satu anak,
--    sementara ekornya bisa dua. Menaruh data lahir di `animals` berarti
--    menyalin fakta yang sama ke tiap ekor, lalu suatu hari punya dua kambing
--    dengan tanggal lahir berbeda untuk anak yang sama. `orders.aqiqah_for`
--    (jenis kelamin anak) sudah tinggal di sini dengan alasan yang persis sama.
--
-- 2. **Nullable, meski form mewajibkannya.** Order yang sudah ada tidak punya
--    data ini dan tidak ada dari mana mengarangnya; `not null` berarti harus
--    memilih nilai palsu untuk seluruh riwayat. Kewajibannya ditegakkan di
--    tempat data itu benar-benar masuk — `create_guest_order` — bukan di bentuk
--    tabelnya.
--
-- 3. **Wajib hanya untuk paket aqiqah.** RPC yang sama melayani qurban, yang
--    tidak punya anak untuk dicatat. Aturannya mengikuti `aqiqah_for`: diperiksa
--    saat `services.type = 'aqiqah'`, diabaikan selain itu.
-- =============================================================================

alter table public.orders
  add column if not exists child_birth_place text,
  add column if not exists child_birth_date  date;

comment on column public.orders.child_birth_place is
  'Tempat lahir anak yang diaqiqahi. Pasangan `child_birth_date`; namanya sendiri ada di animals.on_behalf_of.';

comment on column public.orders.child_birth_date is
  'Tanggal lahir anak yang diaqiqahi. Dipakai sertifikat aqiqah, dan menjadi acuan hari ke-7 saat admin menyusun jadwal.';

-- Batas bawah yang bisa ditegakkan tabel. Batas atasnya ("tidak boleh di masa
-- depan") sengaja tidak di sini: `current_date` tidak IMMUTABLE, jadi Postgres
-- menolaknya dalam CHECK — dan constraint yang artinya berubah tiap hari akan
-- membuat baris yang sah kemarin gagal di-restore besok. Batas atas ditegakkan
-- `create_guest_order` terhadap tanggal WIB.
alter table public.orders
  drop constraint if exists orders_child_birth_date_check;
alter table public.orders
  add constraint orders_child_birth_date_check
  check (child_birth_date is null or child_birth_date >= date '1900-01-01');

-- =============================================================================
-- create_guest_order — versi dengan data lahir anak
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
  -- Data anak yang diaqiqahi. Namanya tidak di sini — ia sudah dirakit klien
  -- jadi `on_behalf_of` di atas.
  v_birth_place text := nullif(btrim(coalesce(p_payload ->> 'child_birth_place', '')), '');
  v_birth_date  date;
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

  -- --- Data lahir anak ---------------------------------------------------------
  --
  -- Diperiksa setelah paketnya diketahui, karena kewajibannya bergantung pada
  -- `v_service.type`: qurban tidak punya anak untuk dicatat.
  begin
    v_birth_date := nullif(btrim(coalesce(p_payload ->> 'child_birth_date', '')), '')::date;
  exception
    when invalid_datetime_format or datetime_field_overflow then
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

  -- Dibandingkan dengan tanggal WIB, bukan `current_date` yang berjalan di UTC:
  -- bayi yang lahir hari ini akan tertolak sebagai "masa depan" selama tujuh jam
  -- pertama tiap harinya kalau acuannya UTC.
  if v_birth_date is not null then
    if v_birth_date > v_today then
      raise exception 'Tanggal lahir anak tidak boleh di masa depan'
        using errcode = 'check_violation';
    end if;
    if v_birth_date < date '1900-01-01' then
      raise exception 'Tanggal lahir anak tidak masuk akal' using errcode = 'check_violation';
    end if;
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
    child_birth_place, child_birth_date,
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
    left(v_birth_place, 100), v_birth_date,
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
  'Checkout mandiri (prd.md FR-C2). Harga paket & nasi box dibaca dari services — nilai harga/status/terbayar dari klien diabaikan. Tanggal pelaksanaan dibatasi 7 hari ke depan, jenis hewan dibatasi kambing (sapi hanya untuk qurban), cabang jatuh ke branches.is_default bila tidak dikirim. Tempat & tanggal lahir anak wajib untuk paket aqiqah. Alamat Aqiqah Kirim divalidasi terhadap regions (ada, benar tingkatnya, sejalur) dan nama wilayahnya diambil dari database, bukan dari klien. Order tamu ditandai created_by IS NULL.';

revoke execute on function public.create_guest_order(jsonb) from public;
grant execute on function public.create_guest_order(jsonb) to anon, authenticated;

-- =============================================================================
-- get_public_report — data lahir anak ikut ke halaman laporan & PDF
--
-- Aturan "data minimal" (docs/11 section 6) tidak dilanggar di sini: yang
-- ditahan dari halaman publik adalah **kontak** peserta — telepon, email,
-- alamat. Tempat & tanggal lahir anak bukan kontak, melainkan pokok ibadah yang
-- sedang dilaporkan, dan justru itulah yang dicetak di sertifikat aqiqah.
-- =============================================================================

create or replace function public.get_public_report(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_order   public.orders%rowtype;
  v_report  public.reports%rowtype;
  v_result  jsonb;
begin
  -- Token dibuat dari 16 byte acak (32 karakter hex). Menolak yang lebih pendek
  -- memangkas percobaan tebakan sebelum menyentuh indeks.
  if p_token is null or length(p_token) <> 32 then
    return null;
  end if;

  select * into v_order from public.orders where public_token = p_token;
  if not found then
    return null;
  end if;

  -- Halaman publik hanya terbuka setelah laporan pertama dibuat. Tanpa syarat
  -- ini, token yang bocor lebih awal sudah memperlihatkan order yang masih
  -- berjalan.
  select * into v_report
  from public.reports
  where order_id = v_order.id
  order by version desc
  limit 1;

  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'order_number',    v_order.order_number,
    'status',          v_order.status,
    'created_at',      v_order.created_at,
    'branch_name',     (select b.name from public.branches b where b.id = v_order.branch_id),
    -- Sengaja hanya nama peserta: telepon, email, dan alamat tidak pernah ikut
    -- ke halaman publik (docs/11 section 6 — data minimal).
    'participant_name', (
      select p.name from public.participants p where p.id = v_order.participant_id
    ),
    'child_birth_place', v_order.child_birth_place,
    'child_birth_date',  v_order.child_birth_date,
    'services', coalesce((
      select jsonb_agg(jsonb_build_object('name', s.name, 'qty', oi.qty) order by s.name)
      from public.order_items oi
      join public.services s on s.id = oi.service_id
      where oi.order_id = v_order.id
    ), '[]'::jsonb),
    'animals', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'species',      a.species,
          'tag_code',     a.tag_code,
          'on_behalf_of', a.on_behalf_of,
          'status',       a.status
        ) order by a.tag_code
      )
      from public.animals a
      where a.order_id = v_order.id
    ), '[]'::jsonb),
    'schedule', (
      select jsonb_build_object(
        'scheduled_date', sc.scheduled_date,
        'scheduled_time', sc.scheduled_time,
        'location_name',  l.name
      )
      from public.schedules sc
      left join public.locations l on l.id = sc.location_id
      where sc.order_id = v_order.id
    ),
    'progress', (
      select jsonb_build_object(
        'animals_total',       p.animals_total,
        'animals_slaughtered', p.animals_slaughtered,
        'animals_distributed', p.animals_distributed,
        'packages_total',      p.packages_total
      )
      from public.v_order_progress p
      where p.order_id = v_order.id
    ),
    'distributions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'recipient_area',  d.recipient_area,
          'packages_count',  d.packages_count,
          'distributed_at',  d.distributed_at
        ) order by d.distributed_at
      )
      from public.distributions d
      where d.order_id = v_order.id
    ), '[]'::jsonb),
    -- Hanya dokumentasi tervalidasi penuh yang boleh tampil (docs/10 section 6).
    'documentations', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'type',         dc.type,
          'stage',        dc.stage,
          'caption',      dc.caption,
          'storage_path', dc.storage_path
        ) order by dc.created_at
      )
      from public.documentations dc
      where dc.order_id = v_order.id and dc.status = 'approved'
    ), '[]'::jsonb),
    'report', jsonb_build_object(
      'version',      v_report.version,
      'pdf_path',     v_report.pdf_path,
      'generated_at', v_report.generated_at
    )
  ) into v_result;

  return v_result;
end;
$$;

comment on function public.get_public_report is
  'Payload halaman laporan publik `/r/{token}` — satu order saja, dokumentasi approved saja, tanpa kontak peserta (docs/11 section 5, section 6). Tempat & tanggal lahir anak ikut karena keduanya isi sertifikat aqiqah, bukan data kontak.';

grant execute on function public.get_public_report(text) to anon, authenticated;
