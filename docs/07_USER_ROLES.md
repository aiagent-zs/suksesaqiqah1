# 07 — USER ROLES & RBAC

> **Sukses Aqiqah** — _"Tunaikan Ibadah, Tebarkan Manfaat"_
> Sumber kebenaran **RBAC** untuk **09_DASHBOARD_SPEC** & **20_SECURITY_CHECKLIST**.

| Field          | Value                                                                       |
| -------------- | --------------------------------------------------------------------------- |
| Dokumen        | 07_USER_ROLES                                                               |
| Versi          | 2.0 — ditulis ulang mengikuti desain ulang skema 20 Agustus                  |
| Tanggal        | 2026-09-03                                                                  |
| Status         | **Selaras dengan `server/auth/capabilities.ts` & `20260820000800_rls.sql`**  |
| Catatan revisi | v2.0: **5 role → 3 role**. Cabang dihapus; yang banyak adalah mitra          |

> **Kenapa berubah.** v1.1 menggambarkan lima role yang berporos pada `branches`
> — tabel yang dihapus 20 Agustus. Tanpa cabang, `admin_pusat` dan
> `admin_cabang` kehilangan pembedanya, dan `petugas_lapangan` digantikan
> **vendor** yang pelaksananya memang pihak luar, bukan pegawai.

---

## 1. Daftar Role

| Role           | Enum (`user_role`) | Scope data                            | Otentikasi           |
| -------------- | ------------------ | ------------------------------------- | -------------------- |
| **superadmin** | `superadmin`       | Segalanya                             | Login                |
| **admin**      | `admin`            | Seluruh order operasional             | Login                |
| **vendor**     | `vendor`           | **Hanya order yang ditugaskan padanya** | Login                |
| Pemesan        | (anon, tanpa akun) | Order miliknya lewat token            | Tanpa login          |

> **Validasi dokumentasi satu tingkat** sejak 19 Agustus: vendor mengunggah
> (`pending`) → staf memutuskan (`approved`/`rejected`). Dua tingkat pada v1.1
> mengandaikan hierarki cabang yang sudah tidak ada.

---

## 2. Deskripsi & Tanggung Jawab

### 2.1 superadmin

Pemilik keputusan yang menyentuh **uang dan akses**.

- **Master mitra** — identitas, modal per paket, wilayah layanan, batas penawaran.
- **Katalog paket** — nama, harga jual, deskripsi, isi paket, dan konten halaman depan.
- **Pengelolaan pengguna** — membuat akun & menetapkan role.
- Menghapus laporan tahap (`DELETE_STAGE_REPORT`).
- Segala yang bisa dilakukan admin.

> **Kenapa harga berhenti di sini.** `services.price` adalah angka yang dibaca
> `create_guest_order`, dan RPC itu sengaja **mengabaikan harga kiriman klien** —
> itu pertahanan inti checkout publik. Modal (`vendor_services.vendor_price`)
> menentukan margin. Siapa pun yang bisa mengubah keduanya menentukan berapa
> yang ditagih dan berapa yang tampak untung.

### 2.2 admin

Penghubung antara pembeli dan mitra.

- **Verifikasi order tamu** — pintu pertama; order dari checkout publik tertahan
  di `new` sampai seseorang benar-benar memeriksanya.
- Catat & verifikasi pembayaran.
- **Penugasan mitra** (`ASSIGN_VENDOR`) — sekaligus membuka akses vendor ke order.
- Tetapkan jadwal & lokasi.
- **Validasi laporan tahap & bukti** dari vendor.
- Generate & kirim laporan.

Yang **tidak** bisa: mengubah harga, modal, katalog, role pengguna, atau
menghapus laporan tahap.

### 2.3 vendor

Pelaksana lapangan — pihak luar, bukan pegawai.

- Melapor tahap pelaksanaan (`REPORT_STAGE`) pada order yang **ditugaskan padanya**.
- Unggah bukti per tahap.
- Laporkan kendala.

Yang **tidak** bisa:

- Melihat order yang belum ditugaskan padanya, atau milik mitra lain.
- Menyentuh urusan uang — `payments_select` menuntut `is_staff()`, jadi vendor
  bahkan tidak bisa **membaca** pembayaran.
- Melihat modalnya sendiri (`vendor_services`) — itu angka margin, bukan haknya.
- **Memvalidasi laporannya sendiri** (lihat §4).

### 2.4 Pemesan (tanpa akun)

- Membuka halaman laporan publik lewat token unik.
- Mengunduh PDF laporan.
- **Mengonfirmasi penerimaan** (`confirm_delivery`) untuk order mode `kirim` —
  laporan "terkirim" dari vendor adalah pernyataan pengantar, bukan pengakuan
  penerima.

---

## 3. Matriks Kapabilitas

Diambil dari `server/auth/capabilities.ts`, yang merupakan **cerminan** RLS di
`20260820000800_rls.sql`. Kalau keduanya menyimpang, UI akan menawarkan aksi
yang pasti ditolak database — atau lebih buruk, menyembunyikan aksi yang
sebenarnya boleh.

