-- =============================================================================
-- Desain ulang skema · 07 View KPI
-- v_order_stages, v_order_progress, v_vendor_kpi, v_open_orders
--
-- Semua view memakai `security_invoker = on` supaya RLS pemanggil tetap
-- berlaku — tanpa itu view berjalan dengan hak pemiliknya dan vendor bisa
-- melihat order mitra lain lewat pintu belakang.
--
-- `v_branch_kpi` diganti `v_vendor_kpi`. Ini peningkatan, bukan sekadar
-- penggantian nama: dengan satu tempat operasi dan banyak mitra, pertanyaan
-- yang berguna adalah "mitra mana yang lambat, mana yang paling sering
-- buktinya ditolak" — bukan "cabang mana yang tertinggal".
-- =============================================================================

-- --- v_order_stages: ringkasan tahap per order ------------------------------
create view public.v_order_stages
with (security_invoker = on) as
select
  o.id as order_id,
  o.distribution_mode,
  -- Tahap yang seharusnya ada menurut mode order.
  coalesce(array_length(public.fulfilment_sequence(o.distribution_mode), 1), 0) as stages_in_sequence,
  count(e.id)                                          as stages_total,
  count(*) filter (where e.status = 'pending')         as stages_pending,
  count(*) filter (where e.status = 'reported')        as stages_reported,
  count(*) filter (where e.status = 'validated')       as stages_validated,
  count(*) filter (where e.status = 'rejected')        as stages_rejected,
  case
    when count(e.id) = 0 then 0
    else round(count(*) filter (where e.status = 'validated')::numeric * 100 / count(e.id), 2)
  end as pct_stage,
  -- Tahap yang sedang dikerjakan: yang paling awal belum tervalidasi.
  (
    select e2.stage from public.order_stage_events e2
    where e2.order_id = o.id and e2.status <> 'validated'
    order by e2.seq, e2.created_at
    limit 1
  ) as current_stage,
  min(e.reported_at)  as first_reported_at,
  max(e.validated_at) as last_validated_at
from public.orders o
left join public.order_stage_events e on e.order_id = o.id
group by o.id, o.distribution_mode;

comment on view public.v_order_stages is
  'Ringkasan tahap per order. current_stage = tahap paling awal yang belum tervalidasi.';

-- --- v_order_progress -------------------------------------------------------
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
    count(*)                                        as animals_total,
    count(*) filter (where a.status = 'slaughtered'
                        or a.status = 'distributed') as animals_slaughtered,
    count(*) filter (where a.status = 'distributed') as animals_distributed
  from public.animals a where a.order_id = o.id
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

-- --- v_vendor_kpi -----------------------------------------------------------
--
-- Menggantikan v_branch_kpi. Yang diukur kini kinerja mitra: berapa order,
-- berapa yang berjalan, berapa lama siklusnya, dan seberapa sering buktinya
-- ditolak — angka terakhir itu yang paling sulit didapat sebelumnya.
create view public.v_vendor_kpi
with (security_invoker = on) as
select
  v.id   as vendor_id,
  v.code as vendor_code,
  v.name as vendor_name,
  v.is_active,
  count(o.id)                                            as orders_total,
  count(*) filter (where o.status not in ('completed', 'cancelled')) as orders_open,
  count(*) filter (where o.status = 'completed')         as orders_completed,
  count(*) filter (where o.status = 'on_hold')           as orders_on_hold,
  coalesce(sum(o.total_amount), 0)                       as revenue_total,
  coalesce(sum(oi.vendor_cost), 0)                       as vendor_cost_total,
  coalesce(sum(o.total_amount), 0) - coalesce(sum(oi.vendor_cost), 0) as margin_total,
  round(avg(
    extract(epoch from (p.last_validated_at - o.created_at)) / 3600
  )::numeric, 1)                                         as avg_cycle_hours,
  count(*) filter (where p.stages_rejected > 0)          as orders_with_rejection
from public.vendors v
left join public.orders o
  on o.vendor_id = v.id and o.deleted_at is null
left join public.v_order_stages p on p.order_id = o.id
left join lateral (
  select coalesce(sum(i.qty * coalesce(i.vendor_unit_price, 0)), 0) as vendor_cost
  from public.order_items i where i.order_id = o.id
) oi on true
where v.deleted_at is null
group by v.id, v.code, v.name, v.is_active;

comment on view public.v_vendor_kpi is
  'KPI per mitra. margin_total = tagihan pembeli dikurangi modal yang tercatat pada order_items.vendor_unit_price.';

-- --- v_open_orders: jawaban litmus test -------------------------------------
--
-- "Berapa order yang belum selesai, di lokasi mana, siapa PIC-nya, apa
-- kendalanya?" — harus terjawab < 10 detik. Kini PIC-nya adalah mitra, dan
-- kolom `current_stage` menjawab "sedang di tahap apa" yang dulu hanya bisa
-- ditebak dari status order.
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
  pr.stages_rejected,
  pr.missing_doc_stages,
  pr.open_issues,
  pr.max_open_severity,

  extract(epoch from (now() - o.created_at)) / 3600 as age_hours
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
