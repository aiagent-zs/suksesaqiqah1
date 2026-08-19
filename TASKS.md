# TASKS — Status Pengerjaan Sukses Aqiqah

> Peta apa yang **sudah jadi**, apa yang **belum**, dan apa yang **harus dikejar berikutnya**.
> Urutan tahap mengikuti `TEAM_PLAN.md §3`; definisi modul mengikuti `docs/06_MODULE_BREAKDOWN.md`.
> Urutan otoritas kebenaran: **migrations → kode (`features/`, `app/`, `server/`) → `prd.md` → `docs/`**.

| Field | Value |
|-------|-------|
| Dokumen | `TASKS.md` |
| Diperbarui | 2026-08-19 |
| Fase aktif | **Phase 1 — Operational MVP** (`docs/23_MVP_ROADMAP.md`) |
| Estimasi Phase 1 | **± 85%** |
| Terverifikasi pada pembaruan ini | `npm run build` ✅ · `npm run typecheck` ✅ · `npm run lint` ✅ · **323 test hijau (25 file)** · 22 migration ⚠️ 6 belum di-push |

**Aturan pemeliharaan:** centang item hanya kalau kodenya ada **dan** `npm run typecheck` + `npm run build` hijau (Definition of Stable, `TEAM_PLAN §1.5`). Item yang belum diverifikasi dengan data sungguhan ditandai ⚠️, bukan dicentang.

---

## Perubahan sejak pembaruan 2026-08-14

Penyesuaian form pemesan dari lapangan — tiga permintaan, satu migration baru
(`20260819010000_checkout_booking.sql`, **belum di-push**).

- **Domba dicabut dari checkout publik.** Aqiqah kini hanya kambing; qurban
  kambing atau sapi. Enum `animal_species` tidak disentuh — order yang dibuat
  staf masih boleh memakai domba. Detail di §8.
- **Pemilih wilayah layanan dihapus dari form.** `orders.branch_id` tetap NOT
  NULL, jadi cabangnya kini ditentukan server lewat kolom baru
  `branches.is_default`. Detail di §8.
- **Pemesan memilih tanggal & jam pelaksanaan, maksimal 7 hari ke depan** —
  kolom baru `orders.requested_date` / `requested_time`. Detail di §8.
- **Wizard checkout dipadatkan dari 6 langkah jadi 4** — "Aqiqah untuk",
  "Paket", dan "Nasi box" disatukan jadi satu langkah **Pesanan**. Detail di §8.
- **Alamat pengiriman jadi terstruktur** — Provinsi → Kabupaten/Kota →
  Kecamatan → Kelurahan/Desa bertingkat dari tabel `regions` yang baru
  (data Kepmendagri 2025, 91.599 baris), plus kode pos dan detail jalan.
  Dua migration lagi: `20260819020000_regions.sql` &
  `20260819030000_structured_delivery_address.sql`. Detail di §8.
- **Lima role diringkas jadi tiga: superadmin, admin, vendor** —
  `20260819040000_three_roles.sql`. Perubahan paling dalam pada pembaruan ini:
  enum ditukar, seluruh kebijakan RLS yang menyebut role ditulis ulang, scope
  per cabang pensiun, dan validasi dokumentasi jadi satu tingkat. Detail di
  §1 Tahap 3.

> ⚠️ Keenamnya menambah kolom & tabel yang **sudah dibaca kode**
> (`requested_date`, `requested_time`, `branches.is_default`, `regions`,
> `orders.delivery_*`) dan mengganti `create_guest_order` serta seluruh enum
> role. Selama belum di-push, checkout publik gagal mencatat pesanan, halaman
> detail order gagal memuat, dan **tidak seorang pun bisa login dengan benar**
> — kode sudah membandingkan role dengan nilai yang belum ada di database.

**Estimasi Phase 1 tidak bergerak.** Seluruh pekerjaan di atas ada di Tahap 10,
yang tidak muncul di Definition of Done Phase 1 (§12); empat butir DoD yang
tersisa tidak tersentuh.

---

## Perubahan sejak pembaruan 2026-08-13

Tiga pekerjaan, dua di antaranya menuntut migration yang **belum di-push**.

- **Loop order tamu ditutup** — penanda & filter di daftar order, panel + antrian verifikasi, kartu dashboard. Detail di §8.
- **Tangga validasi dokumentasi ditegakkan di database** — sebelumnya hanya di `checkReview`, sementara RLS `documentations_update` cukup longgar untuk melompatinya lewat API langsung. Detail di §3.
- **Rem laju checkout publik per alamat IP** — rem lama hanya per nomor telepon, yang dikirim pengirimnya sendiri. Detail di §8.

> ⚠️ **Wajib sebelum dipakai:** `npm run db:push`. Dua migration baru
> (`20260814010000_guest_order_verification.sql`, `20260814020000_documentation_review_ladder.sql`)
> menambah kolom `orders.guest_verified_at` / `guest_verified_by` yang **sudah dibaca kode**.
> Selama belum ter-push, daftar order dan halaman detail akan gagal memuat.

**Kenapa estimasi Phase 1 hanya naik 1%.** Sama seperti pembaruan sebelumnya: dua dari tiga pekerjaan di atas mendorong **Tahap 10**, yang tidak muncul di Definition of Done Phase 1 (§12). Empat butir DoD yang tersisa masih persis sama — tidak ada yang tersentuh. Kenaikan kecilnya murni dari pengerasan Tahap 5.

---

## Perubahan sejak pembaruan 2026-08-07

Sepuluh commit (semua 11 Agustus) belum tercatat di revisi sebelumnya:

- **Checkout mandiri guest dibangun** — prasyarat migration yang dulu ditulis "belum bisa dimulai" sudah ada. Detail di §8.
- **Keluar otomatis saat menganggur** — middleware + `IdleLogout`, ambang 30 menit (§1 Tahap 2).
- **Navigasi mobile** — bottom-nav + panel `≡`; sebelumnya di bawah 1024px tidak ada cara berpindah halaman atau keluar sistem (§10).
- **Panel Kendala** (sudah tercatat di §2) dan penanda aktif sidebar yang diturunkan dari pathname.
- **Perbaikan token design system** (13 Agustus) — §10.

**Kenapa estimasi Phase 1 hanya naik 2%.** Sebagian besar pekerjaan di atas mendorong **Tahap 10** (Public Platform), yang tidak muncul sama sekali di Definition of Done Phase 1 (§12). Empat butir DoD yang tersisa — pilot end-to-end, cakupan dokumentasi tervalidasi, pengiriman laporan otomatis, UAT + checklist keamanan — tidak tersentuh. Kenaikan kecil itu datang dari pengerasan auth dan navigasi mobile, bukan dari checkout.

---

## 0. Litmus test — tolok ukur tunggal

> *"Berapa order yang belum selesai, di lokasi mana, siapa PIC-nya, apa kendalanya?"* — harus terjawab **< 10 detik**.

- [x] Terjawab di `/dashboard` lewat `v_open_orders` — nomor order, cabang, lokasi, PIC, status, kendala, umur, terurut keparahan lalu umur.
- [x] Terverifikasi dengan data seed di Supabase cloud (5 order tertunda, 3 kendala terbuka).
- [ ] Terverifikasi dengan data operasional asli 1 cabang pilot.

---

## 1. Tahap 0–3 · Fondasi — **SELESAI**

