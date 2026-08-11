-- =============================================================================
-- Tahap 10 — Checkout mandiri · RPC pemesanan tamu (prd.md FR-C2 · FR-C3 · FR-C4)
--
-- Pengunjung anonim tidak punya akses tulis apa pun: seluruh kebijakan RLS
-- ditujukan `to authenticated`, dan `anon` hanya di-grant SELECT pada
-- `services`. Checkout mandiri karena itu tidak bisa menulis langsung ke tabel.
--
-- Perbedaan terpenting dari `create_order` (Tahap 4): fungsi itu menerima
-- `unit_price` dari pemanggil, karena pemanggilnya staf yang memang berwenang
-- menetapkan harga. Di sini pemanggilnya orang tak dikenal, jadi **harga
-- selalu dibaca dari tabel `services`** dan apa pun yang dikirim klien soal
-- harga, status, atau jumlah terbayar diabaikan. Tanpa aturan itu, siapa pun
-- bisa memesan seharga nol rupiah — atau langsung berstatus lunas.
-- =============================================================================

-- --- Kolom baru pada orders --------------------------------------------------
--
-- Ketiganya nullable: order yang dibuat staf lewat `create_order` tidak
-- mengisinya, dan baris lama tidak perlu di-backfill.
alter table public.orders
  add column if not exists referral_code         text,
  add column if not exists delivery_address      text,
  add column if not exists recipient_institution text;

comment on column public.orders.referral_code is
  'Kode referral/affiliate yang dibawa saat checkout (prd.md FR-C4). Disimpan apa adanya (huruf besar, tanpa spasi) — tabel affiliate belum ada (FR-AF1), jadi belum bisa divalidasi maupun ditautkan ke pemiliknya.';

comment on column public.orders.delivery_address is
  'Alamat pengiriman hasil olahan; bisa berbeda dari alamat peserta.';

comment on column public.orders.recipient_institution is
  'Instansi/lembaga penerima risalah aqiqah, mis. panti atau masjid.';

-- Order tamu dikenali dari `created_by is null` — tidak ada kolom penanda
-- terpisah supaya tidak ada dua sumber kebenaran yang bisa berbeda.
comment on column public.orders.created_by is
  'Staf pembuat order. NULL berarti order datang dari checkout mandiri (tamu).';

create index if not exists orders_referral_code_idx
  on public.orders (referral_code)
  where referral_code is not null;

-- =============================================================================
-- Daftar cabang untuk pemilih wilayah layanan
-- =============================================================================
--
-- `orders.branch_id` NOT NULL, jadi checkout wajib memilih cabang. `anon` tidak
-- boleh SELECT tabel `branches` — isinya termasuk telepon & alamat internal.
-- Fungsi ini membuka persis tiga kolom yang dibutuhkan pemilih, tidak lebih.
create or replace function public.get_public_branches()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', b.id, 'name', b.name, 'code', b.code)
      order by b.name
    ),
    '[]'::jsonb
  )
  from public.branches b
  where b.deleted_at is null;
$$;

comment on function public.get_public_branches is
  'Cabang aktif untuk pemilih wilayah di checkout publik — id, nama, kode saja.';

revoke execute on function public.get_public_branches() from public;
grant execute on function public.get_public_branches() to anon, authenticated;

