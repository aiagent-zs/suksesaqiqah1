# TEAM_PLAN — Rebuild Sukses Aqiqah (Tim: Bani & Awalin)

> Rencana kerja tim untuk membangun ulang **Sukses Aqiqah** dari nol.
> Baca dokumen ini **setelah** `prd.md` dan `REBUILD_GUIDE.md`.
> Urutan otoritas kebenaran: **migrations → kode (`features/`, `app/`, `server/`) → `prd.md` → `docs/`**.

| Field | Value |
|-------|-------|
| Dokumen | `TEAM_PLAN.md` |
| Versi | 1.0 |
| Tanggal | 2026-08-06 |
| Tim | **Bani** (Operasional Inti / backend-data) · **Awalin** (Publik & Pelaporan / frontend) |
| Branch kerja | `claude/rebuild-aplikasi-nol-2lojhr` |
| Stack terkunci | Next.js 16 (App Router), React 19, Tailwind 4, Supabase (Postgres/Auth/Storage), Zod, React PDF, n8n, Vercel |

---

## 0. Kondisi awal (baca ini dulu)

Repo saat ini **hanya berisi dokumentasi** — belum ada satu baris kode aplikasi.
"Rebuild dari nol" = membangun aplikasi dari awal berdasarkan `prd.md` + `docs/`.

**Litmus test tunggal** yang jadi tolok ukur seluruh sistem:
> Sistem harus bisa menjawab dalam **< 10 detik**: *"Berapa order yang belum selesai, di lokasi mana, siapa PIC-nya, apa kendalanya?"*

---

## 1. Prinsip kolaborasi berdua (WAJIB disepakati di awal)

1. **Fondasi dikerjakan bersama dulu** (Tahap 0). Jangan dibagi sebelum DB + Auth stabil — kalau dibagi terlalu awal, dua-duanya kerja di atas fondasi yang belum ada.
2. **Database & tipe data = milik Bani.** Hanya satu orang yang menambah/mengubah migration, supaya tidak ada konflik schema. Awalin request perubahan schema lewat Bani, bukan edit sendiri.
3. **Kontrak antar layer disepakati lebih dulu.** Bentuk data Order, enum status, dan tipe TypeScript ditetapkan di awal → Awalin membangun UI di atas kontrak itu (boleh pakai mock data dulu kalau server belum siap).
4. **Ikuti build sequence (`docs/25`), jangan lompat tahap.** Checkout & payment gateway dibangun **setelah** Order Management inti jadi — keduanya bermuara ke tabel order yang sama.
5. **Definition of Stable per tahap:** acceptance criteria terpenuhi, `npm run typecheck` hijau, `npm run build` sukses, tidak ada regresi tahap sebelumnya, kontrol keamanan dasar lulus.

---

## 2. Pembagian tanggung jawab

### 🟦 Bani — Operasional Inti (backend / data / server)
Jantung sistem: dari order masuk sampai dokumentasi tervalidasi.

| Area | Referensi |
|------|-----------|
| **Database & migrations** (schema, enum, index, views KPI, RLS, RPC, storage) | `docs/05`, `docs/17` |
| **Auth & RBAC/RLS** (Supabase Auth, guard route, scope per cabang) | `docs/07` |
| **Order Management** (CRUD, nomor unik, state machine, 1 order banyak hewan, filter/search) | `docs/08`, `docs/16` |
| **Payment tracking** (Unpaid/Partial/Paid, gate DP & pelunasan) | `prd.md §7.4` |
| **Scheduling & Assignment** (tanggal, lokasi/koordinat, PIC) | `prd.md §7.5` |
| **Slaughter & Distribution** (catat pemotongan, distribusi, penanda kendala) | `prd.md §7.6` |
| **Documentation flow** (upload, validasi 2 tingkat Supervisor → Admin Pusat) | `docs/10` |
| **Audit trail** (siapa/kapan/apa untuk aksi penting) | `prd.md §7.14` |
| **Server actions / API layer** (`server/`, kontrak data untuk Awalin) | `docs/16` |

### 🟩 Awalin — Publik & Pelaporan (frontend / customer-facing)
Sisi yang dilihat peserta + output laporan + monitoring.

| Area | Referensi |
|------|-----------|
| **Landing / CMS / SEO** (landing page, halaman program, FAQ editable, sitemap, robots) | `docs/27`, `docs/14`, `docs/15` |
| **Katalog Program & Harga** (Aqiqah Ekonomi/Favorit/Premium, Nasi Box, Qurban) | `docs/28` |
| **Checkout + Guest Checkout** (ringkasan pesanan, buat order) | `features/checkout` |
| **Payment Gateway (UI + verifikasi)** | `features/integrations` |
| **Reporting Engine** (PDF React PDF + halaman publik `r/[token]` + kirim WA.me/Email) | `docs/11` |
| **Dashboard & Monitoring** (Executive/Cabang/Lokasi/Petugas dari views KPI) | `docs/09` |
| **PWA** (installable, offline queue upload, kamera) | `docs/13` |
| **Chatbot + human handoff** | `docs/26` |
| **Affiliate/Referral UI** (kode referral, tier, rekap) | `prd.md §7.11` |
| **Notification UI** (alert in-app) | `docs/12` |

> Catatan: pembagian bukan tembok. Bani menyediakan data & kontrak; Awalin merakit UI di atasnya. Saat butuh, saling bantu — tapi **schema tetap satu pintu (Bani)**.

