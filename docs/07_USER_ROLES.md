# 07 — USER ROLES & RBAC

> **Sukses Aqiqah** — _"Tunaikan Ibadah, Tebarkan Manfaat"_
> Sumber kebenaran **RBAC** untuk **09_DASHBOARD_SPEC** & **20_SECURITY_CHECKLIST**.

| Field          | Value                                                                       |
| -------------- | --------------------------------------------------------------------------- |
| Dokumen        | 07_USER_ROLES                                                               |
| Versi          | 2.1 — perbaikan visibilitas mitra & pembukaan tulis lokasi                   |
| Tanggal        | 2026-09-21                                                                  |
| Status         | **Selaras dengan `server/auth/capabilities.ts`, `20260820000800_rls.sql`, `20260907020000`, `20260908010000`** |
| Catatan revisi | v2.1: tiga kebocoran akun mitra ditutup; `locations` bisa ditulis staf. v2.0: **5 role → 3 role** |

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
- **Mendaftarkan & menyunting lokasi** (sejak 7 September) — lokasi salur
  berganti hampir tiap order, dan yang tahu tempatnya adalah admin yang sedang
  menjadwalkan. Selama pintunya tertutup, yang terjadi bukan "admin meminta
  tolong superadmin" melainkan alamat ditulis di kolom catatan jadwal.
- **Validasi laporan tahap & bukti** dari vendor.
- Generate & kirim laporan.

Yang **tidak** bisa: mengubah harga, modal, katalog, role pengguna, **menghapus
lokasi**, atau menghapus laporan tahap.

### 2.3 vendor

Pelaksana lapangan — pihak luar, bukan pegawai.

- Melapor tahap pelaksanaan (`REPORT_STAGE`) pada order yang **ditugaskan padanya**.
- Unggah bukti per tahap.
- Laporkan kendala.

Yang **tidak** bisa:

- Melihat order yang belum ditugaskan padanya, atau milik mitra lain.
- Menyentuh urusan uang — `payments_select` menuntut `is_staff()`, jadi vendor
  bahkan tidak bisa **membaca** pembayaran. `enforce_vendor_assignment` juga
  menolak perubahan `total_amount`/`paid_amount`/`payment_status` dari vendor.
- Melihat modalnya sendiri (`vendor_services`) — itu angka margin, bukan haknya.
- Membaca **nama & telepon peserta** — `participants_select` menuntut
  `is_staff()`. Ordernya sendiri tetap terbaca (lihat §5.1).
- Membaca bukti lapangan **mitra lain** — kebijakan Storage mencocokkan
  `order_number` pada segmen ketiga path.
- Melihat lokasi milik mitra lain — yang terbuka hanya lokasi tanpa pemilik
  (masjid, panti, tempat salur umum) dan miliknya sendiri.
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

### 5.1 Tiga kebocoran & satu kebutaan pada akun mitra (8 September)

Ditemukan saat menelusuri apa yang **benar-benar** terbaca akun vendor, dan
dibuktikan lewat impersonasi (`set_config('request.jwt.claims', …)`) di dalam
transaksi yang di-rollback. Hasil sebelum perbaikan, untuk akun mitra pemilik
dua order:

| Yang dibaca      | Sebelum | Seharusnya                        |
| ---------------- | :-----: | --------------------------------- |
| `orders`         |    2    | 2 ✅                              |
| `v_open_orders`  |  **0**  | 2 — dashboardnya kosong permanen  |
| `locations`      |  **4**  | hanya miliknya + yang tak bermilik |
| `participants`   |    0    | 0 ✅ (memang tertutup)            |

1. **Dashboard mitra kosong permanen.** `v_open_orders` memakai `join
   participants` (inner). Karena `participants_select` menuntut `is_staff()` dan
   view-nya `security_invoker`, tabel itu kosong bagi mitra — dan inner join
   menghapus **setiap** baris. Diperbaiki jadi `left join`: barisnya tetap ada,
   kolom nama/telepon bernilai NULL bagi yang tidak berhak. Penyaringan PII tetap
   dikerjakan RLS pada `participants`, bukan oleh view.
2. **Bucket dokumentasi tidak ter-scope.** `storage_documentation_read` memberi
   SELECT atas **seluruh** bucket kepada siapa pun yang login. Pembatasan folder
   diserahkan ke `isDocPathForOrder` di server action — tetapi itu hanya menjaga
   jalur tulis, dan klien Supabase di browser bisa memanggil
   `storage.from('documentation').list()` langsung.
3. **Seluruh lokasi terbaca setiap mitra.** `locations_select` memakai
   `using (true)`, jadi tiap mitra membaca nama & alamat fasilitas pesaingnya.

> **Pelajaran yang berlaku umum:** RLS pada tabel **tidak** otomatis menjaga view
> yang membacanya. `security_invoker` menghormati RLS, tetapi bentuk **join**-nya
> tetap menentukan baris mana yang selamat — inner join ke tabel yang tertutup
> menghapus semuanya, dan itu terbaca seperti "tidak punya data", bukan seperti
> kesalahan.

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
