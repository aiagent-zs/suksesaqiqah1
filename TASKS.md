# TASKS — Status Pengerjaan Sukses Aqiqah

> Peta apa yang **sudah jadi**, apa yang **belum**, dan apa yang **harus dikejar berikutnya**.
> Urutan tahap mengikuti `TEAM_PLAN.md §3`; definisi modul mengikuti `docs/06_MODULE_BREAKDOWN.md`.
> Urutan otoritas kebenaran: **migrations → kode (`features/`, `app/`, `server/`) → `prd.md` → `docs/`**.

| Field | Value |
|-------|-------|
| Dokumen | `TASKS.md` |
| Diperbarui | 2026-08-13 |
| Fase aktif | **Phase 1 — Operational MVP** (`docs/23_MVP_ROADMAP.md`) |
| Estimasi Phase 1 | **± 84%** |
| Terverifikasi pada pembaruan ini | `npm run build` ✅ · `npm run typecheck` ✅ · **271 test hijau (23 file)** · 16 migration |

**Aturan pemeliharaan:** centang item hanya kalau kodenya ada **dan** `npm run typecheck` + `npm run build` hijau (Definition of Stable, `TEAM_PLAN §1.5`). Item yang belum diverifikasi dengan data sungguhan ditandai ⚠️, bukan dicentang.

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
- [x] 16 migration di `supabase/migrations/` — 19 tabel, enum, index, trigger
  <br>*(13 fondasi + `public_report_rpc` + 2 migration guest checkout, lihat §8)*
- [x] 3 view KPI: `v_order_progress`, `v_branch_kpi`, `v_open_orders` (semua `security_invoker = on`)
- [x] RPC: `create_order`, `next_order_number`, `min_dp_ratio`, helper `can_read_order` / `can_write_order`
- [x] Storage buckets + GRANT eksplisit untuk `anon` / `authenticated`
- [x] Seed `01_master.sql` (cabang, lokasi) & `02_demo.sql` (7 akun demo + order contoh)
- [x] **Ter-push & terverifikasi di Supabase cloud** — ketiga view mengembalikan data

### Tahap 2 · Auth — *Bani*
- [x] Login email+password, `auth/callback`, `logout`
- [x] `getSession` / `requireAuth` / `requireRole` di `server/auth/session.ts`
- [x] Proxy/middleware redirect route terproteksi
- [x] Guard environment (`lib/supabase/env.ts`) — kredensial kosong gagal dengan pesan yang menyebut variabelnya
- [x] **Keluar otomatis saat menganggur** (ambang 30 menit, `lib/auth/idle.ts`). Supabase menyegarkan token di tiap permintaan lewat middleware, jadi sesi yang ditinggal tidak pernah kedaluwarsa sendiri. Ditegakkan di **middleware** lewat cookie `httpOnly` — berlaku sekalipun JavaScript mati — sementara `IdleLogout` di klien hanya membuat waktunya tepat, karena tab yang menganggur tidak mengirim permintaan apa pun

### Tahap 3 · RBAC / RLS — *Bani*
- [x] RLS aktif di seluruh tabel + kebijakan per role
- [x] Matriks kapabilitas action-level (`server/auth/capabilities.ts`) + unit test
- [x] **Uji positif & negatif lintas cabang lolos di cloud**: direktur 5 order · admin cabang 3 · petugas 1 (hanya yang di-PIC-i)

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

## 3. Tahap 5 · Documentation Flow — **± 85%** — *Bani*

