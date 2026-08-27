-- =============================================================================
-- `animals.status` dibuang — angkanya diturunkan dari order_stage_events
--
-- Kolom ini adalah sumber kebenaran kedua yang tidak pernah tersambung ke
-- rantai pelaksanaan. Satu-satunya penulisnya adalah dropdown manual di
-- `features/orders/components/animal-manager.tsx` lewat `updateAnimalStatus()`:
-- tidak ada trigger, tidak ada RPC, tidak ada satu pun jalur yang menggesernya
-- ketika tahap benar-benar dilaporkan dan divalidasi.
--
-- Akibatnya dua arah, dan keduanya sampai ke layar pemesan lewat
-- `/r/{token}` dan PDF laporan:
--
--   1. Diam-diam nol. Vendor menempuh seluruh tahap dengan benar, tiap tahap
--      berbukti dan tervalidasi, order sampai `completed` — laporan tetap
--      mencetak "0/3 ekor dipotong". `tests/integration/full-flow.test.ts`
--      menempuh persis jalur itu tanpa pernah menyentuh status hewan, dan
--      hijau: perbedaannya nyata, bukan dugaan.
--
--   2. Atau benar sejak hari pertama tanpa satu pun bukti. Admin memilih
--      `distributed` di dropdown pada hari order masuk, dan laporan mencetak
--      "3/3 ekor tersalurkan" — melewati `enforce_stage_order`,
--      `enforce_stage_review`, gerbang kelengkapan bukti, dan pemisahan tugas
--      sekaligus. Seluruh gerbang yang dibangun 20–24 Agustus tidak menyentuh
--      kolom ini.
--
-- Kebenarannya sudah ada, dengan bentuk yang lebih baik. `generate_stage_checklist`
-- menerbitkan baris `sembelih` **satu per ekor** lengkap dengan `animal_id`,
-- dan baris itu wajib berbukti serta wajib divalidasi sebelum berstatus
-- `validated`. Jadi angka yang sama dapat diturunkan dari sana:
--
--   animals_slaughtered : baris `sembelih` yang `validated`, dihitung per ekor
--   animals_distributed : tahap penutup (`salur`/`terkirim`) `validated`
--                         → seluruh ekor; daging satu order disalurkan
--                         bersama, tidak per ekor
--
-- Dikunci ke `validated`, bukan `reported`, mengikuti gerbang yang sudah
-- berlaku di `enforce_stage_order`: yang dilaporkan vendor belum tentu benar
-- sampai admin memeriksanya, dan angka yang dicetak ke pemesan tidak boleh
-- mendahului pemeriksaan itu.
--
-- Kolomnya di-DROP, bukan dibiarkan mati. Kolom yang tinggal tapi tidak lagi
-- dibaca adalah undangan bagi kode berikutnya untuk mempercayainya lagi.
--
-- `animal_status` sebagai TYPE ikut dibuang: sesudah kolomnya hilang tidak ada
-- lagi yang memakainya. `registered`/`prepared` tidak punya padanan di
-- `fulfilment_stage` dan memang tidak perlu — "terdaftar" adalah keberadaan
-- barisnya sendiri, dan "disiapkan" sudah jadi tahap `persiapan` per order.
-- =============================================================================

-- --- v_open_orders & v_order_progress disusun ulang --------------------------
--
-- Keduanya di-drop lebih dulu: `v_open_orders` membaca `v_order_progress`,
-- dan Postgres menolak mengubah view yang masih dirujuk view lain.
drop view if exists public.v_open_orders;
drop view if exists public.v_order_progress;

