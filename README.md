# Sukses Aqiqah

> _"Tunaikan Ibadah, Tebarkan Manfaat"_

Aplikasi operasional & platform publik Sukses Aqiqah: dari order masuk → pembayaran → penjadwalan → pemotongan → distribusi → dokumentasi tervalidasi → laporan ke peserta.

**Litmus test sistem:** harus bisa menjawab dalam **< 10 detik** — _"Berapa order yang belum selesai, di lokasi mana, siapa PIC-nya, apa kendalanya?"_

---

## Dokumen (baca berurutan)

| Urutan | Dokumen                                | Isi                                         |
| ------ | -------------------------------------- | ------------------------------------------- |
| 1      | [`prd.md`](prd.md)                     | Visi, scope, requirement, prioritas         |
| 2      | [`REBUILD_GUIDE.md`](REBUILD_GUIDE.md) | Panduan masuk + dokumen inti Tier 1         |
| 3      | [`TEAM_PLAN.md`](TEAM_PLAN.md)         | Pembagian kerja Bani & Awalin, urutan tahap |
| 4      | [`docs/`](docs/)                       | Detail per modul (01–28)                    |

**Urutan otoritas kebenaran:** `supabase/migrations/` → kode (`features/`, `app/`, `server/`) → `prd.md` → `docs/`.
Kalau docs dan kode berbeda, **kode menang**.

---

## Tech stack

Next.js 16 (App Router) · React 19 · Tailwind 4 · TypeScript · Supabase (Postgres/Auth/Storage) · Zod · React PDF · n8n · Vercel

---

## Setup lokal

Prasyarat: **Node.js ≥ 20.9**, **Docker Desktop** (jalan), **Git**.

```bash
# 1. Dependencies
npm install

# 2. Environment
cp .env.example .env.local      # isi kredensial (nilai lokal keluar dari `npm run db:start`)

# 3. Database lokal
npm run db:start                # supabase start — pertama kali menarik image Docker
npm run db:reset                # apply migrations + seed (mulai Tahap 1)

# 4. Jalankan
npm run dev                     # http://localhost:3000
```

### Scripts

| Script                         | Fungsi                                         |
| ------------------------------ | ---------------------------------------------- |
| `npm run dev`                  | Dev server                                     |
| `npm run build`                | Build produksi                                 |
| `npm run typecheck`            | `next typegen && tsc --noEmit`                 |
| `npm run lint`                 | ESLint                                         |
| `npm run format`               | Prettier                                       |
| `npm run test`                 | Vitest                                         |
| `npm run db:start` / `db:stop` | Start/stop Supabase lokal                      |
| `npm run db:reset`             | Reset DB + apply seluruh migrations & seed     |
| `npm run db:types`             | Generate `types/database.ts` dari schema lokal |

### Layanan lokal (setelah `npm run db:start`)

| Layanan              | URL                    |
| -------------------- | ---------------------- |
| App                  | http://localhost:3000  |
| Supabase Studio      | http://localhost:54323 |
| API Supabase         | http://localhost:54321 |
| Mailpit (email test) | http://localhost:54324 |

---

## Struktur folder

Lihat [`docs/24_FOLDER_STRUCTURE.md`](docs/24_FOLDER_STRUCTURE.md).
Catatan koreksi: route group publik memakai **`(site)`**, bukan `(public)`.

```
app/         routes (App Router)      server/      server-only: actions, db, auth, services
components/  UI reusable              lib/         util, klien, helpers
features/    logika per domain        supabase/    migrations, policies, seed
types/       tipe & schema            tests/       unit, integration, e2e
```

---

## Urutan build (jangan lompat tahap)

```
0. Fondasi ✅  1. Database  2. Auth  3. RBAC/RLS  4. Order Management
  5. Documentation  6. Reporting  7. Dashboard  8. Automation  9. AI Layer
  10. Public Platform (checkout, payment gateway, affiliate, chatbot)
```

**Gate antar tahap:** acceptance criteria terpenuhi · `npm run typecheck` hijau · `npm run build` sukses · tidak ada regresi · kontrol keamanan lulus.

Detail: [`docs/25_BUILD_SEQUENCE.md`](docs/25_BUILD_SEQUENCE.md) & [`TEAM_PLAN.md`](TEAM_PLAN.md).

---

## Aturan tim

- **Schema satu pintu:** hanya **Bani** yang menambah/mengubah file di `supabase/migrations/`.
- Commit kecil & sering; sub-branch per orang (`feat/bani-*`, `feat/awalin-*`), merge lewat PR.
- Sebelum push: `npm run typecheck` + `npm run build` harus hijau.
- `.env.local` **tidak pernah** di-commit.
