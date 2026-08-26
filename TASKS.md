# TASKS — Status Pengerjaan Sukses Aqiqah

> Peta apa yang **sudah jadi**, apa yang **belum**, dan apa yang **harus dikejar berikutnya**.
> Urutan tahap mengikuti `TEAM_PLAN.md §3`; definisi modul mengikuti `docs/06_MODULE_BREAKDOWN.md`.
> Urutan otoritas kebenaran: **migrations → kode (`features/`, `app/`, `server/`) → `prd.md` → `docs/`**.

| Field                            | Value                                                                                                                                                                                                                                                |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dokumen                          | `TASKS.md`                                                                                                                                                                                                                                           |
| Diperbarui                       | 2026-08-24                                                                                                                                                                                                                                           |
| Fase aktif                       | **Phase 1 — Operational MVP** (`docs/23_MVP_ROADMAP.md`)                                                                                                                                                                                             |
| Estimasi Phase 1                 | **± 83%** (dari 80% — rantai end-to-end kini terbukti otomatis di lokal, lihat _Perbaikan 24 Agustus_)                                                                                                                                               |
| Terverifikasi pada pembaruan ini | `npm run typecheck` ✅ · `npm run lint` ✅ **(nol warning)** · `npm run build` ✅ **(18 rute)** · **386 unit test hijau (29 file)** · **104 tes integrasi hijau (8 file) terhadap Postgres lokal** · **39 migration jalan bersih di lokal ✅; 38 selaras di cloud, yang ke-39 belum di-push ⚠️** · **jendela pemesanan baru terbukti ditegakkan di cloud lewat jalur `anon`** ✅ |

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

### Perbaikan 24 Agustus — `tests/integration/` terisi

Direktori yang selama dua revisi ditandai "masih kosong" kini berisi **93 tes di
6 berkas**, dijalankan terhadap Postgres lokal sungguhan lewat `postgres.js`
(bukan supabase-js: tes ini perlu menyetel `request.jwt.claims` dan menangkap
SQLSTATE persis dari `raise exception`, dua hal yang PostgREST sembunyikan).

Yang kini terjaga otomatis — empat trigger dan tiga RPC yang perilakunya hanya
muncul di database:

| Berkas                       | Cakupan                                                                                                                                                        |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stage-checklist.test.ts`    | `generate_stage_checklist` — 5 tahap mode kirim, 4 mode salur, `sembelih` satu baris per ekor, tidak terbit ganda                                              |
| `stage-gates.test.ts`        | `enforce_stage_order` (lompat tahap ditolak; gerbangnya di `validated`, bukan `reported`) & `enforce_stage_review` (pemisahan tugas, `validated_by` dari sesi) |
| `vendor-assignment.test.ts`  | `enforce_vendor_assignment`, `is_staff()`, `auth_vendor_id()`                                                                                                  |
| `public-report-rpc.test.ts`  | `get_public_report` — 16 key payload, penyebut progres, penjagaan token                                                                                        |
| `guest-checkout-rpc.test.ts` | `create_guest_order` (harga/status/vendor kiriman klien diabaikan) & `confirm_delivery` (idempoten)                                                            |
| `full-flow.test.ts`          | **Alur penuh kedua percabangan dalam satu transaksi**                                                                                                          |
| `rls.test.ts`                | **RLS per role** — isolasi antar mitra, batas admin↔superadmin, data publik vs internal, view KPI                                                              |

**Dua bug 21 Agustus sekarang punya penjaga.** `public-report-rpc.test.ts`
menuntut keenam-belas key yang dideklarasikan `RpcPayload` benar-benar ada di
payload yang **dikembalikan RPC saat dijalankan** — bukan yang tertulis di
berkas migration. `public-report-payload.test.ts` (unit) membaca migration, dan
itu berguna, tapi berkas SQL bukan database. Ditambah satu tes yang menuntut
`stages_total` = 7 dan `stages_in_sequence` = 5 pada order 3 ekor mode kirim,
lalu menegaskan keduanya **tidak** sama — pencampuran itulah yang akan mencetak
"7/5 tahap" kepada pemesan.

**Alur penuh terbukti jalan end-to-end di lokal.** `full-flow.test.ts` menempuh
checkout tamu → verifikasi admin → pembayaran (dan membuktikan
`sync_order_payment` menaikkan `paid_amount` sendiri) → penugasan mitra → lima
tahap lapangan berurutan → bukti per tahap → laporan → halaman bertoken →
konfirmasi terkirim → `completed`, dengan berganti-ganti peran sebagaimana orang
sungguhan bergantian menyentuh order yang sama. Di tengahnya, vendor sengaja
mencoba melompat ke tahap `masak` dan **ditolak database**. Mode `salur` diuji
terpisah: 4 tahap, gerbang bukti menutup pada tahap `salur` sampai buktinya
disetujui, dan `confirm_delivery` menolaknya karena tidak ada yang diantar.

**Satu bug seed ditemukan dan ditutup.** `02_demo.sql` menyisipkan tiga order
dengan nomor **hardcode** (`IA-202608-0001..0003`) tetapi tidak pernah menyentuh
`order_counters`, jadi penghitung tertinggal di 0. Akibatnya order pertama yang
dibuat lewat aplikasi meminta nomor `0001` yang sudah terpakai dan **ditolak
`orders_order_number_key`** — checkout gagal total di database yang baru
di-seed. Ini tidak pernah terlihat karena tidak ada yang pernah membuat order
sesudah seed. Ditutup dengan menurunkan `last_value` dari `orders` (bukan angka
yang ditulis ulang), sehingga tetap benar kalau order demo ditambah.

> **Kenapa `npm test` sekarang hanya unit.** Tes integrasi butuh Docker.
> `npm test` → `tests/unit` (364), `npm run test:integration` → `tests/integration`
> (93), `npm run test:all` → keduanya. Kontributor tanpa Docker tetap bisa
> bekerja, dan prasyaratnya tercatat di `tests/integration/README.md`.

---

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

> _"Berapa order yang belum selesai, di lokasi mana, siapa mitranya, apa kendalanya?"_ — harus terjawab **< 10 detik**.

- [x] Terjawab di `/dashboard` lewat `v_open_orders` — nomor order, mitra, lokasi, tahap berjalan, status, kendala, umur, terurut keparahan lalu umur.
- [x] Seed baru jalan di Postgres lokal (3 order menempuh keadaan berbeda: satu `in_progress` mode kirim, satu `assigned` mode salur, satu order tamu `new` yang belum diverifikasi).
- [x] **Alur penuh terbukti di lokal secara otomatis** — `tests/integration/full-flow.test.ts` menempuh kedua percabangan sampai `completed`, dan menegaskan order selesai keluar dari `v_open_orders` (24 Agustus).
- [ ] ⚠️ Belum diulang di **cloud** — verifikasi cloud yang lama hangus bersama skema lama. Yang berubah sejak 21 Agustus: alurnya kini punya tes yang bisa **diarahkan** ke cloud, jadi verifikasinya tidak lagi manual.
- [ ] Terverifikasi dengan data operasional asli.

> Pertanyaannya sendiri ikut berubah: **"siapa PIC-nya"** jadi **"siapa mitranya"**. Dengan satu tempat operasi dan banyak mitra, itulah yang sungguh ingin diketahui.

---

## 1. Tahap 0–3 · Fondasi — **SELESAI** _(dibangun ulang 20 Agustus)_

### Tahap 0 · Fondasi bersama

- [x] Init Next.js 16 + React 19 + Tailwind 4 + TypeScript
- [x] Struktur folder sesuai `docs/24_FOLDER_STRUCTURE.md`
- [x] Tooling: ESLint, Prettier, Vitest, `npm run typecheck`
- [x] `.env.example` lengkap (termasuk `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` & `SUPABASE_DB_URL`)

### Tahap 1 · Database — _Bani_

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
      `supabase db push --dry-run` → _"Remote database is up to date"_, dan inspeksi
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

### Tahap 2 · Auth — _Bani_

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

### Tahap 3 · RBAC / RLS — _Bani_

Tiga role tetap: **superadmin · admin · vendor**.

| Role           | Wewenang                                                                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **superadmin** | Segalanya: master mitra & harga, pengelolaan user, penghapusan laporan tahap                                                                    |
| **admin**      | Penghubung pembeli & vendor: verifikasi order tamu, catat & verifikasi pembayaran, **penugasan mitra**, validasi laporan tahap & bukti, laporan |
| **vendor**     | Pelaksana: melapor tahap, unggah bukti, lapor kendala — **hanya pada order yang ditugaskan padanya**                                            |

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

## 2. Tahap 4 · Order Management — **± 95%** — _Bani_

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

## 3. Tahap 5 · Documentation Flow — **± 88%** — _Bani_

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
- [x] **Gerbang bukti & pemisahan tugas terjaga tes integrasi** — bukti yang dilampirkan ke tahap yang salah ditolak, pengunggah tidak bisa menyetujui unggahannya sendiri (`full-flow.test.ts`, 24 Agustus)
- [ ] ⚠️ Belum diverifikasi di cloud

---

## 4. Tahap 6 · Reporting Engine — **± 80%** — _Awalin_

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

## 5. Tahap 7 · Dashboard & Monitoring — **± 85%** — _Awalin_

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

## 6. Tahap 8 · Automation & Notification — **± 45%** — _Bani_

- [x] Tabel `notifications` + enum channel/status
- [x] **Outbox terisi — 24 Agustus.** Tabelnya ada sejak 20 Agustus tapi **nol
      referensi** di seluruh `server/`, `features/`, dan `app/` — tidak ada satu
      pun yang pernah menulis ke sana. `20260824020000` menutupnya dengan enam
      trigger: bukti diunggah, bukti ditolak, laporan terbit, kendala `high`,
      order tamu masuk, dan tahap `kirim` tervalidasi
- [x] **Pemicunya trigger, bukan server action.** Peristiwanya datang dari lebih
      dari satu jalan — aksi staf, RPC `create_guest_order`, `confirm_delivery`
      dari halaman bertoken, dan nanti worker n8n. Di lapisan aplikasi, setiap
      jalan baru harus ingat memanggilnya, dan yang lupa **tidak menghasilkan
      galat** — cuma notifikasi yang diam-diam tidak pernah terbit
- [x] **Idempotensi lewat `event_key`** (`docs/12 §4`), index unik parsial.
      Terbukti: bukti yang ditolak → caption dikoreksi → ditolak lagi hanya
      menerbitkan **satu** notifikasi. Tanpa ini vendor menerima dua pesan untuk
      satu peristiwa. Pengecualian yang disengaja: `report_ready` memuat nomor
      versi di kuncinya, sebab generate ulang memang mengubah isi laporan
- [x] **Alert in-app di dashboard** (`docs/12 §2`) — panel "Perlu Tindakan" di
      bawah kartu KPI. Kartu menjawab *berapa*, panel ini menjawab **yang mana**
      dan membawa langsung ke barisnya (`/validation` untuk bukti, `/orders/{id}`
      untuk sisanya). Dibatasi `queued`: yang sudah terkirim bukan lagi tugas
- [x] **Notifikasi konfirmasi terkirim** — celah yang tercatat terbuka sejak
      `confirm_delivery()` dibuat: fungsinya ada, tapi tidak ada yang memberi
      tahu pemesan bahwa ia perlu menekannya. Kini terbit otomatis begitu tahap
      `kirim` divalidasi, lengkap dengan `public_token` di payload sehingga
      pesan WA bisa dirakit tanpa membaca ulang tabel `orders`
- [x] **Tombol "Kirim WA" per baris** — pesannya dirakit di server dari template
      `docs/12 §5`, nomornya lewat `whatsAppHref()` yang sudah ada. Tombolnya
      **tidak dirender** bila nomor tidak bisa dinormalkan; tautan yang membuka
      WhatsApp ke nomor kosong lebih buruk daripada tidak ada tombol
- [x] **18 tes baru** — 11 integrasi (`notification-outbox.test.ts`: idempotensi,
      kendala `low`/`medium` tidak memicu, order staf tidak memicu, mode `salur`
      tidak pernah meminta konfirmasi, generate ulang justru memicu lagi,
      penandaan kedua tidak menggeser `sent_at`) + 7 unit (`alert-panel.test.tsx`)
- [x] **Antrian bisa dikosongkan (26 Agustus)** — sampai hari ini **tidak ada
      satu pun** penulis `status = 'sent'` di seluruh repo; `from('notifications')`
      cuma punya satu hasil, dan itu `.select()`. Akibatnya klik "Kirim WA"
      meninggalkan barisnya `queued` selamanya: panel tidak pernah menyusut, dan
      dengan `limit 8` notifikasi lama mendorong yang baru keluar dari layar.
      `markNotificationSent` menutupnya — dikunci `.eq('status','queued')` supaya
      penekanan kedua tidak menggeser `sent_at`, dan "Kirim WA" menandai
      sekaligus agar tidak ada langkah kedua yang bisa dilupakan
- [ ] **Worker pengirim** — pengiriman masih manual-klik. Yang berubah: tidak
      ada lagi yang terlewat, sebab semuanya tercatat sebagai antrian.
      ⚠️ "Selesai" saat ini berarti *admin sudah dibawa ke WhatsApp*, bukan bukti
      pesannya terkirim — ganti dengan status dari worker/webhook
- [ ] Workflow n8n: reminder H-1, generate & kirim laporan (`docs/18`)
- [ ] Realtime pada panel alert — saat ini butuh muat ulang halaman
- [ ] Folder `automation/` masih kosong (`.gitkeep`)
- [x] **`20260824020000` sudah di cloud (26 Agustus)** — 39/39 migration selaras
      (`supabase migration list`). Trigger outbox kini aktif di produksi, panel
      "Perlu Tindakan" terisi dari peristiwa nyata

---

## 7. Tahap 9 · AI Layer — **0%** — Phase 2

- [ ] AI Executive Summary (`docs/19`) · AI Risk Detector · AI Report Writer
- [ ] Fallback aman saat AI gagal / kuota habis

> `@anthropic-ai/sdk` sudah terpasang, `ANTHROPIC_API_KEY` masih kosong. Jangan mulai sebelum Phase 1 stabil (`docs/23 §3`).

---

## 8. Tahap 10 · Public Platform — **± 55%** — _Awalin + Bani_

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
- [x] **Jeda persiapan minimum — 24 Agustus.** Sebelumnya pemesan boleh memilih
      **hari ini** sebagai tanggal pelaksanaan; hewan perlu dicari dan disiapkan,
      mitra perlu dijadwalkan, jadi order hari-yang-sama tidak pernah benar-benar
      bisa dikerjakan — yang terjadi hanya admin menelepon balik untuk memundurkan
      tanggal. Kini hari pengisian form **dan 3 hari sesudahnya** ditolak: mengisi
      tanggal 10 paling cepat mendapat tanggal 14. Batas atas ikut dilonggarkan
      7 → 30 hari, sebab jendela lama hanya menyisakan 3 tanggal setelah jeda
      diberlakukan. Angkanya di `app_settings.booking_min_days` lewat
      `booking_min_days()`, mengikuti pola yang sudah dipakai batas atas.
      **Terverifikasi di Postgres lokal**: 38 migration jalan bersih dari nol,
      `booking_min_days()` = 4 dan `booking_max_days()` = 30 terbaca dari
      `app_settings`. Tiga tes integrasi menjaganya — tiap hari dalam jeda
      ditolak satu per satu (jeda yang meleset sehari hanya terlihat di hari
      terakhir), dan tanggal persis di batas bawah **diterima**, supaya jeda yang
      kelebihan sehari tidak lolos tanpa jejak
- [x] **Peran `minDate` dipisah.** Form dulu meminjam prop `minDate` untuk dua
      hal — batas bawah pemesanan **dan** "hari ini" sebagai batas atas tanggal
      lahir anak — karena nilainya kebetulan sama. Dengan jeda persiapan keduanya
      berbeda empat hari, dan meminjamnya lagi berarti meloloskan tanggal lahir
      yang belum terjadi. Prop `today` kini berdiri sendiri, dengan tes yang
      menuntut `co-birthdate.max` tetap hari ini
- [x] **Pesan galat dipisah** antara "sudah lewat" dan "belum melewati jeda" —
      dua kekeliruan dengan jalan keluar berbeda: yang satu cukup ganti tanggal,
      yang satu memang harus menghubungi admin. RPC menyebutkan tanggal terdekat
      yang bisa dipilih, bukan hanya jumlah harinya
- [x] Alamat pengiriman terstruktur dari `regions` (91.599 wilayah Kemendagri); nama ikut disimpan, bukan hanya kode, karena alamat pada order adalah rekaman sejarah
- [x] Kebenaran kode wilayah ditegakkan saat penulisan (sejalur dari kodenya sendiri), bukan lewat FK
- [x] `orders.delivery_address` dirakit RPC dari bagian-bagiannya — satu tempat saja yang menyusun teks itu
- [x] Rem laju per nomor telepon (RPC) **dan** per alamat IP (`lib/security/rate-limit.ts`)

#### Checkout — isian tidak lagi hilang (21 Agustus)

> Rombakan 21 Agustus sebelumnya baru menyentuh landing, header, dan footer.
> Checkout ditelusuri menyusul, dan celah terbesarnya ternyata bukan tampilan.

- [x] **Isian tersimpan otomatis** (`features/checkout/draft.ts`). Sebelum ini,
      satu kali muat ulang halaman membuang belasan medan di tiga langkah tanpa
      peringatan apa pun — dan pemesan tidak punya cara memulihkannya
- [x] **`sessionStorage`, bukan `localStorage` — keputusan privasi, bukan
      selera.** Isian ini memuat nama anak, tanggal lahir, nomor telepon, email, dan
      alamat rumah. `localStorage` meninggalkan semuanya di perangkat sampai ada yang
      menghapusnya, termasuk di warnet atau ponsel pinjaman. `sessionStorage` habis
      bersama tabnya
- [x] **Pemulihan ditawarkan, tidak dipaksakan.** Mendapati kolom sudah terisi
      data yang tidak diketahui asalnya lebih meresahkan daripada menolong —
      terlebih bila perangkatnya dipakai berdua. Draft yang berhenti di langkah 1
      tidak ditawarkan sama sekali: tidak ada yang layak diselamatkan
- [x] **Draft dibuang begitu pesanan terkirim.** Tanpa ini, membuka checkout lagi
      akan menawarkan memulihkan pesanan yang **sudah** masuk — dan pemesan bisa
      mengirimnya dua kali tanpa merasa melakukan sesuatu yang salah
- [x] Umur draft dibatasi 12 jam. Tanggal pelaksanaan yang dipilih kemarin
      keburu lewat, dan memulihkannya hanya membuat pemesan menghadapi galat tanggal
      yang tidak ia mengerti asalnya
- [x] **`useSyncExternalStore`, bukan `useState` + efek.** `sessionStorage` tidak
      ada saat render di server; hook inilah yang dirancang untuk sumber data di luar
      React yang jawabannya berbeda antara server dan klien. Snapshot server
      mengembalikan `null`, jadi hidrasinya tetap cocok — **diverifikasi**: nol
      kemunculan banner pemulihan di HTML hasil render server
- [x] **Hasil bacaan disinggahkan seumur halaman.** Bukan penghematan:
      `useSyncExternalStore` memanggil `getSnapshot` tiap render dan membandingkannya
      dengan `Object.is`. Mengurai JSON tiap kali menghasilkan objek baru
      terus-menerus, yang dibaca React sebagai "berubah lagi" — render tak berujung
- [x] **Tombol kembali peramban memundurkan langkah**, bukan meninggalkan
      halaman. Di ponsel, gestur usap-dari-tepi adalah cara paling lazim membatalkan
      sesuatu — dan tanpa ini gestur itu membuang tiga langkah isian sekaligus.
      Entri pertama di-`replaceState` supaya langkah 1 tetap bisa ditinggalkan sekali
      tekan; halaman yang menyandera terbaca sebagai rusak
- [x] Tombol "Kembali" di layar menempuh jalur yang sama (`history.back()`),
      jadi tumpukan riwayat tidak menyisakan entri "maju" yang menganggur
- [x] `beforeunload` sebagai jaring terakhir — sebagian peramban mengabaikannya
      bila pemesan belum berinteraksi, jadi ia melengkapi draft tersimpan, bukan
      menggantikannya
- [x] **Draft dari luar diperlakukan sebagai data tak terpercaya** (`coerceDraft`).
      Isinya bisa berasal dari versi form sebelum deploy terakhir atau disunting
      lewat devtools; satu medan yang hilang (mis. `delivery`) membuat komponen
      menabrak `undefined` saat render — halaman putih, di tengah pengisian, tanpa
      jejak penyebabnya
- [x] **25 tes baru** (`checkout-draft.test.ts` 16 · `checkout-form-draft.test.tsx` 9):
      penyaringan bentuk draft, kedaluwarsa, JSON rusak, penyimpanan yang ditolak
      peramban, kestabilan snapshot, serta kapan tawaran pemulihan muncul dan kapan
      justru tidak boleh muncul

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

#### Landing dirombak — editorial, bukan dekoratif (21 Agustus)

- [x] **Kembali ke `design.md §1` — _clarity over decoration_.** Tampilan
      sebelumnya justru melanggar spec-nya sendiri: `design.md §4` menetapkan radius
      **8–12px** dan _"shadow halus"_, sementara halamannya memakai `rounded-3xl`
      dan `shadow-2xl` bertumpuk
- [x] Yang dibuang, semuanya karena menarik perhatian ke dirinya sendiri alih-alih
      ke isinya: teks bergradasi (`bg-clip-text`) yang menurunkan keterbacaan judul,
      gumpalan blur dekoratif (`blur-3xl`), bayangan tebal, tombol pil
      (`rounded-full`), dan `hover:-translate-y` di tiap kartu
- [x] Penggantinya: hierarki tipografi yang tegas, garis rambut sebagai pemisah
      (`divide-*`, `border-y`), rata kiri alih-alih rata tengah, dan satu warna
      aksen dipakai hemat. Section diberi penanda urutan bernomor (01–06) supaya
      halaman yang panjang tetap terasa punya posisi, tanpa berganti-ganti warna latar
- [x] **Bentuk ini lebih jujur pada produknya.** Yang dijual keterlacakan dan
      dokumentasi — tampilan dokumenter menyampaikan itu lebih baik daripada
      tampilan promosi
- [x] Keterangan galeri pindah ke **bawah** foto, tidak lagi ditumpuk di atasnya
      lewat gradasi gelap: teks di atas foto keterbacaannya bergantung pada seterang
      apa foto yang nanti diunggah — dan foto itu belum ada saat halaman ini ditulis
- [x] **Header: dua tombol jadi satu.** Sebelumnya "Pesan Online" dan "Pesan
      Sekarang" berdampingan — pengunjung harus menebak bedanya. WhatsApp turun jadi
      tautan biasa, menyisakan satu aksi utama
- [x] Label "Terpopuler" jadi label teks kecil di dalam kartu, bukan pita
      mengambang yang menggeser tata letak kartunya
- [x] **Terverifikasi**: nol kemunculan `bg-clip-text`, `blur-3xl`, `shadow-2xl`,
      `rounded-3xl`, `hover:-translate-y`, dan `backdrop-blur` di HTML hasil render
- [x] Warning lint lama ikut tertutup (`siteConfig` tak terpakai di `Logo.tsx`,
      beserta prop `light` yang ternyata memilih dua warna yang sama persis) —
      **lint kini nol warning**

#### Animasi & keresponsifan mobile (21 Agustus)

- [x] **Satu gerakan saja**: naik 16px sambil memudar masuk (`@keyframes rise-in`),
      **0,85 detik**, easing melambat di akhir. Tidak ada pantulan, skala, atau geser
      dari samping — semuanya menarik perhatian ke gerakannya sendiri, bukan ke isinya
- [x] **Easing diperbaiki setelah terasa menyentak.** Versi pertama memakai
      `cubic-bezier(.22,1,.36,1)` (easeOutQuint) yang menempuh ~80% jarak dalam 20%
      waktu pertama — terbaca sebagai "menyentak lalu menggantung", cepat sekaligus
      kasar. Diganti `cubic-bezier(.33,1,.68,1)` (easeOutCubic) yang pembagian
      kecepatannya jauh lebih merata
- [x] **Durasi & jarak dinaikkan** dari 0,5 detik/10px. Yang terlalu singkat
      tidak sempat terbaca sebagai gerakan — yang tertangkap mata hanya "sudah
      telanjur ada". Jaraknya ikut ditambah karena perpindahan yang terlalu kecil
      membuat easing apa pun tidak terasa bedanya
- [x] **Pemicu dimajukan** (`rootMargin: 0 0 14% 0`) — dengan gerakan 0,85 detik,
      memicu tepat saat elemen masuk pandangan berarti pengunjung menangkapnya di
      tengah jalan, dan bagian yang paling terasa halus (perlambatan di akhir) justru
      terlewat. Nilai versi pertama (`-8%`) efeknya kebalikan: memundurkan pemicu
- [x] **Transisi hover diselaraskan** ke 220ms dengan easing yang sama, lewat
      `--default-transition-*` di `@theme`. Bawaan Tailwind 150ms terbaca sebagai
      pergantian mendadak dan terasa kaku di sebelah reveal. **Percobaan pertama
      menuliskannya sebagai `@layer base { a, button { … } }` dan diam-diam tidak
      berpengaruh** — utilitas `transition-colors` muncul belakangan di bundel dan
      menimpanya; ketahuan saat memeriksa CSS hasil build, bukan dari kodenya
- [x] **`<Reveal>` berbasis IntersectionObserver**, tanpa pustaka tambahan —
      memasang pustaka animasi untuk satu gerakan sepanjang 10px tidak sebanding
      dengan tambahan ukuran bundel. Animasi yang langsung jalan saat halaman dimuat
      akan sudah selesai sebelum pengunjung menggulir sampai ke sana
- [x] **Sekali jalan, lalu berhenti diamati** — elemen yang muncul-hilang
      berulang saat digulir naik-turun terasa gelisah, terutama di ponsel
- [x] **Jeda antar-anggota 110ms, ditahan ≤ 220ms** untuk kelompok yang muncul
      saat digulir. Dihitung `i % 3`, bukan `i` — pada kelompok lima langkah, `i * 110`
      membuat anggota terakhir menunggu 440ms, dan pada layar lebar kelimanya
      berjajar sehingga selisih itu terbaca sebagai "menunggu", bukan sebagai urutan.
      Ketahuan dari memeriksa `animation-delay` di HTML hasil build
- [x] Hero boleh sampai 360ms karena ia tampil saat halaman dibuka, bukan saat
      digulir — tidak ada risiko terlewat
- [x] **`prefers-reduced-motion` dihormati** (`design.md §9`). Termasuk
      `scroll-behavior: smooth` yang sudah ada sejak lama **tanpa guard** — ia paling
      sering terlewat karena bukan animasi CSS melainkan perilaku bawaan peramban.
      Isinya tetap tampil: `[data-reveal]` dikembalikan ke `opacity: 1`, jadi
      mematikan animasi tidak pernah berarti menyembunyikan konten
- [x] **Jaring pengaman JavaScript mati.** `[data-reveal]` lahir `opacity: 0`,
      jadi tanpa JS seluruh isi halaman akan tak terlihat — halaman kosong yang
      tampak rusak. Ditutup `<noscript>` di `app/(site)/layout.tsx`, ditambah
      fallback di `Reveal` bila `IntersectionObserver` tidak tersedia
- [x] **Mobile**: ukuran judul hero diturunkan ke `2rem` (pada `text-4xl`,
      "tebarkan manfaat." pecah jadi tiga baris di lebar 360px); strip fakta jadi
      dua kolom agar tidak mendorong foto terlalu jauh ke bawah; padding section
      dikurangi (`py-16` dari `py-20`); tombol menu dinaikkan ke 44×44px sesuai
      ambang target sentuh; `active:` state ditambahkan di seluruh tombol karena
      `hover:` tidak berarti apa-apa pada layar sentuh
- [x] Panel menu mobile memudar & turun saat dibuka (320ms), sebelumnya muncul
      mendadak. Jawaban FAQ juga memudar masuk (380ms) — memberi tahu bahwa isi baru
      muncul, bukan halaman yang meloncat. Keduanya lebih singkat dari reveal karena
      dibuka atas permintaan pengguna: yang menunggu jawaban tidak ingin diperlambat
- [x] **Terverifikasi di hasil build**: `@keyframes rise-in` (16px / 0,85s /
      easeOutCubic) & blok `prefers-reduced-motion` ikut ter-bundle, token
      `--default-transition-duration: .22s` benar-benar berlaku, guard `<noscript>`
      terpasang, jeda terlama 360ms (hero) dan 220ms (saat digulir), serta **judul
      dan kesepuluh foto tetap ada di HTML hasil render** — jadi SEO dan pembaca
      layar tidak terpengaruh

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
- [x] **Jendela pemesanan terverifikasi di cloud (24 Agustus).** `20260824010000`
      sudah ada di remote (38/38 migration selaras). Diuji lewat jalur `anon`
      dengan kunci publik, bukan service role — jadi yang terbukti adalah jalan
      yang sungguh ditempuh pengunjung: H+0…H+3 semuanya ditolak dengan pesan
      yang menyebut tanggal terdekat ("paling cepat … tanggal 28-08-2026"), H+31
      ditolak batas atas, dan **H+4 berhasil membuat order** — penolakan saja
      tidak membuktikan apa pun kalau batas bawahnya ikut tertutup.
      `booking_min_days()` = 4 dan `booking_max_days()` = 30 terbaca `anon`
- [x] **Bug penghitung nomor order di cloud ditemukan & ditutup (24 Agustus).**
      Terungkap justru karena uji batas bawah di atas: H+4 lolos seluruh gerbang
      lalu ditolak `orders_order_number_key` — `order_counters.last_value` = 2
      sementara order seed sudah sampai `IA-202608-0003`, jadi **checkout
      berikutnya dari pengunjung mana pun pasti gagal**. Perbaikan seed-nya sudah
      ada di `02_demo.sql`, tetapi seed **tidak ikut `db push`**, jadi cloud yang
      di-seed sebelum perbaikan itu tetap membawa penghitung basi. Diselaraskan
      dengan pernyataan yang sama seperti seed — nilainya diturunkan dari
      `orders`, bukan angka yang diketik. Order uji dihapus dan penghitung
      dikembalikan; cloud kembali ke 3 order, `last_value` = 3
- [ ] ⚠️ Belum diverifikasi dengan pemesanan sungguhan dari pengunjung anonim di cloud
      (yang di atas dilakukan lewat skrip, bukan orang lewat halaman checkout)
- [ ] **Pelajaran yang belum ditutup: seed tidak ikut `db push`.** Dua kali
      berturut-turut celah muncul dari sini. Belum ada yang menjaga bahwa
      `order_counters` di cloud selaras dengan `orders` — pemeriksaannya sepele
      (`max(order_number)` vs `last_value`), tapi sekarang hanya ketahuan saat
      ada yang mencoba memesan

> **Pertentangan dokumen — sudah diputuskan di lapangan.** `prd.md §7.3` FR-C2 menetapkan guest checkout sebagai **M (Must)**, sementara `docs/01 §6` dan `docs/23 §6` mencantumkannya sebagai out of scope. Aturan otoritas memenangkan `prd.md`, dan kodenya sudah ada sejak 11 Agustus — jadi kedua bagian `docs/` itu kini bukan sekadar usang, melainkan **salah**.

---

## 9. PWA — **0%** — _Awalin_

- [ ] `manifest.json` + installable · Service worker · Offline queue upload
- [ ] Akses kamera untuk dokumentasi lapangan · Indikator upload pending

→ `docs/13_PWA_ARCHITECTURE.md`. Prasyarat Documentation Flow yang dipakai vendor di lapangan.

---

## 10. Kualitas & Rapi-rapi

- [x] **364 unit test hijau di 27 file** — state machine order & hewan, urutan tahap (dibaca langsung dari migration), payload RPC laporan publik, alur & path dokumentasi, kapabilitas, filter schema, agregasi dashboard, format & aritmetika tanggal WIB, path & schema pembayaran, schema & wizard checkout, **penyimpanan sementara isian checkout**, rem laju & normalisasi nomor WhatsApp
- [x] `ActionResult` + helper error disatukan di `server/actions/result.ts`
- [x] **Navigasi < 1024px** — bottom-nav + panel `≡`, disaring per role
- [x] Penanda aktif sidebar diturunkan dari `pathname`, berhenti di batas segmen
- [x] **Link mati "Pengaturan" sudah tertutup** — `/users` & `/vendors` kini ada, dan menu disaring per role
- [x] **`tests/integration/` terisi — 93 tes di 7 berkas** (24 Agustus). Keempat trigger sasaran (`generate_stage_checklist`, `enforce_stage_order`, `enforce_stage_review`, `enforce_vendor_assignment`) plus `create_guest_order`, `get_public_report`, `confirm_delivery`, dan alur penuh kedua percabangan. Prasyarat & rancangannya di `tests/integration/README.md`
- [x] **RLS per role terjaga — 21 tes** (`rls.test.ts`, 24 Agustus). Yang dibuktikan: vendor A tidak melihat order/tahap/bukti/jadwal/kendala/laporan milik vendor B; order tanpa mitra tidak terbaca vendor mana pun; pembayaran & notifikasi tertutup dari vendor; **admin tidak dapat mengubah role** (termasuk dirinya sendiri) sementara superadmin bisa; vendor tidak dapat memindahkan dirinya ke mitra lain; bukti `approved` dan kendala tidak dapat dihapus siapa pun; `anon` membaca `services`+`regions` tetapi ditolak pada `orders`/`profiles`/`payments`; dan **view KPI menghormati RLS pemanggilnya** (`security_invoker`)
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
- [x] **Landing dikembalikan ke §1 (_clarity over decoration_) & §4 (radius 8–12px, shadow halus)** — lihat §8. Sebelumnya halaman publik justru jadi bagian yang paling jauh menyimpang dari spec-nya sendiri
- [x] **Kedalaman dikembalikan tanpa melanggar spec (24 Agustus).** Rombakan 21
      Agustus ternyata ditarik terlalu jauh — halamannya patuh sampai terbaca
      datar. Yang ditambahkan: latar bertekstur (pola titik & sapuan warna dari
      gradient CSS, nol permintaan jaringan), latar section berselang-seling,
      ikon berlatar warna pada kartu layanan/keunggulan/galeri, garis aksen di
      bawah judul yang digambar dari kiri, bidang warna di belakang foto hero
      sebagai pengganti bayangan tebal, dan lencana status berdenyut. **Keempat
      larangan tetap nol** — `bg-clip-text`, `blur-3xl`, `shadow-2xl`,
      `rounded-2xl`/`3xl` — diverifikasi dari HTML yang benar-benar dirender,
      bukan dari grep sumber. `design.md §1` diberi catatan batas supaya spec
      dan kode tidak berselisih lagi
- [x] **Gerakan dibuat dua arah & berulang (24 Agustus).** Dua keluhan, dua
      akar: `observer.unobserve()` membuat animasi hanya sekali seumur halaman —
      menggulir balik menampilkan halaman yang sepenuhnya diam; dan arah
      gerakannya selalu sama tanpa peduli arah gulir, sehingga saat menggulir
      naik isinya terbaca didorong berlawanan dengan tangan. Sekarang arah
      gerakan mengikuti arah gulir, dan blok tampil lagi tiap kali masuk layar.
      Reset hanya setelah blok benar-benar lepas layar (`intersectionRatio === 0`),
      jadi kegelisahan yang dulu dihindari `unobserve` tetap tidak terjadi.
      Durasi dipendekkan 0,85 → 0,62 detik dan easing dilembutkan ke easeOutQuad:
      sejak gerakannya berulang, durasi lama terbaca sebagai penundaan.
      Satu listener `scroll` dipakai bersama seluruh `Reveal` (halaman ini punya
      43) dengan ambang 4px untuk menelan getaran gulir inersia di ponsel.
      **5 tes baru** (`reveal.test.ts`) menjaga keempat perilaku itu
- [x] **Garis aksen & pola titik dicabut, latar divariasikan (24 Agustus).**
      Putaran lanjutan sesudah masukan bahwa hero masih terbaca generik. Yang
      dicabut: **garis oranye di bawah "tebarkan manfaat."** dan garis serupa di
      bawah **tiap judul section** (10 kemunculan) — bentuknya pola
      landing-page generik, dan warnanya `accent` yang di sistem ini berarti
      sorotan KPI, jadi memakainya untuk menghias judul menghabiskan arti warna
      itu. Penekanan kini lewat `text-primary` pada frasa kuncinya. Keyframe
      `draw-line` ikut dibuang supaya tidak jadi jalan yang mengundang pemakaian
      ulang. **Pola titik** diganti kisi garis tipis dua kepadatan — titik
      seragam adalah tekstur paling umum di halaman produk mana pun, sementara
      kisi punya alasan di sini: halaman ini menjual pencatatan. **Jarak
      navbar→teks** dirapatkan (`py-14/20/24` → `pt-8/12/14`); header setinggi
      64px sudah memberi ruang putihnya sendiri. **Latar section jadi tiga
      perlakuan** (`plain`/`tinted`/`grid`), sebab selang-seling dua nilai jadi
      pola yang bisa ditebak setelah dua pergantian
- [x] **Pengayaan yang terbaca "AI slop" dicabut (24 Agustus).** Ditambahkan
      pada putaran sebelumnya lalu dibuang karena semuanya pola landing-page
      generik: lencana titik berdenyut (menandakan "live" padahal tidak ada yang
      live), kotak ikon yang berbalik hijau penuh saat hover, garis atas kartu
      yang melebar, latar berdenyut pelan, dan gradasi pada tiap kartu. Yang
      dipertahankan hanya yang menerangkan sesuatu: pola titik statis di hero,
      latar section berselang-seling, garis aksen di bawah judul, dan zoom halus
      pada foto — penanda kartu mana yang sedang dituju di grid. Patokannya
      dicatat di `design.md §1` sebagai uji tetap
- [x] **Gambar landing pindah ke `.webp` + AVIF (24 Agustus).** Sepuluh path di
      `site.ts` kini `.webp`, dan `next.config.ts` menyajikan
      `['image/avif', 'image/webp']`. Catatan yang perlu diketahui: `next/image`
      **sudah** mengubah gambar ke WebP secara bawaan apa pun format sumbernya —
      jadi yang benar-benar baru di sini adalah AVIF (biasanya 20-30% lebih kecil
      lagi) dan sumber di repo yang ikut ringan. Peramban tanpa dukungan AVIF
      jatuh ke WebP sendiri lewat negosiasi `Accept`
- [x] **Sistem gerak diperluas (24 Agustus).** `rise-scale` (kartu — naik +
      membesar 2%), `slide-in-left` (deret langkah proses; arahnya ikut
      menyampaikan urutan), `draw-line` (aksen judul), `soft-pulse` (latar).
      `<Reveal anim="...">` memilihnya lewat atribut, bukan kelas, supaya tidak
      bisa tertimpa utilitas Tailwind. Easing-nya satu untuk semua
      (`cubic-bezier(.33,1,.68,1)`), jadi seluruh halaman terbaca berasal dari
      satu sistem gerak. Semuanya mati pada `prefers-reduced-motion` lewat
      aturan sapu-bersih yang sudah ada — diverifikasi ada di CSS bundel
- [x] **Placeholder foto dirapikan.** Sepuluh slot kosong sebelumnya kotak abu
      rata bertuliskan nama berkas; dengan sepuluh sekaligus halamannya terbaca
      belum jadi. Kini bergradasi tipis + pola titik + ikon berlatar, jadi
      terasa disengaja alih-alih rusak — tanpa menyamar sebagai foto sungguhan.
      **Ini menutupi gejala, bukan sebabnya**: `public/images/landing/` masih
      berisi README saja, dan mengisi 10 foto itu tetap pekerjaan nomor 1 di §11.
      README-nya kini menyebut `.webp` beserta cara mengubahnya tanpa memasang
      perkakas apa pun
- [x] **Checkout — umpan balik galat & target sentuh ditutup (24 Agustus).**
      Empat dari enam butir telusur UI/UX beres; sisanya di butir terpisah
      di bawah. Yang dikerjakan:
  1. **Target sentuh ≥ 44px** — tombol jam, `StepperButton` jumlah ekor, dan tab
     langkah semuanya naik ke `min-h-11`/`size-11`. Ambang yang sudah ditegakkan
     di header landing kini berlaku juga di checkout
  2. **Galat sampai ke pembaca layar** — `FieldError` kini `role="alert"`,
     ditautkan ke inputnya lewat `aria-describedby` di 10 medan, dan diberi ikon
     supaya tandanya tidak hanya warna (≈8% laki-laki buta warna merah-hijau).
     Tab langkah dapat `aria-label` utuh — sebelumnya yang terbaca cuma "1." atau
     ikon centang
  3. **`role="radiogroup"` + `aria-labelledby`** pada tiga grup tombol
     (aqiqah untuk, paket, cara penyaluran); `aria-pressed` diganti
     `aria-checked` karena ketiganya pilihan tunggal, bukan tombol tekan
  4. **Radius & tinggi tombol seragam** — "Kembali" dan "Lanjut" sama-sama
     `rounded-lg min-h-11`; input ikut `rounded-lg`, jadi kartu, tombol, dan
     input berada di radius yang sama
  6. `text-neutral-400` (≈2,6:1, gagal AA) **nol** di checkout maupun landing —
     diverifikasi dari HTML yang benar-benar dirender, bukan dari grep sumber
- [x] **Umpan balik galat: toast + ringkasan yang bisa diklik (24 Agustus).**
      Keduanya dipakai bersama justru karena kelemahannya berlawanan — toast
      terasa tapi menghilang, ringkasan bertahan tapi bisa terlewat kalau
      perhatian sedang di bawah layar. Ringkasan menetap di atas form,
      menyebut **berapa** yang bermasalah dan **di mana**, dan tiap barisnya
      melompat ke medannya lewat `jumpToField` — jalur yang sama dengan lompatan
      otomatis, supaya keduanya tidak bisa menyimpang. `FIELD_ANCHOR` dilengkapi
      empat medan grup yang sebelumnya tidak ada di peta sama sekali, jadi
      galatnya tidak pernah bisa dilompati. **7 tes baru** menjaga: ringkasan
      memakai nama medan yang terbaca orang (bukan `aqiqah_for`), hitungan
      jamaknya benar, `aria-describedby` benar-benar menunjuk id yang ada, baris
      ringkasan sungguh memindahkan langkah, dan toast muncul **lagi** pada
      kesalahan yang sama berturut-turut (penghitung, bukan pesan, sebagai kunci)
- [x] **Gerakan: `nudge` & `toast-in` di `globals.css`** — dua keyframe saja, dan
      keduanya menerangkan sesuatu. Goyangan medan 4px sekali jalan; lebih lebar
      terbaca sebagai "rusak", bukan "periksa lagi". Sumbunya horizontal karena
      arah itu tidak dipakai gerakan lain, jadi tidak tertukar dengan `rise-in`
      yang vertikal. Gerak tekan (`active:scale-[0.98]`) ditambahkan pada seluruh
      CTA landing, header, dan checkout: di ponsel `hover:` tidak pernah menyala,
      jadi tanpa itu tombol terasa mati saat disentuh. Semuanya ikut mati lewat
      blok `prefers-reduced-motion` yang sudah ada
- [x] **Halaman internal dirapikan ke radius spec (24 Agustus).** 46 `rounded-2xl`
      (24px) di `app/(app)`, `features/`, dan `components/{data,layout}` diganti
      `rounded-lg` (12px, batas atas §4) di **21 berkas** — kini **nol** tersisa.
      `rounded-3xl`, `shadow-xl`, dan `shadow-2xl` ternyata sudah nol sejak
      sebelumnya: yang terhitung di revisi lalu adalah kemunculan di dalam **teks
      komentar**, bukan kelas yang dirender. Halaman ini terlindung auth (307 ke
      login) sehingga tidak bisa dirender tanpa sesi, jadi buktinya `npm run build`
      hijau untuk seluruh 18 rute
- [x] **`prefers-reduced-motion` ditegakkan global** (§9) — sebelumnya
      `scroll-behavior: smooth` berjalan tanpa guard sama sekali
- [ ] **§8 State & Feedback — sebagian tertutup.** **Toast sudah ada**
      (`components/ui/toast.tsx`), tapi baru dipakai checkout; halaman staf masih
      memakai pesan sebaris. Yang belum sama sekali: `Skeleton`,
      `loading.tsx`/`error.tsx`, konfirmasi aksi destruktif, dan banner
      "Mode offline"
- [ ] Token semantik `success`/`warning`/`danger`/`info` terdefinisi tapi hampir tak terpakai
- [x] **Navy sidebar disatukan ke token (24 Agustus).** `#0b1c30` sebelumnya
      ditulis ulang di lima tempat sementara `--sidebar` justru bernilai hijau dan
      tidak dibaca siapa pun. Token kini bernilai navy yang memang tampil, dan
      `bg-[#0b1c30]`/`border-slate-800`/`bg-slate-900` diganti `bg-sidebar`/
      `border-sidebar-border`/`bg-sidebar-accent` — **nol** nilai hardcode tersisa.
      Tampilannya tidak berubah; yang berubah hanya jumlah tempat yang harus
      disentuh untuk mengubahnya