-- =============================================================================
-- create_guest_order — satu-satunya jalan tulis bagi pengunjung anonim
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
  v_qty         int  := coalesce((p_payload ->> 'qty')::int, 1);
  v_species     public.animal_species;
  v_on_behalf   text := nullif(btrim(coalesce(p_payload ->> 'on_behalf_of', '')), '');
  v_delivery    text := nullif(btrim(coalesce(p_payload ->> 'delivery_address', '')), '');
  v_institution text := nullif(btrim(coalesce(p_payload ->> 'recipient_institution', '')), '');
  v_referral    text := nullif(upper(btrim(coalesce(p_payload ->> 'referral_code', ''))), '');
  v_notes       text := nullif(btrim(coalesce(p_payload ->> 'notes', '')), '');
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

  -- Nomor telepon adalah satu-satunya cara menghubungi pemesan tamu; tanpa itu
  -- order masuk tanpa ada yang bisa dikonfirmasi.
  if v_phone is null or length(v_phone) < 8 or length(v_phone) > 20 then
    raise exception 'Nomor telepon tidak valid' using errcode = 'check_violation';
  end if;
  if v_phone !~ '^[0-9+()\- ]+$' then
    raise exception 'Nomor telepon hanya boleh berisi angka dan tanda + ( ) -'
      using errcode = 'check_violation';
  end if;

  -- --- Paket: harga & kelayakan diambil dari database -------------------------
  select * into v_service
  from public.services s
  where s.id = (p_payload ->> 'service_id')::uuid
    and s.is_active
    and s.deleted_at is null;

  if not found then
    raise exception 'Paket tidak ditemukan atau sedang tidak tersedia'
      using errcode = 'no_data_found';
  end if;

  -- Checkout mandiri hanya untuk paket ibadah. `nasi_box` adalah tambahan yang
  -- menempel pada paket dan tidak berdiri sendiri sebagai order tamu.
  if v_service.type not in ('aqiqah', 'qurban') then
    raise exception 'Paket ini tidak tersedia untuk pemesanan mandiri'
      using errcode = 'check_violation';
  end if;

  if v_qty < 1 or v_qty > 20 then
    raise exception 'Jumlah pesanan di luar batas yang wajar (1-20)'
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

  -- Qurban sapi lazim dibagi 7 orang, tapi aqiqah tidak memakai sapi. Aturan
  -- ini menjaga data tetap masuk akal sejak pintu masuknya.
  if v_service.type = 'aqiqah' and v_species = 'sapi' then
    raise exception 'Aqiqah hanya melayani kambing atau domba'
      using errcode = 'check_violation';
  end if;

  -- --- Rem kiriman ganda ------------------------------------------------------
  --
  -- Menahan tombol yang tertekan dua kali dan skrip naif. Ini BUKAN pengaman
  -- anti-penyalahgunaan: nomor telepon dikendalikan pemanggil, jadi cukup
  -- diganti-ganti untuk melewatinya. Pembatasan yang sebenarnya harus ada di
  -- tepi (rate limit / captcha) — lihat catatan di ujung berkas.
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
  --
  -- Selalu baris baru: mencocokkan tamu ke peserta yang sudah ada berdasarkan
  -- telepon berarti siapa pun yang menebak nomor orang lain bisa menempelkan
  -- ordernya ke data peserta itu.
  insert into public.participants (name, phone, email, address)
  values (v_name, v_phone, v_email, v_address)
  returning participants.id into v_participant;

  -- --- Order ------------------------------------------------------------------
  --
  -- `status`, `payment_status`, dan `paid_amount` sengaja tidak diambil dari
  -- payload; keduanya jatuh ke default tabel (`new`, `unpaid`, 0). `created_by`
  -- NULL menandai order ini datang dari tamu.
  v_total := v_service.price * v_qty;

  insert into public.orders (
    participant_id, branch_id, created_by, total_amount, notes,
    referral_code, delivery_address, recipient_institution
  )
  values (
    v_participant, v_branch_id, null, v_total, v_notes,
    left(v_referral, 40), v_delivery, left(v_institution, 200)
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

  -- Satu ekor per qty, semuanya atas nama yang sama — hewan berbeda nama
  -- dipisahkan admin saat konfirmasi.
  insert into public.animals (order_id, species, on_behalf_of)
  select v_order_id, v_species, left(v_on_behalf, 150)
  from generate_series(1, v_qty);

  -- Keluarannya dikunci di sini: hanya yang dibutuhkan halaman konfirmasi.
  -- `public_token` ikut agar tamu bisa memantau pesanannya lewat `/r/{token}`
  -- tanpa perlu akun.
  return (
    select jsonb_build_object(
      'order_number',  o.order_number,
      'public_token',  o.public_token,
      'total_amount',  o.total_amount,
      'status',        o.status,
      'payment_status', o.payment_status
    )
    from public.orders o
    where o.id = v_order_id
  );
end;
$$;

comment on function public.create_guest_order is
  'Checkout mandiri tanpa login (prd.md FR-C2). Harga dibaca dari services — nilai harga/status/terbayar dari klien diabaikan. Order tamu ditandai created_by IS NULL.';

-- Fungsi SECURITY DEFINER berjalan sebagai pemiliknya, jadi hak EXECUTE bawaan
-- untuk PUBLIC dicabut dulu dan diberikan secara eksplisit.
revoke execute on function public.create_guest_order(jsonb) from public;
grant execute on function public.create_guest_order(jsonb) to anon, authenticated;

-- =============================================================================
-- Catatan yang belum tertutup oleh migration ini
--
-- 1. Pembatasan laju. Fungsi ini adalah endpoint tulis yang terbuka untuk
--    siapa saja. Rem berbasis nomor telepon di atas hanya menahan kiriman
--    ganda; penyerang cukup mengganti nomor. Perlindungan sebenarnya harus
--    dipasang di tepi — rate limit per IP di middleware/WAF, atau captcha.
-- 2. Kode referral belum tervalidasi. Tabel affiliate (FR-AF1) belum ada, jadi
--    kode disimpan apa adanya untuk ditautkan menyusul.
-- =============================================================================