- [x] Tabel `documentations` + enum `doc_status` / `doc_stage` / `doc_type` + RLS
- [x] Storage bucket
- [x] Unggah foto/video/catatan, tertaut ke order + tahap + hewan (opsional) — berkas langsung browser → Storage, path baru dikirim ke Server Action
- [x] Path diverifikasi ulang terhadap cabang + nomor order + tahap (`isDocPathForOrder`); kebijakan Storage hanya menuntut role, sama sekali tidak membatasi folder
- [x] Validasi 2 tingkat: Supervisor (`pending → approved_supervisor`) → Admin Pusat (`→ approved`), tolak wajib beralasan
- [x] Tingkat validasi **diturunkan dari role**, tidak pernah dikirim klien — Supervisor tidak bisa meminta `approved` penuh
- [x] **Pemisahan tugas** (`docs/10 §4`): pengupload tidak dapat memvalidasi unggahannya sendiri
- [x] Penguncian optimistik: dua validator bersamaan tidak bisa sama-sama berhasil
- [x] Halaman `/validation` — antrian tingkat-1 & tingkat-akhir menyesuaikan role, filter cabang & tahap, urut tertua dulu, paginasi
- [x] **Gate diperketat sesuai `docs/10 §5`**: `documentation → reporting` kini menuntut ≥1 bukti **pemotongan** DAN ≥1 bukti **distribusi** yang tervalidasi penuh — sebelumnya cukup "ada satu dokumentasi apa pun"
- [x] Pratinjau media memakai `<img>`/`<video>` biasa, bukan `next/image`: optimizer Next akan menyimpan salinan yang tetap tersaji setelah signed URL ber-TTL 10 menit kedaluwarsa (`docs/10 §8`)
- [x] Dokumentasi `approved` tidak dapat dihapus — bukti itu dipakai laporan peserta
- [x] **Terverifikasi di cloud:** petugas unggah → `pending`; percobaan menyetujui sendiri ditolak RLS (`42501`); Supervisor → `approved_supervisor`; Admin Pusat → `approved`; hitungan gate per tahap `slaughter=1, distribution=0` sehingga order tetap tertahan. Data uji dibersihkan.
- [ ] Antrian validasi tingkat-1 belum tampil di Cabang Dashboard (`docs/09 §4`) — saat ini hanya di `/validation`
- [ ] Notifikasi ke Supervisor saat ada unggahan baru & ke Petugas saat ditolak (`docs/10 §7`) — bergantung Tahap 8
- [ ] Kompresi gambar di klien & antrian upload offline (`docs/13`) — bergantung PWA
- [ ] Pelucutan EXIF/GPS sebelum unggah (`docs/17 §4`, `docs/20`)

> **Catatan kedalaman pertahanan:** urutan dua tingkat ditegakkan di lapisan aplikasi (`checkReview`), **bukan** di RLS — kebijakan `documentations_update` memberi Admin Pusat wewenang penuh atas baris mana pun, sehingga secara teknis ia bisa melompati validasi tingkat-1 lewat panggilan API langsung. Menutupnya butuh constraint/trigger di database (migration).

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

## 8. Tahap 10 · Public Platform — **± 45%** — *Awalin + Bani*

### Sudah jadi
- [x] Landing page (`app/(site)/page.tsx`)
- [x] SEO dasar: `sitemap.xml`, `robots.txt`, metadata
- [x] Katalog `services` di DB + grant baca untuk `anon`

#### Guest Checkout (`prd.md` FR-C2 · FR-C3 · FR-C4)
- [x] Migration prasyarat **ter-push**: `20260811010000_guest_checkout.sql` & `20260811020000_guest_checkout_steps.sql`
- [x] RPC `create_guest_order(jsonb)` **`SECURITY DEFINER`**, di-grant ke `anon` — `anon` sendiri ditolak RLS di setiap tabel operasional
- [x] **Harga, total, status, dan jumlah terbayar tidak pernah datang dari klien** — RPC membacanya dari `services`. `guestCheckoutSchema` sengaja tidak menyediakan tempatnya, jadi tidak ada jalan memesan seharga nol rupiah
- [x] RPC `get_public_branches()` untuk daftar wilayah layanan (`anon` tidak boleh membaca `branches` langsung)
- [x] Form 6 tahap (`features/checkout/`): paket → jenis & jumlah hewan → nasi box → cara penyaluran → data pemesan → ringkasan
- [x] Kolom baru `orders.aqiqah_for` & `orders.distribution_mode`
- [x] Aturan lintas-medan ditegakkan **dua kali** — di `superRefine` supaya galatnya menempel pada medan yang tepat di form, dan di dalam RPC supaya tidak bisa dilewati: alamat wajib untuk "Aqiqah Kirim", nasi box terpilih wajib berjumlah, jenis hewan dibatasi per jenis layanan
- [x] Hanya kode penolakan yang memang layak dibaca pengunjung (`23514`, `P0002`, `P0003`) yang diteruskan ke layar; pesan mentah Postgres tidak pernah sampai karena membocorkan nama tabel & kolom
- [x] Halaman `force-dynamic` — katalog ter-cache akan memajang harga lama
- [x] `?paket=` dari landing dicocokkan ke katalog sebagai **slug**, bukan dipercaya sebagai id
- [x] Panel sukses menampilkan nomor order + total tagihan
- [x] Order tamu ditandai **`created_by IS NULL`**