- [x] **`text-accent-dark` ternyata tidak dipakai di mana pun** — yang tersisa
      hanya definisi tokennya di `globals.css`, jadi tidak ada teks yang gagal
      kontras karenanya. Diperiksa ulang 24 Agustus, bukan diperbaiki
- [ ] `DataTable` belum punya sort per kolom & klik-baris; `Timeline`, `EmptyState`, `MediaGallery` masih inline
- [ ] `MediaUploader` masih `<input type="file">` polos — digabung ke pekerjaan PWA (§9)
- [ ] Blok `.dark` di `globals.css` — **bukan kode mati sepenuhnya**: varian
      `dark:` masih dirujuk `components/ui/button.tsx`. Yang benar: tidak ada yang
      pernah memasang kelas `.dark`, jadi cabang itu tidak pernah menyala.
      Diperiksa ulang 24 Agustus
- [ ] `design.md §2` menyebut Radix & Recharts; kenyataannya `@base-ui/react` dan bar CSS buatan sendiri

---

## 11. Urutan kejar berikutnya

| #     | Pekerjaan                                                                                            | Kenapa didahulukan                                                                                                                                                                                                                                                                                                                                                                                                                                   | Pemilik       |
| ----- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| **1** | **Isi 10 foto landing** → `public/images/landing/`                                                   | Halaman kini memajang 10 kotak abu bertuliskan nama berkas yang ditunggu. Daftar lengkap beserta rasio & ukuran ada di `public/images/landing/README.md`. Tidak ada kode yang perlu diubah — begitu berkasnya ditaruh, fotonya langsung tampil. **Galeri sebaiknya foto pelaksanaan sungguhan**: halamannya menulis "bukan foto ilustrasi"                                                                                                           | Pemilik usaha |
| 2     | **Uji alur penuh di cloud** — _jalankan `full-flow.test.ts` dengan `TEST_DB_URL` diarahkan ke cloud_ | Alurnya sudah terbukti di lokal (§0), jadi yang tersisa membuktikannya di sana. **Butuh keputusan lebih dulu**: tes ini menulis baris, dan cloud sudah berisi 3 order + 2 pembayaran. Pilihannya — pakai project Supabase terpisah untuk staging, atau jalankan di cloud produksi dengan sadar bahwa `inRollback` membatalkan tiap transaksi (tetapi `order_counters` dan sequence tetap maju). Ini pula yang menahan butir Definition of Done (§12) | Bani          |
| 3     | **`tests/e2e/` masih kosong** (§10)                                                                  | Lapisan yang tersisa sesudah unit + integrasi: alur order → laporan lewat UI sungguhan (`docs/21`). Nilainya kini berbeda dari sebelumnya — rantai databasenya sudah terbukti, jadi e2e tinggal menjaga lapisan yang belum tersentuh: formulir, navigasi, dan unggahan berkas                                                                                                                                                                        | Awalin        |
| 4     | **Worker pengirim** (sisa Tahap 8)                                                                   | Outbox & alert in-app **selesai 24 Agustus** — peristiwanya kini tercatat dan tidak ada lagi yang terlewat, tetapi pengirimannya masih manual-klik. Yang tersisa: worker yang membaca antrian queued dan benar-benar mengirim. Butuh keputusan kredensial (n8n vs di dalam app) — lihat §6                                                                                                                                                                                                                                                         | Bani          |
| 5     | **PWA** (kamera, kompresi klien, antrian offline)                                                    | Dokumentasi sudah bisa diunggah, tapi belum nyaman dipakai vendor di lapangan                                                                                                                                                                                                                                                                                                                                                                        | Awalin        |
| 6     | **`design.md §8`** — toast, `loading.tsx`/`error.tsx`, `Skeleton`                                    | Celah design system yang paling terasa pengguna; murah dan menyentuh seluruh halaman                                                                                                                                                                                                                                                                                                                                                                 | Awalin        |
| 7     | Realtime + filter periode dashboard                                                                  | Penyempurnaan, bukan penghalang                                                                                                                                                                                                                                                                                                                                                                                                                      | Awalin        |
| ~~—~~ | ~~**Jalankan `20260821010000` di lokal**~~                                                           | **Selesai 21 Agustus** — 37 migration jalan bersih, terverifikasi lewat jalur `anon` di lokal **dan** cloud (§4)                                                                                                                                                                                                                                                                                                                                     | Bani          |
| ~~—~~ | ~~**`npm run db:push`**~~                                                                            | **Selesai** — seluruh 37 migration sudah ter-push; `db push --dry-run` melaporkan remote up-to-date, dan inspeksi tabel remote memastikan skema barunya hidup (§1 Tahap 1)                                                                                                                                                                                                                                                                           | Bani          |
| ~~—~~ | ~~**Putuskan nasib Qurban**~~                                                                        | **Diputuskan 21 Agustus: dicabut dari pemasaran, fokus aqiqah** (§8)                                                                                                                                                                                                                                                                                                                                                                                 | —             |

