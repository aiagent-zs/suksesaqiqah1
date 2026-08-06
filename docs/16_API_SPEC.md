# 16 — API SPEC

> **Sukses Aqiqah** — *"Tunaikan Ibadah, Tebarkan Manfaat"*
> Entity mengikuti **05_DATABASE_DESIGN**; akses mengikuti **07_USER_ROLES**.

| Field | Value |
|-------|-------|
| Dokumen | 16_API_SPEC |
| Versi | 1.0 |
| Tanggal | 2026-06-14 |
| Status | Draft — menunggu approval |

---

## 1. Pendekatan

- Mutasi utama lewat **Next.js Server Actions** & **Route Handlers** (`app/api/*`) di Vercel; data via Supabase client (server-side, RLS aktif).
- Konvensi REST-like di bawah ini menjadi kontrak logis (baik diimplementasi sebagai Server Action maupun route handler).
- **Auth:** Bearer JWT Supabase (kecuali endpoint publik bertoken).
- **Format:** JSON. Waktu ISO-8601. ID = uuid.
- **Error standar:**
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "fields": { "field": "pesan" } } }
```
Kode umum: `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `VALIDATION_ERROR` (422), `CONFLICT` (409), `RATE_LIMITED` (429).

- **Paginasi:** `?page=1&page_size=20` → respons `{ data: [...], page, page_size, total }`.
- **Filter umum order:** `?status=&branch_id=&location_id=&pic_id=&service_type=&date_from=&date_to=&q=`.

## 2. Auth

| Method | Path | Akses | Deskripsi |
|--------|------|-------|-----------|
| POST | `/api/auth/login` | publik | Login (delegasi Supabase Auth) |
| POST | `/api/auth/logout` | login | Akhiri sesi |
| GET | `/api/me` | login | Profil + role + branch_id |

## 3. Orders

| Method | Path | Akses | Deskripsi |
|--------|------|-------|-----------|
| GET | `/api/orders` | R sesuai scope | List + filter + paginate |
| POST | `/api/orders` | Admin Cabang | Buat order |
| GET | `/api/orders/{id}` | R sesuai scope | Detail order (+relasi) |
| PATCH | `/api/orders/{id}` | Admin Cabang | Ubah data order |
| POST | `/api/orders/{id}/status` | sesuai kapabilitas | Transisi status (validasi state machine **08**) |
| GET | `/api/orders/{id}/timeline` | R | Riwayat audit order |

**POST /api/orders — request:**
```json
{
  "participant": { "name": "Ahmad", "phone": "62812...", "email": "a@x.id" },
  "branch_id": "uuid",
  "items": [{ "service_id": "uuid", "qty": 1, "unit_price": 1750000, "meta": { "on_behalf_of": "Ahmad" } }],
  "animals": [{ "species": "kambing", "on_behalf_of": "Ahmad" }],
  "notes": "..."
}
```
**Validasi:** `branch_id` = branch user (admin); `items` ≥ 1; `service_id` aktif; `qty` ≥ 1.
**Response 201:**
```json
{ "data": { "id": "uuid", "order_number": "IA-202606-0012", "status": "new", "payment_status": "unpaid" } }
```

**POST /api/orders/{id}/status — request:** `{ "to": "scheduled", "reason": "..." }`
**Validasi:** transisi diizinkan untuk role & memenuhi precondition. `scheduled` butuh schedule lengkap + pembayaran memenuhi gate (`paid` **atau** `partial ≥ min_dp`); `completed` butuh **pelunasan penuh** + dokumentasi `approved`. Gagal → `CONFLICT`/`VALIDATION_ERROR`.

## 4. Payments

| Method | Path | Akses | Deskripsi |
|--------|------|-------|-----------|
| GET | `/api/orders/{id}/payments` | Admin/Manager | Riwayat pembayaran |
| POST | `/api/orders/{id}/payments` | Admin Cabang | Catat pembayaran (+upload bukti) |
| POST | `/api/payments/{id}/verify` | Admin Cabang | Verifikasi → update `payment_status` |

**POST payments — request:** `{ "amount": 1750000, "method": "transfer", "proof_path": "storage/..." }` → set `orders.payment_status`.

## 5. Schedules

| Method | Path | Akses | Deskripsi |
|--------|------|-------|-----------|
| GET | `/api/schedules?date=&location_id=&pic_id=` | R scope | Jadwal |
| PUT | `/api/orders/{id}/schedule` | Admin Cabang | Set tanggal/lokasi/PIC |

**PUT schedule — request:** `{ "location_id": "uuid", "pic_user_id": "uuid", "scheduled_date": "2026-06-12", "scheduled_time": "07:00" }` → order `scheduled`.

## 6. Animals, Slaughter, Distribution

