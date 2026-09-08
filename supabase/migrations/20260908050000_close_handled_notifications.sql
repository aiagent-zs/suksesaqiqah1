-- =============================================================================
-- Notifikasi ditutup sendiri begitu pekerjaannya selesai
--
-- Panel "Perlu Tindakan" menjawab satu pertanyaan: apa yang belum ditangani.
-- Tetapi outbox hanya tahu cara **menerbitkan** notifikasi, tidak pernah tahu
-- kapan ia berhenti relevan. Barisnya bertahan `queued` sampai ada admin yang
-- menekan centang secara manual — dan tidak ada yang menekan centang untuk
-- pekerjaan yang sudah ia kerjakan lewat jalan lain.
--
-- Terlihat langsung di produksi saat ini:
--
--   guest_order_new  IA-202609-0003  order sudah `assigned`     <-- sudah diverifikasi
--   guest_order_new  IA-202609-0002  order sudah `in_progress`  <-- sudah diverifikasi
--   guest_order_new  IA-202609-0001  order sudah `cancelled`    <-- tidak akan pernah diverifikasi
--
-- Tiga dari empat barisnya menuntut tindakan yang sudah tidak ada. Panel yang
-- isinya sebagian besar tugas semu berhenti dibaca, dan tugas yang sungguhan
-- ikut tenggelam bersamanya.
--
-- **`sent`, bukan nilai enum baru.** Bagi notifikasi kanal `dashboard` tidak ada
-- yang benar-benar "dikirim" — `markNotificationSent` sudah memakainya untuk
-- menandai "sudah ditangani", dan `getPendingAlerts` menyaring `queued` saja.
-- Menambah nilai enum berarti menyentuh setiap pembacaan status demi perbedaan
-- yang tidak dipakai siapa pun.
--
-- Yang **tidak** ditutup otomatis: notifikasi berkanal WhatsApp/email. Baris itu
-- menunggu benar-benar terkirim ke pemesan, dan pengirimannya belum dibangun
-- (Tahap 8). Menutupnya di sini berarti menyatakan pesan terkirim padahal tidak
-- pernah ada yang mengirimnya.
-- =============================================================================

-- --- Penutup bersama ---------------------------------------------------------
create or replace function public.close_dashboard_notification(
  p_order_id uuid,
  p_template text
)
returns void
language sql security definer set search_path = public as $fn$
  update public.notifications
  set status = 'sent', sent_at = now()
  where order_id = p_order_id
    and template = p_template
    and channel = 'dashboard'
    and status = 'queued';
$fn$;

comment on function public.close_dashboard_notification is
  'Menutup notifikasi dashboard yang pekerjaannya sudah selesai. Hanya kanal dashboard — kanal kirim menunggu benar-benar terkirim.';

-- --- Order tamu diverifikasi atau dibatalkan ---------------------------------
--
-- Dua sebab notifikasi ini berhenti relevan, dan keduanya diperiksa di sini:
-- ordernya sudah diverifikasi (pekerjaannya selesai) atau dibatalkan (tidak
-- akan pernah dikerjakan).
create or replace function public.close_guest_order_notification()
returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if (new.guest_verified_at is not null and old.guest_verified_at is null)
     or (new.status = 'cancelled' and old.status <> 'cancelled') then
    perform public.close_dashboard_notification(new.id, 'guest_order_new');
  end if;
  return new;
end $fn$;

drop trigger if exists close_guest_order_notification on public.orders;
create trigger close_guest_order_notification
  after update on public.orders
  for each row execute function public.close_guest_order_notification();

-- --- Bukti sudah diputuskan --------------------------------------------------
--
-- "Bukti baru menunggu validasi" berhenti relevan begitu buktinya disetujui
-- atau ditolak — apa pun keputusannya, ia sudah tidak menunggu.
--
-- Ditutup per order, bukan per bukti: `notify_documentation_uploaded` memakai
-- `event_key` per dokumentasi, tetapi barisnya tidak menyimpan
-- `documentation_id` di kolom sendiri — hanya di dalam payload. Menutup seluruh
-- notifikasi bukti order ini saat salah satunya diputuskan sedikit terlalu
-- luas, tetapi arah kelirunya aman: yang masih menunggu tetap terlihat di
-- antrean `/validation`, yang memang tempatnya.
create or replace function public.close_documentation_notification()
returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if new.status <> 'pending' and old.status = 'pending' then
    perform public.close_dashboard_notification(new.order_id, 'documentation_uploaded');
  end if;
  return new;
end $fn$;

drop trigger if exists close_documentation_notification on public.documentations;
create trigger close_documentation_notification
  after update on public.documentations
  for each row execute function public.close_documentation_notification();

-- --- Kendala berat sudah ditangani -------------------------------------------
create or replace function public.close_issue_notification()
returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if new.status = 'resolved' and old.status <> 'resolved' then
    perform public.close_dashboard_notification(new.order_id, 'issue_high');
  end if;
  return new;
end $fn$;

drop trigger if exists close_issue_notification on public.issues;
create trigger close_issue_notification
  after update on public.issues
  for each row execute function public.close_issue_notification();

-- --- Membersihkan yang sudah terlanjur basi ----------------------------------
--
-- Barisnya sudah tidak menuntut apa pun; yang menerbitkannya tidak punya cara
-- menutupnya sampai sekarang.
update public.notifications n
set status = 'sent', sent_at = now()
from public.orders o
where n.order_id = o.id
  and n.channel = 'dashboard'
  and n.status = 'queued'
  and n.template = 'guest_order_new'
  and (o.guest_verified_at is not null or o.status = 'cancelled');

update public.notifications n
set status = 'sent', sent_at = now()
where n.channel = 'dashboard'
  and n.status = 'queued'
  and n.template = 'documentation_uploaded'
  and not exists (
    select 1 from public.documentations d
    where d.order_id = n.order_id and d.status = 'pending'
  );

update public.notifications n
set status = 'sent', sent_at = now()
where n.channel = 'dashboard'
  and n.status = 'queued'
  and n.template = 'issue_high'
  and not exists (
    select 1 from public.issues i
    where i.order_id = n.order_id and i.status <> 'resolved' and i.severity = 'high'
  );