---

## 12. Definition of Done — Phase 1

- [ ] Litmus test terjawab < 10 detik di dashboard — terbukti di lokal (§0), **belum di cloud**
- [ ] 1 pilot jalan end-to-end: order → pembayaran → penugasan mitra → tahapan lapangan → dokumentasi → laporan → konfirmasi terkirim — **rantainya terbukti utuh di lokal** lewat `full-flow.test.ts` (kedua percabangan, 24 Agustus); yang kurang: dijalankan di cloud oleh orang sungguhan
- [ ] ≥ 95% order selesai punya dokumentasi tervalidasi — butuh data operasional, bukan kode
- [ ] Laporan terkirim otomatis ke peserta via link unik — bergantung Tahap 8
- [ ] Lulus UAT + checklist keamanan inti (`docs/20`, `docs/21`)

**0 dari 5 tercentang, tetapi butir 2 berpindah sifat.** Sebelum 24 Agustus,
tidak ada satu pun bukti bahwa rantai end-to-end bekerja — tahap terbit, gerbang
urutan, gerbang bukti, dan konfirmasi terkirim semuanya hanya diverifikasi
manual, sekali, di skema yang sudah dihapus. Sekarang rantai itu **berjalan utuh
dalam satu transaksi setiap kali `npm run test:integration` dipanggil**, di
kedua percabangan, dengan peran yang berganti sebagaimana orang sungguhan
bergantian menyentuh order.

Yang masih menahan centangnya jujur saja bukan lagi soal "apakah kodenya
bekerja", melainkan dua hal yang tidak bisa digantikan tes: **dijalankan di
cloud**, dan **dijalankan oleh orang** dengan data sungguhan. Butir 3 dan 5
memang menunggu itu; butir 4 menunggu Tahap 8.

---

### Referensi silang

- Pembagian kerja & gate antar tahap → `TEAM_PLAN.md`
- Roadmap & exit criteria per fase → `docs/23_MVP_ROADMAP.md`
- Urutan teknis build → `docs/25_BUILD_SEQUENCE.md`
- Skema & view → `docs/05_DATABASE_DESIGN.md` ⚠️ **usang, belum menyusul desain ulang 20 Agustus**
