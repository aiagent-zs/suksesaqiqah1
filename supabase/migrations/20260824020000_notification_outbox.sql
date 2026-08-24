-- =============================================================================
-- Tahap 8 - Outbox notifikasi
--
-- Tabel `notifications` sudah ada sejak 20 Agustus tetapi **tidak pernah
-- disentuh satu baris kode pun** - nol referensi di seluruh `server/`,
-- `features/`, dan `app/`. Yang ditambahkan di sini adalah yang mengisinya.
--
-- **Kenapa trigger, bukan server action.** Peristiwa yang memicu notifikasi
-- datang dari lebih dari satu jalan: aksi staf lewat aplikasi, RPC checkout
-- tamu (`create_guest_order`), `confirm_delivery` dari halaman bertoken, dan
-- nanti worker n8n. Menaruh pemicunya di lapisan aplikasi berarti setiap jalan
-- baru harus ingat memanggilnya - dan yang lupa tidak menghasilkan galat, cuma
-- notifikasi yang diam-diam tidak pernah terbit.
--
-- **Idempotensi lewat `event_key`.** `docs/12` bagian 4 menuntutnya. Kuncinya
-- disusun dari jenis peristiwa + id barisnya, jadi trigger yang tereksekusi dua
-- kali tidak menghasilkan dua notifikasi. Tanpa ini, satu revalidasi yang
-- menulis ulang status akan mengirim pesan kedua ke pemesan yang sama.
-- =============================================================================

alter table public.notifications
  add column if not exists event_key text;

comment on column public.notifications.event_key is
  'Kunci idempotensi: jenis peristiwa + id baris sumbernya. Unik, jadi pemicu yang berjalan dua kali tidak menerbitkan notifikasi ganda.';

-- Unik **parsial**: baris tanpa kunci (dibuat manual) tidak terhalang, tetapi
-- yang berkunci tidak bisa kembar.
create unique index if not exists notifications_event_key_uniq
  on public.notifications (event_key)
  where event_key is not null;

-- Antrian dibaca per kanal oleh worker yang berbeda.
create index if not exists notifications_channel_status_idx
  on public.notifications (channel, status, created_at)
  where status = 'queued';

-- --- Penerbit ----------------------------------------------------------------
--
-- Satu fungsi yang dipakai seluruh trigger di bawah, supaya bentuk payload dan
-- perlakuan idempotensinya tidak menyimpang antar-pemicu.
create or replace function public.enqueue_notification(
  p_order_id  uuid,
  p_channel   public.notif_channel,
  p_template  text,
  p_recipient text,
  p_event_key text,
  p_payload   jsonb default '{}'::jsonb
)
returns uuid
language plpgsql security definer set search_path = public as $fn$
declare
  v_id uuid;
begin
  -- Penerima kosong bukan galat: notifikasi dashboard memang tidak punya
  -- alamat, dan pemesan yang tidak mencantumkan email tetap boleh diproses
  -- lewat kanal lain. Yang dicatat cukup tanda strip.
  insert into public.notifications (order_id, channel, status, recipient, template, payload, event_key)
  values (p_order_id, p_channel, 'queued',
          coalesce(nullif(btrim(p_recipient), ''), '-'),
          p_template, coalesce(p_payload, '{}'::jsonb), p_event_key)
  on conflict (event_key) where event_key is not null do nothing
  returning id into v_id;

  return v_id;
end $fn$;

comment on function public.enqueue_notification is
  'Menerbitkan satu baris ke outbox notifikasi. Idempoten lewat event_key: pemanggilan kedua dengan kunci sama tidak menghasilkan baris baru.';

-- --- Bukti diunggah -> admin perlu memvalidasi -------------------------------
create or replace function public.notify_documentation_uploaded()
returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  v_order_number text;
begin
  select o.order_number into v_order_number from public.orders o where o.id = new.order_id;

  perform public.enqueue_notification(
    new.order_id, 'dashboard', 'documentation_uploaded', '-',
    'doc_uploaded:' || new.id::text,
    jsonb_build_object('order_number', v_order_number, 'stage', new.stage, 'documentation_id', new.id)
  );
  return new;
end $fn$;

drop trigger if exists notify_documentation_uploaded on public.documentations;
create trigger notify_documentation_uploaded
  after insert on public.documentations
  for each row execute function public.notify_documentation_uploaded();

-- --- Bukti ditolak -> vendor perlu mengunggah ulang --------------------------
--
-- Hanya pada perpindahan status, bukan tiap update: koreksi caption pada bukti
-- yang sudah ditolak tidak boleh menerbitkan notifikasi kedua.
create or replace function public.notify_documentation_rejected()
returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  v_order_number text;
  v_vendor_phone text;
begin
  if new.status <> 'rejected' or old.status = 'rejected' then
    return new;
  end if;

  select o.order_number, coalesce(v.whatsapp, v.phone)
    into v_order_number, v_vendor_phone
  from public.orders o
  left join public.vendors v on v.id = o.vendor_id
  where o.id = new.order_id;

  perform public.enqueue_notification(
    new.order_id, 'dashboard', 'documentation_rejected', coalesce(v_vendor_phone, '-'),
    'doc_rejected:' || new.id::text,
    jsonb_build_object(
      'order_number', v_order_number, 'stage', new.stage,
      'documentation_id', new.id, 'review_note', new.review_note
    )
  );
  return new;
end $fn$;

drop trigger if exists notify_documentation_rejected on public.documentations;
create trigger notify_documentation_rejected
  after update of status on public.documentations
  for each row execute function public.notify_documentation_rejected();

