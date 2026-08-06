-- =============================================================================
-- Tahap 1 — Database · 06 Views KPI
-- v_order_progress, v_branch_kpi, v_open_orders
-- Acuan: docs/05_DATABASE_DESIGN.md section 7, docs/09_DASHBOARD_SPEC.md section 2 & 9
--
-- Semua view memakai security_invoker = on supaya RLS pemanggil tetap berlaku
-- (tanpa ini view berjalan dengan hak pemilik dan membocorkan data lintas cabang).
-- =============================================================================

-- --- v_order_progress: agregat progres per order ----------------------------
create view public.v_order_progress
with (security_invoker = on) as
select
  o.id             as order_id,
  o.order_number,
  o.branch_id,
  o.participant_id,
  o.status,
  o.payment_status,
  o.total_amount,
  o.paid_amount,
  o.created_at,
  an.animals_total,
  an.animals_slaughtered,
  an.animals_distributed,
  case
    when an.animals_total = 0 then 0
    else round(an.animals_slaughtered::numeric * 100 / an.animals_total, 2)
  end              as pct_slaughter,
  case
    when an.animals_total = 0 then 0
    else round(an.animals_distributed::numeric * 100 / an.animals_total, 2)
  end              as pct_distribution,
  dc.docs_total,
  dc.docs_approved,
  dc.docs_pending_review,
  case
    when dc.docs_total = 0 then 0
    else round(dc.docs_approved::numeric * 100 / dc.docs_total, 2)
  end              as pct_documentation,
  (dc.docs_approved > 0) as documentation_ready,
  ds.distribution_count,
  ds.packages_total,
  rp.report_count,
  rp.report_sent_at,
  (rp.report_count > 0)         as report_generated,
  (rp.report_sent_at is not null) as report_sent,
  iss.open_issues,
  iss.max_open_severity
from public.orders o
cross join lateral (
  select
    count(*)::int                                                            as animals_total,
    count(*) filter (where a.status in ('slaughtered', 'distributed'))::int  as animals_slaughtered,
    count(*) filter (where a.status = 'distributed')::int                    as animals_distributed
  from public.animals a
  where a.order_id = o.id
) an
cross join lateral (
  select
    count(*)::int                                            as docs_total,
    count(*) filter (where d.status = 'approved')::int        as docs_approved,
    count(*) filter (
      where d.status in ('pending', 'approved_supervisor')
    )::int                                                    as docs_pending_review
  from public.documentations d
  where d.order_id = o.id
) dc
cross join lateral (
  select
    count(*)::int                             as distribution_count,
    coalesce(sum(dist.packages_count), 0)::int as packages_total
  from public.distributions dist
  where dist.order_id = o.id
) ds
cross join lateral (
  select
    count(*)::int  as report_count,
    max(r.sent_at) as report_sent_at
  from public.reports r
  where r.order_id = o.id
) rp
cross join lateral (
  select
    count(*)::int    as open_issues,
    max(i.severity)  as max_open_severity
  from public.issues i
  where i.order_id = o.id and i.status in ('open', 'in_progress')
) iss;

comment on view public.v_order_progress is
  'Agregat progres per order: potong, distribusi, dokumentasi, laporan (docs/05 section 7).';

-- --- v_branch_kpi: KPI per cabang -------------------------------------------
create view public.v_branch_kpi
with (security_invoker = on) as
select
  b.id   as branch_id,
  b.code as branch_code,
  b.name as branch_name,
  count(p.order_id)::int                                                        as total_orders,
  count(*) filter (where p.status not in ('completed', 'cancelled'))::int        as open_orders,
  count(*) filter (where p.status = 'completed')::int                            as completed_orders,
  count(*) filter (where p.status = 'on_hold')::int                              as on_hold_orders,
  count(*) filter (where p.payment_status <> 'paid' and p.status <> 'cancelled')::int
                                                                                 as unpaid_orders,
  coalesce(round(avg(p.pct_slaughter), 2), 0)                                    as pct_slaughter,
  coalesce(round(avg(p.pct_distribution), 2), 0)                                 as pct_distribution,
  coalesce(round(avg(p.pct_documentation), 2), 0)                                as pct_documentation,
  case
    when count(p.order_id) = 0 then 0
    else round(count(*) filter (where p.report_sent)::numeric * 100 / count(p.order_id), 2)
  end                                                                            as pct_report,
  coalesce(sum(p.open_issues), 0)::int                                           as open_issues,
  coalesce(sum(p.total_amount), 0)                                               as total_amount,
  coalesce(sum(p.paid_amount), 0)                                                as paid_amount
from public.branches b
left join public.v_order_progress p on p.branch_id = b.id
where b.deleted_at is null
group by b.id, b.code, b.name;

comment on view public.v_branch_kpi is
  'KPI agregat per cabang untuk Executive & Cabang Dashboard (docs/09 section 3, section 4).';

-- --- v_open_orders: inti litmus test ----------------------------------------
-- "Berapa order yang belum selesai, di lokasi mana, siapa PIC-nya, apa kendalanya?"
-- (docs/08 section 8, docs/09 section 2)
create view public.v_open_orders
with (security_invoker = on) as
select
  o.id             as order_id,
  o.order_number,
  o.status,
  o.payment_status,
  o.total_amount,
  o.paid_amount,
  o.created_at,
  extract(day from now() - o.created_at)::int as age_days,

  b.id             as branch_id,
  b.code           as branch_code,
  b.name           as branch_name,

  l.id             as location_id,
  l.name           as location_name,
  l.address        as location_address,
  l.lat            as location_lat,
  l.lng            as location_lng,

  s.id             as schedule_id,
  s.scheduled_date,
  s.scheduled_time,
  s.status         as schedule_status,

  pic.id           as pic_user_id,
  pic.full_name    as pic_name,
  pic.phone        as pic_phone,

  part.id          as participant_id,
  part.name        as participant_name,
  part.phone       as participant_phone,

  prog.animals_total,
  prog.animals_slaughtered,
  prog.animals_distributed,
  prog.pct_slaughter,
  prog.pct_distribution,
  prog.pct_documentation,
  prog.docs_pending_review,
  prog.report_sent,

  iss.open_issues,
  iss.max_open_severity,
  iss.latest_issue_title
from public.orders o
join public.branches b on b.id = o.branch_id
join public.participants part on part.id = o.participant_id
left join public.schedules s on s.order_id = o.id
left join public.locations l on l.id = s.location_id
left join public.profiles pic on pic.id = s.pic_user_id
left join public.v_order_progress prog on prog.order_id = o.id
cross join lateral (
  select
    count(*)::int   as open_issues,
    max(i.severity) as max_open_severity,
    (
      select i2.title
      from public.issues i2
      where i2.order_id = o.id and i2.status in ('open', 'in_progress')
      order by i2.severity desc, i2.created_at desc
      limit 1
    )               as latest_issue_title
  from public.issues i
  where i.order_id = o.id and i.status in ('open', 'in_progress')
) iss
where o.status not in ('completed', 'cancelled');

comment on view public.v_open_orders is
  'Order belum selesai + lokasi + PIC + kendala terbuka. Sumber jawaban litmus test < 10 detik (docs/08 section 8).';
