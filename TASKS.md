# TASKS — Status Pengerjaan Sukses Aqiqah

> Peta apa yang **sudah jadi**, apa yang **belum**, dan apa yang **harus dikejar berikutnya**.
> Urutan tahap mengikuti `TEAM_PLAN.md §3`; definisi modul mengikuti `docs/06_MODULE_BREAKDOWN.md`.
> Urutan otoritas kebenaran: **migrations → kode (`features/`, `app/`, `server/`) → `prd.md` → `docs/`**.

| Field | Value |
|-------|-------|
| Dokumen | `TASKS.md` |
| Diperbarui | 2026-08-21 |
| Fase aktif | **Phase 1 — Operational MVP** (`docs/23_MVP_ROADMAP.md`) |
| Estimasi Phase 1 | **± 80%** (turun dari 85% — lihat *Kenapa estimasi turun* di bawah) |
| Terverifikasi pada pembaruan ini | `npm run typecheck` ✅ · `npm run lint` ✅ (1 warning lama) · `npm run build` ✅ · **339 test hijau (25 file)** · **37 migration jalan bersih di lokal ✅ dan seluruhnya sudah ter-push ke cloud ✅** |

**Aturan pemeliharaan:** centang item hanya kalau kodenya ada **dan** `npm run typecheck` + `npm run build` hijau (Definition of Stable, `TEAM_PLAN §1.5`). Item yang belum diverifikasi dengan data sungguhan ditandai ⚠️, bukan dicentang.

---

## Perubahan sejak pembaruan 2026-08-19

Desain ulang skema — **perubahan terbesar sejak project dimulai**, dan satu-satunya
yang pernah menghapus tabel yang sudah dipakai. Lima commit di branch
`feat/schema-vendor-stages`, 14 migration baru, ~8.100 baris ditambah.

Tiga hal yang diminta operasi ternyata **tidak ada sama sekali** di skema lama,
dan itu terbukti dari penelusuran, bukan dugaan:

1. **Tidak ada tabel mitra.** Vendor cuma baris `profiles` berrole `vendor` —
   tanpa nama usaha, kontak, alamat, apalagi daftar harga. Jejak paling telak:
   seed lama menyimpan "RPH Mitra Bandung" sebagai baris `locations` — mitra
   yang menyamar jadi lokasi.
2. **Tidak ada tahap memasak.** Kata `masak` hanya muncul di teks pemasaran dan
   sebagai komponen harga pada `services.meta`.
3. **`distribution_mode` tidak menyetir apa pun.** Divalidasi di checkout hanya
   untuk menentukan wajib-tidaknya alamat, lalu diabaikan. Kedua mode melewati
   rantai yang identik, tidak ada konfirmasi terkirim, dan alamat pembeli tidak
   pernah terlihat oleh vendor yang mengantar.

Ringkas perubahannya:

- **`vendors` + `vendor_services` + `vendor_coverage`.** Modal per mitra, bukan
  satu kolom mati di `services`. Harga jual tetap satu di `services.price`;
  `vendor_price` & `margin_amount` yang dulu kolom mati dibuang dari sana.
- **`order_stage_events` menggantikan `slaughter_records` + `distributions`.**
  Daftar tahap terbit otomatis saat mitra ditugaskan — vendor mengisi tahap yang
  menunggu, bukan mengarang tahap.
- **Tahapan bercabang** lewat `fulfilment_sequence()` sebagai satu sumber:
  ```
  salur : persiapan → sembelih → masak → salur
  kirim : persiapan → sembelih → masak → kirim → terkirim
  ```
- **`branches` dibuang seluruhnya.** Klaim di revisi TASKS.md sebelumnya —
  bahwa nomor order memakai kode cabang — ternyata **keliru**; penomoran tidak
  pernah menyentuhnya. Path Storage kini `{YYYY}/{MM}/{order_number}/{stage}/…`
- **Akses vendor pindah** dari `schedules.pic_user_id` ke `orders.vendor_id`,
  jadi penugasan berdiri sendiri dan jadwal kembali jadi jadwal.
- **`/users` & `/vendors`** — menutup celah yang sudah lama tercatat: akun
  sebelumnya hanya bisa dibuat manual lewat dashboard Supabase, dan tautan
  "Pengaturan" di sidebar serta panel mobile masih `href="#"`.
- **`confirm_delivery()`** — pembeli mengonfirmasi penerimaan sendiri lewat
  halaman bertoken. Laporan "terkirim" dari vendor adalah pernyataan pengantar,
  bukan pengakuan penerima.

### Kenapa estimasi Phase 1 **turun** dari 85% ke 80%

Bukan karena ada yang rusak — melainkan karena penyebutnya bertambah. Desain
ulang ini memunculkan pekerjaan yang sebelumnya tidak pernah masuk hitungan
(master mitra, modal per mitra, tahap masak, konfirmasi penerimaan), sementara
**empat butir Definition of Done Phase 1 tetap tidak tersentuh** (§12). Angka
85% dihitung terhadap ruang lingkup yang ternyata tidak memuat tiga kebutuhan
operasi di atas.

Yang juga berubah: verifikasi cloud yang sudah terkumpul di revisi-revisi
sebelumnya **hangus seluruhnya**. Skemanya bukan lagi skema yang diuji waktu itu.

### Perbaikan 21 Agustus

- **Blok `progress` hilang dari `get_public_report`** — desain ulang menyusun
  ulang payload RPC dan menambahkan `stages`, tapi key `progress` ikut hilang;
  pembacanya di `public-report.ts` tetap mengambilnya lewat `p.progress?.x ?? 0`.
  Akibatnya tiga kartu "Status Pelaksanaan" di `/r/{token}` dan blok progres di
  PDF **mencetak `0/0`** — tanpa satu pun galat. Ditutup
  `20260821010000_public_report_progress.sql`.
