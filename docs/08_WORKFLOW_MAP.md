# 08 — WORKFLOW MAP

> **Sukses Aqiqah** — *"Tunaikan Ibadah, Tebarkan Manfaat"*
> Status mengikuti `order_status` di **05_DATABASE_DESIGN §5**.

| Field | Value |
|-------|-------|
| Dokumen | 08_WORKFLOW_MAP |
| Versi | 1.0 |
| Tanggal | 2026-06-14 |
| Status | Draft — menunggu approval |

---

## 1. Alur End-to-End

```mermaid
flowchart LR
    A[Order] --> B[Payment]
    B --> C[Schedule]
    C --> D[Preparation]
    D --> E[Slaughter]
    E --> F[Distribution]
    F --> G[Documentation]
    G --> H[Report]
    H --> I[Completed + Audit]
```

## 2. Order State Machine

```mermaid
stateDiagram-v2
    [*] --> new
    new --> paid: pembayaran diverifikasi
    new --> cancelled: dibatalkan
    paid --> scheduled: jadwal+PIC+lokasi ditetapkan
    scheduled --> preparation: hari-H, hewan disiapkan
    preparation --> slaughtering: pemotongan dimulai
    slaughtering --> distribution: daging didistribusikan
    distribution --> documentation: dokumentasi diunggah
    documentation --> reporting: dokumentasi APPROVED
    reporting --> completed: laporan terkirim
    new --> on_hold: kendala
    paid --> on_hold: kendala
    scheduled --> on_hold: kendala
    on_hold --> scheduled: kendala selesai
    completed --> [*]
    cancelled --> [*]
```

**Aturan transisi kunci:**
- `new → paid` butuh `payment_status = paid` **atau** `partial` dengan terbayar ≥ **`min_dp`** (DP/Partial diizinkan; `min_dp` dikonfigurasi di settings, default mis. 50%).
- `paid → scheduled` butuh `schedules` lengkap (tanggal, lokasi, PIC).
- **Pelunasan penuh** (`payment_status = paid`) wajib sebelum `reporting → completed`.
- `documentation → reporting` butuh ≥1 dokumentasi berstatus `approved`.
- `reporting → completed` butuh `reports` ter-generate & terkirim.
- `on_hold` dapat dipicu dari `issues` severity tinggi; kembali ke status sebelumnya saat resolved.

## 3. Workflow per Tahap (aktor, aksi, output, SLA)

| Tahap | Aktor | Aksi | Output/Status | SLA contoh |
|-------|-------|------|---------------|-----------|
| **Order** | Admin Cabang | Input order, item, peserta | `orders.status=new`, order_number | saat order masuk |
| **Payment** | Admin Cabang | Verifikasi bukti (lunas/DP ≥ min_dp) | `payment_status`, `status=paid` | < 1×24 jam |
| **Schedule** | Admin Cabang | Set tanggal/lokasi/PIC | `schedules`, `status=scheduled` | ≥ H-1 |
| **Preparation** | Petugas | Cek kelayakan hewan | `animals.status=prepared`, `status=preparation` | hari-H |
| **Slaughter** | Petugas | Catat pemotongan | `slaughter_records`, `animals.status=slaughtered` | hari-H |
| **Distribution** | Petugas | Catat distribusi | `distributions`, `animals.status=distributed` | ≤ H+1 |
| **Documentation** | Petugas→Supervisor→Pusat | Upload & validasi | `documentations.status` naik ke `approved` | ≤ H+1 |
| **Report** | n8n/Manager | Generate & kirim | `reports` + link unik | ≤ H+2 |
| **Audit** | Sistem | Catat jejak | `audit_logs` | berkelanjutan |

## 4. Sub-Workflow: Validasi Dokumentasi

```mermaid
flowchart TB
    U[Petugas upload\ndocumentations: pending] --> S{Supervisor review}
    S -->|reject + alasan| R1[rejected\nminta ulang]
    R1 --> U
    S -->|approve| P{Admin Pusat review}
    P -->|reject + alasan| R2[rejected\nminta ulang]
    R2 --> U
    P -->|approve| A[approved\nmasuk laporan]
```

Detail lengkap → **10_DOCUMENTATION_FLOW**.

## 5. Sub-Workflow: Reporting & Notifikasi (otomatis)

```mermaid
flowchart LR
    T[Trigger: dokumentasi approved\n& distribusi selesai] --> G[n8n generate PDF\nReact PDF]
    G --> SV[Simpan reports + public_token]
    SV --> N{Kirim notifikasi}
    N --> WA[WA.me ke peserta]
    N --> EM[Email ke peserta]
    WA --> PUB[Peserta buka\npublic report page]
    EM --> PUB
```

Detail → **11_REPORTING_ENGINE** & **18_AUTOMATION_WORKFLOW**.

## 6. Sub-Workflow: Penanganan Kendala (Issue)

```mermaid
flowchart LR
    I[Petugas/Admin buat issue] --> SEV{Severity}
    SEV -->|high| HOLD[order on_hold]
    SEV -->|low/medium| TRACK[tetap berjalan + monitor]
    HOLD --> RES[Resolusi]
    TRACK --> RES
    RES --> BACK[issue resolved\norder lanjut]
```

Issue terbuka **disorot di dashboard** sebagai bagian jawaban "apa kendalanya" (litmus test < 10 detik).

## 7. Reminder Otomatis (n8n)

| Reminder | Pemicu | Target |
|----------|--------|--------|
| Dokumentasi tertunda | Order `distribution`/`documentation` tanpa dokumentasi `approved` setelah SLA | Petugas + Supervisor |
| Distribusi tertunda | `slaughtered` tanpa `distributions` setelah SLA | Petugas + Admin |
| Laporan tertunda | `reporting` tanpa `reports` terkirim setelah SLA | Manager |

Detail → **18_AUTOMATION_WORKFLOW**.

## 8. Pemetaan ke Litmus Test

> *"Berapa order belum selesai, di lokasi mana, siapa PIC-nya, apa kendalanya?"*

| Pertanyaan | Sumber data |
|------------|-------------|
| Belum selesai | `orders.status ≠ completed/cancelled` |
| Lokasi mana | `schedules.location_id → locations` |
| Siapa PIC | `schedules.pic_user_id → users` |
| Apa kendalanya | `issues` (status open/in_progress) |

Disajikan oleh view `v_open_orders` (**05 §7**) di dashboard (**09**).

---

### Referensi silang
- Status & entity → **05_DATABASE_DESIGN**
- Modul → **06_MODULE_BREAKDOWN**
- Dokumentasi → **10_DOCUMENTATION_FLOW**
- Reporting → **11_REPORTING_ENGINE**
- Otomasi → **18_AUTOMATION_WORKFLOW**
