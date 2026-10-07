# 15 — PAGE MAP

> **Sukses Aqiqah** — _"Tunaikan Ibadah, Tebarkan Manfaat"_
> Route Next.js 16 App Router. Akses per role mengikuti **07_USER_ROLES**.

| Field   | Value                                                     |
| ------- | --------------------------------------------------------- |
| Dokumen | 15_PAGE_MAP                                               |
| Versi   | 2.0 — ditulis ulang mengikuti rute yang benar-benar ada    |
| Tanggal | 2026-09-22                                                |
| Status  | **Selaras dengan `app/` & `components/layout/nav-items.ts`** |

> **Kenapa ditulis ulang.** v1.0 (14 Juni) memetakan rute yang **tidak satu pun
> dibangun**: `/programs`, `/locations`, `/petugas`, `/documentation`,
> `/payments`, `/reports`, `/issues`, `/settings`. Seluruhnya berporos pada lima
> role dan hierarki cabang yang dihapus 20 Agustus. Yang benar-benar ada hanya
> delapan halaman terproteksi, dan sebagian pekerjaan yang dulu dibayangkan
> sebagai halaman sendiri kini jadi **panel di dalam detail order**.

---

## 1. Struktur route

```
app/
├─ (site)/                             ← publik, tanpa login
│  ├─ page.tsx                         → /                       Landing
│  ├─ checkout/page.tsx                → /checkout               Pesan aqiqah
│  └─ checkout/katering/page.tsx       → /checkout/katering      Pesan katering
├─ r/[token]/page.tsx                  → /r/{token}              Laporan publik
├─ (auth)/                             ← publik, tetapi bukan halaman isi
│  ├─ login/page.tsx                   → /login
│  ├─ lupa-sandi/page.tsx              → /lupa-sandi
│  └─ atur-sandi/page.tsx              → /atur-sandi
├─ (app)/                              ← terproteksi (sesi + RBAC)
│  ├─ dashboard/page.tsx               → /dashboard
│  ├─ orders/page.tsx                  → /orders
│  ├─ orders/new/page.tsx              → /orders/new
│  ├─ orders/[id]/page.tsx             → /orders/{id}
│  ├─ schedule/page.tsx                → /schedule
│  ├─ validation/page.tsx              → /validation
│  ├─ vendors/page.tsx                 → /vendors
│  ├─ vendors/[id]/page.tsx            → /vendors/{id}
│  ├─ vendors/katalog/[id]/page.tsx    → /vendors/katalog/{id}
│  ├─ users/page.tsx                   → /users
│  └─ profil/page.tsx                  → /profil
├─ auth/callback/route.ts              → pertukaran kode Supabase
└─ api/session/heartbeat/route.ts      → penanda aktivitas (logout idle)
```

**24 rute** pada build terakhir; halaman depan tetap **prerender statis** (`○ /`).

---

## 2. Halaman publik

| Halaman            | Route                | Fungsi                                                      |
| ------------------ | -------------------- | ----------------------------------------------------------- |
| **Landing**        | `/`                  | Hero, paket & harga (bertab), proses, galeri, FAQ, kontak    |
| **Checkout aqiqah**| `/checkout`          | 4 langkah; `?paket={slug}` memilih paket dari kartu landing  |
| **Checkout katering** | `/checkout/katering` | 3 langkah; boleh beberapa paket sekaligus                  |
| **Laporan publik** | `/r/{token}`         | Read-only + unduh PDF + tombol konfirmasi terima            |

> **Dua checkout, bukan satu yang bercabang.** Alasannya di `06 §2b`: pesanan
> aqiqah melahirkan baris `animals` beserta segala yang mengalir darinya,
> katering tidak punya satu pun dari itu.

Keduanya `force-dynamic`: katalog & harga berubah dari sisi admin, dan jendela
tanggal dihitung saat render — halaman ter-cache akan menawarkan jendela milik
kemarin.

### 2.1 Bagian Paket & Harga di landing

Tiga tab, **Pilihan** sebagai bawaan:

| Tab          | Isi                                                     |
| ------------ | ------------------------------------------------------- |
| **Pilihan**  | Aqiqah bertanda `is_popular` + seluruh katering + nasi box |
| **Aqiqah**   | Seluruh paket aqiqah + nasi box                          |
| **Katering** | Paket katering saja                                      |

Penyaringnya komponen klien, tetapi **kartunya dirakit di server** — `SitePhoto`
memeriksa berkas lewat `node:fs`. Yang dikirim ke klien adalah blok jadi, dan
itulah yang membuat halaman tetap prerender statis sekaligus memuat seluruh
kartu di HTML awal (mesin pencari membaca semuanya, bukan hanya tab terbuka).

Nasi box dirender sebagai **blok ringkas**, bukan kartu sejajar — lihat `06 §1.1`.

