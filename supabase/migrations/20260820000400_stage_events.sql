-- =============================================================================
-- Desain ulang skema · 04 Pelaporan tahap oleh vendor
--
-- Inilah yang selama ini tidak ada. Sebelumnya `distribution_mode` hanya label
-- pada order: divalidasi di checkout untuk menentukan wajib-tidaknya alamat,
-- ditampilkan sekali di panel, lalu diabaikan. Kedua mode melewati rantai yang
-- persis sama, tidak ada tahap memasak, dan tidak ada konfirmasi terkirim.
--
-- `slaughter_records` + `distributions` **diganti** satu tabel kejadian.
-- Alasannya: keduanya merekam hal yang sama (satu kejadian lapangan — siapa,
-- kapan, bukti apa) dengan bentuk berbeda dan kunci berbeda (satu per hewan,
-- satu per order). Menambah masak/kirim/terkirim dengan pola lama berarti lima
-- tabel, lima kebijakan RLS, lima server action, dan lima bentuk di view KPI.
--
-- Satu lagi yang diperbaiki: `distributions.recipient_area` diketik ulang oleh
-- vendor padahal alamat terstruktur pembeli sudah tersimpan di `orders`. Pada
-- tahap `kirim`, vendor tidak lagi mengetik alamat — ia **membaca** alamat
-- order.
-- =============================================================================

-- --- Urutan tahap: satu sumber kebenaran ------------------------------------
--
-- Fungsi ini yang menentukan percabangannya. Dicerminkan di
-- `features/stages/sequence.ts` untuk dipakai UI, dan ada tes yang menuntut
-- keduanya identik — kembaran seperti ini yang paling gampang menyimpang
-- diam-diam.
create or replace function public.fulfilment_sequence(p_mode public.distribution_mode)
returns public.fulfilment_stage[]
language sql immutable as $$
  select case p_mode
    when 'salur' then array['persiapan','sembelih','masak','salur']::public.fulfilment_stage[]
    when 'kirim' then array['persiapan','sembelih','masak','kirim','terkirim']::public.fulfilment_stage[]
  end;
$$;

comment on function public.fulfilment_sequence is
  'Urutan tahap menurut cara penyaluran. Kembarannya di features/stages/sequence.ts; keduanya diuji harus sama persis.';

-- --- order_stage_events -----------------------------------------------------
create table public.order_stage_events (
  id        uuid primary key default gen_random_uuid(),
  order_id  uuid not null references public.orders (id) on delete cascade,
  stage     public.fulfilment_stage not null,
  -- Urutan tahap dalam rangkaian ordernya. Dipakai gerbang di bawah untuk tahu
  -- tahap mana yang mendahului tanpa perlu tahu modenya.
  seq       smallint not null,
  -- Hanya untuk `sembelih`: pemotongan dicatat per ekor, tahap lain per order.
  animal_id uuid references public.animals (id) on delete cascade,
  status    public.stage_event_status not null default 'pending',

  reported_by uuid references public.profiles (id) on delete set null,
  reported_at timestamptz,
  occurred_at timestamptz,
  notes       text,

  -- Rincian yang hanya berarti pada sebagian tahap.
  packages_count  int,
  recipient_name  text,
  recipient_phone text,
  recipient_area  text,
  weight_kg       numeric(6, 2),
  lat numeric(9, 6),
  lng numeric(9, 6),
  meta jsonb not null default '{}'::jsonb,

  validated_by uuid references public.profiles (id) on delete set null,
  validated_at timestamptz,
  review_note  text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint stage_events_animal_only_sembelih_check check (
    stage = 'sembelih' or animal_id is null
  ),
  constraint stage_events_reported_consistency_check check (
    (status = 'pending' and reported_at is null)
    or (status <> 'pending' and reported_at is not null)
  ),
  constraint stage_events_validated_consistency_check check (
    (status = 'validated' and validated_at is not null)
    or (status <> 'validated' and validated_at is null)
  ),
  -- Penolakan tanpa alasan tidak bisa ditindaklanjuti vendor.
  constraint stage_events_reject_reason_check check (
    status <> 'rejected' or review_note is not null
  ),
  constraint stage_events_packages_check check (
    packages_count is null or packages_count >= 0
  ),
  constraint stage_events_geo_check check (
    (lat is null and lng is null)
    or (lat between -90 and 90 and lng between -180 and 180)
  )
);

comment on table public.order_stage_events is
  'Laporan tahap dari vendor. Baris terbit otomatis berstatus pending saat mitra ditugaskan — vendor mengisi tahap yang sudah menunggu, bukan membuat tahap baru.';
comment on column public.order_stage_events.recipient_area is
  'Hanya untuk tahap salur. Pada tahap kirim, alamat dibaca dari orders.delivery_* — vendor tidak mengetik ulang alamat pembeli.';