- **`branch_name` masih hidup sebagai nama field.** RPC sudah mengirim
  `vendor_name`, tapi pembacanya masih mendeklarasikan `branch_name`, jadi nama
  mitra **tidak pernah sampai** ke halaman publik maupun PDF. `ReportData.branchName`
  diganti `vendorName` di seluruh rantai.
- **Penyebut progres tahap dipastikan `stages_total`** di kedua jalur (halaman
  publik & laporan internal). `v_order_progress` punya dua angka yang mudah
  tertukar: `stages_total` menghitung **baris** tahap, `stages_in_sequence`
  menghitung **tahap dalam rangkaian mode**. Keduanya sengaja berbeda — tahap
  `sembelih` terbit satu baris per ekor, jadi order 3 ekor bermode `kirim` punya
  7 baris untuk 5 tahap. Mencampurnya dengan `stages_validated` (yang menghitung
  baris) akan mencetak "7/5 tahap".
- **Tes baru `public-report-payload.test.ts`** (18 assertion) membaca migration
  langsung dan menuntut setiap key yang dibaca `RpcPayload` benar-benar ada di
  `jsonb_build_object`. Ini bug yang **mustahil** ditangkap typecheck: RPC-nya
  `Returns: Json` di `types/database.ts`, jadi `as unknown as RpcPayload`
  melewati pemeriksaan apa pun.

> **Kenapa dua bug ini bertahan.** Keduanya sejenis: kembaran SQL↔TypeScript yang
> menyimpang diam-diam, dengan `?? 0` dan `?? null` yang menelan bukti hilangnya.
> Pola yang sama sudah diantisipasi untuk urutan tahap (`stage-sequence.test.ts`
> membaca migration langsung), tapi tidak untuk payload RPC.

---

## 0. Litmus test — tolok ukur tunggal

> *"Berapa order yang belum selesai, di lokasi mana, siapa mitranya, apa kendalanya?"* — harus terjawab **< 10 detik**.

- [x] Terjawab di `/dashboard` lewat `v_open_orders` — nomor order, mitra, lokasi, tahap berjalan, status, kendala, umur, terurut keparahan lalu umur.
- [x] Seed baru jalan di Postgres lokal (3 order menempuh keadaan berbeda: satu `in_progress` mode kirim, satu `assigned` mode salur, satu order tamu `new` yang belum diverifikasi).
- [ ] ⚠️ Belum diulang di **cloud** — verifikasi cloud yang lama hangus bersama skema lama.
- [ ] Terverifikasi dengan data operasional asli.

> Pertanyaannya sendiri ikut berubah: **"siapa PIC-nya"** jadi **"siapa mitranya"**. Dengan satu tempat operasi dan banyak mitra, itulah yang sungguh ingin diketahui.

---

## 1. Tahap 0–3 · Fondasi — **SELESAI** *(dibangun ulang 20 Agustus)*

### Tahap 0 · Fondasi bersama
- [x] Init Next.js 16 + React 19 + Tailwind 4 + TypeScript
- [x] Struktur folder sesuai `docs/24_FOLDER_STRUCTURE.md`
- [x] Tooling: ESLint, Prettier, Vitest, `npm run typecheck`
- [x] `.env.example` lengkap (termasuk `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` & `SUPABASE_DB_URL`)

### Tahap 1 · Database — *Bani*

**37 migration**, 14 di antaranya lahir 20–21 Agustus. 21 tabel, 4 view, 26 fungsi.

- [x] **`20260820000000_reset_keep_regions.sql`** membuang seluruh tabel
  operasional, fungsi, dan enum lama, lalu membangun ulang dari nol. `regions`
  (91.599 baris, ±3 MB) **sengaja tidak disentuh** — isinya tidak berubah oleh
  desain ulang ini, dan membangunnya ulang berarti push 3 MB lagi tanpa manfaat
- [x] **Migration destruktif, bukan squash riwayat.** `supabase db push` bersifat
  append-only; squash menuntut `migration repair --status reverted` pada belasan
  versi di tabel pembukuan **produksi**, tanpa staging untuk melatihnya. Menambah
  berkas adalah jalur yang memang dirancang alatnya. Konsekuensi yang diterima:
  23 berkas lama tetap ada sebagai riwayat
- [x] `auth.users` sengaja tidak disentuh — akun superadmin hidup di sana
- [x] 21 tabel: `vendors`, `vendor_services`, `vendor_coverage`, `services`,
  `locations`, `profiles`, `participants`, `app_settings`, `stage_requirements`,
  `order_counters`, `orders`, `order_items`, `animals`, `payments`, `schedules`,
  `order_stage_events`, `documentations`, `reports`, `notifications`, `issues`,
  `audit_logs`
- [x] 4 view (semua `security_invoker = on`): `v_order_stages`, `v_order_progress`,
  `v_vendor_kpi`, `v_open_orders`. **`v_branch_kpi` → `v_vendor_kpi`** bukan
  sekadar ganti nama: dengan satu tempat operasi, pertanyaan yang berguna adalah
  "mitra mana yang lambat, mana yang paling sering buktinya ditolak"
- [x] `fulfilment_sequence()` sebagai **satu sumber percabangan tahap** —
  dipakai trigger penerbit tahap, penegak urutan, dan gerbang kelengkapan bukti
- [x] `booking_max_days()` di `app_settings` — satu angka yang dibaca RPC **dan**
  klien, menutup selisih 30-vs-7 hari
- [x] Storage buckets + GRANT eksplisit untuk `anon` / `authenticated`
- [x] Seed `01_master.sql` (**dua mitra dengan kemampuan sengaja berbeda** — RPH
  Amanah tidak melayani "kirim", jadi penyaringan mode benar-benar teruji saat
  dipakai, bukan hanya ada di kode) & `02_demo.sql` (satu akun per role + tiga
  order yang menempuh keadaan berbeda)
- [x] **Terverifikasi di Postgres lokal:** 14 migration jalan bersih, regions
  utuh 91.599 baris, tahap terbit otomatis, lompat tahap ditolak, bukti salah
  tahap ditolak, konfirmasi penerimaan ditolak untuk order salur. RLS diuji per
  role di dalam transaksi: vendor melihat 1 dari 3 order, 0 pembayaran, hanya
  mitranya sendiri, hanya profilnya sendiri
