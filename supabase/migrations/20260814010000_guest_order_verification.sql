-- =============================================================================
-- Tahap 10 — Public Platform · Verifikasi order tamu
--
-- MASALAH
-- `create_guest_order` menandai order dari publik hanya dengan `created_by is
-- null`. Penanda itu tidak pernah keluar dari database: daftar order admin tidak
-- menyebutnya, dan tidak ada satu pun langkah yang menahan order tamu sebelum
-- seseorang benar-benar memeriksanya. Order yang masuk dari internet bisa
-- mengendap tanpa diketahui, atau sebaliknya ikut berjalan ke tahap operasional
-- tanpa pernah dikonfirmasi ke pemesannya.
--
-- SOLUSI
-- Dua kolom penanda verifikasi + trigger yang menahan order tamu di status `new`
-- sampai verifikasi itu tercatat. Penahannya sengaja di database, bukan di
-- Server Action: `orders_update` memberi Manager Program dan Admin Cabang
-- wewenang penuh atas baris order, jadi guard di lapisan aplikasi saja bisa
-- dilewati lewat panggilan PostgREST langsung.
--
-- Acuan: TASKS.md section 8 & section 11 butir 1, prd.md FR-C2..FR-C4
-- =============================================================================

alter table public.orders
  add column if not exists guest_verified_at timestamptz,
  add column if not exists guest_verified_by uuid references public.profiles (id) on delete set null;

comment on column public.orders.guest_verified_at is
  'Waktu admin memverifikasi order tamu (created_by is null). Null = masih di antrian verifikasi.';
comment on column public.orders.guest_verified_by is
  'Admin yang memverifikasi. Boleh null meski guest_verified_at terisi bila profilnya kemudian dihapus.';

-- Arahnya satu sisi saja: pemverifikasi tanpa waktu verifikasi adalah data
-- rusak, tapi waktu tanpa pemverifikasi harus tetap sah — `on delete set null`
-- di atas akan mengosongkan kolomnya kalau profil admin itu dihapus, dan
-- constraint dua arah akan menolak penghapusan profil tersebut.
alter table public.orders drop constraint if exists orders_guest_verified_consistency_check;
alter table public.orders
  add constraint orders_guest_verified_consistency_check
  check (guest_verified_by is null or guest_verified_at is not null);

-- Antrian verifikasi = order tamu yang belum diverifikasi. Index parsial supaya
-- yang diindeks hanya baris antrian, bukan seluruh tabel order.
create index if not exists orders_guest_pending_idx
  on public.orders (created_at desc)
  where created_by is null and guest_verified_at is null;

-- --- Penahan alur -----------------------------------------------------------

create or replace function public.enforce_guest_order_verification()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Hanya order tamu yang ditahan.
  if old.created_by is not null then
    -- Sekaligus tutup jalur sebaliknya: order internal tidak punya antrian
    -- verifikasi, jadi penandanya tidak boleh terisi sama sekali.
    if new.guest_verified_at is not null then
      raise exception 'Order internal tidak melewati verifikasi order tamu'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  -- Verifikasi tidak bisa dicabut: `guest_verified_at` yang sudah terisi adalah
  -- catatan bahwa seseorang benar-benar memeriksa order ini.
  if old.guest_verified_at is not null and new.guest_verified_at is null then
    raise exception 'Verifikasi order tamu tidak dapat dibatalkan'
      using errcode = 'check_violation';
  end if;

  -- Yang berhak memverifikasi disamakan dengan kapabilitas VERIFY_GUEST_ORDER di
  -- server/auth/capabilities.ts. Dilewati saat auth.uid() kosong (service role,
  -- seed, migration) — di jalur itu RLS pun tidak berlaku.
  if old.guest_verified_at is null and new.guest_verified_at is not null then
    if auth.uid() is not null
       and coalesce(public.auth_role()::text, '') not in
           ('manager_program', 'admin_cabang', 'admin_pusat') then
      raise exception 'Role Anda tidak berhak memverifikasi order tamu'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  -- Inti penahannya: selama belum diverifikasi, status tidak boleh bergerak.
  -- `cancelled` dikecualikan supaya pesanan iseng atau ganda tetap bisa ditutup
  -- tanpa harus diverifikasi lebih dulu.
  if new.status is distinct from old.status
     and new.guest_verified_at is null
     and new.status <> 'cancelled' then
    raise exception 'Order tamu harus diverifikasi admin sebelum masuk alur operasional'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function public.enforce_guest_order_verification is
  'Menahan order tamu di status `new` sampai diverifikasi admin (TASKS.md section 11 butir 1).';

drop trigger if exists enforce_guest_order_verification on public.orders;
create trigger enforce_guest_order_verification
  before update on public.orders
  for each row execute function public.enforce_guest_order_verification();
