-- =============================================================================
-- Tiga kebocoran & satu kebutaan pada akun mitra
--
-- Ketiganya ditemukan saat menelusuri apa yang benar-benar terbaca akun vendor,
-- dan ketiganya dibuktikan langsung terhadap database ini lewat impersonasi
-- (`set_config('request.jwt.claims', …)`) di dalam transaksi yang di-rollback.
-- Hasil sebelum perbaikan, untuk akun mitra pemilik dua order:
--
--   orders terbaca      : 2
--   v_open_orders       : 0     <-- kosong, padahal ordernya dua
--   locations           : 4     <-- seluruhnya, termasuk milik mitra lain
--   participants        : 0     (benar — memang tertutup)
--
-- Ketiganya berdiri sendiri dan tidak menyentuh gerbang kelengkapan bukti
-- (`missing_doc_stages`), yang sengaja dibiarkan apa adanya.
-- =============================================================================

-- --- 1. Dashboard mitra kosong permanen -------------------------------------
--
-- `v_open_orders` melakukan `join public.participants` — inner join. Sementara
-- `participants_select` menuntut `is_staff()`, dan view-nya `security_invoker`,
-- jadi bagi mitra tabel itu kosong dan inner join menghapus SETIAP baris.
--
-- Akibatnya halaman yang berjudul "Order yang ditugaskan kepada Anda" tidak
-- pernah menampilkan satu pun order, dan panel kendala di sampingnya ikut nol.
-- Ini bukan pembatasan yang disengaja: nama peserta memang tidak boleh terbaca
-- mitra, tapi ordernya sendiri harus.
--
-- `left join` menjawab keduanya sekaligus — barisnya tetap ada, kolom
-- `participant_name`/`participant_phone` bernilai NULL bagi yang tidak berhak.
-- Penyaringan PII tetap dikerjakan RLS pada `participants`, bukan oleh view.
--
-- Kenapa view-nya ditulis ulang utuh: `create or replace view` menolak
-- perubahan pada daftar kolom maupun bentuk join, jadi ia harus di-drop dulu.
drop view if exists public.v_open_orders;

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
-- INI perubahannya: `join` → `left join`.
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

-- Grant dipulihkan eksplisit. `20260820001000_grants.sql` memberikannya lewat
-- `on all tables in schema public`, yang hanya berlaku atas tabel & view yang
-- ADA saat itu — view yang lahir sesudahnya tidak ikut. Di database ini
-- default privileges kebetulan menutupinya, tapi bersandar pada kebetulan
-- berarti `db reset` di mesin lain bisa menghasilkan view yang tidak terbaca
-- siapa pun.
grant select on public.v_open_orders to authenticated;

-- --- 2. Bucket dokumentasi tidak ter-scope -----------------------------------
--
-- `storage_documentation_read` memberi SELECT atas SELURUH bucket kepada siapa
-- pun yang login. Komentar migration aslinya menyerahkan pembatasan folder ke
-- `isDocPathForOrder` di server action — tetapi itu hanya menjaga jalur tulis.
-- Klien Supabase di browser sudah dipakai untuk mengunggah, jadi
-- `storage.from('documentation').list()` dari sana melewatinya sepenuhnya, dan
-- satu mitra bisa membaca foto lapangan mitra lain.
--
-- Path-nya `{YYYY}/{MM}/{order_number}/{stage}/{uuid}.{ext}`, jadi segmen
-- ketiga adalah nomor order — nilai yang unik global dan tidak pernah berubah
-- seumur hidup order, yang justru alasan ia dipilih jadi segmen path dulu.
drop policy if exists storage_documentation_read on storage.objects;

create policy storage_documentation_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documentation'
    and (
      public.is_staff()
      or exists (
        select 1 from public.orders o
        where o.vendor_id is not null
          and o.vendor_id = public.auth_vendor_id()
          and o.order_number = split_part(storage.objects.name, '/', 3)
      )
    )
  );

-- --- 3. Seluruh lokasi terbaca setiap mitra ----------------------------------
--
-- `locations_select` memakai `using (true)`: tiap mitra membaca nama dan alamat
-- seluruh fasilitas di sistem, termasuk milik pesaingnya. Terlihat paling jelas
-- di penyaring halaman Jadwal, yang memuat daftarnya untuk semua role.
--
-- Yang tetap terbuka bagi mitra: lokasi tanpa pemilik (masjid, panti, tempat
-- salur umum) dan miliknya sendiri. Keduanya memang perlu ia lihat untuk
-- membaca jadwalnya.
drop policy if exists locations_select on public.locations;

create policy locations_select on public.locations
  for select to authenticated
  using (
    public.is_staff()
    or vendor_id is null
    or vendor_id = public.auth_vendor_id()
  );