- [x] **`20260821010000_public_report_progress.sql` terverifikasi di Postgres
  lokal** — seluruh 37 migration jalan bersih, dan payload RPC-nya diuji lewat
  jalur `anon` yang sesungguhnya (lihat §4)
- [x] **Seluruh 37 migration sudah ter-push ke cloud** (21 Agustus). Diverifikasi
  `supabase db push --dry-run` → *"Remote database is up to date"*, dan inspeksi
  tabel remote menunjukkan skema barunya memang hidup: `vendors` 2 baris,
  `vendor_services` 9, `stage_requirements` 6, `regions` utuh 91.599 —
  sementara `branches`, `slaughter_records`, dan `distributions` sudah tidak ada
- [ ] ⚠️ Cloud belum berisi data yang cukup untuk menguji alur penuh: `animals`,
  `order_stage_events`, `order_items`, dan `documentations` semuanya 0 baris.
  Jadi angka progres di sana **benar bernilai nol**, dan itu bukan gejala bug

> **Catatan lingkungan.** `supabase db reset` di mesin ini kadang gagal di akhir
> dengan "storage container is not ready" — kontainer Storage kalah cepat dari
> batas tunggu CLI. Migration dan seed sudah selesai sebelum itu, jadi datanya
> tetap benar.

### Tahap 2 · Auth — *Bani*
- [x] Login email+password, `auth/callback`, `logout`
- [x] `getSession` / `requireAuth` / `requireRole` di `server/auth/session.ts`
- [x] Proxy/middleware redirect route terproteksi
- [x] Guard environment (`lib/supabase/env.ts`) — kredensial kosong gagal dengan pesan yang menyebut variabelnya
- [x] **Keluar otomatis saat menganggur** (ambang 30 menit, `lib/auth/idle.ts`). Ditegakkan di **middleware** lewat cookie `httpOnly` — berlaku sekalipun JavaScript mati — sementara `IdleLogout` di klien hanya membuat waktunya tepat, karena tab yang menganggur tidak mengirim permintaan apa pun
- [x] **`handle_new_user` tidak lagi membaca role dari user metadata.** Celah
  yang tercatat sebagai "wajib ditutup sebelum produksi" di revisi sebelumnya
  kini **tertutup**: selama pendaftaran mandiri terbuka di Supabase, metadata
  role berarti siapa pun bisa mendaftar sebagai admin. Role ditetapkan lewat
  UPDATE terpisah oleh superadmin

### Tahap 3 · RBAC / RLS — *Bani*

Tiga role tetap: **superadmin · admin · vendor**.

| Role | Wewenang |
|------|----------|
| **superadmin** | Segalanya: master mitra & harga, pengelolaan user, penghapusan laporan tahap |
| **admin** | Penghubung pembeli & vendor: verifikasi order tamu, catat & verifikasi pembayaran, **penugasan mitra**, validasi laporan tahap & bukti, laporan |
| **vendor** | Pelaksana: melapor tahap, unggah bukti, lapor kendala — **hanya pada order yang ditugaskan padanya** |

- [x] RLS aktif di seluruh tabel + kebijakan per role, ditulis ulang penuh di `20260820000800_rls.sql`
- [x] Matriks kapabilitas action-level (`server/auth/capabilities.ts`) + unit test — termasuk tes yang menuntut **superadmin memegang setiap kapabilitas**
- [x] Kapabilitas baru: `REPORT_STAGE`, `VALIDATE_STAGE_REPORT`, `ASSIGN_VENDOR`, `MANAGE_VENDORS`, `MANAGE_USERS`, `DELETE_STAGE_REPORT`
- [x] **Pintu masuk data vendor pindah ke `ASSIGN_VENDOR`.** `can_read_order`
  kini membandingkan `orders.vendor_id` dengan `profiles.vendor_id`; trigger
  `enforce_vendor_assignment` menolak vendor yang mencoba memindahkan penugasan
  ke dirinya sendiri
- [x] **Pemisahan tugas pada tahap** — `REPORT_STAGE` (semua role) dipisah dari
  `VALIDATE_STAGE_REPORT` (staf), dan trigger `enforce_stage_review` masih
  menolak sekalipun seorang admin memvalidasi laporan yang ia buat sendiri
- [x] `is_staff()` / `is_superadmin()` / `auth_vendor_id()`
- [x] Vendor sama sekali di luar urusan uang (`payments_select` menuntut `is_staff()`)
- [x] Vendor hanya melihat profilnya sendiri dan mitranya sendiri
- [x] Akun baru lahir sebagai `vendor` **non-aktif** — `auth_role()` mengembalikan NULL selama `is_active` masih false
- [x] **Pengelolaan user berhenti di superadmin.** Jalurnya memakai service role
  yang melewati RLS sepenuhnya, jadi server action-nya memeriksa rolenya sendiri
  lebih dulu — **tidak ada jaring pengaman kedua di database untuk jalur ini**
- [x] Akun auth **dihapus kembali** bila penetapan profil gagal, supaya tidak meninggalkan akun yang bisa login tapi tidak punya peran
- [x] Superadmin terakhir tidak bisa diturunkan — sistem tanpa superadmin tidak punya siapa pun yang bisa mengangkat superadmin baru
- [x] Menu disaring per role (`navItemsForRole`) — kenyamanan, bukan pengaman
- [ ] ⚠️ Uji positif & negatif per role belum diulang **di cloud**; hasil lokal sudah ada (lihat Tahap 1)

---

## 2. Tahap 4 · Order Management — **± 95%** — *Bani*

### Sudah jadi
- [x] CRUD order + nomor unik `IA-YYYYMM-####` (atomik lewat `order_counters`)
- [x] **State machine ditulis ulang** untuk rangkaian administratif baru:
  `new → verified → paid → assigned → in_progress → validation → reporting → completed`.
  **Tahapan lapangan tidak lagi jadi status** — ia bercabang, dan status tidak
  bisa bercabang