### Tahap 0 · Fondasi bersama
- [x] Init Next.js 16 + React 19 + Tailwind 4 + TypeScript
- [x] Struktur folder sesuai `docs/24_FOLDER_STRUCTURE.md`
- [x] Tooling: ESLint, Prettier, Vitest, `npm run typecheck`
- [x] `.env.example` lengkap (termasuk `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` & `SUPABASE_DB_URL`)

### Tahap 1 · Database — *Bani*
- [x] 22 migration di `supabase/migrations/` — 20 tabel, enum, index, trigger
  <br>*(13 fondasi + `public_report_rpc` + 2 migration guest checkout + 2 migration pengerasan 14 Agustus + 4 migration penyesuaian 19 Agustus; **enam terakhir belum di-push**, lihat §1 Tahap 3, §3 & §8)*
- [x] 3 view KPI: `v_order_progress`, `v_branch_kpi`, `v_open_orders` (semua `security_invoker = on`)
- [x] RPC: `create_order`, `next_order_number`, `min_dp_ratio`, helper `can_read_order` / `can_write_order`
- [x] Storage buckets + GRANT eksplisit untuk `anon` / `authenticated`
- [x] Seed `01_master.sql` (cabang, lokasi) & `02_demo.sql` (7 akun demo — 2 superadmin, 3 admin, 2 vendor — + order contoh)
- [x] **Ter-push & terverifikasi di Supabase cloud** — ketiga view mengembalikan data

### Tahap 2 · Auth — *Bani*
- [x] Login email+password, `auth/callback`, `logout`
- [x] `getSession` / `requireAuth` / `requireRole` di `server/auth/session.ts`
- [x] Proxy/middleware redirect route terproteksi
- [x] Guard environment (`lib/supabase/env.ts`) — kredensial kosong gagal dengan pesan yang menyebut variabelnya
- [x] **Keluar otomatis saat menganggur** (ambang 30 menit, `lib/auth/idle.ts`). Supabase menyegarkan token di tiap permintaan lewat middleware, jadi sesi yang ditinggal tidak pernah kedaluwarsa sendiri. Ditegakkan di **middleware** lewat cookie `httpOnly` — berlaku sekalipun JavaScript mati — sementara `IdleLogout` di klien hanya membuat waktunya tepat, karena tab yang menganggur tidak mengirim permintaan apa pun

### Tahap 3 · RBAC / RLS — *Bani*

**Tiga role sejak 19 Agustus 2026** (`20260819040000_three_roles.sql`, belum
di-push). Lima role lama dirancang untuk organisasi bercabang; kenyataannya
operasi berjalan **satu tempat** dan yang banyak adalah vendornya. Alurnya:
pesanan masuk -> admin memvalidasi -> admin mencari vendor yang siap -> vendor
mengerjakan & mengunggah bukti -> admin memvalidasi bukti itu.

| Role | Wewenang |
|------|----------|
| **superadmin** | Segalanya: master data, harga (`total_amount`), penghapusan order & catatan lapangan, pengelolaan user |
| **admin** | Penghubung pembeli & vendor: verifikasi order tamu, catat & verifikasi pembayaran, penugasan vendor, validasi bukti dari vendor, laporan |
| **vendor** | Pelaksana: catat pemotongan & distribusi, unggah bukti, lapor kendala - **hanya pada order yang ditugaskan padanya** |

Pemetaan dari role lama: `direktur` + `manager_program` -> **superadmin**;
`admin_pusat` + `admin_cabang` -> **admin**; `petugas_lapangan` -> **vendor**.

- [x] RLS aktif di seluruh tabel + kebijakan per role
- [x] Matriks kapabilitas action-level (`server/auth/capabilities.ts`) + unit test —
  termasuk tes yang menuntut **superadmin memegang setiap kapabilitas**, janji
  yang paling gampang dilanggar diam-diam saat menambah kapabilitas baru
- [x] **Enum ditukar, bukan ditambah.** `alter type … add value` akan
  meninggalkan lima nilai lama yang masih sah dipakai. Menukar tipenya memaksa
  tiap baris dipetakan ulang sekarang juga — dengan konsekuensi seluruh
  kebijakan yang menyebut role harus dilepas dan dibangun ulang di migration
  yang sama
- [x] Pelepasan fungsi lama **sengaja tanpa `CASCADE`** — kalau masih ada yang
  bergantung pada `auth_role()` di luar daftar yang dibangun ulang, migration
  harus gagal berisik, bukan diam-diam menghapus kebijakan yang tak tergantikan
- [x] `can_read_order` / `can_write_order` di-`create or replace`, tidak
  di-`drop`: belasan kebijakan RLS bergantung padanya, dan menghapusnya berarti
  ikut menghapus kebijakannya
- [x] `is_central()` -> `is_staff()` (superadmin atau admin) + `is_superadmin()`
- [x] **Vendor tidak bisa menugaskan dirinya sendiri.** `can_read_order` memberi
  vendor akses justru lewat `schedules.pic_user_id`, jadi menulis jadwal berarti
  bisa membuka order mana pun. `schedules_write` menuntut `is_staff()`
- [x] **Vendor sama sekali di luar urusan uang** — `payments_select` menuntut
  `is_staff()`, jadi panel pembayaran tidak dirender untuk mereka dan barisnya
  pun tidak terbaca
- [x] **Vendor hanya melihat profilnya sendiri** — daftar vendor lain bukan
  urusannya (`profiles_select`)
- [x] **Pengelolaan user berhenti di superadmin.** Admin sengaja tidak ikut:
  siapa pun yang bisa mengubah role bisa mengangkat dirinya sendiri
- [x] Akun baru lahir sebagai `vendor` **non-aktif** — kerja sama dengan vendor
  dimulai dari kesepakatan, bukan dari pendaftaran. `auth_role()` mengembalikan
  NULL selama `is_active` masih false, jadi akunnya belum bisa apa-apa
- [x] `profiles.is_supervisor` dibuang — penanda itu hanya berarti pada tangga
  validasi dua tingkat yang kini ditiadakan (lihat §3)
- [x] **Cabang dicabut dari seluruh permukaan pengguna.** Yang hilang: filter
  "Cabang" di dashboard, order, jadwal, dan validasi (beserta `branch_id` di
  keempat filter schema-nya); grafik "Order Tertunda per Cabang"; kolom Cabang
  di tabel order dan kartu jadwal; dan pemilih cabang di form Order Baru.
  Cabang order kini ditentukan server (`getDefaultBranchId`) dengan urutan yang
  sama persis dengan `create_guest_order` — jadi order dari admin dan order dari
  checkout publik selalu mendarat di cabang yang sama
- [x] Tautan lama yang masih membawa `?branch_id=` **diabaikan, bukan
  digagalkan** — seluruh filter schema memakai `.catch()`, dan ada tesnya
- [ ] **`branches` sendiri belum dibongkar, dan itu disengaja.** Tabelnya serta
  `orders.branch_id` tetap ada karena menyusun nomor order (`IA-YYYYMM-####`)
  dan path Storage (`BDG/2026/08/…`); `v_branch_kpi` juga masih beragregasi per
  cabang — dengan satu cabang hasilnya satu baris, dan `aggregateBranchKpi`
  tetap benar seandainya suatu saat bertambah lagi. Membongkarnya menyentuh view
  KPI, penomoran, dan seluruh path berkas yang sudah terlanjur ditulis —
  pekerjaan tersendiri, bukan bagian pembersihan filter