-- Tahap yang hanya boleh sekali per order.
create unique index stage_events_singleton_idx
  on public.order_stage_events (order_id, stage)
  where stage in ('persiapan', 'masak', 'kirim', 'terkirim');

-- Sembelih: satu baris per ekor.
create unique index stage_events_sembelih_idx
  on public.order_stage_events (order_id, animal_id)
  where stage = 'sembelih';

-- `salur` sengaja TANPA batasan unik: satu order bisa disalurkan ke banyak
-- titik penerima, persis seperti tabel `distributions` yang digantikannya.

create index stage_events_order_stage_idx on public.order_stage_events (order_id, stage, status);
create index stage_events_pending_review_idx on public.order_stage_events (reported_at)
  where status = 'reported';

create trigger set_order_stage_events_updated_at
  before update on public.order_stage_events
  for each row execute function public.set_updated_at();

-- --- Daftar tahap terbit otomatis saat mitra ditugaskan ---------------------
--
-- Vendor tidak pernah membuat tahap; ia mengisi yang sudah menunggu. Itu yang
-- membedakan daftar kerja dari formulir kosong — dan sekaligus mencegah vendor
-- mengarang tahap yang tidak ada dalam rangkaian modenya.
create or replace function public.generate_stage_checklist()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_stages public.fulfilment_stage[];
  v_stage  public.fulfilment_stage;
  v_seq    smallint := 0;
begin
  if new.status <> 'assigned' or coalesce(old.status, 'new') = 'assigned' then
    return new;
  end if;

  if new.distribution_mode is null then
    raise exception 'Cara penyaluran belum ditentukan — tahap tidak bisa disusun.'
      using errcode = 'check_violation';
  end if;

  v_stages := public.fulfilment_sequence(new.distribution_mode);

  foreach v_stage in array v_stages loop
    v_seq := v_seq + 1;

    if v_stage = 'sembelih' then
      -- Satu baris per ekor: pemotongan memang dikerjakan per hewan.
      insert into public.order_stage_events (order_id, stage, seq, animal_id)
      select new.id, v_stage, v_seq, a.id
      from public.animals a
      where a.order_id = new.id
      on conflict do nothing;
    else
      insert into public.order_stage_events (order_id, stage, seq)
      values (new.id, v_stage, v_seq)
      on conflict do nothing;
    end if;
  end loop;

  return new;
end $$;

create trigger generate_stage_checklist_on_assign
  after update of status on public.orders
  for each row execute function public.generate_stage_checklist();

-- --- Urutan tahap ditegakkan di database ------------------------------------
--
-- Tahap ke-N tertutup sampai seluruh tahap sebelumnya **tervalidasi**. Baris
-- `sembelih` berbagi satu `seq`, jadi antar-ekor tetap bisa paralel.
--
-- Gerbangnya sengaja di `validated`, bukan `reported`: bukti sembelih harus
-- disetujui admin sebelum vendor boleh melapor masak. Konsekuensinya nyata —
-- admin jadi penghambat di tiap tahap. Kalau lapangan mengeluh, longgarkan ke
-- `status in ('reported','validated')`; satu baris. Mulai ketat lebih murah
-- daripada mengetatkan setelah orang terlanjur terbiasa longgar.
create or replace function public.enforce_stage_order()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_blocking text;
begin
  if new.status = 'pending' or new.status = old.status then
    return new;
  end if;

  select string_agg(distinct e.stage::text, ', ')
  into v_blocking
  from public.order_stage_events e
  where e.order_id = new.order_id
    and e.seq < new.seq
    and e.status <> 'validated';

  if v_blocking is not null then
    raise exception 'Tahap sebelumnya belum tervalidasi: %', v_blocking
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

create trigger enforce_stage_order_before_update
  before update on public.order_stage_events
  for each row execute function public.enforce_stage_order();

-- --- Pemisahan tugas --------------------------------------------------------
--
-- Yang mengerjakan tidak boleh menyatakan pekerjaannya benar. Berlaku juga bagi
-- admin yang kebetulan ikut melapor.
create or replace function public.enforce_stage_review()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid();
begin
  if new.status not in ('validated', 'rejected') or old.status = new.status then
    return new;
  end if;

  if new.reported_by is not null and new.reported_by = v_actor then
    raise exception 'Pelapor tidak boleh memvalidasi laporannya sendiri.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Validator diturunkan dari sesi, tidak pernah dipercaya dari klien.
  new.validated_by := v_actor;
  new.validated_at := case when new.status = 'validated' then now() else null end;

  return new;
end $$;

create trigger enforce_stage_review_before_update
  before update on public.order_stage_events
  for each row execute function public.enforce_stage_review();