- [x] 1 order banyak hewan: registrasi, ubah status, hapus + unit test
- [x] Filter, pencarian lintas tabel, paginasi berbasis URL
- [x] Halaman detail order + timeline audit
- [x] Audit trail otomatis lewat trigger

#### Payment
- [x] Catat pembayaran, unggah bukti langsung browser → Storage, validasi MIME & ukuran tiga lapis
- [x] Path bukti diverifikasi ulang terhadap **nomor order** (`isProofPathForOrder`) — sebelumnya terhadap cabang + nomor order. Pemeriksaannya justru **menguat**: bersandar pada nomor order yang unik global dan beku, bukan kode cabang yang tidak pernah unik. Ada tesnya untuk penolakan awalan nomor order yang mirip
- [x] Verifikasi / tolak dengan alasan wajib; penguncian optimistik; tolak kelebihan bayar
- [x] Hapus catatan yang masih `pending`; riwayat + signed URL (TTL 10 menit)
- [x] Indikator gate DP di panel pembayaran
- [ ] Integrasi payment gateway → Tahap 10

#### Scheduling & Assignment
- [x] **Dua aksi dipisah**: jadwal (kapan/di mana) dan **penugasan mitra** (yang
  membuka akses vendor ke order dan menerbitkan daftar tahapnya). Sebelumnya
  keduanya menyatu di `schedules.pic_user_id`
- [x] Lokasi divalidasi **milik mitra order ini** — lokasi kini milik mitra, jadi pemeriksaan itu akhirnya punya arti
- [x] `assignVendor()` berdiri sendiri sebagai aksi
- [x] Halaman `/schedule`: filter lokasi / status / rentang tanggal, tabel desktop + kartu mobile, paginasi URL
- [x] Tautan Google Maps dari koordinat lokasi

#### Stage Events — menggantikan Slaughter & Distribution
- [x] **Satu panel tahap** menggantikan panel sembelih + distribusi. Vendor mengisi daftar yang sudah menunggu; tombol tahap berikutnya **mati sampai tahap sebelumnya divalidasi**, mencerminkan trigger di database
- [x] Daftar tahap **terbit otomatis** saat mitra ditugaskan (`generate_stage_checklist`) — vendor tidak bisa mengarang tahap
- [x] Urutan ditegakkan trigger `enforce_stage_order` — lompat tahap ditolak di database, bukan hanya di UI
- [x] **Pada tahap kirim, alamat pembeli DITAMPILKAN ke vendor**, tidak diketik ulang. Sebelumnya alamat terstruktur itu tersimpan tapi tak pernah dibaca siapa pun sesudah checkout
- [x] `features/stages/sequence.ts` — kembaran `fulfilment_sequence()` di SQL, dengan tes yang **membaca berkas migration langsung** dan menuntut keduanya identik
- [x] Hapus laporan tahap dibatasi superadmin (`DELETE_STAGE_REPORT`)

#### Issues
- [x] Panel Kendala di halaman detail order; laporkan, ubah status dua arah, koreksi isi terpisah dari perubahan status
- [x] `resolved_by` / `resolved_at` diturunkan dari status tujuan, tidak pernah dikirim klien
- [x] Penguncian optimistik; tanpa tombol hapus
- [x] `MANAGE_ISSUES` disamakan persis dengan `can_write_order`

### Harus dikejar
- [ ] Status hewan masih bisa diubah langsung lewat panel Hewan tanpa laporan tahap. Perlu diputuskan: kunci status hewan agar hanya bergerak lewat laporan tahap, atau biarkan sebagai jalur koreksi
- [ ] ⚠️ Seluruh butir di atas belum diverifikasi di cloud

---

## 3. Tahap 5 · Documentation Flow — **± 88%** — *Bani*

- [x] Tabel `documentations` + enum + RLS
- [x] Unggah foto/video/catatan tertaut ke order + **tahap** + hewan (opsional)
- [x] Path Storage kehilangan segmen cabang: `{YYYY}/{MM}/{order_number}/{stage}/…`
- [x] Validasi satu tingkat: vendor unggah (`pending`) → admin/superadmin memutuskan (`approved`/`rejected`), tolak wajib beralasan
- [x] **Pemisahan tugas** — pengupload tidak dapat memvalidasi unggahannya sendiri, ditegakkan `checkReview` **dan** trigger
- [x] `enforce_documentation_stage_match` — bukti yang dilampirkan ke tahap yang salah ditolak di database
- [x] **Gerbang kelengkapan bukti dibaca dari `v_order_progress.missing_doc_stages`**, tidak lagi dihitung ulang di TypeScript. Dengan tahapan yang bercabang, aturan yang disalin ke kode akan jadi empat tempat yang harus sinkron. Sumbernya `stage_requirements`, jadi menambah tahap baru tidak menyentuh satu baris TypeScript pun
- [x] Halaman `/validation` — satu antrian, filter tahap, urut tertua dulu, paginasi
- [x] Pratinjau media memakai `<img>`/`<video>` biasa, bukan `next/image`
- [x] Dokumentasi `approved` tidak dapat dihapus
- [ ] Antrian validasi belum tampil di dashboard (`docs/09 §4`) — saat ini hanya di `/validation`
- [ ] Notifikasi ke admin saat ada unggahan baru & ke vendor saat ditolak — bergantung Tahap 8
- [ ] Kompresi gambar di klien & antrian upload offline — bergantung PWA
- [ ] Pelucutan EXIF/GPS sebelum unggah (`docs/17 §4`, `docs/20`)
- [ ] ⚠️ Belum diverifikasi di cloud

---

## 4. Tahap 6 · Reporting Engine — **± 80%** — *Awalin*

