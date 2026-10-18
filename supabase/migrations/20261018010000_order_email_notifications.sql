-- =============================================================================
-- Email ke pemesan: pesanan divalidasi & pesanan selesai
--
-- Keputusan pemilik 18 Oktober 2026: WhatsApp otomatis ditunda, pemesan
-- diberi kabar lewat email pada dua titik saja.
--
--   * `verified`  -> konfirmasi pesanan (nomor order, isi, jadwal, total,
--                    tautan pantau `/r/{token}`)
--   * `completed` -> pesanan selesai (tautan laporan & dokumentasi)
--
-- Pemicunya perpindahan status order, bukan server action, dengan alasan yang
-- sama seperti `20260824020000`: status bisa berubah lewat lebih dari satu
-- jalan, dan jalan yang lupa memanggil penerbit tidak menghasilkan galat.
--
-- Idempoten per order lewat `event_key`. Order yang ditahan (`on_hold`) lalu
-- diverifikasi ulang tidak mengirim konfirmasi kedua.
--
-- Email `report_ready` berhenti diterbitkan. Order baru boleh `completed`
-- sesudah laporannya terkirim, jadi email selesai selalu menyusul dengan
-- tautan yang sama; dua email untuk satu laporan hanya membingungkan pemesan.
-- Kanal WhatsApp `report_ready` dibiarkan untuk tombol "Kirim WA" di dashboard.
-- =============================================================================

create or replace function public.notify_order_email()
returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  v_template text;
  v_name     text;
  v_email    text;
  v_items    jsonb;
begin
  if new.status = old.status then
    return new;
  end if;

  v_template := case new.status
    when 'verified'  then 'order_verified'
    when 'completed' then 'order_completed'
  end;
  if v_template is null then
    return new;
  end if;

  select p.name, nullif(btrim(p.email), '') into v_name, v_email
  from public.participants p where p.id = new.participant_id;

  -- Tanpa alamat tidak ada yang bisa dikirim. Tidak diantrekan sama sekali,
  -- sebab baris `queued` berpenerima '-' akan dicoba worker selamanya.
  if v_email is null then
    return new;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('name', s.name, 'qty', i.qty) order by i.created_at), '[]'::jsonb)
    into v_items
  from public.order_items i
  join public.services s on s.id = i.service_id
  where i.order_id = new.id;

  perform public.enqueue_notification(
    new.id, 'email', v_template, v_email,
    v_template || '_email:' || new.id::text,
    jsonb_build_object(
      'order_number', new.order_number,
      'public_token', new.public_token,
      'participant_name', v_name,
      'total_amount', new.total_amount,
      'requested_date', new.requested_date,
      'requested_time', new.requested_time,
      'distribution_mode', new.distribution_mode,
      'is_catering', public.is_catering_order(new.id),
      'items', v_items
    )
  );
  return new;
end $fn$;

comment on function public.notify_order_email is
  'Mengantrekan email ke pemesan saat order menjadi verified (konfirmasi) atau completed (selesai). Dilewati bila pemesan tidak punya email.';

drop trigger if exists notify_order_email on public.orders;
create trigger notify_order_email
  after update of status on public.orders
  for each row execute function public.notify_order_email();

-- --- report_ready: WhatsApp saja ---------------------------------------------
create or replace function public.notify_report_ready()
returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  v_order public.orders%rowtype;
  v_name  text;
  v_phone text;
begin
  select * into v_order from public.orders where id = new.order_id;
  select p.name, p.phone into v_name, v_phone
  from public.participants p where p.id = v_order.participant_id;

  -- Kuncinya memuat versi: generate ulang laporan memang layak memberi tahu
  -- pemesan lagi, sebab isinya berubah.
  perform public.enqueue_notification(
    new.order_id, 'whatsapp', 'report_ready', coalesce(v_phone, '-'),
    'report_ready_wa:' || new.order_id::text || ':' || new.version::text,
    jsonb_build_object(
      'order_number', v_order.order_number,
      'public_token', v_order.public_token,
      'participant_name', v_name,
      'report_version', new.version
    )
  );
  return new;
end $fn$;

-- Email `report_ready` yang terlanjur antre tidak akan pernah dikirim worker:
-- isinya sudah dibawa email selesai. Ditutup sebagai `failed` dengan alasan,
-- bukan dihapus, supaya jejaknya tetap terbaca.
update public.notifications
set status = 'failed', error_text = 'Digantikan email order_completed (20261018010000)'
where channel = 'email' and template = 'report_ready' and status = 'queued';