create view public.v_order_progress
with (security_invoker = on) as
select
  o.id           as order_id,
  o.order_number,
  o.vendor_id,
  o.participant_id,
  o.status,
  o.payment_status,
  o.distribution_mode,
  o.total_amount,
  o.paid_amount,
  o.created_at,

  an.animals_total,
  an.animals_slaughtered,
  an.animals_distributed,

  st.stages_in_sequence,
  st.stages_total,
  st.stages_pending,
  st.stages_reported,
  st.stages_validated,
  st.stages_rejected,
  st.pct_stage,
  st.current_stage,

  dc.docs_total,
  dc.docs_approved,
  dc.docs_pending_review,
  case
    when dc.docs_total = 0 then 0
    else round(dc.docs_approved::numeric * 100 / dc.docs_total, 2)
  end as pct_documentation,

  -- Gerbang kelengkapan bukti, dihitung dari `stage_requirements` — satu sumber
  -- kebenaran, jadi menambah tahap baru tidak menyentuh satu baris TypeScript
  -- pun. Nilainya: daftar tahap yang buktinya masih kurang.
  (
    select coalesce(array_agg(r.stage::text order by r.stage), '{}')
    from public.stage_requirements r
    where r.min_docs > 0
      and r.stage = any (public.fulfilment_sequence(o.distribution_mode))
      and (
        select count(*) from public.documentations d
        where d.order_id = o.id and d.status = 'approved' and d.stage::text = r.stage::text
      ) < r.min_docs
  ) as missing_doc_stages,

  rp.report_count,
  rp.report_sent_at,
  (rp.report_count > 0)           as report_generated,
  (rp.report_sent_at is not null) as report_sent,
  o.delivery_confirmed_at,
  (o.delivery_confirmed_at is not null) as delivery_confirmed,

  iss.open_issues,
  iss.max_open_severity
from public.orders o
left join lateral (
  select
    (select count(*) from public.animals a where a.order_id = o.id) as animals_total,

    -- Dihitung dari tahap, bukan dari kolom status pada baris hewan.
    --
    -- Tidak perlu berkorelasi ke `animals`: `sembelih` sudah terbit **satu
    -- baris per ekor** (`generate_stage_checklist`), jadi mencacah baris yang
    -- tervalidasi sama saja dengan mencacah ekor yang sudah dipotong. Ekor yang
    -- barisnya belum divalidasi tidak ikut terhitung, dan itulah gunanya: angka
    -- ini menyusul pelaksanaan, tidak mendahuluinya.
    (
      select count(*)
      from public.order_stage_events e
      where e.order_id = o.id
        and e.stage = 'sembelih'
        and e.status = 'validated'
    ) as animals_slaughtered,

    -- Penyaluran tidak per ekor: daging satu order dimasak dan disalurkan
    -- bersama. Jadi begitu tahap penutup tervalidasi, seluruh ekor terhitung —
    -- 0 atau `animals_total`, tidak ada di antaranya.
    --
    -- Tahap penutupnya berbeda menurut mode: `salur` selesai di `salur`,
    -- sedangkan `kirim` baru selesai di `terkirim` (`kirim` hanya berarti
    -- berangkat). Memakai `kirim` di sini akan mencetak "tersalurkan" kepada
    -- pemesan yang paketnya masih di jalan.
    case when exists (
      select 1
      from public.order_stage_events e
      where e.order_id = o.id
        and e.stage = (case o.distribution_mode
                         when 'salur' then 'salur' else 'terkirim'
                       end)::public.fulfilment_stage
        and e.status = 'validated'
    ) then (select count(*) from public.animals a where a.order_id = o.id)
    else 0 end as animals_distributed
) an on true
left join public.v_order_stages st on st.order_id = o.id
left join lateral (
  select
    count(*)                                    as docs_total,
    count(*) filter (where d.status = 'approved') as docs_approved,
    count(*) filter (where d.status = 'pending')  as docs_pending_review
  from public.documentations d where d.order_id = o.id
) dc on true
left join lateral (
  select count(*) as report_count, max(r.sent_at) as report_sent_at
  from public.reports r where r.order_id = o.id
) rp on true
left join lateral (
  select
    count(*) as open_issues,
    max(i.severity::text) as max_open_severity
  from public.issues i
  where i.order_id = o.id and i.status in ('open', 'in_progress')
) iss on true
where o.deleted_at is null;