- [x] Generate PDF per order (React PDF)
- [x] **Laporan bercerita per tahap**, bukan sekadar "distribusi sekian paket" — halaman publik & PDF sama-sama menyusunnya dari `order_stage_events` yang sudah tervalidasi
- [x] Halaman publik bertoken `app/r/[token]` tanpa login, `noindex`, `/r/` masuk `robots.txt`
- [x] Unduh PDF lewat signed URL (TTL 10 menit)
- [x] Versi laporan tercatat; generate ulang menambah versi **tanpa** mengubah `public_token`
- [x] Hanya dokumentasi `approved` yang masuk laporan; kontak peserta tidak pernah ikut
- [x] Gate kelengkapan diperiksa ulang saat generate
- [x] Kirim tautan via WA.me + salin tautan + tandai terkirim
- [x] Foto WebP dilewati; maksimal 6 foto disematkan
- [x] **`confirm_delivery()`** — pembeli mengonfirmasi penerimaan sendiri lewat halaman bertoken. Idempoten; menolak order non-`kirim`
- [x] **Blok `progress` dikembalikan ke payload RPC (21 Agustus)** — sebelumnya tiga kartu status di halaman publik dan blok progres di PDF mencetak `0/0` tanpa galat
- [x] **`vendorName` menggantikan `branchName`** di seluruh rantai laporan — nama mitra sebelumnya tidak pernah sampai ke halaman publik maupun PDF
- [x] Tes `public-report-payload.test.ts` mengunci bentuk payload RPC terhadap pembacanya
- [x] **Terverifikasi di Postgres lokal (21 Agustus)** — 37 migration jalan bersih.
  Dipanggil sebagai peran `anon` dengan token yang datang dari URL (bukan dengan
  membaca tabel `orders`, seperti halaman sungguhan): payload mengembalikan
  `2/5 tahap` dan nama mitra terisi, sementara `participant_phone` &
  `delivery_address` **tidak ada** di payload. Pada percobaan yang sama, `anon`
  tetap **ditolak** membaca tabel `orders` langsung — jadi RPC benar-benar
  satu-satunya pintu, bukan sekadar lolos karena hak berlebih
- [x] **Penyebut multi-ekor terbukti benar.** Order 3 ekor bermode `salur`
  menghasilkan `stages_in_sequence = 4` tapi `stages_total = 6` (tahap `sembelih`
  terbit satu baris per ekor). Memakai `stages_in_sequence` sebagai penyebut akan
  mencetak "6/4 tahap" — pembilang melebihi penyebut
- [x] **Terverifikasi di cloud (21 Agustus)** — `anon` memanggil `get_public_report`
  dengan token sah: blok `progress` **ada** dan `vendor_name` terisi
  ("Dapur Berkah Bandung"), tanpa `participant_phone` maupun `delivery_address`.
  Token ngawur mengembalikan `null`. Angka progresnya nol di cloud karena
  ordernya memang belum punya hewan & tahap terbit, bukan karena bug —
  jalur lokal yang datanya lengkap mengembalikan `2/5 tahap`
- [ ] Kirim via Email (baru WA.me) — bergantung Tahap 8
- [ ] QR code ke halaman publik pada PDF (`docs/11 §3`)
- [ ] Rate limiting percobaan token (`docs/11 §6`)

> **Catatan cara menguji RLS dari klien.** Membaca tabel terlarang lewat
> PostgREST sebagai `anon` mengembalikan **array kosong, bukan error** — RLS
> menyaring baris, ia tidak menolak permintaan. Menguji dengan `psql` memberi
> `permission denied` karena yang diuji di sana hak tabel, bukan RLS. Keduanya
> lapisan berbeda, dan tes yang menganggap "tidak ada error = bocor" akan
> melaporkan kebocoran palsu. Yang benar diperiksa: **jumlah baris = 0**.

> **Kenapa butuh RPC, bukan service role.** Pengunjung anonim tidak punya akses apa pun: seluruh RLS ditujukan `to authenticated`. `get_public_report(token)` bersifat `SECURITY DEFINER` dan mengunci bentuk keluarannya **di level database** — satu order saja, dokumentasi `approved` saja, tahap `validated` saja, tanpa kontak peserta. Service role tetap dipakai, tapi **hanya untuk menandatangani berkas** yang path-nya sudah dikembalikan RPC.

---

## 5. Tahap 7 · Dashboard & Monitoring — **± 85%** — *Awalin*

### Sudah jadi
- [x] **KPI cabang → KPI mitra.** Yang diukur kini **margin** (tagihan dikurangi
  modal), **rata-rata siklus per order**, dan **berapa order yang buktinya pernah
  ditolak** — pertanyaan yang berguna ketika operasi satu tempat dan yang banyak
  mitranya. Inilah yang membuat `vendor_services` punya arti: modal berbeda antar
  mitra, jadi margin tidak bisa dihitung dari satu kolom di `services`
- [x] Kartu operasional: Order Tertunda, Kendala Terbuka, Belum Lunas, Order Ditahan, Order Tamu Baru
- [x] Agregat lintas mitra **ditimbang jumlah order**, bukan rata-rata polos
- [x] Panel kendala per tingkat keparahan + 5 sorotan teratas
- [x] Tabel litmus test + versi kartu mobile + paginasi
- [x] Filter tahap / keparahan / hanya-berkendala (form GET, state di URL)
- [x] Drill-down KPI card & baris tabel → `/orders`
- [x] Unit test agregasi (termasuk pembobotan siklus) + filter schema

### Harus dikejar
- [ ] **Filter periode** — `v_vendor_kpi` agregat tanpa dimensi tanggal, jadi butuh perubahan view
- [ ] **Supabase Realtime** — update live saat tahap/dokumentasi berubah (`docs/09 §8`)
- [ ] Dashboard Lokasi + peta Google Maps (`docs/09 §5`)
- [ ] Tombol aksi cepat di dashboard vendor: lapor tahap, upload dokumentasi
- [ ] Ukur beneran target performa: initial paint < 3 dtk

---

## 6. Tahap 8 · Automation & Notification — **± 5%** — *Bani*

