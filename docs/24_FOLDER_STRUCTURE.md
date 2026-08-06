# 24 — FOLDER STRUCTURE

> **Sukses Aqiqah** — *"Tunaikan Ibadah, Tebarkan Manfaat"*
> Struktur project Next.js 16 (App Router) sebelum coding. Selaras dengan **15_PAGE_MAP**, **16_API_SPEC**, **14_UI_UX_SPEC**.

| Field | Value |
|-------|-------|
| Dokumen | 24_FOLDER_STRUCTURE |
| Versi | 1.0 |
| Tanggal | 2026-06-14 |
| Status | Draft — menunggu approval |

---

## 1. Root

```
sukses-aqiqah/
├─ app/                      # Next.js App Router (routes)
├─ components/               # Komponen UI reusable (14)
├─ features/                 # Logika per domain/modul (06)
├─ lib/                      # Util, klien, helpers
├─ server/                   # Server-only: actions, db, auth, services
├─ hooks/                    # React hooks
├─ types/                    # Tipe TypeScript & schema
├─ styles/                   # Tailwind & global css
├─ public/                   # Aset statis, ikon PWA, manifest
├─ supabase/                 # Migrations, policies (RLS), seed
├─ automation/               # Definisi/ekspor workflow n8n (referensi)
├─ tests/                    # Unit/integration/e2e
├─ docs/                     # Dokumen arsitektur (01–25)
├─ .env.example
├─ next.config.ts
├─ package.json
└─ README.md
```

## 2. `app/` (routes — lihat 15)

```
app/
├─ (public)/
│  ├─ page.tsx                     # Landing
│  └─ r/[token]/page.tsx           # Laporan publik (tanpa login)
├─ (auth)/
│  └─ login/page.tsx
├─ (app)/
│  ├─ layout.tsx                   # AppShell + guard sesi/RBAC
│  ├─ dashboard/page.tsx
│  ├─ orders/{page,new,[id]}/...
│  ├─ payments/page.tsx
│  ├─ programs/page.tsx
│  ├─ locations/page.tsx
│  ├─ petugas/{page,tugas}/...
│  ├─ documentation/page.tsx
│  ├─ reports/page.tsx
│  ├─ issues/page.tsx
│  └─ settings/page.tsx
├─ api/                            # Route handlers (16)
│  ├─ orders/route.ts
│  ├─ orders/[id]/{route,status,schedule,...}
│  ├─ documentation/...
│  ├─ public/reports/[token]/...
│  ├─ kpi/{overview,open-orders}/route.ts
│  └─ internal/notifications/dispatch/route.ts
├─ manifest.webmanifest            # (atau public/) — PWA (13)
└─ layout.tsx                      # Root layout
```

## 3. `features/` (per modul — lihat 06)

Setiap modul mengelompokkan komponen, hook, dan logika domainnya:

```
features/
├─ orders/         { components, hooks, schema, queries }
├─ payments/
├─ animals/
├─ slaughter/
├─ distribution/
├─ documentation/
├─ reporting/
├─ dashboard/      # KPI cards, charts, open-orders table
├─ notifications/
└─ issues/
```

## 4. `server/` (server-only)

```
server/
├─ actions/        # Server Actions per modul (mutasi)
├─ db/             # Supabase server client, query helpers
├─ auth/           # Sesi, RBAC guard, capability checks
├─ services/       # report (React PDF), storage, notification outbox
└─ validation/     # Schema (Zod) bersama untuk endpoint (16)
```

## 5. `components/` & `lib/`

```
components/
├─ ui/             # Primitives (shadcn/ui): button, card, table, badge...
├─ layout/         # AppShell, Sidebar, BottomNav, Header
├─ data/           # DataTable, FilterBar, KpiCard, StatusBadge
├─ media/          # MediaUploader, MediaGallery, MapView
└─ feedback/       # Toast, Skeleton, EmptyState

lib/
├─ supabase/       # createClient (browser/server)
├─ pwa/            # service worker, upload queue (IndexedDB) (13)
├─ format/         # tanggal, mata uang, status label
└─ constants/      # enum label, status warna (14)
```

## 6. `supabase/`

```
supabase/
├─ migrations/     # Skema bertahap (05) + RLS + views
├─ policies/       # Catatan kebijakan RLS (07/20)
└─ seed/           # Master data non-prod (services, demo)
```

## 7. `tests/` (lihat 21)

```
tests/
├─ unit/           # state machine, validasi, util
├─ integration/    # actions ↔ db ↔ RLS
└─ e2e/            # Playwright: order→laporan, offline upload, litmus
```

## 8. Konvensi

- **TypeScript** ketat; tipe & schema di `types/` & `server/validation`.
- **Server vs Client** dipisah jelas; secret hanya di `server/`/env.
- Penamaan file `kebab-case`; komponen `PascalCase`.
- Satu sumber kebenaran tipe entity (selaras **05**).
- Path alias (`@/features`, `@/server`, `@/components`).

---

### Referensi silang
- Routes/halaman → **15_PAGE_MAP**
- Endpoint → **16_API_SPEC**
- Komponen/UI → **14_UI_UX_SPEC**
- Skema/migrations → **05_DATABASE_DESIGN**
- Build order → **25_BUILD_SEQUENCE**
