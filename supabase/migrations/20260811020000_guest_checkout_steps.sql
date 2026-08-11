-- =============================================================================
-- Checkout mandiri — alur enam tahap
--
-- Menyesuaikan `create_guest_order` dengan alur pemesanan yang diminta:
--   1. Aqiqah untuk (anak laki-laki / perempuan)
--   2. Paket kambing + jumlah ekor
--   3. Nasi box (opsional)
--   4. Penyaluran (disalurkan / dikirim ke pemesan)
--   5. Data pemesan
--   6. Ringkasan & konfirmasi
--
-- Tiga hal yang belum tertampung skema sebelumnya: jenis kelamin anak, mode
-- penyaluran, dan nasi box sebagai tambahan pada paket ibadah. Yang ketiga
-- tidak butuh kolom baru — ia menjadi baris `order_items` kedua, persis seperti
-- item layanan lain.
-- =============================================================================

alter table public.orders
  add column if not exists aqiqah_for        text,
  add column if not exists distribution_mode text;

-- Nilainya dikunci di database, bukan hanya di form: kolom teks bebas akan
-- terisi apa saja begitu ada pemanggil lain (n8n, impor, perbaikan manual).
alter table public.orders
  drop constraint if exists orders_aqiqah_for_check;
alter table public.orders
  add constraint orders_aqiqah_for_check
  check (aqiqah_for is null or aqiqah_for in ('laki_laki', 'perempuan'));

alter table public.orders
  drop constraint if exists orders_distribution_mode_check;
alter table public.orders
  add constraint orders_distribution_mode_check
  check (distribution_mode is null or distribution_mode in ('salur', 'kirim'));

comment on column public.orders.aqiqah_for is
  'Jenis kelamin anak yang diaqiqahi — dasar anjuran jumlah ekor (2 laki-laki, 1 perempuan). NULL untuk order non-aqiqah atau yang dibuat staf.';

comment on column public.orders.distribution_mode is
  '`salur` = daging disalurkan ke penerima manfaat, `kirim` = diantar ke alamat pemesan. Menentukan apakah delivery_address wajib.';

-- =============================================================================
-- create_guest_order — versi enam tahap
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

  -- --- Tahap 4: penyaluran -----------------------------------------------------
  if v_mode is not null and v_mode not in ('salur', 'kirim') then
    raise exception 'Mode penyaluran tidak dikenali' using errcode = 'check_violation';
  end if;
  -- Dikirim tanpa alamat berarti pesanan tidak bisa diantar ke mana pun.
  if v_mode = 'kirim' and v_delivery is null then
    raise exception 'Alamat pengiriman wajib diisi untuk pilihan Aqiqah Kirim'
      using errcode = 'check_violation';
  end if;

  -- --- Cabang -----------------------------------------------------------------
  select b.id into v_branch_id
  from public.branches b
  where b.id = (p_payload ->> 'branch_id')::uuid and b.deleted_at is null;

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

  if v_service.type = 'aqiqah' and v_species = 'sapi' then
    raise exception 'Aqiqah hanya melayani kambing atau domba'
      using errcode = 'check_violation';
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
    aqiqah_for, distribution_mode
  )
  values (
    v_participant, v_branch_id, null, v_total, v_notes,
    left(v_referral, 40), v_delivery, left(v_institution, 200),
    v_aqiqah_for, v_mode
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
  'Checkout mandiri enam tahap (prd.md FR-C2). Harga paket & nasi box dibaca dari services — nilai harga/status/terbayar dari klien diabaikan. Order tamu ditandai created_by IS NULL.';

revoke execute on function public.create_guest_order(jsonb) from public;
grant execute on function public.create_guest_order(jsonb) to anon, authenticated;