| Kapabilitas                              | superadmin | admin | vendor |
| ---------------------------------------- | :--------: | :---: | :----: |
| `UPDATE_ORDER_STATUS`                    |     ✅     |  ✅   |   ✅   |
| `UPDATE_ORDER`                           |     ✅     |  ✅   |   —    |
| `UPDATE_ORDER_AMOUNT`                    |     ✅     |   —   |   —    |
| `VERIFY_GUEST_ORDER`                     |     ✅     |  ✅   |   —    |
| `MANAGE_ANIMALS`                         |     ✅     |  ✅   |   ✅   |
| `REPORT_STAGE`                           |     ✅     |  ✅   |   ✅   |
| `VALIDATE_STAGE_REPORT`                  |     ✅     |  ✅   |   —    |
| `ASSIGN_VENDOR`                          |     ✅     |  ✅   |   —    |
| `MANAGE_VENDORS`                         |     ✅     |   —   |   —    |
| `MANAGE_USERS`                           |     ✅     |   —   |   —    |
| `MANAGE_MASTER_DATA` (katalog)           |     ✅     |   —   |   —    |
| `DELETE_STAGE_REPORT`                    |     ✅     |   —   |   —    |
| `MANAGE_ISSUES`                          |     ✅     |  ✅   |   ✅   |
| `RECORD_PAYMENT` / `VERIFY_PAYMENT`      |     ✅     |  ✅   |   —    |
| `MANAGE_SCHEDULE`                        |     ✅     |  ✅   |   —    |
| `UPLOAD_DOCUMENTATION`                   |     ✅     |  ✅   |   ✅   |
| `VALIDATE_DOCUMENTATION`                 |     ✅     |  ✅   |   —    |
| `GENERATE_REPORT`                        |     ✅     |  ✅   |   —    |
| `MANAGE_NOTIFICATIONS`                   |     ✅     |  ✅   |   —    |
| `VIEW_FULL_AUDIT`                        |     ✅     |  ✅   |   —    |

Ada unit test yang menuntut **superadmin memegang setiap kapabilitas** — daftar
di atas tidak boleh punya baris yang kosong di kolomnya.

---

## 4. Pemisahan tugas

Prinsip yang paling banyak ditegakkan di skema ini: **yang mengerjakan tidak
menyatakan pekerjaannya benar.**

| Dipisah                                             | Ditegakkan oleh                     |
| --------------------------------------------------- | ----------------------------------- |
| `REPORT_STAGE` ≠ `VALIDATE_STAGE_REPORT`            | `enforce_stage_review` (trigger)    |
| Pengunggah bukti ≠ yang memvalidasinya              | `enforce_documentation_review`      |
| Vendor tidak bisa menugaskan dirinya sendiri        | `enforce_vendor_assignment`         |

Ketiganya trigger, **bukan** pemeriksaan aplikasi — dan itu disengaja: trigger
menolak sekalipun seorang admin memvalidasi laporan yang ia buat sendiri, lewat
jalur mana pun.

---

## 5. Batas yang dijaga database, bukan UI

- Vendor melihat order lewat `can_read_order()` yang membandingkan
  `orders.vendor_id` dengan `profiles.vendor_id`. **Penugasan adalah pintu masuk data.**
- Akun baru lahir sebagai `vendor` **non-aktif** — `auth_role()` mengembalikan
  NULL selama `is_active` masih false.
- **Superadmin terakhir tidak bisa diturunkan.** Sistem tanpa superadmin tidak
  punya siapa pun yang bisa mengangkat superadmin baru.
- Menu disaring per role (`navItemsForRole`) — itu **kenyamanan, bukan
  pengaman**; halamannya memeriksa kapabilitas sendiri dan RLS menolak datanya.

> ⚠️ **Satu jalur tanpa jaring pengaman kedua.** Pengelolaan pengguna memakai
> service role yang melewati RLS sepenuhnya, jadi server action-nya memeriksa
> rolenya sendiri lebih dulu. Tidak ada penjaga di database untuk jalur ini.

---

## 6. Menguji RLS — cara yang benar

Membaca tabel terlarang lewat PostgREST sebagai `anon` mengembalikan **array
kosong, bukan error**: RLS **menyaring baris**, ia tidak menolak permintaan. Hal
yang sama berlaku untuk UPDATE dan DELETE — keduanya membalas `200`/`204` tanpa
menyentuh baris apa pun.

Yang benar diperiksa: **jumlah baris = 0**, atau **nilainya tidak bergeser**.
Tes yang menganggap "tidak ada error = bocor" akan melaporkan kebocoran palsu.

`INSERT` berbeda — `with check` menolaknya dengan galat sungguhan (`42501`).

---

### Referensi silang

- Skema & kebijakan → `05_DATABASE_DESIGN.md`
- Modul & kepemilikan → `06_MODULE_BREAKDOWN.md`
- Checklist keamanan → `20_SECURITY_CHECKLIST.md`
