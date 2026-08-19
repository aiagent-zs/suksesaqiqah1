-- =============================================================================
-- Tahap 10 — Checkout mandiri · penyesuaian form pemesan
--
-- Tiga perubahan yang diminta dari lapangan:
--
--   1. Jenis hewan di checkout publik cukup **kambing** — domba tidak lagi
--      ditawarkan maupun diterima.
--   2. Pemilih **wilayah layanan dihapus** dari form. `orders.branch_id` tetap
--      NOT NULL, jadi cabangnya kini ditentukan server: cabang default.
--   3. Pemesan **memilih tanggal & jam pelaksanaan**, maksimal 7 hari ke depan.
--
-- Yang ketiga menuntut kolom baru. Sengaja **bukan** baris `schedules`:
-- `schedules.location_id` NOT NULL dan pemesan tidak memilih lokasi pemotongan,
-- jadi jadwal sungguhan tetap dibuat admin sesudah verifikasi. Kolom di bawah
-- adalah *permintaan* pemesan — bahan admin saat menyusun jadwal, bukan jadwal
-- itu sendiri.
-- =============================================================================

-- --- 1. Cabang default -------------------------------------------------------
--
-- Tanpa pemilih di form, harus ada satu cabang yang menampung order publik.
-- Penandanya kolom, bukan konstanta di kode: begitu cabang bertambah, yang
-- menerima order publik adalah keputusan operasional, bukan keputusan deploy.
alter table public.branches
  add column if not exists is_default boolean not null default false;

comment on column public.branches.is_default is
  'Cabang penampung order dari checkout publik — pemesan tidak lagi memilih wilayah. Admin memindahkannya saat verifikasi bila ternyata bukan wilayah ini.';

-- Paling banyak satu. Tanpa ini "cabang default" bisa berarti dua baris
-- sekaligus, dan `create_guest_order` akan memilih salah satunya diam-diam.
create unique index if not exists branches_single_default_idx
  on public.branches (is_default)
  where is_default;

-- Tandai cabang tertua bila belum ada yang ditandai — supaya checkout tetap
-- jalan pada database yang sudah terisi.
update public.branches b
set is_default = true
where b.id = (
  select b2.id
  from public.branches b2
  where b2.deleted_at is null
  order by b2.created_at, b2.code
  limit 1
)
and not exists (select 1 from public.branches d where d.is_default);

-- --- 2. Tanggal & jam yang diminta pemesan -----------------------------------
alter table public.orders
  add column if not exists requested_date date,
  add column if not exists requested_time time;

comment on column public.orders.requested_date is
  'Tanggal pelaksanaan yang diminta pemesan lewat checkout publik, maksimal 7 hari sejak pemesanan. Bukan jadwal resmi — jadwal ada di `schedules`, dibuat admin setelah verifikasi.';

comment on column public.orders.requested_time is
  'Jam pelaksanaan yang diminta pemesan. Pasangan `requested_date`; keduanya diisi bersama oleh `create_guest_order`.';

-- Batas 7 hari tidak bisa jadi CHECK constraint: acuannya `now()`, sementara
-- CHECK menuntut ekspresi immutable — dan baris lama akan ikut dinilai ulang
-- tiap kali disentuh. Batasnya ditegakkan di `create_guest_order` (di bawah)
-- dan di `guestCheckoutSchema`. Yang bisa dikunci di sini hanya
-- kekonsistenannya: tanggal tanpa jam adalah setengah pemesanan.
alter table public.orders
  drop constraint if exists orders_requested_slot_check;
alter table public.orders
  add constraint orders_requested_slot_check
  check (num_nulls(requested_date, requested_time) <> 1);

-- Admin menyusun jadwal dari daftar permintaan yang jatuh pada satu tanggal.
create index if not exists orders_requested_date_idx
  on public.orders (requested_date)
  where requested_date is not null;

comment on function public.get_public_branches is
  'Cabang aktif — id, nama, kode saja. Sejak 19 Agustus 2026 checkout tidak lagi memakainya (wilayah ditentukan server lewat branches.is_default); disimpan untuk daftar wilayah layanan di halaman publik.';

-- =============================================================================
-- create_guest_order — versi dengan tanggal pemesanan
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
  v_delivery    text := nullif(btrim(coalesce(p_payload ->> 'delivery_address', '')), '');
  v_institution text := nullif(btrim(coalesce(p_payload ->> 'recipient_institution', '')), '');
  v_referral    text := nullif(upper(btrim(coalesce(p_payload ->> 'referral_code', ''))), '');
  v_notes       text := nullif(btrim(coalesce(p_payload ->> 'notes', '')), '');
  v_aqiqah_for  text := nullif(btrim(coalesce(p_payload ->> 'aqiqah_for', '')), '');
  v_mode        text := nullif(btrim(coalesce(p_payload ->> 'distribution_mode', '')), '');
  v_req_date    date;
  v_req_time    time;
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

  -- --- Tahap 1: aqiqah untuk siapa --------------------------------------------
  if v_aqiqah_for is not null and v_aqiqah_for not in ('laki_laki', 'perempuan') then
    raise exception 'Pilihan aqiqah untuk tidak dikenali' using errcode = 'check_violation';
  end if;
  if v_service.type = 'aqiqah' and v_aqiqah_for is null then
    raise exception 'Pilih aqiqah untuk anak laki-laki atau perempuan'
      using errcode = 'check_violation';
  end if;

  -- --- Tahap 3: nasi box sebagai tambahan --------------------------------------
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

  -- --- Tahap 4: jadwal yang diminta --------------------------------------------
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

  -- --- Tahap 5: penyaluran -----------------------------------------------------
  if v_mode is not null and v_mode not in ('salur', 'kirim') then
    raise exception 'Mode penyaluran tidak dikenali' using errcode = 'check_violation';
  end if;
  -- Dikirim tanpa alamat berarti pesanan tidak bisa diantar ke mana pun.
  if v_mode = 'kirim' and v_delivery is null then
    raise exception 'Alamat pengiriman wajib diisi untuk pilihan Aqiqah Kirim'
      using errcode = 'check_violation';
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
    aqiqah_for, distribution_mode, requested_date, requested_time
  )
  values (
    v_participant, v_branch_id, null, v_total, v_notes,
    left(v_referral, 40), v_delivery, left(v_institution, 200),
    v_aqiqah_for, v_mode, v_req_date, v_req_time
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
  'Checkout mandiri (prd.md FR-C2). Harga paket & nasi box dibaca dari services — nilai harga/status/terbayar dari klien diabaikan. Tanggal pelaksanaan dibatasi 7 hari ke depan, jenis hewan dibatasi kambing (sapi hanya untuk qurban), cabang jatuh ke branches.is_default bila tidak dikirim. Order tamu ditandai created_by IS NULL.';

revoke execute on function public.create_guest_order(jsonb) from public;
grant execute on function public.create_guest_order(jsonb) to anon, authenticated;