- [x] Tabel `notifications` + enum channel/status
- [ ] Outbox notifikasi + worker pengirim
- [ ] Alert in-app di dashboard (`docs/12`)
- [ ] Workflow n8n: reminder H-1, generate & kirim laporan (`docs/18`)
- [ ] **Notifikasi konfirmasi terkirim** — `confirm_delivery()` sudah ada, tapi tidak ada yang memberi tahu pemesan bahwa ia perlu menekannya
- [ ] Folder `automation/` masih kosong (`.gitkeep`)

---

## 7. Tahap 9 · AI Layer — **0%** — Phase 2

- [ ] AI Executive Summary (`docs/19`) · AI Risk Detector · AI Report Writer
- [ ] Fallback aman saat AI gagal / kuota habis

> `@anthropic-ai/sdk` sudah terpasang, `ANTHROPIC_API_KEY` masih kosong. Jangan mulai sebelum Phase 1 stabil (`docs/23 §3`).

---

## 8. Tahap 10 · Public Platform — **± 55%** — *Awalin + Bani*

### Sudah jadi
- [x] Landing page, SEO dasar (`sitemap.xml`, `robots.txt`, metadata)
- [x] Katalog `services` di DB + grant baca untuk `anon`

#### Guest Checkout
- [x] RPC `create_guest_order(jsonb)` **`SECURITY DEFINER`**, di-grant ke `anon`
- [x] **Harga, total, status, dan jumlah terbayar tidak pernah datang dari klien** — RPC membacanya dari `services`
- [x] Form 4 tahap: pesanan → jadwal & penyaluran → data pemesan → ringkasan
- [x] Aturan lintas-medan ditegakkan **dua kali** — `superRefine` (agar galat menempel pada medan yang tepat) dan di dalam RPC (agar tidak bisa dilewati)
- [x] Hanya kode penolakan yang layak dibaca pengunjung yang diteruskan ke layar
- [x] Halaman `force-dynamic`; `?paket=` dicocokkan sebagai **slug**, bukan id
- [x] Order tamu ditandai `created_by IS NULL` + gerbang verifikasi admin lewat trigger
- [x] **Cara penyaluran kini wajib dan menyetir tahapan** — bukan lagi sekadar penentu wajib-tidaknya alamat
- [x] **`BOOKING_MAX_DAYS` diseragamkan.** Klien mengizinkan 30 hari sementara RPC menolak di atas 7 — pemesan lolos seluruh validasi form lalu ditolak database. Keduanya kini membaca `app_settings.booking_max_days`
- [x] Alamat pengiriman terstruktur dari `regions` (91.599 wilayah Kemendagri); nama ikut disimpan, bukan hanya kode, karena alamat pada order adalah rekaman sejarah
- [x] Kebenaran kode wilayah ditegakkan saat penulisan (sejalur dari kodenya sendiri), bukan lewat FK
- [x] `orders.delivery_address` dirakit RPC dari bagian-bagiannya — satu tempat saja yang menyusun teks itu
- [x] Rem laju per nomor telepon (RPC) **dan** per alamat IP (`lib/security/rate-limit.ts`)

#### Belum selesai / ⚠️ perlu keputusan
- [x] **Qurban dicabut dari pemasaran, fokus ke aqiqah — diputuskan 21 Agustus.**
  Checkout hanya melayani aqiqah (`.eq('type','aqiqah')`), dan kini seluruh
  materi pemasaran ikut menyesuaikan supaya tidak ada tawaran yang tak bisa
  dipesan: `siteConfig.description`, kartu layanan, badge & subjudul hero,
  keyword SEO di `app/layout.tsx`, teks footer, dan jawaban FAQ pertama
- [x] **Tiga kartu layanan disusun ulang mengikuti apa yang sungguh dilayani** —
  Aqiqah Kirim, Aqiqah Salur, Nasi Box Aqiqah. Ketiganya diperiksa terhadap
  `services` di database (3 paket aqiqah + 5 nasi box) dan terhadap
  `DISTRIBUTION_OPTIONS` di checkout. Draf sebelumnya sempat memakai "Aqiqah
  Dewasa", tapi `AQIQAH_FOR_OPTIONS` hanya menawarkan anak laki-laki/perempuan —
  itu akan jadi janji kosong baru menggantikan yang lama
- [x] **Sisi kode sengaja TIDAK disentuh** — enum `service_type`, baris
  `services` bertipe `qurban` di database, `SPECIES_BY_SERVICE_TYPE`, dan
  `IconQurban` semuanya tetap utuh. Yang dicabut keputusan pemasarannya, bukan
  kemampuannya; membuka Qurban lagi cukup melonggarkan saringan di
  `features/checkout/queries.ts`
- [ ] Sebelum Qurban dibuka lagi: tahapannya perlu dirancang lebih dulu.
  Rangkaiannya berbeda dari aqiqah — tidak ada "aqiqah untuk siapa", dan
  penyalurannya lazimnya massal, bukan per pemesan

#### Foto landing (21 Agustus)

- [x] **Komponen `SitePhoto`** — merender foto bila berkasnya ada di `public/`,
  dan kotak abu bertuliskan path yang ditunggu bila belum. Keberadaan berkas
  diperiksa di server saat render, jadi menambah foto tidak menyentuh kode
- [x] Sengaja bukan gambar rusak dan bukan pula ruang kosong: gambar rusak
  membuat halaman tampak salah, sedang ruang kosong menyembunyikan slot yang
  justru perlu diingat untuk diisi
- [x] Memakai `next/image` — **berkebalikan** dengan galeri bukti di `/r/{token}`
  yang sengaja memakai `<img>` polos. Alasannya justru berlawanan: foto
  pemasaran memang **ingin** disinggahkan & dioptimasi, sementara bukti
  dokumentasi tidak boleh meninggalkan salinan yang tetap tersaji setelah
  signed URL-nya kedaluwarsa