---

## 3. Halaman terproteksi

| Halaman             | Route                    | Akses           | Fungsi                                        |
| ------------------- | ------------------------ | --------------- | --------------------------------------------- |
| **Dashboard**       | `/dashboard`             | semua role      | KPI per mitra, order belum selesai, notifikasi |
| **Daftar pesanan**  | `/orders`                | semua role      | Tabel + filter; vendor hanya ordernya          |
| **Pesanan baru**    | `/orders/new`            | staf            | Form order internal                            |
| **Detail pesanan**  | `/orders/{id}`           | sesuai RLS      | Sembilan panel — lihat §3.1                    |
| **Jadwal**          | `/schedule`              | staf            | Kalender & penugasan mitra                     |
| **Validasi tahap**  | `/validation`            | staf            | Antrian laporan tahap + buktinya               |
| **Mitra**           | `/vendors`               | superadmin      | Master mitra + tab Katalog paket               |
| **Detail mitra**    | `/vendors/{id}`          | superadmin      | Data, wilayah layanan, modal per paket         |
| **Detail paket**    | `/vendors/katalog/{id}`  | superadmin      | Data paket, foto, kaitan ke order & mitra      |
| **Pengguna**        | `/users`                 | superadmin      | Akun & peran                                   |
| **Profil**          | `/profil`                | semua role      | Ganti email & sandi sendiri                    |

### 3.1 Detail order memuat sembilan panel, bukan sembilan halaman

Verifikasi, Pembayaran, Jadwal, Hewan, Tahap Pelaksanaan, Kendala, Laporan,
Sertifikat, Riwayat. Panel yang relevan pada status saat itu terbuka; sisanya
terlipat — "belum waktunya" bukan alasan menyembunyikan sama sekali, sebab admin
tetap perlu menengok ke belakang.

<!-- schema-history -->

Itu sebabnya `/payments`, `/documentation`, dan `/issues` pada v1.0 tidak pernah
lahir: pekerjaannya ada, tempatnya saja yang berbeda — di dalam order yang
sedang dikerjakan, bukan di daftar lintas-order yang menuntut pencarian ulang.

<!-- /schema-history -->

**Panel Hewan disembunyikan untuk order katering** — tidak ada hewan, jadi
panelnya akan kosong selamanya.

### 3.2 Dialog, bukan halaman tersendiri

Tambah, ubah, dan hapus dikerjakan lewat modal di layar daftar (22 September).
Sebelumnya formulir mekar di dalam halaman dan mendorong daftarnya keluar layar
— keluhan yang berulang di enam layar. Yang tetap punya halaman sendiri hanya
detail mitra & detail paket, sebab keduanya memuat hal yang tidak masuk dialog:
foto, kaitan ke order, dan tombol aktif/non-aktif yang butuh konteks.

---

## 4. Navigasi per role

Dari `components/layout/nav-items.ts` — `navItemsForRole()` menyaringnya.

| Role           | Menu terlihat                                                            |
| -------------- | ------------------------------------------------------------------------ |
| **superadmin** | Dashboard · Pesanan · Jadwal · Validasi · Mitra · Pengguna                |
| **admin**      | Dashboard · Pesanan · Jadwal · Validasi                                   |
| **vendor**     | Dashboard · Pesanan · Jadwal · Validasi (isinya tersaring RLS)            |
| Pemesan        | tanpa menu — hanya `/r/{token}`                                           |

> **Menu yang disaring adalah kenyamanan, bukan pengaman.** Halamannya memeriksa
> kapabilitas sendiri, dan RLS menolak datanya. Vendor yang mengetik `/vendors`
> langsung tetap ditolak — bukan karena menunya disembunyikan.

Di ponsel menu jadi bottom-nav (`mobile-nav.tsx`) dengan label pendek.

---

## 5. Guard & redirect

- `(app)/*` menuntut sesi valid; tanpa itu → `/login`.
- **Logout otomatis saat idle**: `lib/auth/idle.ts` + `proxy.ts`; detak
  aktivitas lewat `/api/session/heartbeat`.
- Akun non-aktif → `auth_role()` NULL → ditolak RLS di mana-mana.
- `/r/{token}`: token 32 hex divalidasi server-side; yang tidak dikenal
  mengembalikan 404 generik (anti-enumerasi), dan halamannya baru terbuka
  setelah laporan pertama dibuat.
- `?paket={slug}` yang tidak dikenal **diabaikan**, bukan digagalkan — form
  jatuh ke paket pertama.

---

### Referensi silang

- Modul & kepemilikan → **06_MODULE_BREAKDOWN**
- Role & kapabilitas → **07_USER_ROLES**
- Kontrak server action → **16_API_SPEC**
- Isi dashboard → **09_DASHBOARD_SPEC**
