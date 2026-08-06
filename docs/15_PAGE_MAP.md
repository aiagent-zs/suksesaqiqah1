# 15 — PAGE MAP

> **Sukses Aqiqah** — *"Tunaikan Ibadah, Tebarkan Manfaat"*
> Route Next.js 16 App Router. Akses per role mengikuti **07_USER_ROLES**.

| Field | Value |
|-------|-------|
| Dokumen | 15_PAGE_MAP |
| Versi | 1.0 |
| Tanggal | 2026-06-14 |
| Status | Draft — menunggu approval |

---

## 1. Struktur Route (App Router)

```
app/
├─ (public)/
│  ├─ page.tsx                      → / (Landing)
│  └─ r/[token]/page.tsx            → /r/{token} (Laporan Publik, tanpa login)
├─ (auth)/
│  └─ login/page.tsx                → /login
└─ (app)/                            ← terproteksi (Supabase Auth + RBAC)
   ├─ dashboard/page.tsx            → /dashboard
   ├─ orders/
   │  ├─ page.tsx                   → /orders (list)
   │  ├─ new/page.tsx               → /orders/new
   │  └─ [id]/page.tsx              → /orders/{id} (detail)
   ├─ programs/page.tsx             → /programs (services/program)
   ├─ locations/page.tsx           → /locations
   ├─ petugas/page.tsx             → /petugas (kelola petugas) + /petugas/tugas (tugas saya)
   ├─ documentation/page.tsx       → /documentation (antrian validasi)
   ├─ reports/page.tsx             → /reports
   ├─ payments/page.tsx            → /payments
   ├─ issues/page.tsx              → /issues
   └─ settings/page.tsx            → /settings
```

## 2. Daftar Halaman

| Halaman | Route | Akses | Fungsi |
|---------|-------|-------|--------|
| **Landing** | `/` | Publik | Penjelasan singkat + tombol login. |
| **Login** | `/login` | Publik | Auth internal (Supabase). |
| **Dashboard** | `/dashboard` | Semua role login | Render dashboard sesuai role (Executive/Cabang/Lokasi/Petugas — **09**). |
| **Order List** | `/orders` | Direktur(R), Manager(R), Admin(CRU), Petugas(R*) | Tabel order + filter + status. |
| **Order Create** | `/orders/new` | Admin Cabang | Form order baru. |
| **Order Detail** | `/orders/{id}` | sesuai scope | Tab: Info, Pembayaran, Jadwal, Hewan, Dokumentasi, Distribusi, Riwayat. |
| **Program/Services** | `/programs` | Manager(CRUD), lainnya(R) | Master layanan Aqiqah/Qurban/Sedekah Daging. |
| **Lokasi** | `/locations` | Manager/Admin | Master lokasi + peta (Google Maps). |
| **Petugas** | `/petugas` | Admin/Manager | Kelola petugas & penugasan. |
| **Tugas Saya** | `/petugas/tugas` | Petugas Lapangan | Daftar tugas + aksi cepat (mobile). |
| **Dokumentasi** | `/documentation` | Supervisor/Pusat | Antrian validasi (approve/reject). |
| **Pembayaran** | `/payments` | Admin/Manager | Verifikasi & riwayat pembayaran. |
| **Laporan** | `/reports` | Manager/Admin | Generate/kirim/lihat laporan + status. |
| **Issues** | `/issues` | Admin/Manager/Petugas | Daftar & kelola kendala. |
| **Settings** | `/settings` | sesuai role | Profil, cabang, user, template, preferensi. |
| **Laporan Publik** | `/r/{token}` | Peserta (tanpa login) | Halaman laporan read-only + unduh PDF (**11**). |

## 3. Navigasi per Role

| Role | Menu terlihat |
|------|---------------|
| Direktur | Dashboard, Orders (R), Reports, Issues, Settings(view) |
| Manager Program | Dashboard, Orders, Programs, Locations, Petugas, Documentation, Payments, Reports, Issues, Settings |
| Admin Pusat | Dashboard, Documentation (validasi akhir, semua cabang), Reports, Issues(R), Settings(view) |
| Admin Cabang | Dashboard, Orders, Locations, Petugas, Documentation, Payments, Reports, Issues, Settings(branch) |
| Petugas Lapangan | Dashboard (Tugas), Tugas Saya, Upload Dokumentasi, Issues, Profil |
| Peserta | (hanya `/r/{token}`) |

## 4. Pola Halaman

- **List page:** Header + `FilterBar` + `DataTable`/cards + pagination (**14**).
- **Detail page:** Header (nomor + `StatusBadge`) + tab section + aksi kontekstual + `Timeline` riwayat.
- **Mobile petugas:** bottom-nav (Tugas · Upload · Profil), aksi 1-tap.

## 5. Guard & Redirect

- Route `(app)/*` butuh sesi valid → jika tidak, redirect `/login`.
- RBAC menyaring menu & aksi; akses tak berhak → 403 friendly.
- `/r/{token}`: validasi token server-side; token invalid → 404 generik (anti-enumerasi).

---

### Referensi silang
- Komponen/layout → **14_UI_UX_SPEC**
- Endpoint per halaman → **16_API_SPEC**
- Akses/role → **07_USER_ROLES**
- Struktur folder → **24_FOLDER_STRUCTURE**