- [ ] **Role masih bisa dikirim lewat user metadata saat signup.**
  `handle_new_user` membacanya dari `raw_user_meta_data` (jalur admin membuat
  akun). Kalau signup mandiri dibuka di Supabase, seseorang bisa mendaftar
  sebagai `admin`. Bukan regresi — perilakunya sudah begitu sejak Tahap 2 —
  tapi wajib ditutup sebelum produksi, entah dengan invite-only atau dengan
  mengabaikan metadata role sama sekali
- [ ] Uji positif & negatif belum diulang di cloud dengan tiga role; hasil lama
  (direktur 5 order · admin cabang 3 · petugas 1) sudah tidak berlaku

---

## 2. Tahap 4 · Order Management — **± 98%** — *Bani*

### Sudah jadi
- [x] CRUD order + nomor unik `IA-YYYYMM-####` (atomik lewat `order_counters`)
- [x] State machine transisi status + guard (`features/orders/state-machine.ts`) + unit test
- [x] 1 order banyak hewan: registrasi, ubah status, hapus (`animal-state-machine.ts`) + unit test
- [x] Filter, pencarian lintas tabel, paginasi berbasis URL
- [x] Halaman detail order + timeline audit
- [x] Audit trail otomatis lewat trigger

#### Payment — catat & verifikasi (`prd.md` FR-P1 · FR-P2 · FR-P4)
- [x] Catat pembayaran (nominal, metode, catatan) → baris `payments` berstatus `pending`
- [x] Unggah bukti transfer **langsung browser → Storage**, path-nya baru dikirim ke Server Action (badan Server Action dibatasi 1 MB, bucket menerima 5 MB)
- [x] Validasi MIME & ukuran di klien, bucket, dan server action
- [x] Path bukti diverifikasi ulang terhadap cabang + nomor order (`isProofPathForOrder`) — kebijakan Storage hanya membatasi bucket, bukan folder
- [x] Verifikasi / tolak dengan alasan wajib; `verified_by` & `verified_at` tercatat
- [x] Penguncian optimistik: dua verifikator bersamaan tidak bisa sama-sama berhasil
- [x] Tolak kelebihan bayar saat pencatatan **dan** saat verifikasi
- [x] Hapus catatan yang masih `pending` (yang sudah terverifikasi adalah bukti keuangan, tidak dapat dihapus)
- [x] Riwayat pembayaran + signed URL bukti (TTL 10 menit, `docs/17 §4`)
- [x] Indikator gate DP di panel pembayaran
- [x] **Terverifikasi di cloud:** `pending` tidak menggerakkan `paid_amount`; `verified` mengubahnya ke `partial`/`paid` lewat trigger `sync_order_payment`. Petugas lapangan `[]` saat membaca, `403` saat menulis.
- [ ] Integrasi payment gateway (bagian FR-P2 yang tersisa) → Tahap 10

#### Scheduling & Assignment (`prd.md` FR-S1 · FR-S2 · FR-S3)
- [x] Tetapkan tanggal, jam, lokasi, PIC, dan catatan jadwal — upsert pada `order_id` yang unik, jadi penyuntingan kedua tidak menabrak constraint
- [x] Lokasi divalidasi milik cabang order (`locations` dapat dibaca lintas cabang, jadi RLS saja tidak cukup)
- [x] PIC divalidasi Petugas Lapangan **aktif** di cabang yang sama (kolomnya hanya ber-FK ke `profiles`, tanpa cek ini seorang Direktur bisa tercatat sebagai PIC lapangan)
- [x] Status pelaksanaan `planned → ongoing → done` satu tahap, dua arah, dengan penguncian optimistik
- [x] Aturan "jadwal lengkap" disatukan di `isScheduleComplete` — dipakai guard state machine **dan** pesan "apa yang kurang" di panel, supaya keduanya tidak pernah berbeda
- [x] Halaman `/schedule`: filter cabang / lokasi / petugas / status / rentang tanggal, tabel desktop + kartu mobile, paginasi URL
- [x] Tautan Google Maps dari koordinat lokasi; koordinat rusak sengaja tidak bertautan
- [x] `/schedule` didaftarkan di `PROTECTED_PREFIXES` dan masuk sidebar
- [x] **Terverifikasi di cloud:** upsert idempoten (dua kali simpan tetap satu baris), filter bersarang PostgREST `order.branch_id` & `order.status` bekerja lewat `!inner`, dan petugas lapangan mendapat 0 baris saat mencoba mengubah jadwal

#### Slaughter & Distribution (`prd.md` FR-SL1 · FR-SL2 · FR-SL3)
- [x] Catat pemotongan per hewan (waktu, pelaksana, catatan) — sekaligus menaikkan status hewan ke Dipotong, karena itulah yang dibaca `v_order_progress`
- [x] Satu hewan satu catatan pemotongan (tabelnya tanpa constraint unik, jadi ditegakkan di action)
- [x] Waktu pelaksanaan tidak boleh di masa depan (toleransi selisih jam 5 menit)
- [x] Catat distribusi: penerima, area, jumlah paket, waktu, koordinat opsional
- [x] Distribusi menolak order yang belum satu ekor pun dipotong (`docs/06 §5`)
- [x] Centang hewan yang tercakup penyaluran → naik ke Terdistribusi; kepemilikannya diverifikasi ke database, bukan dipercaya dari klien
- [x] Koordinat wajib berpasangan; di luar rentang bumi ditolak
- [x] Hapus catatan dibatasi Manager Program (`DELETE_FIELD_RECORD`); menghapus catatan potong mengembalikan hewan ke Disiapkan
- [x] Petugas Lapangan bisa mencatat keduanya pada order yang ia PIC-i, sesuai `can_write_order`
- [x] **Terverifikasi di cloud:** petugas mencatat potong + distribusi pada order-nya sendiri → `pct_slaughter` 0→100%, `pct_distribution` 0→100%, `distribution_count` 1, `packages_total` 12. Seluruh data uji dikembalikan.

#### Issues — tandai & kelola kendala (`prd.md` FR-SL4 · `docs/06 §1`)
- [x] Panel Kendala di halaman detail order — jalur pembuatan kendala pertama dari UI; sebelumnya tabel `issues` hanya bisa terisi lewat seed
- [x] Laporkan kendala: judul, tingkat keparahan, deskripsi opsional → baris `issues` berstatus `open`
- [x] `status` tidak pernah datang dari klien saat pelaporan — kendala selalu lahir `open`, karena itulah yang membuatnya terhitung di panel dashboard
- [x] Ubah status dua arah `open ↔ in_progress ↔ resolved`; kendala yang ternyata belum beres bisa dibuka kembali
- [x] `resolved_by` & `resolved_at` **diturunkan dari status tujuan**, tidak pernah dikirim klien — constraint `issues_resolved_consistency_check` menuntut `resolved_at` terisi tepat ketika statusnya `resolved`, dan kosong di status lain
- [x] Menulis ulang status yang sama ditolak; tanpa itu "Tandai selesai" dua kali akan menggeser waktu penyelesaian yang sudah tercatat
- [x] Penguncian optimistik: dua operator yang mengubah status bersamaan tidak bisa sama-sama berhasil
- [x] Koreksi isi (judul/keparahan/deskripsi) dipisah dari perubahan status, supaya perbaikan redaksional tidak menyentuh `resolved_at`
- [x] Tanpa tombol hapus — tabel `issues` memang tanpa kebijakan RLS `delete`; kendala dikoreksi atau ditutup, bukan dihapus
- [x] Kapabilitas `MANAGE_ISSUES` disamakan persis dengan `can_write_order`, jadi Petugas Lapangan bisa melapor sendiri dari lapangan
- [x] `ISSUE_OPEN_STATUSES` menyatukan definisi "kendala terbuka" dengan `v_open_orders` / `v_order_progress` (`open` + `in_progress`), supaya hitungan di panel order tidak pernah berbeda dari angka dashboard
- [x] **Terverifikasi di cloud:** petugas melapor & menangani kendala pada order yang ia PIC-i → berhasil; pada order di luar PIC-nya → ditolak RLS; direktur bisa membaca lintas cabang tapi ditolak saat menulis; `delete` menghasilkan 0 baris bahkan bagi Manager Program. Constraint menolak `resolved` tanpa `resolved_at` **dan** pembukaan kembali tanpa mengosongkannya; trigger `audit_issues` mencatat tiap perubahan. Seluruh data uji dikembalikan.