| Method | Path | Akses | Deskripsi |
|--------|------|-------|-----------|
| GET | `/api/orders/{id}/animals` | R scope | List hewan |
| POST | `/api/orders/{id}/animals` | Admin Cabang | Tambah hewan |
| PATCH | `/api/animals/{id}` | Admin/Petugas | Update status hewan |
| POST | `/api/animals/{id}/slaughter` | Petugas (PIC) | Catat pemotongan |
| GET | `/api/orders/{id}/distributions` | R scope | List distribusi |
| POST | `/api/orders/{id}/distributions` | Petugas (PIC) | Catat distribusi |

**POST slaughter — request:** `{ "performed_at": "2026-06-12T07:30:00Z", "notes": "..." }` → `slaughter_records`, `animals.status=slaughtered`.
**POST distributions — request:** `{ "recipient_name": "...", "recipient_area": "Cibiru", "packages_count": 8, "lat": -6.9, "lng": 107.7 }`.

## 7. Documentation

| Method | Path | Akses | Deskripsi |
|--------|------|-------|-----------|
| POST | `/api/orders/{id}/documentation` | Petugas (PIC) | Upload metadata (file via Storage signed upload) |
| GET | `/api/documentation?status=pending&branch_id=` | Supervisor/Pusat | Antrian validasi |
| POST | `/api/documentation/{id}/review` | Supervisor/Pusat | Approve/Reject |

**POST documentation — request:**
```json
{ "animal_id": "uuid|null", "type": "photo", "stage": "slaughter", "storage_path": "...", "caption": "..." }
```
→ `documentations.status=pending`.
**POST review — request:** `{ "decision": "approve" | "reject", "note": "alasan jika reject" }`
- `approve` oleh **Supervisor** (Admin Cabang/Manager ditunjuk) → `approved_supervisor`; oleh **Admin Pusat** (`admin_pusat`) → `approved`.
- `reject` → `rejected` + `review_note` wajib.
- Kapabilitas ditegakkan per role (lihat **07**): hanya `admin_pusat` yang dapat memberi `approved` final.

## 8. Reports (internal) & Public (token)

| Method | Path | Akses | Deskripsi |
|--------|------|-------|-----------|
| POST | `/api/orders/{id}/report` | Manager/Admin/n8n | Generate PDF + token + (opsi) kirim |
| GET | `/api/orders/{id}/reports` | R scope | Daftar versi laporan |
| GET | `/api/public/reports/{token}` | **publik** | Data laporan untuk halaman publik (read-only) |
| GET | `/api/public/reports/{token}/pdf` | **publik** | Signed URL / stream PDF |

**Publik:** validasi token server-side; hanya data order pemilik token; media via signed URL; rate-limited; token invalid → 404 generik.

## 9. Notifications

| Method | Path | Akses | Deskripsi |
|--------|------|-------|-----------|
| GET | `/api/notifications` | login | Alert in-app (scope user) |
| POST | `/api/notifications/{id}/read` | login | Tandai dibaca |
| POST | `/api/internal/notifications/dispatch` | service (n8n) | Proses outbox → WA/email |

## 10. Dashboard / KPI

| Method | Path | Akses | Deskripsi |
|--------|------|-------|-----------|
| GET | `/api/kpi/overview?branch_id=&period=` | login | KPI agregat (dari views **05 §7**) |
| GET | `/api/kpi/open-orders?branch_id=&location_id=` | login | Order tertunda + lokasi + PIC + issue (litmus test) |

**GET open-orders — response (inti litmus test):**
```json
{ "data": [
  { "order_number": "IA-202606-0012", "branch": "Bandung", "location": "Masjid Al-Ikhlas",
    "pic": "Budi", "status": "documentation", "open_issues": 1, "age_hours": 30 }
] }
```

## 11. Master & Issues

| Method | Path | Akses |
|--------|------|-------|
| GET/POST/PATCH | `/api/services` | Manager(CRUD), lain(R) |
| GET/POST/PATCH | `/api/locations` | Manager/Admin |
| GET/POST/PATCH | `/api/users` | Manager/Admin(branch) |
| GET/POST/PATCH | `/api/orders/{id}/issues` | Admin/Manager/Petugas |

## 12. Aturan Validasi Lintas Endpoint

- Semua input divalidasi schema (mis. Zod) sebelum mutasi.
- Scoping `branch_id` ditegakkan di server + RLS (defense in depth).
- Transisi status hanya via `/status` (tidak boleh patch langsung kolom status sembarang).
- Upload file lewat Storage signed upload; server hanya menyimpan `storage_path` tervalidasi.
- Endpoint publik: tanpa data sensitif selain milik token; rate limiting wajib.

---

### Referensi silang
- Entity & views → **05_DATABASE_DESIGN**
- Workflow/status → **08_WORKFLOW_MAP**
- Akses → **07_USER_ROLES**
- Keamanan → **20_SECURITY_CHECKLIST**
