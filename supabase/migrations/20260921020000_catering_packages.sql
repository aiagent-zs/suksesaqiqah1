-- =============================================================================
-- Katering · 02 Paket awal + pembebasan bukti masak
--
-- Dua hal yang harus berada di berkas TERPISAH dari `20260921010000`: keduanya
-- **memakai** nilai enum `katering`, dan Postgres menolak itu dalam transaksi
-- yang sama dengan yang menambahkannya.
--
-- --- Kenapa `is_catering_order()`, bukan menurunkan `min_docs` -----------------
--
-- Keputusan pemilik usaha: vendor katering **tidak wajib** mengunggah foto
-- proses masak. Cara yang tampak paling mudah — `update stage_requirements set
-- min_docs = 0 where stage = 'masak'` — adalah cara yang salah, dan kesalahannya
-- senyap: tabel itu berlaku **per tahap, global**, tidak per jenis order. Satu
-- baris itu akan ikut melepas gerbang bukti masak untuk **seluruh order aqiqah
-- yang sudah berjalan**, tanpa satu pun galat yang memberi tahu.
--
-- Jadi gerbangnya yang diajari membedakan, bukan aturannya yang dilemahkan.
-- `stage_requirements` tetap utuh apa adanya (masak = 1 bukti), dan
-- `missing_doc_stages` mendapat satu syarat tambahan: lewati tahap `masak`
-- ketika ordernya katering.
--
-- Konsekuensi yang diterima dengan sadar: aturan "tahap mana butuh bukti" kini
-- tinggal di **dua** tempat — tabel `stage_requirements` dan satu pengecualian
-- di dalam view. Itu ongkos yang nyata. Yang membuatnya tetap lebih murah
-- daripada menambah kolom `service_type` ke `stage_requirements`: pengecualian
-- ini satu baris yang terbaca apa adanya, sedangkan kolom baru menuntut tiap
-- pembaca tabel itu tahu jenis ordernya — dan pembacanya bukan hanya view ini.
--
-- Kalau kelak pengecualiannya bertambah (misal katering juga bebas `persiapan`),
-- itulah saatnya berpindah ke tabel per-jenis. Satu pengecualian belum menuntut
-- mesin.
-- =============================================================================

-- --- Penanda order katering -------------------------------------------------
--
-- Katering dikenali dari **isi ordernya**, bukan dari kolom di `orders`: sebuah
-- order adalah katering bila salah satu itemnya berjenis `katering`. Tidak ada
-- kolom baru yang perlu dijaga tetap sinkron dengan item yang sebenarnya dipesan.
--
-- `stable`, bukan `immutable`: hasilnya bergantung isi tabel.
create or replace function public.is_catering_order(p_order_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.order_items oi
    join public.services s on s.id = oi.service_id
    where oi.order_id = p_order_id and s.type = 'katering'
  );
$$;

comment on function public.is_catering_order is
  'Order katering dikenali dari jenis item yang dipesan, bukan dari kolom di orders. Dipakai v_order_progress untuk membebaskan tahap masak dari kewajiban bukti.';

grant execute on function public.is_catering_order(uuid) to authenticated;

-- --- Paket katering awal ----------------------------------------------------
--
-- Ikut ke semua environment lewat `db push`, sealur dengan katalog aqiqah di
-- `20260820001200_reference_data.sql` — bukan di `supabase/seed/`, yang hanya
-- jalan lokal. Harga & menunya contoh awal yang memang untuk disunting pemilik
-- lewat halaman katalog; yang penting ada sesuatu untuk dipesan sejak hari
-- pertama, bukan halaman kosong.
--
-- `show_on_landing` sengaja **false**: memajangnya di halaman depan keputusan
-- pemasaran yang terpisah, dan pemilik bisa menyalakannya sendiri per paket.
insert into public.services (
  id, type, name, slug, description, price, sort_order, meta,
  tagline, landing_features, is_popular, show_on_landing
) values
  (
    'a2000000-0000-4000-8000-000000000031', 'katering',
    'Katering Nasi Kotak Sederhana', 'katering-nasi-kotak-sederhana',
    'Nasi kotak untuk acara: pengajian, rapat, dan syukuran kecil.',
    25000, 31,
    '{"items": ["nasi putih", "ayam goreng", "mie goreng", "sambal", "lalapan", "kerupuk"]}'::jsonb,
    'Pilihan hemat untuk acara sehari-hari.',
    '{}', false, false
  ),
  (
    'a2000000-0000-4000-8000-000000000032', 'katering',
    'Katering Nasi Kotak Lengkap', 'katering-nasi-kotak-lengkap',
    'Nasi kotak dengan lauk lebih lengkap beserta buah dan puding.',
    38000, 32,
    '{"items": ["nasi putih", "ayam bakar", "rendang", "capcay", "sambal", "lalapan", "buah", "puding", "kerupuk"]}'::jsonb,
    'Lauk lengkap untuk acara yang lebih besar.',
    '{}', true, false
  ),
  (
    'a2000000-0000-4000-8000-000000000033', 'katering',
    'Katering Prasmanan', 'katering-prasmanan',
    'Sajian prasmanan beserta peralatan saji. Harga per porsi.',
    55000, 33,
    '{"items": ["nasi putih", "nasi goreng", "ayam bakar", "rendang", "gulai", "capcay", "buah potong", "puding", "air mineral"]}'::jsonb,
    'Sajian prasmanan lengkap dengan peralatannya.',
    '{}', false, false
  )
on conflict (id) do nothing;

-- --- Gerbang bukti: tahap `masak` dibebaskan untuk katering ------------------
--
-- Kedua view disusun ulang. `v_open_orders` membaca `v_order_progress`, jadi
-- urutan drop-nya tidak bisa dibalik. Isinya **salinan verbatim** dari
-- `20260908020000_doc_stage_drop_umum.sql` kecuali satu syarat tambahan pada
-- `missing_doc_stages` — ditandai di tempatnya.
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

  -- Gerbang tetap dihitung per TAHAP, bukan per baris tahap. Order dua ekor
  -- punya dua baris `sembelih`, dan satu bukti tervalidasi sudah melepasnya.
  (
    select coalesce(array_agg(r.stage::text order by r.stage), '{}')
    from public.stage_requirements r
    where r.min_docs > 0
      and r.stage = any (public.fulfilment_sequence(o.distribution_mode))
      -- INI satu-satunya tambahannya: order katering tidak dituntut bukti
      -- masak. `stage_requirements` tidak disentuh — aturan aqiqah tetap utuh.
      and not (r.stage = 'masak' and public.is_catering_order(o.id))
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
  'Progres per order. missing_doc_stages membebaskan tahap masak untuk order katering — stage_requirements sendiri tidak disentuh, jadi gerbang aqiqah tetap utuh.';

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
