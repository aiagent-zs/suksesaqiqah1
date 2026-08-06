# Sukses Aqiqah — Dokumentasi Arsitektur

> *"Tunaikan Ibadah, Tebarkan Manfaat"*
> Operations Command Center untuk Aqiqah, Qurban, dan Sedekah Daging — internal Zakat Sukses.

**Aturan emas:** dokumentasi diselesaikan & disetujui sebelum coding. Litmus test desain — sistem harus menjawab *"order belum selesai, di lokasi mana, siapa PIC, apa kendalanya?"* dalam **< 10 detik**.

## Status Penyusunan

| Batch | Dokumen | Status |
|-------|---------|--------|
| **A — Fondasi** | 01–08 | ✅ Selesai & disetujui |
| **B — Spesifikasi** | 09–17 | ✅ Selesai & disetujui |
| **C — Operasional/AI/Delivery** | 18–25 | ✅ Selesai (menunggu review) |

> **25/25 dokumen selesai.** Setelah Batch C disetujui, sistem siap masuk fase coding sesuai [25_BUILD_SEQUENCE](25_BUILD_SEQUENCE.md).

## Indeks Dokumen

### Batch A — Fondasi
- [01_PROJECT_VISION](01_PROJECT_VISION.md) — visi, misi, metrik, scope/non-scope
- [02_BUSINESS_REQUIREMENTS](02_BUSINESS_REQUIREMENTS.md) — goals, stakeholder, proses, constraint
- [03_PRODUCT_REQUIREMENTS](03_PRODUCT_REQUIREMENTS.md) — FR/NFR, user stories, acceptance criteria
- [04_SYSTEM_ARCHITECTURE](04_SYSTEM_ARCHITECTURE.md) — arsitektur, komponen, data flow
- [05_DATABASE_DESIGN](05_DATABASE_DESIGN.md) — entity, ERD, tabel, index *(sumber kebenaran data)*
- [06_MODULE_BREAKDOWN](06_MODULE_BREAKDOWN.md) — 8 modul inti
- [07_USER_ROLES](07_USER_ROLES.md) — 6 role + RBAC matrix
- [08_WORKFLOW_MAP](08_WORKFLOW_MAP.md) — state machine & alur tahap

### Batch B — Spesifikasi
- [09_DASHBOARD_SPEC](09_DASHBOARD_SPEC.md) — Executive/Cabang/Lokasi/Petugas + KPI
- [10_DOCUMENTATION_FLOW](10_DOCUMENTATION_FLOW.md) — upload + validasi 2 tingkat
- [11_REPORTING_ENGINE](11_REPORTING_ENGINE.md) — PDF + halaman publik bertoken
- [12_NOTIFICATION_SYSTEM](12_NOTIFICATION_SYSTEM.md) — WA.me, Email, Dashboard Alert
- [13_PWA_ARCHITECTURE](13_PWA_ARCHITECTURE.md) — manifest, offline queue, kamera
- [14_UI_UX_SPEC](14_UI_UX_SPEC.md) — design system, palet, komponen
- [15_PAGE_MAP](15_PAGE_MAP.md) — route App Router + akses per role
- [16_API_SPEC](16_API_SPEC.md) — endpoint, request/response, validasi
- [17_STORAGE_STRATEGY](17_STORAGE_STRATEGY.md) — bucket, naming, retensi

### Batch C — Operasional/AI/Delivery
- [18_AUTOMATION_WORKFLOW](18_AUTOMATION_WORKFLOW.md) — 8 workflow n8n (reminder/PDF/dispatch/housekeeping)
- [19_AI_LAYER](19_AI_LAYER.md) — 3 fitur AI bernilai bisnis (Phase 2)
- [20_SECURITY_CHECKLIST](20_SECURITY_CHECKLIST.md) — auth, RLS, file, audit, privasi
- [21_TESTING_PLAN](21_TESTING_PLAN.md) — unit/integration/E2E/UAT/performa/security
- [22_DEPLOYMENT_PLAN](22_DEPLOYMENT_PLAN.md) — Vercel/Supabase/n8n, CI/CD, migrations
- [23_MVP_ROADMAP](23_MVP_ROADMAP.md) — Phase 1/2/3 + exit criteria
- [24_FOLDER_STRUCTURE](24_FOLDER_STRUCTURE.md) — struktur project Next.js 16
- [25_BUILD_SEQUENCE](25_BUILD_SEQUENCE.md) — urutan build 9 tahap + gate

## Tech Stack (fixed)
Next.js 16 · Supabase · PostgreSQL · Supabase Storage · n8n · Vercel · Google Maps · PWA + Manifest · React PDF
