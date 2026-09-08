-- =============================================================================
-- Bukti wajib menempel pada satu laporan tahap
--
-- Kolom `stage_event_id` sudah ada sejak `20260820000500` beserta triggernya,
-- tetapi tidak pernah diisi: `uploadDocumentation` mengabaikannya, dan panel
-- Dokumentasi yang berdiri sendiri memang tidak tahu tahap mana yang sedang
-- dibuktikan. Akibatnya bukti mengambang — terikat ke order, tidak ke pekerjaan
-- yang dibuktikannya.
--
-- Sejak `uploadDocumentation` menurunkan tahap & order dari baris tahapnya
-- (dikerjakan lebih dulu, sudah tayang), kolomnya selalu terisi. Migration ini
-- menutup pintunya: yang tidak menyebut laporan tahap tidak bisa lagi masuk.
--
-- **`on delete set null` harus ikut berubah.** Ia tidak bisa hidup bersama
-- NOT NULL: menghapus laporan tahap akan mencoba mengosongkan tautannya dan
-- menabrak constraint, sehingga penghapusan yang sah justru gagal. `cascade`
-- yang benar di sini — bukti bagi laporan yang sudah tidak ada adalah bukti
-- yatim yang tetap terhitung di gerbang kelengkapan, dan itu membuat gerbangnya
-- berbohong.
--
-- Produksi diperiksa sebelum migration ini ditulis: nol baris `documentations`.
-- Baris warisan di mesin dev tetap dibersihkan supaya `db reset` tidak patah.
-- =============================================================================

-- Bukti tanpa laporan tahap tidak punya arti lagi. Di produksi tidak ada yang
-- tersentuh; di dev ini membuang sisa percobaan lama.
delete from public.documentations where stage_event_id is null;

alter table public.documentations
  drop constraint documentations_stage_event_id_fkey;

alter table public.documentations
  add constraint documentations_stage_event_id_fkey
    foreign key (stage_event_id) references public.order_stage_events (id)
    on delete cascade;

alter table public.documentations
  alter column stage_event_id set not null;

comment on column public.documentations.stage_event_id is
  'Laporan tahap yang dibuktikan. Wajib: bukti yang tidak menempel pada pekerjaan tertentu tidak bisa dinilai, dan gerbang kelengkapan ikut menghitungnya.';
