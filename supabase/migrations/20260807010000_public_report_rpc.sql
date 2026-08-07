-- =============================================================================
-- Tahap 6 — Reporting · Halaman laporan publik bertoken
-- Acuan: docs/11_REPORTING_ENGINE.md section 5 & section 6
--
-- Pengunjung anonim tidak punya akses apa pun ke tabel operasional: seluruh
-- kebijakan RLS ditujukan `to authenticated`, dan `anon` hanya di-grant SELECT
-- pada `services`. Halaman `/r/{token}` karena itu tidak bisa membaca langsung.
--
-- Fungsi di bawah SECURITY DEFINER dengan satu pintu masuk: token. Bentuk
-- keluarannya dikunci di sini, sehingga kesalahan di sisi aplikasi tidak dapat
-- membuatnya mengembalikan data order lain — pertahanan yang tidak didapat bila
-- halaman publik memakai service role dan menyusun query-nya sendiri.
-- =============================================================================

create or replace function public.get_public_report(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_order   public.orders%rowtype;
  v_report  public.reports%rowtype;
  v_result  jsonb;
begin
  -- Token dibuat dari 16 byte acak (32 karakter hex). Menolak yang lebih pendek
  -- memangkas percobaan tebakan sebelum menyentuh indeks.
  if p_token is null or length(p_token) <> 32 then
    return null;
  end if;

  select * into v_order from public.orders where public_token = p_token;
  if not found then
    return null;
  end if;

  -- Halaman publik hanya terbuka setelah laporan pertama dibuat. Tanpa syarat
  -- ini, token yang bocor lebih awal sudah memperlihatkan order yang masih
  -- berjalan.
  select * into v_report
  from public.reports
  where order_id = v_order.id
  order by version desc
  limit 1;

  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'order_number',    v_order.order_number,
    'status',          v_order.status,
    'created_at',      v_order.created_at,
    'branch_name',     (select b.name from public.branches b where b.id = v_order.branch_id),
    -- Sengaja hanya nama peserta: telepon, email, dan alamat tidak pernah ikut
    -- ke halaman publik (docs/11 section 6 — data minimal).
    'participant_name', (
      select p.name from public.participants p where p.id = v_order.participant_id
    ),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object('name', s.name, 'qty', oi.qty) order by s.name)
      from public.order_items oi
      join public.services s on s.id = oi.service_id
      where oi.order_id = v_order.id
    ), '[]'::jsonb),
    'animals', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'species',      a.species,
          'tag_code',     a.tag_code,
          'on_behalf_of', a.on_behalf_of,
          'status',       a.status
        ) order by a.tag_code
      )
      from public.animals a
      where a.order_id = v_order.id
    ), '[]'::jsonb),
    'schedule', (
      select jsonb_build_object(
        'scheduled_date', sc.scheduled_date,
        'scheduled_time', sc.scheduled_time,
        'location_name',  l.name
      )
      from public.schedules sc
      left join public.locations l on l.id = sc.location_id
      where sc.order_id = v_order.id
    ),
    'progress', (
      select jsonb_build_object(
        'animals_total',       p.animals_total,
        'animals_slaughtered', p.animals_slaughtered,
        'animals_distributed', p.animals_distributed,
        'packages_total',      p.packages_total
      )
      from public.v_order_progress p
      where p.order_id = v_order.id
    ),
    'distributions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'recipient_area',  d.recipient_area,
          'packages_count',  d.packages_count,
          'distributed_at',  d.distributed_at
        ) order by d.distributed_at
      )
      from public.distributions d
      where d.order_id = v_order.id
    ), '[]'::jsonb),
    -- Hanya dokumentasi tervalidasi penuh yang boleh tampil (docs/10 section 6).
    'documentations', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'type',         dc.type,
          'stage',        dc.stage,
          'caption',      dc.caption,
          'storage_path', dc.storage_path
        ) order by dc.created_at
      )
      from public.documentations dc
      where dc.order_id = v_order.id and dc.status = 'approved'
    ), '[]'::jsonb),
    'report', jsonb_build_object(
      'version',      v_report.version,
      'pdf_path',     v_report.pdf_path,
      'generated_at', v_report.generated_at
    )
  ) into v_result;

  return v_result;
end;
$$;

comment on function public.get_public_report is
  'Payload halaman laporan publik `/r/{token}` — satu order saja, dokumentasi approved saja, tanpa kontak peserta (docs/11 section 5, section 6).';

-- Halaman publik dipanggil pengunjung anonim; pengguna internal juga boleh
-- memakainya untuk pratinjau tautan yang dikirim ke peserta.
grant execute on function public.get_public_report(text) to anon, authenticated;

-- `v_order_progress` dibaca di dalam fungsi SECURITY DEFINER milik `postgres`,
-- jadi tidak butuh grant untuk `anon` — dan memang sengaja tidak diberikan.