### Harus dikejar

**Penutup loop guest checkout — prioritas tertinggi (lihat §11).** Ordernya sudah masuk dari publik, tapi sisi penanganannya belum ada:

- [ ] **Penanda & filter order tamu di daftar order admin.** `created_by IS NULL` hanya hidup di database; `features/orders` tidak menyebut order tamu sama sekali, dan halaman detail hanya menghilangkan kata "oleh …" tanpa penanda apa pun. Order dari publik bisa mengendap tanpa ada yang tahu
- [ ] **Antrian verifikasi admin** untuk order tamu sebelum masuk alur operasional
- [ ] **Notifikasi WhatsApp** ke pemesan. Halaman checkout **menjanjikan** "tim kami menghubungi Anda lewat WhatsApp", tapi tidak ada pengiriman apa pun — saat ini murni manual dan bergantung admin memeriksa daftar order. Bergantung Tahap 8

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

- [x] **271 unit test hijau di 23 file** (state machine order/hewan/jadwal, alur & path dokumentasi, kapabilitas, filter schema, agregasi dashboard, format tanggal, path & schema pembayaran, tautan peta, schema pelaksanaan lapangan, schema checkout)
- [x] `ActionResult` + helper error disatukan di `server/actions/result.ts` — sebelumnya terduplikasi di tiap modul action
- [x] **Navigasi < 1024px** — bottom-nav + panel `≡` (`components/layout/mobile-nav.tsx`). Sebelumnya sidebar `hidden lg:flex` tidak punya pengganti: di bawah 1024px tidak ada cara berpindah halaman, dan tidak ada cara keluar sistem karena logout hanya hidup di footer sidebar
- [x] Penanda aktif sidebar diturunkan dari `pathname` dengan pencocokan yang berhenti di batas segmen — sebelumnya di-hardcode pada tautan Dashboard, jadi tidak pernah berpindah
- [ ] `tests/integration/` masih kosong (`.gitkeep`) — target: RLS lintas cabang, RPC `create_order`, **dan kini RPC `create_guest_order`** (satu-satunya jalan tulis milik `anon`, jadi paling layak diuji)
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
| **1** | **Tutup loop order tamu** (§8) — penanda & filter di daftar order, antrian verifikasi admin | Satu-satunya butir yang **sudah menyentuh pengguna luar**. Order masuk hanya bertanda `created_by IS NULL` di database dan tidak muncul sebagai apa pun di UI admin, jadi bisa mengendap tanpa ada yang tahu. Risikonya bukan fitur tertunda, melainkan pesanan terlewat | Bani |
| 2 | **Automation & Notification** (Tahap 8) | Sekarang menahan **tiga** tahap sekaligus: pengiriman laporan (Tahap 6), notifikasi validasi dokumentasi (`docs/10 §7`), dan notifikasi WA yang sudah **dijanjikan** halaman checkout kepada pemesan | Bani |
| 3 | **PWA** (kamera, kompresi klien, antrian offline) | Dokumentasi sudah bisa diunggah, tapi belum nyaman dipakai petugas di lapangan | Awalin |
| 4 | **`design.md §8`** — toast, `loading.tsx`/`error.tsx`, `Skeleton` (§10) | Celah design system yang paling terasa pengguna; murah dikerjakan dan menyentuh seluruh halaman | Awalin |
| 5 | Realtime + filter periode dashboard | Penyempurnaan, bukan penghalang | Awalin |
| ~~—~~ | ~~**Reporting Engine** (Tahap 6)~~ | Inti sudah jalan (± 80%) — PDF, halaman publik bertoken, kirim WA.me, versi laporan. Sisanya (email, QR, rate limit) bergantung #2 atau dependensi baru | Awalin |
| ~~—~~ | ~~**Issues** (Tahap 4, FR-SL4)~~ | **Selesai** — panel Kendala di detail order kini mengisi tabel `issues`, jadi panel dashboard tidak lagi bergantung pada seed | Bani |

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
