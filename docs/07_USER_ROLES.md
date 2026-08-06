# 07 — USER ROLES & RBAC

> **Sukses Aqiqah** — *"Tunaikan Ibadah, Tebarkan Manfaat"*
> Sumber kebenaran **RBAC** untuk **09_DASHBOARD_SPEC** & **20_SECURITY_CHECKLIST**.

| Field | Value |
|-------|-------|
| Dokumen | 07_USER_ROLES |
| Versi | 1.1 |
| Tanggal | 2026-06-14 |
| Status | Draft — menunggu approval |
| Catatan revisi | v1.1: menambah role **Admin Pusat** sebagai validator dokumentasi tingkat-akhir terpusat. |

---

## 1. Daftar Role

| Role | Enum (`user_role`) | Scope data | Otentikasi |
|------|--------------------|------------|------------|
| Direktur | `direktur` | Semua cabang | Login |
| Manager Program | `manager_program` | Semua cabang / per program | Login |
| **Admin Pusat** | `admin_pusat` | Semua cabang (fokus validasi) | Login |
| Admin Cabang | `admin_cabang` | 1 cabang (`branch_id`) | Login |
| Petugas Lapangan | `petugas_lapangan` | Tugas yang ditugaskan (PIC) | Login |
| Peserta | (anon, tanpa akun) | Order miliknya via token | Tanpa login (link unik) |

> **Validasi dokumentasi 2 tingkat:** tingkat-1 **Supervisor** (kapabilitas yang dipegang `admin_cabang`/`manager_program` yang ditunjuk) → tingkat-akhir **Admin Pusat** (`admin_pusat`, role terpusat khusus). Manager/Direktur tetap dapat memantau, namun keputusan validasi akhir baku berada pada Admin Pusat.

## 2. Deskripsi & Tanggung Jawab

### 2.1 Direktur
Pengawasan strategis seluruh organisasi.
- Melihat **Executive Dashboard** & seluruh KPI agregat.
- Melihat laporan eksekutif & (Phase 2) AI Executive Summary/Risk.
- Mengakses audit trail.
- **Tidak** menangani input operasional harian.

### 2.2 Manager Program
Mengelola jalannya program lintas cabang.
- Memantau progres semua cabang & lokasi.
- Mengelola master data (services, template laporan).
- Memicu/meninjau laporan & reminder.
- Dapat ditunjuk sebagai Supervisor (validasi tingkat-1).

### 2.3 Admin Pusat
Penjaga mutu dokumentasi terpusat.
- **Validasi dokumentasi tingkat-akhir** (`approved_supervisor → approved`/`rejected`).
- Memantau antrian validasi seluruh cabang.
- Memastikan hanya bukti sah masuk laporan.
- Dapat memicu/meninjau generate laporan setelah dokumentasi final.

### 2.4 Admin Cabang
Operator utama di cabang.
- CRUD order, peserta, jadwal, penetapan PIC — **dalam cabangnya**.
- Verifikasi pembayaran.
- Validasi dokumentasi tingkat-1 (jika ditunjuk sebagai Supervisor).
- Memantau **Cabang/Lokasi Dashboard**.

### 2.5 Petugas Lapangan
Eksekutor di lapangan.
- Melihat **Petugas Dashboard** (tugas yang ditugaskan).
- Update status pemotongan & distribusi.
- Upload dokumentasi (kamera PWA, offline-tolerant).
- Melaporkan kendala (`issues`).

### 2.6 Peserta
Penerima output (tanpa akun).
- Membuka **halaman laporan publik** via link unik bertoken.
- Mengunduh PDF laporan.
- **Read-only**, hanya order miliknya.

## 3. RBAC Matrix (CRUD per entity)

Legend: **C**=Create, **R**=Read, **U**=Update, **D**=Delete, **—**=tidak ada akses, **R\***=read ter-scope, **(token)**=akses publik via link.

| Entity / Aksi | Direktur | Manager Program | Admin Pusat | Admin Cabang | Petugas Lapangan | Peserta |
|---------------|:--------:|:---------------:|:-----------:|:------------:|:----------------:|:-------:|
| orders | R | R, U(status) | R | C R U (branch) | R* U(status tugas) | (token) R |
| order_items | R | R | R | C R U (branch) | R* | — |
| participants | R | R, U | R | C R U (branch) | R* | — |
| payments | R | R | R | C R U (branch) | — | — |
| schedules | R | R | R | C R U (branch) | R* | — |
| animals | R | R | R | C R U (branch) | R* U(status) | — |
| slaughter_records | R | R | R | R | C R (tugas) | — |
| distributions | R | R | R | R U | C R (tugas) | — |
| documentations | R | R + validasi-1(jika ditunjuk) | R + **validasi akhir** | C R + validasi-1(jika ditunjuk) | C R (tugas, upload) | (token) R approved |
| reports | R | R, generate/kirim | R, generate/kirim | R | R* | (token) R + download |
| issues | R | R, U | R | C R U (branch) | C R (tugas) | — |
| notifications | R | R, kirim | R | R (branch) | R* | — |
| users | R | R, U | R | R (branch) | R(self) | — |
| branches / locations | R | C R U | R | R (own) | R* | — |
| services | R | C R U D | R | R | R | — |
| audit_logs | R | R | R | R (branch) | — | — |

## 4. Kapabilitas Khusus (action-level)

| Kapabilitas | Direktur | Manager | Admin Pusat | Admin Cabang | Petugas |
|-------------|:--------:|:-------:|:-----------:|:------------:|:-------:|
| Ubah status order (transisi valid) | — | ✔ | — | ✔ | ✔ (tahap tugasnya) |
| Verifikasi pembayaran | — | ✔ | — | ✔ | — |
| Validasi dokumentasi tingkat-1 (Supervisor) | — | ✔ (jika ditunjuk) | — | ✔ (jika ditunjuk) | — |
| Validasi dokumentasi tingkat-akhir | — | — | ✔ | — | — |
| Generate & kirim laporan | — | ✔ | ✔ | ✔ (branch) | — |
| Kelola master data & user | — | ✔ | — | terbatas (branch) | — |
| Lihat seluruh cabang | ✔ | ✔ | ✔ | — | — |
| Akses audit trail penuh | ✔ | ✔ | ✔ | branch saja | — |

## 5. Penegakan Teknis (enforcement)

- **Supabase Auth JWT** membawa klaim `role` & `branch_id`.
- **PostgreSQL RLS** menegakkan scoping di level baris (lihat **05 §8** & **20**).
- **Server Actions** memvalidasi kapabilitas action-level sebelum mutasi.
- **Akses peserta** melalui fungsi keamanan bertoken (bukan tabel langsung); media via signed URL terbatas waktu.
- Setiap aksi sensitif → `audit_logs`.

## 6. Prinsip

- **Least privilege** — default tanpa akses; berikan minimum yang diperlukan.
- **Scope by branch** untuk operasional; **global read** hanya untuk pusat (Direktur/Manager/Admin Pusat).
- **Pemisahan tugas** — pengupload dokumentasi (Petugas) ≠ validator tingkat-1 (Supervisor) ≠ validator akhir (Admin Pusat).

---

### Referensi silang
- Skema & RLS → **05_DATABASE_DESIGN**
- Dashboard per role → **09_DASHBOARD_SPEC**
- Keamanan → **20_SECURITY_CHECKLIST**
- Alur validasi → **10_DOCUMENTATION_FLOW**
- Workflow → **08_WORKFLOW_MAP**