---

## 3. Urutan tahap (build sequence)

```
TAHAP 0  Fondasi bersama  ← Bani + Awalin
   └─ init project, folder, tooling, .env.example
TAHAP 1  Database          ← Bani (Awalin review schema)
TAHAP 2  Auth              ← Bani
TAHAP 3  RBAC / RLS        ← Bani
─────────── setelah sini, kerja paralel ───────────
TAHAP 4  Order Mgmt*       ← Bani        ║  Landing/CMS/SEO   ← Awalin
TAHAP 5  Documentation     ← Bani        ║  Dashboard shell   ← Awalin
TAHAP 6  Reporting                       ← Awalin (butuh data order dari Bani)
TAHAP 7  Dashboard (KPI penuh)           ← Awalin
TAHAP 8  Automation (n8n, notifikasi)    ← Bani
TAHAP 9  AI Layer (fallback aman)        ← Bani/berdua
TAHAP 10 Public Platform**  (checkout, payment gateway, affiliate, chatbot) ← Awalin + Bani (server)
```

\* Tahap 4 mencakup Payment, Scheduling, Slaughter, Distribution, Issues (semua bagian rangkaian status order).
\** Tahap 10 dibangun **setelah** operasional inti (1–8) stabil.

**Gate antar tahap:** tahap berikut tidak dimulai sebelum tahap sebelumnya lulus Definition of Stable (§1.5).

---

## 4. Checklist per orang

### Bani
- [ ] Tahap 0: bantu init project & sepakati struktur folder (`docs/24`)
- [ ] Tahap 1: semua migration DB di `supabase/migrations/`; `supabase db reset` sukses
- [ ] Views KPI (`v_open_orders`, `v_branch_kpi`, `v_order_progress`) mengembalikan data
- [ ] Tahap 2: Auth login email+password jalan
- [ ] Tahap 3: RLS teruji positif & negatif (lintas cabang tidak bocor)
- [ ] Tahap 4: Order CRUD + state machine + payment gate + scheduling + slaughter/distribution
- [ ] Tahap 5: Documentation flow + validasi 2 tingkat; order tak bisa `COMPLETED` tanpa dokumentasi tervalidasi
- [ ] Audit trail mencatat aksi penting
- [ ] Kontrak data & tipe TypeScript untuk Awalin didokumentasikan
- [ ] Tahap 8: Automation/notifikasi outbox + n8n

### Awalin
- [ ] Tahap 0: bantu init project & setup Tailwind + layout dasar
- [ ] Landing page + halaman program + katalog harga (`docs/28`)
- [ ] CMS FAQ editable + SEO (sitemap XML, robots, metadata)
- [ ] Dashboard shell + KPI cards (Executive/Cabang/Lokasi/Petugas)
- [ ] Litmus test terjawab < 10 detik di dashboard
- [ ] Reporting: PDF per order + halaman publik `r/[token]` + unduh PDF + kirim WA.me/Email
- [ ] PWA installable + offline queue upload dokumentasi
- [ ] Tahap 10: Checkout + guest, payment gateway UI, affiliate UI, chatbot + handoff

---

## 5. Aturan Git (kerja berdua di satu branch)

- Branch utama kerja: **`claude/rebuild-aplikasi-nol-2lojhr`**.
- Disarankan tiap orang bikin sub-branch dari branch ini, mis. `feat/bani-order-mgmt`, `feat/awalin-landing`, lalu merge balik lewat PR kecil-kecil.
- **Commit kecil & sering** dengan pesan jelas (contoh: `feat(order): add state machine transitions`).
- **Hindari dua orang mengedit file yang sama** dalam satu waktu (terutama migration & tipe global).
- Sebelum push: `npm run typecheck` + `npm run build` harus hijau.
- Selalu `git pull` sebelum mulai kerja, dan komunikasikan perubahan schema.

---

## 6. Bootstrap teknis (Tahap 0)

```bash
# 1. Init & dependencies (Next.js 16 + Tailwind 4 + TS)
#    (perintah pasti disesuaikan saat scaffold)

# 2. Environment
cp .env.example .env.local   # isi kredensial Supabase, gateway, ANTHROPIC_API_KEY, dll.

# 3. Database lokal (butuh Docker + Supabase CLI)
supabase start
supabase db reset            # apply seluruh migrations + seed

# 4. Buat user & set role/branch_id di tabel profiles (via Supabase Studio)

# 5. Jalankan
npm run dev                  # http://localhost:3000
npm run typecheck            # tsc --noEmit
npm run build                # verifikasi build produksi
```

---

## 7. Definition of Done (Phase 1 / MVP)

- [ ] Litmus test terjawab < 10 detik di dashboard
- [ ] 1 cabang pilot bisa jalan end-to-end: order → pembayaran → jadwal → pemotongan → distribusi → dokumentasi → laporan
- [ ] ≥ 95% order selesai punya dokumentasi tervalidasi
- [ ] Laporan terkirim otomatis ke peserta via link unik
- [ ] Lulus UAT + checklist keamanan inti (`docs/20`, `docs/21`)

---

### Ringkasan satu kalimat
**Bani** pegang data & operasional inti (satu pintu untuk schema), **Awalin** pegang sisi publik & pelaporan; keduanya bangun **fondasi (DB+Auth) bersama dulu**, lalu kerja paralel mengikuti **build sequence** tanpa lompat tahap.
