-- =============================================================================
-- Tahap 5 — Documentation Flow · Tangga validasi ditegakkan di database
--
-- MASALAH
-- Urutan validasi dua tingkat (docs/10 section 4) selama ini hanya hidup di
-- `checkReview` (features/documentation/review.ts) — lapisan aplikasi. Kebijakan
-- RLS `documentations_update` jauh lebih longgar daripada aturan itu:
--
--   public.auth_role() = 'admin_pusat'                            -- baris mana pun
--   or (public.is_supervisor() and public.can_read_order(order_id)) -- baris mana pun di cabangnya
--
-- Keduanya tanpa syarat status. Artinya lewat panggilan PostgREST langsung:
--   1. Admin Pusat bisa melompat `pending -> approved`, melewati tingkat-1;
--   2. Supervisor bisa langsung menulis `approved`, padahal itu wewenang pusat;
--   3. Supervisor yang mengunggah sendiri bisa meloloskan buktinya sendiri —
--      persis pemisahan tugas yang docs/10 section 4 minta.
--
-- Dampaknya bukan kosmetik: gate `documentation -> reporting` menghitung
-- dokumentasi berstatus `approved`, dan laporan peserta hanya menampilkan yang
-- `approved`. Tangga yang bisa dilompati berarti bukti bisa terbit tanpa pernah
-- diperiksa dua mata.
--
-- SOLUSI
-- Trigger `before update` yang menegakkan tangga yang sama persis dengan
-- `checkReview`, di bawah RLS. Kebijakan RLS sengaja dibiarkan apa adanya:
-- tugasnya menentukan *baris mana* yang boleh disentuh, sementara *perpindahan
-- status mana* yang sah ditentukan di sini.
--
-- Acuan: docs/10 section 4, features/documentation/review.ts, TASKS.md section 3
-- =============================================================================

create or replace function public.enforce_documentation_review_ladder()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  -- Status tidak berubah: penyuntingan caption/berkas, bukan keputusan review.
  if new.status = old.status then
    return new;
  end if;

  -- Service role, seed, dan migration tidak punya `auth.uid()`. Di jalur itu RLS
  -- pun tidak berlaku, jadi tidak ada yang bisa ditegakkan di sini.
  if v_actor is null then
    return new;
  end if;

  -- `approved` adalah ujung tangga: bukti yang sudah dipakai laporan peserta
  -- tidak boleh dipindahkan diam-diam ke status lain.
  if old.status = 'approved' then
    raise exception 'Dokumentasi yang sudah tervalidasi penuh tidak dapat diubah statusnya'
      using errcode = 'check_violation';
  end if;

  -- Pemisahan tugas (docs/10 section 4). Ditaruh sebelum pemeriksaan peran
  -- supaya seorang Supervisor tetap ditolak pada barisnya sendiri.
  if new.status in ('approved_supervisor', 'approved', 'rejected')
     and old.uploaded_by is not null
     and old.uploaded_by = v_actor then
    raise exception 'Pengunggah tidak dapat memvalidasi dokumentasinya sendiri'
      using errcode = 'insufficient_privilege';
  end if;

  -- Atribusi review tidak boleh dialamatkan ke orang lain.
  if new.reviewed_by is distinct from old.reviewed_by
     and new.reviewed_by is distinct from v_actor then
    raise exception 'Hasil review hanya boleh dicatat atas nama pemanggil'
      using errcode = 'insufficient_privilege';
  end if;

  -- --- Tangga validasi ------------------------------------------------------
  --
  -- Cerminan REVIEWABLE_FROM + nextDocStatus di features/documentation/review.ts.
  -- Setiap perpindahan lain — termasuk `pending -> approved` — ditolak.
  if old.status = 'pending' and new.status in ('approved_supervisor', 'rejected') then
    if not public.is_supervisor() then
      raise exception 'Validasi tingkat-1 hanya oleh Supervisor yang ditunjuk'
        using errcode = 'insufficient_privilege';
    end if;

  elsif old.status = 'approved_supervisor' and new.status in ('approved', 'rejected') then
    if public.auth_role() is distinct from 'admin_pusat' then
      raise exception 'Validasi tingkat akhir hanya oleh Admin Pusat'
        using errcode = 'insufficient_privilege';
    end if;

  elsif old.status = 'rejected' and new.status = 'pending' then
    -- Unggah ulang oleh pengunggahnya sendiri; sejalan dengan RLS
    -- `documentations_update` yang mengizinkan pemilik baris berstatus
    -- `pending` / `rejected`.
    if old.uploaded_by is distinct from v_actor then
      raise exception 'Hanya pengunggah yang dapat mengajukan ulang dokumentasi yang ditolak'
        using errcode = 'insufficient_privilege';
    end if;

  else
    raise exception 'Perpindahan status dokumentasi % -> % tidak sah', old.status, new.status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function public.enforce_documentation_review_ladder is
  'Menegakkan urutan validasi dua tingkat & pemisahan tugas di bawah RLS (docs/10 section 4).';

drop trigger if exists enforce_documentation_review_ladder on public.documentations;
create trigger enforce_documentation_review_ladder
  before update on public.documentations
  for each row execute function public.enforce_documentation_review_ladder();