- [x] **10 slot foto**: hero (1), kartu paket (3), galeri dokumentasi (6).
  Semuanya didaftarkan di satu tempat (`landingPhotos` & `aqiqahPrograms[].photo`
  di `lib/constants/site.ts`), jadi berkas yang ditunggu bisa dilihat tanpa
  menyisir komponen
- [x] **Section Galeri baru**, ditaruh tepat setelah Proses — bagian itu
  menjanjikan setiap tahap terdokumentasi, dan galerilah buktinya. Urutan enam
  fotonya mengikuti `fulfilment_sequence()` di database, jadi yang dilihat
  pengunjung sama dengan bentuk laporan yang nanti ia terima
- [x] Hero disusun ulang jadi dua kolom (teks + foto) pada `lg`, menumpuk di
  layar kecil. Foto **tidak** disembunyikan di mobile: justru di layar kecil
  sebuah foto paling cepat menjelaskan layanan ini
- [x] "Keunggulan" dilepas dari menu header saat "Galeri" masuk — sectionnya
  tetap ada dan tetap tercapai dengan menggulir, tapi enam butir menu membuat
  dua tombol aksi di sebelah kanan berdesakan pada lebar tablet
- [x] Panduan pengisian di `public/images/landing/README.md` — nama berkas,
  rasio, ukuran minimal, dan catatan privasi
- [x] **Terverifikasi lewat build**: kesepuluh placeholder tercetak di HTML
  hasil prerender dengan path yang benar, dan saat satu berkas uji ditaruh,
  jumlah placeholder turun 20→18 sementara hero berganti jadi `<img>` yang
  dioptimasi Next. Berkas uji sudah dihapus kembali
- [ ] ⚠️ **Menunggu 10 foto dari pemilik usaha** — lihat §11 butir 1
- [ ] Kode pos masih diketik manual — dataset Kemendagri tidak memuatnya
- [ ] Alamat pemesan (`participants.address`) masih teks bebas
- [ ] Panel jadwal admin belum memakai `requested_date` sebagai nilai awal
- [ ] Halaman program & katalog harga → `docs/28`
- [ ] Halaman FAQ editable (CMS) → `docs/27`
- [ ] Payment Gateway UI + verifikasi
- [ ] Affiliate / Referral UI — `referral_code` sudah diterima checkout, belum ada yang mengolahnya
- [ ] Chatbot + human handoff → `docs/26`
- [ ] **Notifikasi WhatsApp otomatis** ke pemesan. Halaman checkout **menjanjikan** "tim kami menghubungi Anda lewat WhatsApp"; yang ada baru tombol manual. Bergantung Tahap 8
- [ ] ⚠️ Belum diverifikasi dengan pemesanan sungguhan dari pengunjung anonim di cloud

> **Pertentangan dokumen — sudah diputuskan di lapangan.** `prd.md §7.3` FR-C2 menetapkan guest checkout sebagai **M (Must)**, sementara `docs/01 §6` dan `docs/23 §6` mencantumkannya sebagai out of scope. Aturan otoritas memenangkan `prd.md`, dan kodenya sudah ada sejak 11 Agustus — jadi kedua bagian `docs/` itu kini bukan sekadar usang, melainkan **salah**.

---

## 9. PWA — **0%** — *Awalin*

- [ ] `manifest.json` + installable · Service worker · Offline queue upload
- [ ] Akses kamera untuk dokumentasi lapangan · Indikator upload pending

→ `docs/13_PWA_ARCHITECTURE.md`. Prasyarat Documentation Flow yang dipakai vendor di lapangan.

---

## 10. Kualitas & Rapi-rapi

- [x] **339 unit test hijau di 25 file** — state machine order & hewan, urutan tahap (dibaca langsung dari migration), payload RPC laporan publik, alur & path dokumentasi, kapabilitas, filter schema, agregasi dashboard, format & aritmetika tanggal WIB, path & schema pembayaran, schema & wizard checkout, rem laju & normalisasi nomor WhatsApp
- [x] `ActionResult` + helper error disatukan di `server/actions/result.ts`
- [x] **Navigasi < 1024px** — bottom-nav + panel `≡`, disaring per role
- [x] Penanda aktif sidebar diturunkan dari `pathname`, berhenti di batas segmen
- [x] **Link mati "Pengaturan" sudah tertutup** — `/users` & `/vendors` kini ada, dan menu disaring per role
- [ ] **`tests/integration/` masih kosong** (`.gitkeep`) — dan sekarang lebih mendesak dari sebelumnya. Target: RLS per role, `create_guest_order`, `get_public_report`, **dan empat trigger** yang perilakunya hanya muncul di database: `generate_stage_checklist`, `enforce_stage_order`, `enforce_stage_review`, `enforce_vendor_assignment`. Dua bug 21 Agustus lolos justru karena tidak ada tes yang pernah memanggil RPC sungguhan
- [ ] `tests/e2e/` masih kosong (`.gitkeep`) — target: alur order → laporan end-to-end (`docs/21`)
- [ ] Checklist keamanan `docs/20_SECURITY_CHECKLIST.md` belum ditelusuri satu per satu
- [ ] **Akun demo `*@suksesaqiqah.test` (password `Password123!`)** — `02_demo.sql` tidak ikut `db push`, tapi akun lama yang terlanjur ada di cloud wajib dihapus sebelum produksi
- [ ] **Dokumentasi tertinggal jauh dari kode.** `docs/05_DATABASE_DESIGN.md`,
  `docs/06`, `docs/07`, `docs/08` masih menggambarkan cabang, lima role, dan
  `slaughter_records`/`distributions`. Karena urutan otoritas menempatkan `docs/`
  paling akhir, ini tidak menghentikan pekerjaan — tapi menyesatkan siapa pun
  yang membacanya duluan
- [ ] `docs/01 §6` & `docs/23 §6` masih menyebut checkout sebagai out of scope

### Kepatuhan design system (`design.md`)

