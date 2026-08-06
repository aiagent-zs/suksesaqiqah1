# Rebuild Guide — Membangun Sukses Aqiqah dari Nol

> Panduan masuk tunggal untuk tim/developer/AI yang membangun ulang project ini dari awal.
> Baca dokumen ini **pertama**, lalu ikuti urutan di bawah. Jangan salin 28 dokumen mentah-mentah — ikuti kurasi ini.

| Field | Value |
|-------|-------|
| Dokumen | `REBUILD_GUIDE.md` |
| Versi | 1.0 |
| Tanggal | 2026-08-06 |
| Titik masuk | `prd.md` → dokumen ini → build sequence |

---

## 0. Prinsip: dokumen menjelaskan niat, kode adalah kenyataan

Saat rebuild, urutan otoritas kebenaran:

1. **`supabase/migrations/`** — skema riil yang sudah teruji di Postgres. Ini fondasi & sumber kebenaran data.
2. **`features/`, `app/`, `server/`** — implementasi riil (termasuk fitur yang tidak/tidak lagi tercermin di sebagian docs).
3. **`prd.md`** — *apa* & *kenapa* (visi, scope, requirement, prioritas).
4. **`docs/01`–`docs/28`** — *bagaimana* detail per modul. Sebagian **sudah drift** dari kode (lihat §4).

Kalau docs dan kode berbeda, **kode menang** — perbarui dokumen, bukan sebaliknya.

---

## 1. Apakah `prd.md` cukup?

**Tidak, kalau sendirian.** `prd.md` adalah peta level-atas — cukup untuk memahami produk & memutuskan prioritas, tapi **tidak** memuat detail skema tabel, transisi state machine, matriks RLS, atau kontrak API yang wajib presisi saat coding.

**Tidak juga menyalin semua 28 docs.** Sebagian usang (lihat §4) dan akan membuat spec baru kontradiktif.

**Yang cukup:** `prd.md` + **set dokumen inti** di §2, dibaca sesuai urutan build di §3, dengan kode + migrations sebagai acuan akhir.

---

## 2. Set dokumen inti (dibaca berurutan)

### Tier 1 — Wajib sebelum menulis baris pertama
| Urutan | Dokumen | Untuk |
|--------|---------|-------|
| 1 | `prd.md` | Konteks, scope, requirement, prioritas |
| 2 | `docs/05_DATABASE_DESIGN.md` | Skema, enum, relasi, index, views — fondasi semua |
| 3 | `docs/07_USER_ROLES.md` | RBAC & aturan RLS per entity |
| 4 | `docs/08_WORKFLOW_MAP.md` | State machine status order (jantung operasional) |
| 5 | `docs/04_SYSTEM_ARCHITECTURE.md` | Gambaran arsitektur & keputusan teknis |
| 6 | `docs/25_BUILD_SEQUENCE.md` | Urutan tahap & gate antar tahap |
| 7 | `docs/24_FOLDER_STRUCTURE.md` | Struktur folder & konvensi |

### Tier 2 — Dibaca saat mengerjakan modul terkait
| Modul | Dokumen |
|-------|---------|
| API / endpoint | `docs/16_API_SPEC.md` |
| Dokumentasi & validasi | `docs/10_DOCUMENTATION_FLOW.md`, `docs/17_STORAGE_STRATEGY.md` |
| Reporting | `docs/11_REPORTING_ENGINE.md` |
| Dashboard/KPI | `docs/09_DASHBOARD_SPEC.md` |
| Notifikasi & automation | `docs/12_NOTIFICATION_SYSTEM.md`, `docs/18_AUTOMATION_WORKFLOW.md` |
| PWA | `docs/13_PWA_ARCHITECTURE.md` |
| UI/UX & halaman | `docs/14_UI_UX_SPEC.md`, `docs/15_PAGE_MAP.md` |
| Keamanan | `docs/20_SECURITY_CHECKLIST.md` |
| Testing & deploy | `docs/21_TESTING_PLAN.md`, `docs/22_DEPLOYMENT_PLAN.md` |
| AI layer | `docs/19_AI_LAYER.md` |

