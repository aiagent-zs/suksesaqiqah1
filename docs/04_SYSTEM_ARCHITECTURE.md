# 04 — SYSTEM ARCHITECTURE

> **Sukses Aqiqah** — *"Tunaikan Ibadah, Tebarkan Manfaat"*

| Field | Value |
|-------|-------|
| Dokumen | 04_SYSTEM_ARCHITECTURE |
| Versi | 1.0 |
| Tanggal | 2026-06-14 |
| Status | Draft — menunggu approval |

---

## 1. Prinsip Arsitektur

1. **Managed-first** — manfaatkan Supabase & Vercel agar tim kecil fokus ke fitur, bukan infra.
2. **Single source of truth** — PostgreSQL (Supabase) sebagai pusat data; semua modul membaca/menulis ke sini.
3. **Server-centric Next.js** — App Router + Server Components/Server Actions; logika sensitif di server.
4. **Security at the data layer** — Row Level Security (RLS) PostgreSQL menegakkan scoping per cabang/role.
5. **Event-driven automation** — n8n menangani reminder, generate PDF, dan kirim notifikasi secara asinkron.
6. **PWA offline-tolerant** — antrian upload di klien untuk kondisi sinyal lapangan.
7. **Stateless app tier** — state di DB/Storage; app layer mudah diskalakan horizontal di Vercel.

## 2. High-Level Architecture

```mermaid
flowchart TB
    subgraph Client["Client Layer (PWA)"]
        UI[Next.js 16 App Router\nReact Server + Client Components]
        SW[Service Worker\nOffline Upload Queue]
        CAM[Camera Capture]
    end

    subgraph Edge["Vercel (Hosting/Edge)"]
        SSR[SSR / Server Components]
        SA[Server Actions / Route Handlers]
        PUB[Public Report Pages\n token-based, no auth]
    end

    subgraph Supabase["Supabase (Backend-as-a-Service)"]
        AUTH[Supabase Auth\nJWT + RBAC]
        PG[(PostgreSQL\n+ Row Level Security)]
        STG[Supabase Storage\nFoto/Video + Signed URL]
        RT[Realtime\nstatus updates]
        EF[Edge Functions opsional]
    end

    subgraph Automation["Automation & Integrasi"]
        N8N[n8n Workflows\nReminder/PDF/Email]
        PDF[React PDF Renderer]
        WA[WA.me Link]
        MAIL[Email / SMTP]
        MAPS[Google Maps API]
        AI[AI Layer - Phase 2]
    end

    CAM --> UI
    UI <--> SW
    UI --> SSR
    UI --> SA
    SA <--> AUTH
    SA <--> PG
    SA <--> STG
    UI <--> RT
    SSR --> PUB
    PG --> RT
    N8N <--> PG
    N8N --> PDF
    N8N --> WA
    N8N --> MAIL
    UI --> MAPS
    N8N -.-> AI
    PUB --> STG
```

## 3. System Components

| Komponen | Teknologi | Tanggung jawab |
|----------|-----------|----------------|
| **Web/PWA Frontend** | Next.js 16 (App Router), React, Tailwind (lihat **14_UI_UX_SPEC**) | UI operasional, dashboard, form, kamera, offline queue. |
| **Server Actions / Route Handlers** | Next.js server runtime di Vercel | Mutasi data, validasi, orkestrasi ke Supabase. |
| **Public Report Pages** | Next.js (route publik bertoken) | Halaman laporan peserta tanpa login. |
| **Authentication** | Supabase Auth (JWT) | Login internal, sesi, klaim role/cabang. |
| **Database** | PostgreSQL (Supabase) + RLS | Sumber kebenaran data; penegakan akses di level baris. |
| **Storage** | Supabase Storage | Simpan foto/video; akses via signed URL. |
| **Realtime** | Supabase Realtime | Update status & dashboard live. |
| **Automation** | n8n | Reminder, generate PDF, kirim WA/email, jadwal. |
| **PDF Renderer** | React PDF | Membuat laporan PDF. |
| **Maps** | Google Maps API | Koordinat lokasi & visual peta. |
| **Notification channels** | WA.me, Email (SMTP/transactional) | Distribusi link laporan & reminder. |
| **AI Layer (Phase 2)** | Claude API | Executive summary, risk detector, report writer (**19_AI_LAYER**). |

