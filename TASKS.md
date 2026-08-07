# TASKS — Status Pengerjaan Sukses Aqiqah

> Peta apa yang **sudah jadi**, apa yang **belum**, dan apa yang **harus dikejar berikutnya**.
> Urutan tahap mengikuti `TEAM_PLAN.md §3`; definisi modul mengikuti `docs/06_MODULE_BREAKDOWN.md`.
> Urutan otoritas kebenaran: **migrations → kode (`features/`, `app/`, `server/`) → `prd.md` → `docs/`**.

| Field | Value |
|-------|-------|
| Dokumen | `TASKS.md` |
| Diperbarui | 2026-08-07 |
| Fase aktif | **Phase 1 — Operational MVP** (`docs/23_MVP_ROADMAP.md`) |
| Estimasi Phase 1 | **± 65%** |

**Aturan pemeliharaan:** centang item hanya kalau kodenya ada **dan** `npm run typecheck` + `npm run build` hijau (Definition of Stable, `TEAM_PLAN §1.5`). Item yang belum diverifikasi dengan data sungguhan ditandai ⚠️, bukan dicentang.

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
- [x] 13 migration di `supabase/migrations/` — 19 tabel, enum, index, trigger
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

### Tahap 3 · RBAC / RLS — *Bani*
- [x] RLS aktif di seluruh tabel + kebijakan per role
- [x] Matriks kapabilitas action-level (`server/auth/capabilities.ts`) + unit test
- [x] **Uji positif & negatif lintas cabang lolos di cloud**: direktur 5 order · admin cabang 3 · petugas 1 (hanya yang di-PIC-i)

---

## 2. Tahap 4 · Order Management — **± 95%** — *Bani*

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

### Harus dikejar
- [ ] **Issues** · tandai & kelola kendala (`prd.md` FR-SL4, satu bagian dengan Slaughter & Distribution). Dashboard sudah *menampilkan* kendala, tapi belum ada cara membuatnya dari UI. → `docs/06 §1`
- [ ] Status hewan masih bisa diubah langsung lewat panel Hewan **tanpa** catatan pemotongan. Guard `slaughtering → distribution` membaca `animals.status`, jadi jalur itu melepas transisi tanpa bukti. Perlu diputuskan: kunci status hewan agar hanya bergerak lewat catatan pemotongan, atau biarkan sebagai jalur koreksi.

> Order kini bisa berjalan `new → paid → scheduled → preparation → slaughtering → distribution → documentation` sepenuhnya lewat UI. **Penghambat berikutnya ada di `documentation → reporting`**: guard-nya menuntut ≥1 dokumentasi ber-status `approved`, dan alur dokumentasi (Tahap 5) belum ada.

---

## 3. Tahap 5 · Documentation Flow — **± 5%** — *Bani*

- [x] Tabel `documentations` + enum `doc_status` / `doc_stage` / `doc_type` + RLS
- [x] Storage bucket
- [ ] Upload media (foto/video/catatan) tertaut ke order & hewan
- [ ] Validasi 2 tingkat: Supervisor (`approved_supervisor`) → Admin Pusat (`approved` / `rejected` + alasan)
- [ ] Antrian validasi tingkat-1 di dashboard cabang
- [ ] Antrian validasi tingkat-akhir lintas cabang (`docs/09 §4b`)
- [ ] Gate: order tidak bisa `completed` tanpa dokumentasi tervalidasi

→ `docs/10_DOCUMENTATION_FLOW.md`, kapabilitas `VALIDATE_DOC_LEVEL1` / `VALIDATE_DOC_FINAL`

---

## 4. Tahap 6 · Reporting Engine — **0%** — *Awalin*

- [ ] Generate PDF per order (React PDF — dependency sudah terpasang)
- [ ] Halaman publik bertoken `app/r/[token]` tanpa login
- [ ] Unduh PDF dari halaman publik
- [ ] Kirim link via WA.me & Email
- [ ] Versi laporan tercatat di tabel `reports`
- [ ] Pastikan data peserta lain tidak bocor lewat token