### Harus dikejar
- [ ] Status hewan masih bisa diubah langsung lewat panel Hewan **tanpa** catatan pemotongan. Guard `slaughtering → distribution` membaca `animals.status`, jadi jalur itu melepas transisi tanpa bukti. Perlu diputuskan: kunci status hewan agar hanya bergerak lewat catatan pemotongan, atau biarkan sebagai jalur koreksi.

> Order kini bisa berjalan **penuh dari `new` sampai `completed`** lewat UI — seluruh guard state machine punya jalur pengisiannya masing-masing. Yang tersisa adalah otomasi, kenyamanan lapangan, dan sisi publik.

---

## 3. Tahap 5 · Documentation Flow — **± 88%** — *Bani*

- [x] Tabel `documentations` + enum `doc_status` / `doc_stage` / `doc_type` + RLS
- [x] Storage bucket
- [x] Unggah foto/video/catatan, tertaut ke order + tahap + hewan (opsional) — berkas langsung browser → Storage, path baru dikirim ke Server Action
- [x] Path diverifikasi ulang terhadap cabang + nomor order + tahap (`isDocPathForOrder`); kebijakan Storage hanya menuntut role, sama sekali tidak membatasi folder
- [x] **Validasi satu tingkat sejak 19 Agustus 2026**: vendor unggah (`pending`) → admin/superadmin memutuskan (`approved` / `rejected`), tolak wajib beralasan. Tangga dua tingkat lama (Supervisor → Admin Pusat) ikut pensiun bersama lima role (§1 Tahap 3)
- [x] `approved_supervisor` **tetap ada di enum sebagai jalur warisan** — tidak ada lagi yang membuatnya, tapi baris yang sempat lolos tingkat-1 sebelum perubahan akan terjebak selamanya kalau jalurnya ditutup. `REVIEWABLE_DOC_STATUSES` dan trigger menerima jalur yang sama persis
- [x] Wewenang validasi **diturunkan dari role**, tidak pernah dikirim klien — vendor tidak bisa meminta `approved` untuk unggahannya sendiri
- [x] **Pemisahan tugas** (`docs/10 §4`): pengupload tidak dapat memvalidasi unggahannya sendiri — tetap berlaku meski tingkatnya tinggal satu, jadi admin yang ikut mengunggah pun ditolak pada barisnya sendiri
- [x] Penguncian optimistik: dua validator bersamaan tidak bisa sama-sama berhasil
- [x] Halaman `/validation` — satu antrian (`pending` + sisa `approved_supervisor`), filter cabang & tahap, urut tertua dulu, paginasi
- [x] **Gate diperketat sesuai `docs/10 §5`**: `documentation → reporting` kini menuntut ≥1 bukti **pemotongan** DAN ≥1 bukti **distribusi** yang tervalidasi penuh — sebelumnya cukup "ada satu dokumentasi apa pun"
- [x] Pratinjau media memakai `<img>`/`<video>` biasa, bukan `next/image`: optimizer Next akan menyimpan salinan yang tetap tersaji setelah signed URL ber-TTL 10 menit kedaluwarsa (`docs/10 §8`)
- [x] Dokumentasi `approved` tidak dapat dihapus — bukti itu dipakai laporan peserta
- [x] **Terverifikasi di cloud:** petugas unggah → `pending`; percobaan menyetujui sendiri ditolak RLS (`42501`); Supervisor → `approved_supervisor`; Admin Pusat → `approved`; hitungan gate per tahap `slaughter=1, distribution=0` sehingga order tetap tertahan. Data uji dibersihkan.
- [ ] Antrian validasi tingkat-1 belum tampil di Cabang Dashboard (`docs/09 §4`) — saat ini hanya di `/validation`
- [ ] Notifikasi ke Supervisor saat ada unggahan baru & ke Petugas saat ditolak (`docs/10 §7`) — bergantung Tahap 8
- [ ] Kompresi gambar di klien & antrian upload offline (`docs/13`) — bergantung PWA
- [ ] Pelucutan EXIF/GPS sebelum unggah (`docs/17 §4`, `docs/20`)

> **Kedalaman pertahanan — sudah ditutup (14 Agustus).** Sebelumnya urutan dua tingkat hanya hidup di `checkReview`, sementara `documentations_update` memberi Admin Pusat wewenang penuh atas baris mana pun **dan** Supervisor wewenang penuh atas baris yang bisa ia baca — keduanya tanpa syarat status. Lewat PostgREST langsung itu berarti tiga jalan pintas sekaligus: Admin Pusat melompat `pending → approved`, Supervisor menulis `approved` yang bukan wewenangnya, dan Supervisor yang mengunggah sendiri meloloskan buktinya sendiri.
>
> Trigger `enforce_documentation_review_ladder` (`20260814020000`) kini menegakkan tangga yang sama persis dengan `checkReview` di bawah RLS: transisi sah hanya `pending → approved_supervisor|rejected` (Supervisor), `approved_supervisor → approved|rejected` (Admin Pusat), dan `rejected → pending` (pengunggahnya sendiri). `approved` jadi ujung tangga, `reviewed_by` tidak bisa dialamatkan ke orang lain, dan pengunggah ditolak pada barisnya sendiri. Kebijakan RLS sengaja tidak diubah — tugasnya menentukan *baris mana* yang boleh disentuh, bukan *perpindahan status mana* yang sah.
>
> ⚠️ Belum diverifikasi di cloud: migration-nya belum di-push.

→ `docs/10_DOCUMENTATION_FLOW.md`, kapabilitas `UPLOAD_DOCUMENTATION` / `VALIDATE_DOC_LEVEL1` / `VALIDATE_DOC_FINAL`

---

## 4. Tahap 6 · Reporting Engine — **± 80%** — *Awalin*