## 4. Data Flow

### 4.1 Operasional (write path) — contoh: upload dokumentasi
```mermaid
sequenceDiagram
    participant P as Petugas (PWA)
    participant SW as Service Worker
    participant SA as Server Action
    participant ST as Supabase Storage
    participant DB as PostgreSQL

    P->>SW: Ambil foto/video
    alt Online
        SW->>SA: Kirim file + metadata
    else Offline
        SW-->>SW: Antrikan, retry saat online
        SW->>SA: Kirim saat koneksi pulih
    end
    SA->>ST: Upload file (path terstruktur)
    ST-->>SA: storage path
    SA->>DB: Insert documentation (status=PENDING)
    DB-->>SA: ok
    SA-->>P: Konfirmasi tersimpan
```

### 4.2 Monitoring (read path) — dashboard real-time
```mermaid
sequenceDiagram
    participant U as Direktur/Manager
    participant UI as Dashboard (Next.js)
    participant DB as PostgreSQL (views/agregat)
    participant RT as Supabase Realtime

    U->>UI: Buka Executive Dashboard
    UI->>DB: Query KPI (views teragregasi, RLS)
    DB-->>UI: KPI + daftar order tertunda
    UI-->>U: Render < 3 dtk
    DB-->>RT: Perubahan status
    RT-->>UI: Push update
    UI-->>U: KPI ter-refresh live
```

### 4.3 Reporting & notifikasi (event-driven)
```mermaid
sequenceDiagram
    participant DB as PostgreSQL
    participant N as n8n
    participant PDF as React PDF
    participant CH as WA.me / Email
    participant Peserta

    DB-->>N: Trigger (order COMPLETED / dokumentasi APPROVED)
    N->>PDF: Render laporan PDF
    PDF-->>N: File PDF
    N->>DB: Simpan report + token link unik
    N->>CH: Kirim link laporan
    CH-->>Peserta: WA / Email berisi link publik
    Peserta->>DB: Buka public report page (read-only via token)
```

## 5. Integration Flow

| Integrasi | Arah | Pemicu | Catatan |
|-----------|------|--------|---------|
| Supabase Auth ↔ App | 2 arah | Login/refresh sesi | Klaim role & cabang dipakai RLS. |
| App ↔ PostgreSQL | 2 arah | Setiap operasi data | RLS aktif; akses via Server Actions. |
| App ↔ Storage | 2 arah | Upload/lihat media | Signed URL untuk akses terbatas waktu. |
| PostgreSQL → Realtime → App | 1 arah | Perubahan baris | Update dashboard & status live. |
| PostgreSQL/Webhook → n8n | 1 arah | Event status / jadwal cron | Memicu reminder & generate laporan. |
| n8n → React PDF | internal | Generate laporan | Output disimpan ke Storage + token. |
| n8n → WA.me / Email | keluar | Laporan siap / reminder | wa.me link & email transactional. |
| App → Google Maps | keluar | Tampilkan/isi lokasi | API key dibatasi domain. |
| n8n/App → AI (Phase 2) | keluar | Ringkasan/risk/report | Claude API; data diminimalkan. |

## 6. Environments

| Env | Tujuan | Catatan |
|-----|--------|---------|
| Development | Pengembangan lokal | Supabase project dev + Vercel preview. |
| Staging | UAT & uji performa | Data dummy; konfigurasi mirip prod. |
| Production | Operasional nyata | Backup terjadwal; monitoring aktif. |

Detail deployment → **22_DEPLOYMENT_PLAN**.

## 7. Cross-Cutting Concerns

- **Security & Privacy** → **20_SECURITY_CHECKLIST** (RLS, signed URL, audit trail, data minimization).
- **Observability** → log error, alert dashboard, metrik operasional (NFR-10).
- **Scalability** → app stateless di Vercel; DB connection pooling Supabase; Storage CDN-backed.
- **Resilience** → antrian upload offline; retry n8n; idempotensi pada generate laporan.

---

### Referensi silang
- Skema data & RLS → **05_DATABASE_DESIGN**
- Modul → **06_MODULE_BREAKDOWN**
- PWA → **13_PWA_ARCHITECTURE**
- Otomasi → **18_AUTOMATION_WORKFLOW**
- Deployment → **22_DEPLOYMENT_PLAN**