### Tier 3 — Fitur platform publik (tidak ada di rencana docs awal, hanya di kode)
Untuk modul berikut, **acuan utamanya migration + `features/`**, bukan docs 01–25:
- **Checkout / guest checkout** → `features/checkout/`, migration `..._checkout_guest.sql`
- **Payment gateway** → `features/integrations/`, migration `..._payments_gateway.sql`
- **Program & harga** → `features/programs/`, migration `..._services_pricing.sql`, `..._program_pricing_slug.sql`, `..._seed_packages.sql`; harga acuan di `docs/28_HARGA_PROGRAM.md`
- **Affiliate & tier** → `features/` terkait, migration `..._affiliate.sql`, `..._affiliate_tiers.sql`
- **Customer / landing / CMS / SEO** → `features/customer`, `features/landing`, `features/cms`, `features/seo`; migration `..._landing_media.sql`, `..._cms_pages_faqs.sql`; acuan `docs/27_PAGE_MENU.md`
- **Chatbot + human handoff** → `features/chatbot/`, migration `..._chatbot.sql`, `..._chatbot_kb_payment.sql`; acuan `docs/26_CHAT_BOT.md`
- **AI analyses** → `features/ai/`, migration `..._ai_analyses.sql`, `..._report_narrative.sql`

---

## 3. Urutan build (jangan lompat tahap)

Ikuti `docs/25_BUILD_SEQUENCE.md`. Ringkasnya:

```
1. Database  →  2. Authentication  →  3. RBAC/RLS  →  4. Order Management*
     →  5. Documentation  →  6. Reporting  →  7. Dashboard
     →  8. Automation  →  9. AI Layer
     →  10. Public Platform (checkout, payment gateway, affiliate, CMS/SEO, chatbot)**
```

- \* Tahap 4 mencakup Payment, Scheduling, Slaughter, Distribution, Issues (semuanya bagian rangkaian status order).
- \** Tahap 10 **tidak ada** di build sequence dokumen asli — ini lapisan yang tumbuh setelah MVP. Bangun **setelah** operasional inti (1–8) stabil, karena checkout/pembayaran bermuara ke Order Management yang sama.

**Gate antar tahap (Definition of Stable):** acceptance criteria terpenuhi, test hijau, kontrol keamanan lulus, tidak ada regresi tahap sebelumnya.

---

## 4. Dokumen yang sudah drift dari kode (hati-hati)

Jangan percaya bagian berikut mentah-mentah — kode sudah melampauinya:

| Dokumen | Klaim usang | Kenyataan di kode |
|---------|-------------|-------------------|
| `01_PROJECT_VISION` §6, `23_MVP_ROADMAP` §6 | Marketplace/checkout, payment gateway = **non-scope** | Sudah dibangun (`features/checkout`, `..._payments_gateway.sql`) |
| `24_FOLDER_STRUCTURE` | Grup route `(public)/`; `features/` hanya 10 modul operasional | Aktual: grup `(site)`; `features/` mencakup ai, chatbot, checkout, cms, customer, landing, programs, seo, users, integrations, pwa |
| Semua docs 01–25 | Peran "Peserta" hanya penerima laporan pasif | Kini peserta bisa memesan & bayar mandiri (customer-facing) |
| Beberapa header | Nama/branding awal | Sudah ada `..._rebrand_sukses_aqiqah.sql` |

`prd.md` sudah menyelaraskan hal-hal di atas — jadikan `prd.md` acuan scope, bukan docs 01/23.

---

## 5. Bootstrap teknis

```bash
# 1. Dependencies
npm install

# 2. Environment — salin & isi kredensial asli
cp .env.example .env.local   # isi Supabase, gateway, ANTHROPIC_API_KEY, dll.

# 3. Database lokal (Docker + Supabase CLI)
supabase start
supabase db reset            # apply seluruh migrations + seed

# 4. Buat user & set role/branch_id di tabel profiles (via Supabase Studio)

# 5. Jalankan
npm run dev                  # http://localhost:3000
npm run typecheck            # tsc --noEmit
npm run build                # verifikasi build produksi
```

Tech stack terkunci: **Next.js 16, React 19, Supabase (Postgres/Auth/Storage), Tailwind 4, React PDF, n8n, Vercel, Google Maps, `@anthropic-ai/sdk`.**

---

## 6. Checklist "siap mulai"

- [ ] Sudah baca `prd.md` + Tier 1 (§2).
- [ ] Paham skema `05` & state machine `08`.
- [ ] `supabase db reset` sukses; views KPI (`v_open_orders`, `v_branch_kpi`, `v_order_progress`) mengembalikan data.
- [ ] Login + RBAC/RLS teruji (positif & negatif lintas cabang).
- [ ] Litmus test bisa dijawab < 10 detik di dashboard.
- [ ] Mengikuti urutan build §3, tidak lompat tahap.

---

### Ringkasan satu kalimat
Bawa **`prd.md` + 7 dokumen Tier 1** sebagai bekal awal, gunakan **migrations + `features/` sebagai sumber kebenaran**, ikuti **build sequence**, dan perlakukan docs 01/23/24 sebagai arsip yang perlu dibaca kritis (sudah drift).