- [x] Generate PDF per order (React PDF) — ringkasan, status pelaksanaan, catatan distribusi, galeri bukti, catatan lapangan
- [x] `serverExternalPackages: ['@react-pdf/renderer']` di `next.config.ts` — dependensi non-JS-nya rusak bila ikut dibundel
- [x] Halaman publik bertoken `app/r/[token]` tanpa login, `noindex`, dan `/r/` masuk `robots.txt`
- [x] Unduh PDF dari halaman publik lewat signed URL (TTL 10 menit)
- [x] Versi laporan tercatat di `reports`; generate ulang menambah versi **tanpa** mengubah `public_token`, jadi tautan yang sudah dibagikan tetap sama
- [x] Hanya dokumentasi `approved` yang masuk laporan; kontak peserta (telepon/email/alamat) tidak pernah ikut
- [x] Gate kelengkapan dokumentasi diperiksa ulang saat generate — laporan manual tidak bisa melewati `docs/10 §5`
- [x] Kirim tautan via WA.me + salin tautan + tandai terkirim (`sent_at` inilah yang dibaca `v_order_progress.report_sent`, syarat `reporting → completed`)
- [x] Foto WebP dilewati saat menyematkan ke PDF — React PDF hanya menerima JPEG/PNG mentah dan menghasilkan PDF rusak, bukan galat yang terlihat
- [x] Maksimal 6 foto disematkan; tanpa batas, satu permintaan bisa menahan ratusan MB di memori server
- [x] Migration `20260807010000_public_report_rpc.sql` **ter-push ke cloud**
- [x] **Terverifikasi di cloud:** anon memanggil RPC dengan token sah → payload satu order lengkap; token ngawur → `null`; sementara `orders`, `participants`, dan `documentations` tetap `[]` untuk anon
- [ ] Kirim via Email (baru WA.me) — bergantung Tahap 8
- [ ] QR code ke halaman publik pada PDF (`docs/11 §3`) — butuh dependensi baru
- [ ] Rate limiting percobaan token (`docs/11 §6`)

→ `docs/11_REPORTING_ENGINE.md`

> **Kenapa butuh migration.** Pengunjung anonim tidak punya akses apa pun: seluruh RLS ditujukan `to authenticated` dan `anon` hanya di-grant `SELECT` pada `services`. RPC `get_public_report(token)` bersifat `SECURITY DEFINER` dan mengunci bentuk keluarannya **di level database** — satu order saja, dokumentasi `approved` saja, tanpa kontak peserta. Pilihan ini diambil ketimbang memakai service role di halaman publik, karena dengan service role seluruh pembatasan bergantung pada kebenaran kode TypeScript saya.
>
> **Catatan data seed.** `storage_path` pada `02_demo.sql` berbentuk `documentation/JKT/2026/08/order-4/...` — menyertakan nama bucket dan memakai `order-4`, bukan nomor order asli. Kode menulis path **relatif-bucket** (`JKT/2026/08/IA-202608-0001/...`) sesuai `docs/17 §3`, dan bucket `documentation` di cloud memang masih kosong. Jadi halaman publik untuk order seed tidak menampilkan foto — itu placeholder seed, bukan penandatanganan yang rusak.

> Service role tetap dipakai, tapi **hanya untuk menandatangani berkas** yang path-nya sudah dikembalikan RPC (`server/services/public-report.ts`) — penandatanganan tidak bisa memakai kunci publik karena `storage_documentation_read` ditujukan `to authenticated`, sementara pembaca halaman ini anonim.

---

## 5. Tahap 7 · Dashboard & Monitoring — **± 90%** — *Awalin*

### Sudah jadi
- [x] 5 KPI card inti: Total Order, Potong, Distribusi, Dokumentasi, Laporan
- [x] 4 kartu operasional: Order Tertunda, Kendala Terbuka, Belum Lunas, Order Ditahan
- [x] Agregat lintas cabang **ditimbang jumlah order**, bukan rata-rata polos
- [x] Bar "Order Tertunda per Cabang" (role pusat)
- [x] Panel kendala per tingkat keparahan + 5 sorotan teratas
- [x] Tabel litmus test + versi kartu mobile + paginasi
- [x] Filter cabang / tahap / keparahan / hanya-berkendala (form GET, state di URL)
- [x] Sadar role: Executive · Validasi Pusat · Cabang · Tugas Saya
- [x] Drill-down KPI card & baris tabel → `/orders`
- [x] Unit test agregasi + filter schema

### Harus dikejar
- [ ] **Filter periode** — `v_branch_kpi` agregat tanpa dimensi tanggal, jadi butuh perubahan view (migration, satu pintu di Bani). Alasannya tercatat di `features/dashboard/schema.ts`.
- [ ] **Supabase Realtime** — update live saat status/dokumentasi berubah (`docs/09 §8`)
- [ ] Dashboard Lokasi + peta Google Maps (`docs/09 §5`)
- [ ] Tombol aksi cepat di Petugas Dashboard: catat potong, catat distribusi, upload dokumentasi (`docs/09 §6`) — bergantung Tahap 4 & 5
- [ ] Ukur beneran target performa: initial paint < 3 dtk

---

## 6. Tahap 8 · Automation & Notification — **± 5%** — *Bani*

- [x] Tabel `notifications` + enum channel/status
- [ ] Outbox notifikasi + worker pengirim
- [ ] Alert in-app di dashboard (`docs/12`)
- [ ] Workflow n8n: reminder H-1, generate & kirim laporan (`docs/18`)
- [ ] Folder `automation/` masih kosong (`.gitkeep`)

---

## 7. Tahap 9 · AI Layer — **0%** — Phase 2

- [ ] AI Executive Summary (`docs/19`)
- [ ] AI Risk Detector
- [ ] AI Report Writer (dengan review manusia)
- [ ] Fallback aman saat AI gagal / kuota habis

> `@anthropic-ai/sdk` sudah terpasang, `ANTHROPIC_API_KEY` masih kosong. Jangan mulai sebelum Phase 1 stabil (`docs/23 §3`).

---

## 8. Tahap 10 · Public Platform — **± 55%** — *Awalin + Bani*

### Sudah jadi
- [x] Landing page (`app/(site)/page.tsx`)
- [x] SEO dasar: `sitemap.xml`, `robots.txt`, metadata
- [x] Katalog `services` di DB + grant baca untuk `anon`

#### Guest Checkout (`prd.md` FR-C2 · FR-C3 · FR-C4)
- [x] Migration prasyarat **ter-push**: `20260811010000_guest_checkout.sql` & `20260811020000_guest_checkout_steps.sql`
- [x] RPC `create_guest_order(jsonb)` **`SECURITY DEFINER`**, di-grant ke `anon` — `anon` sendiri ditolak RLS di setiap tabel operasional
- [x] **Harga, total, status, dan jumlah terbayar tidak pernah datang dari klien** — RPC membacanya dari `services`. `guestCheckoutSchema` sengaja tidak menyediakan tempatnya, jadi tidak ada jalan memesan seharga nol rupiah
- [x] RPC `get_public_branches()` untuk daftar wilayah layanan (`anon` tidak boleh membaca `branches` langsung)
- [x] Form bertahap (`features/checkout/`) — sejak 19 Agustus **4 tahap**: pesanan (aqiqah untuk, paket, jenis & jumlah hewan, nasi box) → jadwal & penyaluran → data pemesan → ringkasan
- [x] Kolom baru `orders.aqiqah_for` & `orders.distribution_mode`
- [x] Aturan lintas-medan ditegakkan **dua kali** — di `superRefine` supaya galatnya menempel pada medan yang tepat di form, dan di dalam RPC supaya tidak bisa dilewati: alamat wajib untuk "Aqiqah Kirim", nasi box terpilih wajib berjumlah, jenis hewan dibatasi per jenis layanan
- [x] Hanya kode penolakan yang memang layak dibaca pengunjung (`23514`, `P0002`, `P0003`) yang diteruskan ke layar; pesan mentah Postgres tidak pernah sampai karena membocorkan nama tabel & kolom
- [x] Halaman `force-dynamic` — katalog ter-cache akan memajang harga lama
- [x] `?paket=` dari landing dicocokkan ke katalog sebagai **slug**, bukan dipercaya sebagai id
- [x] Panel sukses menampilkan nomor order + total tagihan
- [x] Order tamu ditandai **`created_by IS NULL`**

#### Penyesuaian form pemesan (19 Agustus)

