-- =============================================================================
-- Gerbang urutan tahap dilonggarkan: `validated` → `reported` cukup
--
-- Aturan lama menutup tahap ke-N sampai seluruh tahap sebelumnya **tervalidasi
-- admin**. Migration aslinya (`20260820000400`) sudah menuliskan konsekuensinya
-- dengan jujur dan menyiapkan jalan keluarnya:
--
--   "Konsekuensinya nyata — admin jadi penghambat di tiap tahap. Kalau lapangan
--    mengeluh, longgarkan ke `status in ('reported','validated')`; satu baris.
--    Mulai ketat lebih murah daripada mengetatkan setelah orang terlanjur
--    terbiasa longgar."
--
-- Lapangan mengeluh. Ini jalan keluar itu, persis seperti yang disiapkan.
--
-- **Yang berubah:** mitra tidak lagi menunggu admin di tiap tahap. Selesai
-- melaporkan sembelih, ia bisa langsung melaporkan masak — admin menyusul
-- memvalidasi kapan sempat. Pekerjaan lapangan tidak lagi berhenti menunggu
-- orang yang sedang tidak di depan layar.
--
-- **Yang TIDAK berubah, dan itu disengaja:**
--
--   1. Urutannya tetap dijaga. Tahap yang belum disentuh sama sekali (`pending`)
--      masih menahan tahap sesudahnya — laporan tidak bisa masuk dengan urutan
--      yang mustahil, misalnya salur sebelum sembelih.
--   2. Tahap yang **ditolak** (`rejected`) tetap menahan. Ia sudah dinilai dan
--      dinyatakan kurang; melanjutkan di atasnya berarti menumpuk pekerjaan di
--      atas dasar yang admin sudah bilang salah.
--   3. Pemisahan tugas (`enforce_stage_review`) tidak tersentuh: yang melapor
--      tetap tidak boleh memvalidasi laporannya sendiri.
--   4. Gerbang kelengkapan bukti (`missing_doc_stages`) tetap menuntut bukti
--      **`approved`** sebelum order boleh naik ke Pelaporan. Melonggarkan
--      urutan kerja tidak berarti melonggarkan apa yang tercetak di laporan
--      peserta.
--
-- Cerminannya di TypeScript (`canReportStage`) ikut diubah dalam commit yang
-- sama. Kalau keduanya menyimpang, tombol di layar akan menawarkan sesuatu yang
-- database tolak — atau sebaliknya, menyembunyikan yang sebenarnya boleh.
-- =============================================================================

create or replace function public.enforce_stage_order()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_blocking text;
begin
  if new.status = 'pending' or new.status = old.status then
    return new;
  end if;

  select string_agg(distinct e.stage::text, ', ')
  into v_blocking
  from public.order_stage_events e
  where e.order_id = new.order_id
    and e.seq < new.seq
    -- Inilah satu-satunya perubahannya. `reported` kini ikut membuka tahap
    -- berikutnya; `pending` dan `rejected` tetap menahan.
    and e.status not in ('reported', 'validated');

  if v_blocking is not null then
    raise exception 'Tahap sebelumnya belum dilaporkan: %', v_blocking
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

comment on function public.enforce_stage_order is
  'Tahap ke-N tertutup sampai tahap sebelumnya dilaporkan (bukan lagi tervalidasi). Tahap yang ditolak tetap menahan — melanjutkan di atas dasar yang sudah dinyatakan kurang tidak masuk akal.';