-- --- Laporan terbit -> pemesan perlu menerima tautannya ----------------------
--
-- Notifikasi yang paling ditunggu: `docs/12` bagian 3 menandainya WA + Email ke
-- peserta. Keduanya diterbitkan sekaligus, dan worker memilih mana yang bisa
-- dikirim berdasarkan kontak yang tersedia.
create or replace function public.notify_report_ready()
returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  v_order   public.orders%rowtype;
  v_name    text;
  v_phone   text;
  v_email   text;
  v_payload jsonb;
begin
  select * into v_order from public.orders where id = new.order_id;
  select p.name, p.phone, p.email into v_name, v_phone, v_email
  from public.participants p where p.id = v_order.participant_id;

  v_payload := jsonb_build_object(
    'order_number', v_order.order_number,
    'public_token', v_order.public_token,
    'participant_name', v_name,
    'report_version', new.version
  );

  -- Kuncinya memuat versi: generate ulang laporan memang layak memberi tahu
  -- pemesan lagi, sebab isinya berubah.
  perform public.enqueue_notification(
    new.order_id, 'whatsapp', 'report_ready', coalesce(v_phone, '-'),
    'report_ready_wa:' || new.order_id::text || ':' || new.version::text, v_payload
  );

  if v_email is not null then
    perform public.enqueue_notification(
      new.order_id, 'email', 'report_ready', v_email,
      'report_ready_email:' || new.order_id::text || ':' || new.version::text, v_payload
    );
  end if;

  return new;
end $fn$;

drop trigger if exists notify_report_ready on public.reports;
create trigger notify_report_ready
  after insert on public.reports
  for each row execute function public.notify_report_ready();

-- --- Kendala berat -> manajemen perlu tahu sekarang --------------------------
create or replace function public.notify_issue_high()
returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  v_order_number text;
begin
  if new.severity <> 'high' then
    return new;
  end if;

  select o.order_number into v_order_number from public.orders o where o.id = new.order_id;

  perform public.enqueue_notification(
    new.order_id, 'dashboard', 'issue_high', '-',
    'issue_high:' || new.id::text,
    jsonb_build_object('order_number', v_order_number, 'issue_id', new.id, 'title', new.title)
  );
  return new;
end $fn$;

drop trigger if exists notify_issue_high on public.issues;
create trigger notify_issue_high
  after insert on public.issues
  for each row execute function public.notify_issue_high();

-- --- Order tamu masuk -> admin perlu memverifikasi ---------------------------
--
-- Order tamu ditandai `created_by IS NULL` dan tertahan sampai admin
-- memverifikasinya. Tanpa notifikasi, satu-satunya cara mengetahuinya adalah
-- membuka dashboard dan melihat kartu "Order Tamu Baru".
create or replace function public.notify_guest_order()
returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  v_name  text;
  v_phone text;
begin
  if new.created_by is not null then
    return new;
  end if;

  select p.name, p.phone into v_name, v_phone
  from public.participants p where p.id = new.participant_id;

  perform public.enqueue_notification(
    new.id, 'dashboard', 'guest_order_new', coalesce(v_phone, '-'),
    'guest_order:' || new.id::text,
    jsonb_build_object(
      'order_number', new.order_number,
      'participant_name', v_name,
      'total_amount', new.total_amount
    )
  );
  return new;
end $fn$;

drop trigger if exists notify_guest_order on public.orders;
create trigger notify_guest_order
  after insert on public.orders
  for each row execute function public.notify_guest_order();

-- --- Pesanan dikirim & menunggu konfirmasi penerima --------------------------
--
-- `confirm_delivery()` sudah ada sejak 20 Agustus, tetapi tidak ada apa pun
-- yang memberi tahu pemesan bahwa ia perlu menekannya - tercatat sebagai celah
-- terbuka di TASKS.md. Ini menutupnya: begitu tahap `kirim` divalidasi, pemesan
-- diberi tahu.
create or replace function public.notify_delivery_pending()
returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  v_order public.orders%rowtype;
  v_phone text;
  v_name  text;
begin
  if new.stage <> 'kirim' or new.status <> 'validated' or old.status = 'validated' then
    return new;
  end if;

  select * into v_order from public.orders where id = new.order_id;
  if v_order.distribution_mode <> 'kirim' or v_order.delivery_confirmed_at is not null then
    return new;
  end if;

  select p.name, p.phone into v_name, v_phone
  from public.participants p where p.id = v_order.participant_id;

  perform public.enqueue_notification(
    new.order_id, 'whatsapp', 'delivery_pending', coalesce(v_phone, '-'),
    'delivery_pending:' || new.order_id::text,
    jsonb_build_object(
      'order_number', v_order.order_number,
      'public_token', v_order.public_token,
      'participant_name', v_name
    )
  );
  return new;
end $fn$;

drop trigger if exists notify_delivery_pending on public.order_stage_events;
create trigger notify_delivery_pending
  after update of status on public.order_stage_events
  for each row execute function public.notify_delivery_pending();

-- --- Grant -------------------------------------------------------------------
--
-- `enqueue_notification` sengaja TIDAK di-grant ke `anon` maupun
-- `authenticated`: satu-satunya pemanggilnya adalah trigger, yang berjalan
-- dengan hak pemilik fungsi. Membukanya berarti siapa pun yang login bisa
-- mengarang notifikasi dengan penerima pilihannya sendiri.
revoke execute on function public.enqueue_notification(uuid, public.notif_channel, text, text, text, jsonb) from public;