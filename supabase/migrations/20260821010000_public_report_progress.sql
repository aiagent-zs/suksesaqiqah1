-- =============================================================================
-- Kembalikan blok `progress` ke payload get_public_report
--
-- Desain ulang skema (20260820001100) menyusun ulang payload laporan publik dan
-- menambahkan `stages`, tapi key `progress` ikut hilang dari `jsonb_build_object`
-- — sementara `server/services/public-report.ts` masih membacanya. Karena field
-- itu opsional di TypeScript dan dibaca lewat `?? 0`, hilangnya tidak membuat
-- apa pun gagal: tiga kartu "Status Pelaksanaan" di /r/{token} dan blok progres
-- di PDF sekadar mencetak `0/0`. Typecheck maupun test tidak bisa menangkap ini
-- — keduanya tidak pernah memanggil RPC yang sesungguhnya.
--
-- Angkanya diambil dari `v_order_progress`, sumber yang sama dengan jalur
-- terotentikasi (`getReportData`). Menghitung ulang di sini akan membuat halaman
-- publik dan PDF internal bisa menyebut angka berbeda untuk order yang sama.
--
-- View-nya `security_invoker = on`, sementara fungsi ini SECURITY DEFINER milik
-- postgres — jadi pembacaannya berjalan dengan hak pemilik fungsi, bukan hak
-- `anon`. Itu memang yang dikehendaki: barisnya sudah dikunci ke satu order yang
-- tokennya cocok, dan seluruh payload ini bentuknya ditetapkan di sini.
--
-- `vendor_name` sudah benar sejak 20260820001100; yang salah adalah pembacanya
-- di TypeScript (masih `branch_name`). Diperbaiki di sisi kode, bukan di sini —
-- nama kolom di database sudah mengikuti skema baru.
-- =============================================================================

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
    'animals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'species', a.species, 'tag_code', a.tag_code,
        'on_behalf_of', a.on_behalf_of, 'status', a.status) order by a.tag_code)
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