- [x] **Domba dicabut dari checkout publik** — aqiqah hanya kambing, qurban
  kambing atau sapi. Ditegakkan tiga lapis: `SPECIES_BY_SERVICE_TYPE` menentukan
  apa yang ditawarkan form, `guestCheckoutSchema` menutup enum-nya di
  `['kambing','sapi']`, dan `create_guest_order` menolak `domba` sekalipun
  dikirim lewat PostgREST langsung. Enum `animal_species` sengaja **tidak**
  diubah — order yang dibuat staf masih melayani domba, dan mencabutnya dari
  enum akan membatalkan baris `animals` yang sudah ada
- [x] **Pemilih wilayah layanan dihapus.** `orders.branch_id` NOT NULL, jadi
  cabangnya kini datang dari kolom baru `branches.is_default` (indeks unik
  parsial: paling banyak satu). Cabang **tidak** lagi diterima dari form —
  `guestCheckoutSchema` tidak menyediakan tempatnya, karena pengunjung anonim
  yang bisa memilih cabang berarti bisa menyetir order ke cabang mana pun.
  Payload yang tetap mengirim `branch_id` (impor, n8n) masih dihormati RPC
- [x] **Tanggal & jam pelaksanaan dipilih pemesan, maksimal 7 hari ke depan** —
  kolom baru `orders.requested_date` / `requested_time`. Ditulis ke `orders`,
  **bukan** `schedules`: `schedules.location_id` NOT NULL dan pemesan tidak
  memilih lokasi pemotongan, jadi jadwal sungguhan tetap disusun admin sesudah
  verifikasi. Kolom ini permintaan pemesan, bukan jadwal
- [x] Batas 7 hari dihitung terhadap **hari ini menurut WIB** di kedua sisi
  (`todayWib` di `lib/format/date-range.ts`, `now() at time zone 'Asia/Jakarta'`
  di RPC). Memakai UTC berarti pemesan yang membuka form pukul 00:30 WIB
  ditolak karena "tanggal sudah lewat"
- [x] Jendelanya dihitung **saat parse**, bukan saat modul dimuat — proses
  server hidup berhari-hari, dan batas yang dibekukan di konstanta modul akan
  menolak "besok" begitu tanggal berganti. `min`/`max` pada input tanggal
  datang sebagai prop dari server, karena memanggil jam di badan komponen
  melanggar aturan kemurnian React dan jam peramban pemesan bisa di zona mana pun
- [x] Jam dibatasi daftar slot di form (08:00–16:00), sementara RPC mengunci
  batas luarnya saja (06:00–20:00) — slotnya bisa digeser tanpa migration
- [x] `orders_requested_slot_check` menolak tanggal tanpa jam (dan sebaliknya).
  Batas 7 harinya sendiri tidak bisa jadi CHECK constraint: acuannya `now()`,
  sementara CHECK menuntut ekspresi immutable
- [x] Tanggal yang diminta tampil di **panel order tamu** halaman detail —
  tanpa itu ia jadi kolom yang tersimpan tapi tidak pernah dibaca siapa pun,
  persis masalah yang ditutup pada 14 Agustus
- [ ] ⚠️ Belum diverifikasi di cloud — `20260819010000_checkout_booking.sql`
  belum di-push
- [x] **Wizard dipadatkan jadi 4 langkah** — Pesanan → Jadwal & Penyaluran →
  Data Pemesan → Ringkasan. "Aqiqah untuk", "Paket", dan "Nasi box" dulu tiga
  langkah terpisah yang masing-masing hanya menuntut satu klik: pemesan menekan
  "Lanjut" dua kali tanpa mengisi apa pun di antaranya, sementara paket dan
  nasi box yang sama-sama menyusun total tagihan justru tidak pernah terlihat
  bersamaan. `FIELD_STEP` — peta yang memindahkan layar ke langkah tempat medan
  yang ditolak server berada — ikut disesuaikan, jadi galat dari zod tetap
  mendarat di langkah yang benar
- [x] **Alamat pengiriman terstruktur** — tabel baru `regions` (kode, nama,
  induk, tingkat) berisi **91.599 wilayah**: 38 provinsi, 514 kabupaten/kota,
  7.285 kecamatan, 83.762 kelurahan/desa. Sumbernya Kepmendagri
  No 300.2.2-2138/2025 lewat dump publik `cahyadsn/wilayah` (MIT); berkas
  migration-nya dibangkitkan, bukan ditulis tangan
- [x] Masuk **migration**, bukan `supabase/seed/` — isi `supabase/seed/` hanya
  jalan lokal saat `db reset`, sementara tanpa tabel ini checkout publik tidak
  bisa merender pemilih alamatnya sama sekali di staging maupun produksi.
  Alasan yang sama dipakai `20260806010900_reference_data.sql`
- [x] Kolom baru di `orders`: `delivery_province_code` / `delivery_province`
  dan tiga pasang serupa untuk kota, kecamatan, kelurahan, ditambah
  `delivery_postal_code` & `delivery_detail`. **Nama ikut disimpan, bukan hanya
  kode** — alamat pada order adalah rekaman sejarah, dan revisi Kemendagri
  berikutnya tidak boleh diam-diam mengubah alamat order lama. Karena alasan
  yang sama **tidak ada FK ke `regions`**: FK akan menahan pembaruan data
  wilayah, atau menyeret order lama ikut berubah
- [x] Kebenaran kodenya ditegakkan saat penulisan, bukan lewat FK —
  `create_guest_order` menolak kode yang tidak ada, salah tingkat, atau tidak
  sejalur dengan induknya. Sejalur diperiksa dari kodenya sendiri (kode
  Kemendagri bersarang: `32` → `32.04` → `32.04.01`), jadi empat kode yang
  masing-masing sah tetap tidak bisa merakit alamat yang tidak pernah ada
- [x] **Nama wilayah tidak pernah dikirim klien** — RPC membacanya dari
  `regions` berdasarkan kode. Yang dibaca kurir adalah namanya, jadi nama yang
  boleh dikirim sendiri oleh pemesan berarti alamat tercatat bisa berbeda dari
  wilayah yang ia pilih
- [x] `orders.delivery_address` tetap ada dan kini **dirakit RPC** dari
  bagian-bagian di atas — satu tempat saja yang menyusun teks itu, jadi
  tampilan, panel admin, dan PDF laporan tidak bisa berbeda-beda
- [x] `regions` dibaca langsung dari peramban (`regions_public_select` untuk
  `anon`), bukan lewat Server Action: isinya daftar wilayah administratif yang
  memang terbuka, jadi melewatkannya lewat server hanya menambah satu lompatan
  tanpa menambah jaminan. 38 provinsi ikut dirender di server; tiga tingkat di
  bawahnya diambil saat induknya dipilih — memuat 83 ribu kelurahan di muka
  jelas bukan pilihan
- [x] Hasil permintaan disinggahkan **per kode induk**, bukan per tingkat.
  Itu yang menyelesaikan balapan: mengganti provinsi dua kali dengan cepat
  membuat dua permintaan berjalan bersamaan, dan yang lebih lambat bisa
  mendarat belakangan — kalau disimpan per tingkat, daftar kabupaten provinsi
  pertama menimpa yang kedua
- [ ] Kode pos masih diketik manual — dataset Kemendagri tidak memuatnya.
  Untuk mengisinya otomatis butuh dataset kodepos terpisah
- [ ] Alamat pemesan (`participants.address`) masih teks bebas; yang
  terstruktur baru alamat kirim