- [x] Konflik token warna diperbaiki (`app/globals.css`) — satu sumber kebenaran per token di `:root`
- [x] Sesuai spec: `AppShell`, `KpiCard`, `StatusBadge`, `FilterBar`, `OrderCard`, `ValidationQueue`, `AlertList`, pola halaman list & detail, breakpoint responsif, bahasa Indonesia
- [ ] **§8 State & Feedback — bagian terlemah.** Tidak ada toast, `Skeleton`, `loading.tsx`/`error.tsx`, konfirmasi aksi destruktif, maupun banner "Mode offline"
- [ ] Token semantik `success`/`warning`/`danger`/`info` terdefinisi tapi hampir tak terpakai
- [ ] Sidebar merender navy `#0b1c30` yang di-hardcode di 11 tempat, sementara token `--sidebar` bernilai hijau dan `design.md §3` tidak menyebut navy sama sekali
- [ ] `text-accent-dark` (`#c98800`) di atas putih ~3,4:1 — gagal WCAG AA untuk teks kecil
- [ ] `DataTable` belum punya sort per kolom & klik-baris; `Timeline`, `EmptyState`, `MediaGallery` masih inline
- [ ] `MediaUploader` masih `<input type="file">` polos — digabung ke pekerjaan PWA (§9)
- [ ] Blok `.dark` di `globals.css` adalah **kode mati**
- [ ] `design.md §2` menyebut Radix & Recharts; kenyataannya `@base-ui/react` dan bar CSS buatan sendiri

---

## 11. Urutan kejar berikutnya

| # | Pekerjaan | Kenapa didahulukan | Pemilik |
|---|-----------|--------------------|---------|
| **1** | **Isi 10 foto landing** → `public/images/landing/` | Halaman kini memajang 10 kotak abu bertuliskan nama berkas yang ditunggu. Daftar lengkap beserta rasio & ukuran ada di `public/images/landing/README.md`. Tidak ada kode yang perlu diubah — begitu berkasnya ditaruh, fotonya langsung tampil. **Galeri sebaiknya foto pelaksanaan sungguhan**: halamannya menulis "bukan foto ilustrasi" | Pemilik usaha |
| 2 | **Tes integrasi untuk trigger & RPC** (§10) | Dua bug 21 Agustus (payload `progress` hilang, `branch_name` tak pernah sampai) lolos typecheck **dan** 321 unit test. Keduanya sejenis: kembaran SQL↔TypeScript yang menyimpang diam-diam. Verifikasi manual sudah dilakukan di lokal & cloud, tapi manual tidak berulang — selama tidak ada tes otomatis yang memanggil database sungguhan, bug ketiga hanya soal waktu | Bani |
| 3 | **Uji alur penuh di cloud dengan data sungguhan** | Skemanya sudah ter-push, tapi cloud masih kosong di `animals`, `order_stage_events`, `order_items`, dan `documentations` — jadi belum ada yang membuktikan tahap terbit, gerbang urutan, dan gerbang bukti benar-benar bekerja di sana. Ini pula yang menahan butir Definition of Done (§12) | Bani |
| 4 | **Automation & Notification** (Tahap 8) | Menahan **empat** hal: pengiriman laporan, notifikasi validasi dokumentasi, notifikasi WA yang sudah dijanjikan halaman checkout, dan pemberitahuan agar pemesan menekan konfirmasi terkirim | Bani |
| 5 | **PWA** (kamera, kompresi klien, antrian offline) | Dokumentasi sudah bisa diunggah, tapi belum nyaman dipakai vendor di lapangan | Awalin |
| 6 | **`design.md §8`** — toast, `loading.tsx`/`error.tsx`, `Skeleton` | Celah design system yang paling terasa pengguna; murah dan menyentuh seluruh halaman | Awalin |
| 7 | Realtime + filter periode dashboard | Penyempurnaan, bukan penghalang | Awalin |
| ~~—~~ | ~~**Jalankan `20260821010000` di lokal**~~ | **Selesai 21 Agustus** — 37 migration jalan bersih, terverifikasi lewat jalur `anon` di lokal **dan** cloud (§4) | Bani |
| ~~—~~ | ~~**`npm run db:push`**~~ | **Selesai** — seluruh 37 migration sudah ter-push; `db push --dry-run` melaporkan remote up-to-date, dan inspeksi tabel remote memastikan skema barunya hidup (§1 Tahap 1) | Bani |
| ~~—~~ | ~~**Putuskan nasib Qurban**~~ | **Diputuskan 21 Agustus: dicabut dari pemasaran, fokus aqiqah** (§8) | — |

---

## 12. Definition of Done — Phase 1

- [ ] Litmus test terjawab < 10 detik di dashboard — ⚠️ **centangnya dicabut**: verifikasi lama memakai skema yang sudah tidak ada
- [ ] 1 pilot jalan end-to-end: order → pembayaran → penugasan mitra → tahapan lapangan → dokumentasi → laporan → konfirmasi terkirim
- [ ] ≥ 95% order selesai punya dokumentasi tervalidasi
- [ ] Laporan terkirim otomatis ke peserta via link unik — bergantung Tahap 8
- [ ] Lulus UAT + checklist keamanan inti (`docs/20`, `docs/21`)

**0 dari 5 tercentang.** Ini kemunduran di atas kertas, bukan di lapangan:
satu-satunya butir yang pernah tercentang bersandar pada verifikasi cloud yang
kini hangus bersama skema lama. Alur end-to-end-nya sendiri justru lebih lengkap
dari sebelumnya — bertambah tahap masak, penugasan mitra, dan konfirmasi
penerimaan. Yang hilang adalah **buktinya**, dan bukti itu baru bisa dikumpulkan
lagi sesudah §11 butir 1.

---

### Referensi silang
- Pembagian kerja & gate antar tahap → `TEAM_PLAN.md`
- Roadmap & exit criteria per fase → `docs/23_MVP_ROADMAP.md`
- Urutan teknis build → `docs/25_BUILD_SEQUENCE.md`
- Skema & view → `docs/05_DATABASE_DESIGN.md` ⚠️ **usang, belum menyusul desain ulang 20 Agustus**