comment on view public.v_order_progress is
  'Progres per order. animals_slaughtered & animals_distributed diturunkan dari order_stage_events yang tervalidasi — tidak ada kolom status di animals yang bisa diklik jadi benar.';

-- --- v_open_orders: disusun ulang apa adanya --------------------------------
--
-- Definisinya tidak berubah; ia hanya perlu dibuat ulang sesudah view yang
-- dirujuknya diganti.
create view public.v_open_orders
with (security_invoker = on) as
select
  o.id as order_id,
  o.order_number,
  o.status,
  o.payment_status,
  o.distribution_mode,
  o.total_amount,
  o.paid_amount,
  o.created_at,
  o.requested_date,
  o.requested_time,
  (o.created_by is null)                                 as is_guest_order,
  (o.created_by is null and o.guest_verified_at is null) as needs_verification,

  p.name  as participant_name,
  p.phone as participant_phone,

  v.id   as vendor_id,
  v.name as vendor_name,
  v.phone as vendor_phone,

  l.name as location_name,
  s.scheduled_date,
  s.scheduled_time,

  pr.current_stage,
  pr.pct_stage,
  pr.stages_total,
  pr.stages_validated,
  pr.stages_rejected,
  pr.missing_doc_stages,
  pr.animals_total,
  pr.animals_slaughtered,
  pr.pct_documentation,
  pr.docs_pending_review,
  pr.open_issues,
  pr.max_open_severity::public.issue_severity as max_open_severity,
  -- Kendala terbaru yang masih terbuka: dipakai kolom "apa kendalanya" pada
  -- tabel litmus test, supaya operator tidak perlu membuka detail order dulu.
  (
    select i.title from public.issues i
    where i.order_id = o.id and i.status in ('open', 'in_progress')
    order by
      case i.severity when 'high' then 1 when 'medium' then 2 else 3 end,
      i.created_at desc
    limit 1
  ) as latest_issue_title,

  extract(epoch from (now() - o.created_at)) / 3600 as age_hours,
  -- Umur dalam hari, dibulatkan ke bawah. Disediakan view karena dipakai
  -- pengurutan **dan** tampilan; menghitungnya di dua tempat berarti keduanya
  -- bisa berbeda untuk baris yang sama.
  floor(extract(epoch from (now() - o.created_at)) / 86400)::int as age_days
from public.orders o
join public.participants p on p.id = o.participant_id
left join public.vendors v on v.id = o.vendor_id
left join public.schedules s on s.order_id = o.id
left join public.locations l on l.id = s.location_id
left join public.v_order_progress pr on pr.order_id = o.id
where o.deleted_at is null
  and o.status not in ('completed', 'cancelled')
order by
  -- Terurut keparahan lalu umur: yang berkendala berat dan sudah lama menunggu
  -- naik ke atas.
  case pr.max_open_severity when 'high' then 1 when 'medium' then 2 when 'low' then 3 else 4 end,
  o.created_at;

-- --- Kolom & type dibuang ---------------------------------------------------
--
-- `get_public_report` menyebut `a.status` pada blok `animals`; ia di-replace di
-- bawah, sesudah kolomnya hilang. Urutannya penting: `create or replace
-- function` tidak memeriksa isi badan plpgsql, tapi DROP COLUMN akan gagal bila
-- ada view yang bergantung — dan fungsi bukan view, jadi keduanya aman selama
-- fungsinya diperbarui dalam migration yang sama.
alter table public.animals drop column status;

drop type public.animal_status;