- [ ] Panel jadwal admin belum memakai `requested_date` sebagai nilai awal;
  admin masih mengetik ulang tanggal yang diminta pemesan
- [ ] `get_public_branches` tidak lagi dipanggil siapa pun (checkout dulu satu-
  satunya pemakainya). Dibiarkan hidup untuk daftar wilayah layanan di halaman
  publik (`docs/28`) — kalau sampai Tahap 11 tidak terpakai, sebaiknya di-drop

#### Penutup loop order tamu (14 Agustus — §11 butir 1)

- [x] **Penanda di daftar order** — badge "Tamu" / "Tamu · perlu verifikasi" di tabel desktop **dan** kartu mobile, diturunkan dari `created_by === null`
- [x] **Filter asal order** — `?source=guest_pending|guest|staff` di FilterBar, ikut terbawa paginasi. `guest_pending` inilah antrian verifikasinya
- [x] **Kartu dashboard "Order Tamu Baru"** — hitungan order publik yang belum diverifikasi, menaut ke `/orders?source=guest_pending`. Dihitung query tersendiri, bukan lewat `v_branch_kpi` yang tidak punya dimensi asal order
- [x] **Panel order tamu di halaman detail** — sekaligus memunculkan isian yang selama ini tersimpan tapi tidak pernah ditampilkan di mana pun: cara penyaluran, alamat kirim, lembaga penerima, kode referral. Sebelumnya admin harus membuka database untuk tahu ke mana daging dikirim
- [x] **Verifikasi admin sebagai gerbang, bukan catatan** — kolom `guest_verified_at` / `guest_verified_by` + trigger `enforce_guest_order_verification` yang **menahan order tamu di status `new`** sampai diverifikasi. Penahannya di database, bukan di Server Action: `orders_update` memberi Manager Program & Admin Cabang wewenang penuh atas baris order, jadi guard di lapisan aplikasi saja bisa dilewati lewat PostgREST
- [x] `cancelled` dikecualikan dari penahan — pesanan iseng atau ganda tetap bisa ditutup tanpa harus diverifikasi lebih dulu
- [x] Verifikasi tidak dapat dicabut, dan order internal tidak bisa dicap terverifikasi (keduanya ditegakkan trigger yang sama)
- [x] Penguncian optimistik: dua admin yang menekan tombol bersamaan tidak bisa sama-sama berhasil
- [x] Kapabilitas `VERIFY_GUEST_ORDER` (Manager Program, Admin Cabang, Admin Pusat) disamakan persis dengan daftar role di trigger + unit test
- [x] **Rem laju checkout per alamat IP** (`lib/security/rate-limit.ts`, 10 permintaan / 10 menit). Rem di `create_guest_order` hanya 5 order/jam **per nomor telepon** — kunci yang dikirim pengirimnya sendiri, jadi skrip yang mengarang nomor acak melewatinya tanpa hambatan
- [x] Tautan "Hubungi pemesan" (wa.me) di panel order tamu — **manual**, penambal sementara sampai Tahap 8 ada
- [ ] **Notifikasi WhatsApp otomatis** ke pemesan. Halaman checkout **menjanjikan** "tim kami menghubungi Anda lewat WhatsApp"; yang ada sekarang baru tombol manual di atas. Bergantung Tahap 8
- [ ] ⚠️ Seluruh butir di atas belum diverifikasi di cloud — `20260814010000_guest_order_verification.sql` belum di-push
- [ ] Rem laju IP-nya **per instance** (hitungan di memori proses). Cukup untuk penyalahgunaan kasar, tidak untuk serangan terdistribusi; pertahanan sesungguhnya tetap WAF / Redis bersama atau captcha

Sisa cakupan Tahap 10:

- [ ] Halaman program & katalog harga (Aqiqah Ekonomi/Favorit/Premium, Nasi Box, Qurban) → `docs/28`
- [ ] Halaman FAQ editable (CMS) → `docs/27`
- [ ] Payment Gateway UI + verifikasi → `features/integrations`
- [ ] Affiliate / Referral UI → `prd.md §7.11` — kolom `referral_code` sudah diterima checkout, tapi belum ada yang mengolahnya
- [ ] Chatbot + human handoff → `docs/26`
- [ ] ⚠️ Belum diverifikasi dengan pemesanan sungguhan dari pengunjung anonim di cloud

> **Pertentangan dokumen — sudah diputuskan di lapangan.** `prd.md §7.3` FR-C2 menetapkan checkout & guest checkout sebagai **M (Must)**, sementara `docs/01 §6` dan `docs/23 §6` mencantumkannya sebagai **out of scope**. Aturan otoritas `TEAM_PLAN` (**migrations → kode → `prd.md` → `docs/`**) memenangkan `prd.md`, dan sejak 11 Agustus kodenya **sudah ada** — jadi kedua bagian `docs/` itu kini bukan sekadar usang, melainkan salah. Koreksinya tercatat di §10.
>
> **Catatan urutan.** `TEAM_PLAN §3` menempatkan Tahap 10 **setelah** operasional inti (Tahap 1–8) stabil. Checkout dikerjakan mendahului itu, selagi Tahap 8 masih ± 5%. Konsekuensinya konkret dan bukan teoretis: notifikasi yang dijanjikan halaman checkout justru bagian dari tahap yang dilewati.

---

## 9. PWA — **0%** — *Awalin*

- [ ] `manifest.json` + installable
- [ ] Service worker
- [ ] Offline queue upload dokumentasi
- [ ] Akses kamera untuk dokumentasi lapangan
- [ ] Indikator upload pending

→ `docs/13_PWA_ARCHITECTURE.md`. Ini prasyarat Documentation Flow yang dipakai petugas di lapangan.

---

## 10. Kualitas & Rapi-rapi

- [x] **323 unit test hijau di 25 file** (state machine order/hewan/jadwal, alur & path dokumentasi, kapabilitas, filter schema, agregasi dashboard, format & aritmetika tanggal WIB, path & schema pembayaran, tautan peta, schema pelaksanaan lapangan, schema & wizard checkout termasuk jendela pemesanan 7 hari, rem laju & normalisasi nomor WhatsApp)
- [x] `ActionResult` + helper error disatukan di `server/actions/result.ts` — sebelumnya terduplikasi di tiap modul action
- [x] **Navigasi < 1024px** — bottom-nav + panel `≡` (`components/layout/mobile-nav.tsx`). Sebelumnya sidebar `hidden lg:flex` tidak punya pengganti: di bawah 1024px tidak ada cara berpindah halaman, dan tidak ada cara keluar sistem karena logout hanya hidup di footer sidebar
- [x] Penanda aktif sidebar diturunkan dari `pathname` dengan pencocokan yang berhenti di batas segmen — sebelumnya di-hardcode pada tautan Dashboard, jadi tidak pernah berpindah
- [ ] `tests/integration/` masih kosong (`.gitkeep`) — target: RLS lintas cabang, RPC `create_order`, RPC `create_guest_order` (satu-satunya jalan tulis milik `anon`; kini juga pemegang batas 7 hari, penolakan domba, dan pemilihan cabang default), **dan dua trigger**: `enforce_documentation_review_ladder` & `enforce_guest_order_verification`. Semuanya justru yang paling layak diuji otomatis — perilakunya hanya muncul di database, jadi tidak ada unit test yang bisa menyentuhnya
- [ ] `tests/e2e/` masih kosong (`.gitkeep`) — target: alur order → laporan end-to-end (`docs/21`)
- [ ] Link mati "Pengaturan" (`href="#"`) — sekarang ada di **dua** tempat: footer sidebar dan panel `≡` mobile. Halamannya baru muncul di Tahap 11 · Master Data
- [ ] Checklist keamanan `docs/20_SECURITY_CHECKLIST.md` belum ditelusuri satu per satu
- [ ] **Koreksi dokumen — kini salah, bukan sekadar usang:** `docs/01 §6` & `docs/23 §6` masih menyebut checkout sebagai out of scope, padahal kodenya sudah ada sejak 11 Agustus (lihat §8)
- [ ] **Akun demo `*@suksesaqiqah.test` (password `Password123!`) ada di project cloud** — wajib dihapus sebelum project dipakai produksi

