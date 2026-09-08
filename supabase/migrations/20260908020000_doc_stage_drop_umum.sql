-- =============================================================================
-- `umum` dicabut dari `doc_stage`
--
-- Tiap bukti kini menempel pada satu laporan tahap. `fulfilment_stage` tidak
-- punya nilai `umum`, dan trigger `enforce_documentation_stage_match` menuntut
-- `documentations.stage` sama dengan tahap laporan yang dirujuknya — jadi
-- begitu `stage_event_id` wajib, nilai `umum` tidak akan pernah bisa lolos.
-- Membiarkannya di enum berarti membiarkan TypeScript terus menawarkannya
-- sebagai pilihan yang sah, dan itu keliru dua kali: di layar ia tampak boleh,
-- di database ia pasti ditolak.
--
-- Konsekuensi yang diterima, bukan efek samping: bukti tidak bisa lagi
-- diunggah sebelum mitra ditugaskan, sebab baris tahap baru terbit di situ.
-- Jalur "admin mengunggah bukti umum lebih awal" ditutup dengan sadar.
--
-- Produksi diperiksa sebelum migration ini ditulis: **nol baris**
-- `documentations`, dan seed tidak menyisipkannya sama sekali.
--
-- Postgres tidak bisa membuang satu nilai dari enum, jadi polanya
-- rename-lama → buat-baru → cast → buang-lama. Yang menyulitkan: kolomnya
-- dibaca `v_order_progress` (diperiksa lewat `pg_depend` — hanya view itu),
-- dan `ALTER COLUMN … TYPE` menolak selama masih ada view yang merujuknya.
-- Karena itu kedua view di-drop lebih dulu lalu disusun ulang **apa adanya**
-- di bawah. Tidak ada satu pun perubahan logika pada `missing_doc_stages`.
-- =============================================================================

-- Baris warisan di mesin dev: tidak ada padanan tahapnya, jadi dibuang — bukan
-- ditebak ke tahap mana pun. Di produksi tidak ada yang tersentuh.
delete from public.documentations where stage = 'umum';

-- `v_open_orders` membaca `v_order_progress`, jadi urutannya harus begini.
drop view if exists public.v_open_orders;
drop view if exists public.v_order_progress;

alter type public.doc_stage rename to doc_stage_old;

create type public.doc_stage as enum (
  'persiapan', 'sembelih', 'masak', 'salur', 'kirim', 'terkirim'
);

-- DEFAULT dibuang lebih dulu — nilainya `umum` dan bertipe lama, jadi ia
-- menghalangi ALTER COLUMN. Sengaja **tidak** diganti default baru: tahap
-- sebuah bukti tidak punya nilai yang wajar untuk ditebak, ia diturunkan dari
-- laporan tahap yang dibuktikannya.
alter table public.documentations
  alter column stage drop default,
  alter column stage type public.doc_stage using stage::text::public.doc_stage;

drop type public.doc_stage_old;

comment on column public.documentations.stage is
  'Tahap yang dibuktikan. Diturunkan server dari order_stage_events, bukan dikirim klien; trigger enforce_documentation_stage_match menegakkannya.';

-- --- Kedua view disusun ulang apa adanya ------------------------------------
--
-- Salinan verbatim dari `20260827010000_drop_animal_status.sql`, kecuali satu
-- hal yang memang sudah diperbaiki di `20260908010000`: join ke `participants`
-- pada `v_open_orders` tetap `left join`, supaya order milik mitra tidak
-- lenyap dari dashboardnya.

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

  -- Tidak berubah sedikit pun: gerbang tetap dihitung per TAHAP, bukan per
  -- baris tahap. Order dua ekor punya dua baris `sembelih`, dan satu bukti
  -- tervalidasi sudah melepasnya — itu perilaku yang sengaja dipertahankan.
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
    (
      select count(*)
      from public.order_stage_events e
      where e.order_id = o.id
        and e.stage = 'sembelih'
        and e.status = 'validated'
    ) as animals_slaughtered,
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
    count(*)                                      as docs_total,
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
  (
    select i.title from public.issues i
    where i.order_id = o.id and i.status in ('open', 'in_progress')
    order by
      case i.severity when 'high' then 1 when 'medium' then 2 else 3 end,
      i.created_at desc
    limit 1
  ) as latest_issue_title,

  extract(epoch from (now() - o.created_at)) / 3600 as age_hours,
  floor(extract(epoch from (now() - o.created_at)) / 86400)::int as age_days
from public.orders o
left join public.participants p on p.id = o.participant_id
left join public.vendors v on v.id = o.vendor_id
left join public.schedules s on s.order_id = o.id
left join public.locations l on l.id = s.location_id
left join public.v_order_progress pr on pr.order_id = o.id
where o.deleted_at is null
  and o.status not in ('completed', 'cancelled')
order by
  case pr.max_open_severity when 'high' then 1 when 'medium' then 2 when 'low' then 3 else 4 end,
  o.created_at;

comment on view public.v_open_orders is
  'Order belum selesai. LEFT JOIN ke participants: nama peserta tertutup bagi mitra lewat RLS, tetapi ordernya sendiri harus tetap terbaca.';

grant select on public.v_order_progress to authenticated;
grant select on public.v_open_orders to authenticated;