-- --- Penjaga hapus hewan pindah ke database ---------------------------------
--
-- `deleteAnimal()` dulu menolak menghapus hewan yang statusnya bukan
-- `registered` — bukti pelaksanaan tidak boleh ikut terhapus. Kolom itu kini
-- tidak ada, tapi kebutuhannya tetap, dan sesungguhnya lebih mendesak daripada
-- yang terlihat: `order_stage_events.animal_id` ber-`on delete cascade`, jadi
-- menghapus satu ekor **ikut menghapus baris tahap `sembelih` miliknya**.
-- Setelah itu `stages_total` menyusut, dan order bisa lolos gerbang
-- `in_progress → validation` karena tahap yang belum dikerjakan sudah lenyap
-- bersama hewannya.
--
-- Diletakkan sebagai trigger, bukan pemeriksaan di server action, karena dua
-- alasan yang sama-sama nyata: pemeriksaan lalu-hapus di aplikasi menyisakan
-- celah TOCTOU (tahap bisa dilaporkan di antara SELECT dan DELETE), dan jalur
-- hapus berikutnya — RPC, worker, atau perbaikan manual — tidak perlu ingat
-- memanggilnya.
--
-- Yang masih boleh dihapus: ekor yang seluruh tahapnya `pending`, yakni salah
-- daftar sebelum ada yang mengerjakannya. Begitu satu tahap dilaporkan, ekor
-- itu sudah punya jejak.
create or replace function public.enforce_animal_delete()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.order_stage_events e
    where e.animal_id = old.id and e.status <> 'pending'
  ) then
    raise exception 'Hewan yang tahapnya sudah dilaporkan tidak dapat dihapus.'
      using errcode = 'check_violation';
  end if;

  return old;
end $$;

create trigger enforce_animal_delete_before
  before delete on public.animals
  for each row execute function public.enforce_animal_delete();

-- --- get_public_report: `status` dilepas dari blok animals -------------------
--
-- Hanya baris `'status', a.status` yang hilang. Blok `progress` tidak berubah
-- sedikit pun — ia membaca `v_order_progress`, jadi angkanya ikut membaik
-- sendiri tanpa satu baris pun disentuh di sini. Itu sebabnya angka laporan
-- publik dibaca dari view sejak 21 Agustus, bukan dihitung ulang di dalam RPC.
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
    -- `status` per ekor dilepas: kemajuan pelaksanaan diceritakan blok `stages`
    -- dan diringkas blok `progress`, keduanya dari tahap yang tervalidasi.
    'animals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'species', a.species, 'tag_code', a.tag_code,
        'on_behalf_of', a.on_behalf_of) order by a.tag_code)
      from public.animals a where a.order_id = v_order.id
    ), '[]'::jsonb),
    -- Ringkasan angka pelaksanaan.
    --
    -- Penyebutnya `stages_total` (jumlah BARIS tahap), bukan `stages_in_sequence`
    -- (jumlah tahap dalam rangkaian mode). Keduanya sengaja berbeda dan tidak
    -- boleh dicampur: tahap `sembelih` terbit satu baris per ekor, jadi order
    -- 3 ekor bermode `kirim` punya 7 baris untuk 5 tahap. Memakai
    -- `stages_in_sequence` sebagai penyebut sementara `stages_validated`
    -- menghitung baris akan mencetak "7/5 tahap".
    --
    -- Tahap terbit sekaligus saat mitra ditugaskan (`generate_stage_checklist`),
    -- jadi tidak ada keadaan "sebagian terbit" yang membuat penyebut ini
    -- menyesatkan — ia 0 sebelum penugasan, dan lengkap sesudahnya.
    'progress', (
      select jsonb_build_object(
        'animals_total',       coalesce(pr.animals_total, 0),
        'animals_slaughtered', coalesce(pr.animals_slaughtered, 0),
        'animals_distributed', coalesce(pr.animals_distributed, 0),
        'stages_total',        coalesce(pr.stages_total, 0),
        'stages_validated',    coalesce(pr.stages_validated, 0)
      )
      from public.v_order_progress pr where pr.order_id = v_order.id
    ),
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
  'Payload halaman laporan publik /r/{token} — satu order, dokumentasi approved saja, tanpa kontak peserta. Blok progress dibaca dari v_order_progress agar angkanya sama dengan laporan internal.';

grant execute on function public.get_public_report(text) to anon, authenticated;