### Kepatuhan design system (`design.md`)

Ditelusuri 13 Agustus, per bagian spec.

- [x] **Konflik token warna diperbaiki** (`app/globals.css`). `@theme` mendeklarasikan `--color-primary: #0e7c5a` dan `--color-accent: #f0a500`, tapi `@theme inline` di bawahnya menimpa keduanya — jadi **warna brand §3 tidak pernah benar-benar tampil**; yang dirender `#006b2c`, berbeda pula dari `themeColor` PWA. Kini satu sumber kebenaran per token di `:root`, dengan `--ring` dan `--accent-foreground` ikut diselaraskan (`#745c00` di atas `#f0a500` hanya ~2,3:1)
- [x] Sesuai spec: `AppShell`, `KpiCard`, `StatusBadge`, `FilterBar`, `OrderCard`, `ValidationQueue`, `AlertList`, pola halaman list & detail, breakpoint responsif, bahasa Indonesia
- [ ] **§8 State & Feedback — bagian terlemah.** Tidak ada toast sukses/gagal, tidak ada `Skeleton`, tidak ada satu pun `loading.tsx`/`error.tsx` di `app/`, tidak ada konfirmasi aksi destruktif, dan tidak ada banner "Mode offline". Yang sudah ada: validasi inline & tombol disabled saat submit
- [ ] Token semantik `success`/`warning`/`danger`/`info` terdefinisi tapi hampir tak terpakai — badge status memakai palet mentah Tailwind. Hasil visualnya konsisten, tapi bukan lewat token spec
- [ ] Sidebar merender navy `#0b1c30` yang di-hardcode di 11 tempat, sementara token `--sidebar` bernilai hijau dan `design.md §3` tidak menyebut navy sama sekali. Perlu diputuskan: resmikan di spec, atau kembalikan ke palet
- [ ] `text-accent-dark` (`#c98800`) di atas putih ~3,4:1 — gagal WCAG AA untuk teks kecil (`design.md §9`)
- [ ] `DataTable` belum punya sort per kolom & klik-baris; `Timeline`, `EmptyState`, `MediaGallery` masih inline, belum jadi komponen pakai-ulang
- [ ] `MediaUploader` masih `<input type="file">` polos — tanpa `capture` kamera dan tanpa indikator antrian (§5). Digabung ke pekerjaan PWA (§9)
- [ ] Blok `.dark` di `globals.css` adalah **kode mati** — kelas `.dark` tidak pernah dipasang, tidak ada theme provider maupun toggle. `design.md` juga tidak punya palet gelap
- [ ] `design.md §2` menyebut Radix & Recharts; kenyataannya `@base-ui/react` (shadcn versi baru memang sudah pindah) dan bar CSS buatan sendiri. Spec yang perlu menyusul kode di sini

---

## 11. Urutan kejar berikutnya

Diurutkan dari yang paling membuka jalan. **Urutannya berubah pada 13 Agustus** karena guest checkout sudah menerima order sungguhan dari publik.

| # | Pekerjaan | Kenapa didahulukan | Pemilik |
|---|-----------|--------------------|---------|
| **1** | **`npm run db:push`** — dua migration 14 Agustus + empat migration 19 Agustus | Kode sudah membaca `orders.guest_verified_at`, `orders.requested_date`, `orders.delivery_*`, `branches.is_default`, dan tabel `regions`. Selama belum ter-push, daftar order & halaman detail gagal memuat, checkout publik gagal mencatat pesanan, dan pengerasan di §3 & §8 belum berlaku sama sekali. Catatan: `20260819020000_regions.sql` berukuran ±3 MB, jadi push-nya lebih lama dari biasanya | Bani |
| 2 | **Automation & Notification** (Tahap 8) | Sekarang menahan **tiga** tahap sekaligus: pengiriman laporan (Tahap 6), notifikasi validasi dokumentasi (`docs/10 §7`), dan notifikasi WA yang sudah **dijanjikan** halaman checkout kepada pemesan — tombol manual di panel order tamu hanya penambal | Bani |
| 3 | **PWA** (kamera, kompresi klien, antrian offline) | Dokumentasi sudah bisa diunggah, tapi belum nyaman dipakai petugas di lapangan | Awalin |
| 4 | **`design.md §8`** — toast, `loading.tsx`/`error.tsx`, `Skeleton` (§10) | Celah design system yang paling terasa pengguna; murah dikerjakan dan menyentuh seluruh halaman | Awalin |
| 5 | Realtime + filter periode dashboard | Penyempurnaan, bukan penghalang | Awalin |
| ~~—~~ | ~~**Reporting Engine** (Tahap 6)~~ | Inti sudah jalan (± 80%) — PDF, halaman publik bertoken, kirim WA.me, versi laporan. Sisanya (email, QR, rate limit) bergantung #2 atau dependensi baru | Awalin |
| ~~—~~ | ~~**Issues** (Tahap 4, FR-SL4)~~ | **Selesai** — panel Kendala di detail order kini mengisi tabel `issues`, jadi panel dashboard tidak lagi bergantung pada seed | Bani |
| ~~—~~ | ~~**Tutup loop order tamu** (§8)~~ | **Selesai 14 Agustus** — penanda & filter di daftar order, panel + gerbang verifikasi, kartu dashboard, rem laju IP. Yang tersisa dari loop ini hanya notifikasi WA otomatis, dan itu memang bagian #2 | Bani |

---

## 12. Definition of Done — Phase 1

- [x] Litmus test terjawab < 10 detik di dashboard *(dengan data seed; ⚠️ belum dengan data pilot asli)*
- [ ] 1 cabang pilot jalan end-to-end: order → pembayaran → jadwal → pemotongan → distribusi → dokumentasi → laporan
- [ ] ≥ 95% order selesai punya dokumentasi tervalidasi
- [ ] Laporan terkirim otomatis ke peserta via link unik — bergantung Tahap 8
- [ ] Lulus UAT + checklist keamanan inti (`docs/20`, `docs/21`)

**1 dari 5 tercentang, itu pun dengan data seed.** Empat butir sisanya tidak tersentuh oleh pekerjaan 11 Agustus — itulah sebab estimasi Phase 1 hampir tidak bergerak meski satu tahap besar bertambah (lihat *Perubahan sejak pembaruan 2026-08-07* di awal dokumen). Dua di antaranya menunggu Tahap 8, dan tiga butir menuntut **data operasional asli**, bukan seed.

---

### Referensi silang
- Pembagian kerja & gate antar tahap → `TEAM_PLAN.md`
- Roadmap & exit criteria per fase → `docs/23_MVP_ROADMAP.md`
- Urutan teknis build → `docs/25_BUILD_SEQUENCE.md`
- Skema & view → `docs/05_DATABASE_DESIGN.md`