→ `docs/11_REPORTING_ENGINE.md`. Tabel `reports` & kolom `orders.public_token` sudah ada di DB.

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

## 8. Tahap 10 · Public Platform — **± 15%** — *Awalin + Bani*

### Sudah jadi
- [x] Landing page (`app/(site)/page.tsx`)
- [x] SEO dasar: `sitemap.xml`, `robots.txt`, metadata
- [x] Katalog `services` di DB + grant baca untuk `anon`

### Harus dikejar
- [ ] Halaman program & katalog harga (Aqiqah Ekonomi/Favorit/Premium, Nasi Box, Qurban) → `docs/28`
- [ ] Halaman FAQ editable (CMS) → `docs/27`
- [ ] Checkout + Guest Checkout → `features/checkout`
- [ ] Payment Gateway UI + verifikasi → `features/integrations`
- [ ] Affiliate / Referral UI → `prd.md §7.11`
- [ ] Chatbot + human handoff → `docs/26`

> Dibangun **setelah** operasional inti (Tahap 1–8) stabil (`TEAM_PLAN §3`).

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

- [x] 114 unit test hijau (state machine order/hewan/jadwal, kapabilitas, filter schema, agregasi dashboard, format tanggal, path & schema pembayaran, tautan peta, schema pelaksanaan lapangan)
- [x] `ActionResult` + helper error disatukan di `server/actions/result.ts` — sebelumnya terduplikasi di tiap modul action
- [ ] `tests/integration/` masih kosong — target: RLS lintas cabang, RPC `create_order`
- [ ] `tests/e2e/` masih kosong — target: alur order → laporan end-to-end (`docs/21`)
- [ ] Dua link mati tersisa di sidebar: "Dokumentasi" & "Pengaturan" masih `href="#"` (link "Jadwal" sudah hidup)
- [ ] Checklist keamanan `docs/20_SECURITY_CHECKLIST.md` belum ditelusuri satu per satu
- [ ] **Akun demo `*@suksesaqiqah.test` (password `Password123!`) ada di project cloud** — wajib dihapus sebelum project dipakai produksi

---

## 11. Urutan kejar berikutnya

Diurutkan dari yang paling membuka jalan:

| # | Pekerjaan | Kenapa didahulukan | Pemilik |
|---|-----------|--------------------|---------|
| 1 | **Documentation Flow** (Tahap 5) | Penghambat berikutnya: `documentation → reporting` menuntut ≥1 dokumentasi `approved`, dan itu juga gate menuju `completed`. Perlu PWA/kamera untuk dipakai petugas di lapangan. | Bani + Awalin |
| 2 | **Issues** (Tahap 4, FR-SL4) | Dashboard sudah *menampilkan* kendala, tapi belum ada cara membuatnya — panel kendala akan selalu kosong sampai ini ada. Ringan dan berdiri sendiri. | Bani |
| 3 | **Reporting Engine** (Tahap 6) | Output akhir ke peserta — salah satu Definition of Done Phase 1. | Awalin |
| 4 | **Automation & Notification** (Tahap 8) | Mengotomatiskan pengiriman laporan yang sudah jadi di #3. | Bani |
| 5 | Realtime + filter periode dashboard | Penyempurnaan, bukan penghalang. | Awalin |

---

## 12. Definition of Done — Phase 1

- [x] Litmus test terjawab < 10 detik di dashboard *(dengan data seed; ⚠️ belum dengan data pilot asli)*
- [ ] 1 cabang pilot jalan end-to-end: order → pembayaran → jadwal → pemotongan → distribusi → dokumentasi → laporan
- [ ] ≥ 95% order selesai punya dokumentasi tervalidasi
- [ ] Laporan terkirim otomatis ke peserta via link unik
- [ ] Lulus UAT + checklist keamanan inti (`docs/20`, `docs/21`)

---

### Referensi silang
- Pembagian kerja & gate antar tahap → `TEAM_PLAN.md`
- Roadmap & exit criteria per fase → `docs/23_MVP_ROADMAP.md`
- Urutan teknis build → `docs/25_BUILD_SEQUENCE.md`
- Skema & view → `docs/05_DATABASE_DESIGN.md`
