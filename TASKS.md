# TASKS — Status Pengerjaan Sukses Aqiqah

> Peta apa yang **sudah jadi**, apa yang **belum**, dan apa yang **harus dikejar berikutnya**.
> Urutan tahap mengikuti `TEAM_PLAN.md §3`; definisi modul mengikuti `docs/06_MODULE_BREAKDOWN.md`.
> Urutan otoritas kebenaran: **migrations → kode (`features/`, `app/`, `server/`) → `prd.md` → `docs/`**.

| Field                            | Value                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dokumen                          | `TASKS.md`                                                                                                                                                                                                                                                                                                                                                     |
| Diperbarui                       | 2026-09-22                                                                                                                                                                                                                                                                                                                                                     |
| Fase aktif                       | **Phase 1 — Operational MVP** (`docs/23_MVP_ROADMAP.md`)                                                                                                                                                                                                                                                                                                       |
| Estimasi Phase 1                 | **± 90%** (dari 87% — pelaporan tahap, sertifikat, akun sendiri, & lupa sandi masuk; lihat _Perubahan 8–11 September_)                                                                                                                                                                                                                                         |
| Terverifikasi pada pembaruan ini | `npm run typecheck` ✅ · `npm run lint` ✅ **(bersih)** · `npm run build` ✅ **(24 rute, `/checkout/katering` terdaftar, landing tetap prerender statis `○ /`)** · **813 unit test hijau (66 file)** · **189 tes integrasi hijau (13 file)** · **56 migration selaras lokal ↔ cloud** (`migration list` 22 Sept: 56/56, ketiga migration katering sudah di produksi & paketnya terbaca lewat jalur `anon`) |

**Aturan pemeliharaan:** centang item hanya kalau kodenya ada **dan** `npm run typecheck` + `npm run build` hijau (Definition of Stable, `TEAM_PLAN §1.5`). Item yang belum diverifikasi dengan data sungguhan ditandai ⚠️, bukan dicentang.

---

## Perubahan 22 September — UI CRUD, margin mitra, halaman depan, dokumentasi

### Halaman depan: paket bertab & kartu seragam

Bagian Paket & Harga dulu menuang seluruh katalog sekaligus — tiga kartu aqiqah,
lima nasi box, lalu katering — dan pengunjung yang datang untuk satu hal harus
melewati semuanya. Sekarang **tiga tab** dengan **Pilihan** sebagai bawaan
(aqiqah terpopuler + katering), lalu Aqiqah dan Katering.

Aqiqah & katering kini memakai **satu bentuk kartu** dalam satu kisi: foto,
label jenis, nama, harga, tagline, daftar isi, tombol. Yang membedakan tinggal
satuan harga dan ke mana tombolnya mengarah.

**Nasi box sempat ikut jadi kartu, lalu dikembalikan ke blok ringkas.** Alasannya
bukan selera: `create_guest_order` menolak layanan bertipe `nasi_box` sebagai
paket utama, jadi kartu bertombol "Pesan" menjanjikan sesuatu yang pasti ditolak
di ujung alur — kekeliruan yang tidak menghasilkan galat apa pun, hanya
pengunjung yang kecewa. Bentuk ringkasnya justru menyampaikan perannya: tambahan
atas pesanan aqiqah, jalurnya WhatsApp.

Penyaringnya komponen klien, **kartunya tetap dirakit di server** (`SitePhoto`
memakai `node:fs`). Halaman depan karena itu tetap prerender statis dan seluruh
kartu ada di HTML awal — mesin pencari membaca semuanya, bukan hanya tab terbuka.

Tautan kartu membawa `?paket={slug}`, dan checkout katering kini membacanya.
Tanpa itu, `?paket=prasmanan` akan mendarat di paket pertama tanpa galat —
persis kelas bug yang pernah terjadi pada `paket-c-favorit`.

### Dokumentasi disinkronkan

| Dokumen | Yang berubah |
| --- | --- |
| `05` v2.2 | `katering` di enum & RPC, `is_catering_order`, §5.1 rangkaian tahap katering, 56 migration |
| `06` v2.1 | Modul **Pemesanan Katering**, §1.1 lima jenis & tiga peran, modal mitra dibekukan saat penugasan |
| `15` v2.0 | **Ditulis ulang** — v1.0 memetakan delapan rute yang tidak pernah dibangun |
| `09` | Peringatan margin order lama |
| `29` v2.0 | Status: selesai & sudah di produksi |

`docs-schema-sync.test.ts` diperluas ke `15_PAGE_MAP` dan mendapat tiga
pemeriksaan baru: katering tercatat di 05 & 06, alasan nasi box bukan pesanan
sendiri tertulis, dan tiap rute yang dipetakan 15 benar-benar punya berkasnya.

---

## Perubahan 22 September — UI CRUD & margin mitra

### `vendor_unit_price` tidak pernah terisi — margin dashboard salah sebulan

Kolomnya lahir bersama tabelnya (`20260820000300`) dengan komentar yang jelas:
*"Modal yang disepakati saat mitra ditugaskan. Di sinilah prinsip rekaman sejarah
benar-benar berlaku."* Tetapi **tidak ada satu pun kode yang pernah menulisinya**
— hanya `v_vendor_kpi` yang membacanya.

Akibatnya `vendor_cost_total` selalu nol, jadi `margin_total = revenue_total`:
dashboard melaporkan margin **100%** untuk setiap mitra. Berlaku untuk seluruh
order, bukan hanya katering.

Diperbaiki: `assignVendor` kini menyalin `vendor_services.vendor_price` ke
`order_items.vendor_unit_price` saat penugasan. Disalin, bukan dibaca lewat join
— revisi kesepakatan bulan depan tidak boleh menggeser margin order yang sudah
berjalan. Paket yang belum punya modal untuk mitra itu dibiarkan **NULL**, bukan
ditulis nol: nol berarti "modalnya memang nol" dan margin terbaca penuh lagi.

Penyalinannya dipanggil **sesudah** penugasan tersimpan, dan galatnya hanya
dicatat: modal yang belum tercatat membuat margin keliru, tetapi order tetap
bisa dikerjakan — membatalkan penugasan demi satu angka dashboard adalah
pertukaran yang salah.

> **Kenapa bertahan sebulan:** `makePaidOrder` di `helpers/fixtures.ts`
> **mengisi kolomnya sendiri**. Jadi setiap tes yang menyentuh `v_vendor_kpi`
> melihat angka yang benar, sementara order sungguhan — yang lahir dari checkout
> lalu ditugaskan lewat `assignVendor` — tidak. Fixture yang terlalu membantu
> menyembunyikan bug yang seharusnya dijaganya.
>
> `tests/integration/vendor-margin.test.ts` (6 tes) karena itu **sengaja tidak
> memakai fixture itu**: ia menyusun ordernya sendiri tanpa kolomnya, persis
> seperti `create_guest_order`. Salah satu tesnya merekam bug-nya secara
> eksplisit, supaya kalau penyalinan itu dicabut lagi, yang merah adalah tes
> yang menjelaskan sebabnya.

### UI CRUD: enam layar berhenti mendorong halaman ke bawah

Keluhan: form create/read/update/delete "muncul ke bawah" dan menggeser isi
halaman. Enam layar memakai pola itu — bukan satu:

| Layar | Yang berubah |
| --- | --- |
| Katalog paket | Tambah, Edit, Hapus → modal |
| Hewan per order | Tambah → modal; **hapus kini bertanya dulu** |
| Pembayaran | Catat → modal |
| Mitra | Daftarkan → modal; hapus → dialog |
| Jadwal | Atur/ubah → modal |
| Modal mitra | Tambah penawaran → modal |

Markup dialog ternyata tersalin **delapan kali** di `features/`, dan pekerjaan
ini akan menambah enam lagi. Jadi dibuat primitif `components/ui/modal.tsx`
(`Modal` + `ConfirmModal`) lebih dulu. Yang dihindari bukan pengulangan
hurufnya, melainkan penyimpangannya: satu salinan yang lupa
`max-h-[90dvh] overflow-y-auto` menghasilkan dialog terpotong di layar pendek,
tanpa satu pun galat.

Delapan dialog lama (akun, lokasi, kendala, laporan) **belum** dimigrasikan ke
primitif itu — tidak ada yang rusak selama belum, tetapi itu utang yang layak
diselesaikan sebelum salinan kesembilan lahir.

**Dua temuan di jalan:** hapus hewan sebelumnya **tanpa penegasan sama sekali**
— satu klik pada ikon kecil dan ekornya hilang beserta kode & beratnya. Dan
dialog hapus mitra kini menyesuaikan diri: bila mitra sedang mengerjakan order,
ia menyebutkan jumlahnya dan menjelaskan bahwa database akan menolak.

---

## Perubahan 21 September — katering, cloud disamakan, `docs/` disinkronkan

### Pemesanan katering — Tahap 1–5 ditulis

Checkout publik kini melayani **katering tanpa aqiqah** lewat
`/checkout/katering`. Rute & form terpisah, bukan cabang di `/checkout`:
pesanan aqiqah melahirkan baris `animals` dan segala yang mengalir darinya,
katering tidak punya satu pun dari itu.

**Tiga keputusan pemilik** (`docs/29 §2`): tahap `persiapan` dibiarkan;
bukti masak **tidak wajib** untuk katering; satu order **boleh memuat beberapa
paket** sekaligus.

K2 tidak dikerjakan dengan menurunkan `stage_requirements.min_docs` — tabel itu
berlaku global per tahap, jadi menurunkannya akan ikut melepas gerbang bukti
masak **seluruh order aqiqah yang sudah berjalan**, tanpa satu pun galat.
Gerbangnya yang diajari membedakan: `missing_doc_stages` melewati `masak` bila
`is_catering_order(o.id)`.

Yang **tidak** perlu diubah, dan ini temuan paling menghemat: urutan tahap.
Cabang `sembelih` mengambil barisnya dari tabel hewan, jadi order tanpa hewan
menghasilkan nol baris sembelih dengan sendirinya → `persiapan → masak → kirim
→ terkirim`. Nol perubahan pada `fulfilment_sequence()` maupun kembarannya di
TypeScript.

✅ **Terverifikasi terhadap database.** Ketiga migration jalan bersih lewat
`db reset`, `types/database.ts` di-generate ulang (suntingan tangan sementara
tertimpa, sebagaimana mestinya), dan `catering-rpc.test.ts` **19/19 hijau** —
termasuk yang membuktikan nol baris `animals`, tahapnya persis empat, dan
`masak` tidak muncul di `missing_doc_stages`.

### Tujuh tes integrasi yang ternyata sudah patah sejak 8 September

Menjalankan `test:integration` untuk pertama kalinya sejak Docker hidup
membongkar kerusakan yang **tidak ada hubungannya dengan katering**:

| Berkas | Patah | Sebab |
| --- | ---: | --- |
| `notification-outbox` | 5 | Menyisipkan `documentations` tanpa `stage_event_id` |
| `rls` | 1 | Sama |
| `full-flow` | 1 | Sama |

Ketiganya lahir sebelum `20260908030000` membuat `stage_event_id` NOT NULL, dan
**tidak ada yang tahu selama dua pekan** karena tes integrasi tidak pernah
dijalankan — `TASKS.md` mencatatnya "TIDAK dijalankan" pada tiga pembaruan
berturut-turut.

Diperbaiki lewat satu helper baru `attachDoc()` di `helpers/fixtures.ts`, yang
menurunkan `stage` dari baris tahapnya (cermin `enforce_documentation_stage_match`)
dan meng-cast antar enum — `doc_stage` & `fulfilment_stage` bernilai sama tapi
bertipe beda, dan Postgres tidak meng-cast otomatis.

> **Pelajaran yang sama bentuknya dengan daftar `DOCS` yang tidak lengkap:**
> penjaga yang tidak pernah dijalankan bukan penjaga. Ia memberi kesan terjaga
> sambil membiarkan kerusakan menumpuk — dan makin lama tidak dijalankan, makin
> sulit membedakan mana yang rusak karena pekerjaan hari ini dan mana yang sudah
> rusak sejak dulu.

### Cloud & dokumentasi

**Cloud: 53/53 tercatat, skema terverifikasi, data utuh.** Prioritas 0 (§11)
tuntas — rinciannya di §11 beserta catatan push yang layak dibaca sebelum
`db push` berikutnya.

### Sinkronisasi `docs/` ke kode

Tidak ada perubahan perilaku. Yang dikerjakan: menelusuri seluruh migration sejak
reset 20 Agustus dan alur checkout end-to-end, lalu membetulkan `docs/` yang
tertinggal di belakangnya.

**Yang diperbaiki — docs salah, kode benar:**

| Dokumen | Yang salah                                                            |
| ------- | --------------------------------------------------------------------- |
| `05`    | Gerbang tahap masih `validated`; `doc_stage` masih memuat `umum`; "35 fungsi, 41 trigger" (sebenarnya 40/46); "42 migration, 42/42 di cloud" |
| `07`    | Tiga kebocoran akun mitra (8 Sept) tidak tercatat; `locations` masih superadmin-only |
| `08`    | Gerbang tahap masih `validated`; aktor `terkirim` tertulis pembeli (sebenarnya vendor melapor, pembeli mengonfirmasi terpisah) |
| `09`    | Masih membagi dashboard per cabang & lima role — yang dibangun satu dashboard yang isinya ditentukan RLS |
| `16`    | **Merancang REST API yang tidak pernah dibangun.** Hanya 2 route handler ada; kontraknya 54 Server Action |
| `20`    | Masih mencentang "6 role" dan scoping `branch_id`                     |

**Dua komentar kode yang menyesatkan** ikut dibetulkan: `server/actions/checkout.ts`
dan `features/checkout/schema.ts` masih menerangkan `branch_id`/`branches.is_default`
sebagai perilaku berjalan, padahal tabelnya dihapus 20 Agustus.

**Penjaga diperluas** (`tests/unit/docs-schema-sync.test.ts`, 11 → 17 tes): daftar
`DOCS` kini memuat `09`, `16`, `20` — ketiganya luput dari daftar semula dan
karena itu basi tiga bulan lebih lama daripada 05–08. Tiga pemeriksaan baru
menjaga gerbang tahap, pencabutan `umum`, dan kembaran urutan tahap SQL ↔ TypeScript.

> **Pelajaran yang layak dicatat:** daftar penjaga yang tidak lengkap lebih buruk
> daripada tidak ada penjaga — ia menjaga sebagian sambil memberi kesan seluruhnya
> terjaga, jadi tidak ada yang curiga.

**Belum dikerjakan (utang yang sengaja ditinggal):** 17 dokumen masih v1.0 (14 Juni)
berstatus Draft — `01`–`04`, `10`–`15`, `17`–`19`, `21`–`25`. Sebagian menggambarkan
rencana yang memang belum dibangun (PWA, AI Layer, chatbot), jadi basinya tidak
menyesatkan dengan cara yang sama. Yang paling layak menyusul: **`10_DOCUMENTATION_FLOW`**
(masih validasi dua tingkat) dan **`15_PAGE_MAP`** (masih rute per cabang).

---

## Perubahan 8–11 September

Enam belas commit dan sembilan migration sesudah pembaruan 7 September. Porosnya
satu: **halaman detail order dan pelaporan tahap** — yang selama ini benar secara
database tetapi menuntut operator menebak apa yang harus dikerjakan sekarang.
Tiga kebocoran pada akun mitra ikut ditemukan dan ditutup di jalan.

### Tiga kebocoran & satu kebutaan pada akun mitra (`20260908010000`)

Ditemukan saat menelusuri apa yang **benar-benar** terbaca akun vendor, bukan apa
yang seharusnya. Dibuktikan lewat impersonasi (`set_config('request.jwt.claims', …)`)
di dalam transaksi yang di-rollback. Keadaan sebelum perbaikan, untuk akun mitra
pemilik dua order:

```
orders terbaca      : 2
v_open_orders       : 0     <-- kosong, padahal ordernya dua
locations           : 4     <-- seluruhnya, termasuk milik mitra lain
participants        : 0     (benar — memang tertutup)
```

**1. Dashboard mitra kosong permanen.** `v_open_orders` memakai
`join public.participants` — inner join. `participants_select` menuntut
`is_staff()` dan view-nya `security_invoker`, jadi bagi mitra tabel itu kosong dan
inner join menghapus **setiap** baris. Halaman berjudul "Order yang ditugaskan
kepada Anda" tidak pernah menampilkan satu pun order. `left join` menjawab keduanya
sekaligus: barisnya tetap ada, `participant_name`/`participant_phone` bernilai NULL
bagi yang tidak berhak — penyaringan PII tetap dikerjakan RLS, bukan oleh view.

**2. Bucket dokumentasi tidak ter-scope.** `storage_documentation_read` memberi
SELECT atas **seluruh** bucket kepada siapa pun yang login. Komentar migration
aslinya menyerahkan pembatasan folder ke `isDocPathForOrder` di server action —
tetapi itu hanya menjaga jalur **tulis**. Klien Supabase di browser sudah dipakai
untuk mengunggah, jadi `storage.from('documentation').list()` dari sana melewatinya
sepenuhnya: satu mitra bisa membaca foto lapangan mitra lain. Ditutup dengan
men-scope lewat `split_part(name, '/', 3)` — segmen ketiga adalah nomor order,
nilai yang unik global dan beku seumur hidup order.

**3. Seluruh lokasi terbaca setiap mitra.** `locations_select` memakai
`using (true)`: tiap mitra membaca nama dan alamat seluruh fasilitas di sistem,
termasuk milik pesaingnya. Kini yang terbuka hanya lokasi tanpa pemilik (masjid,
panti, tempat salur umum) dan miliknya sendiri.

> **Kenapa view-nya ditulis ulang utuh.** `create or replace view` menolak
> perubahan pada daftar kolom maupun bentuk join, jadi ia harus di-drop dulu.
> Grant-nya dipulihkan eksplisit: `20260820001000_grants.sql` memberikannya lewat
> `on all tables in schema public`, yang hanya berlaku atas view yang **ada** saat
> itu — yang lahir sesudahnya tidak ikut.

### Bukti wajib menempel pada laporan tahap (`20260908020000` & `20260908030000`)

Dua migration, satu keputusan: **bukti tidak lagi mengambang**.

`documentations.stage_event_id` sudah ada sejak 20 Agustus beserta triggernya,
tetapi **tidak pernah diisi** — `uploadDocumentation` mengabaikannya, dan panel
Dokumentasi yang berdiri sendiri memang tidak tahu tahap mana yang sedang
dibuktikan. Buktinya terikat ke order, bukan ke pekerjaan yang dibuktikannya.

Kini kolomnya `not null`. Yang ikut berubah dan **harus** ikut: `on delete set null`
tidak bisa hidup bersama NOT NULL — menghapus laporan tahap akan mencoba
mengosongkan tautannya dan menabrak constraint, sehingga penghapusan yang sah justru
gagal. Diganti `cascade`, sebab bukti bagi laporan yang sudah tidak ada adalah bukti
yatim yang tetap terhitung di gerbang kelengkapan — dan itu membuat gerbangnya
berbohong.

`umum` ikut dicabut dari enum `doc_stage`. `fulfilment_stage` tidak punya nilai itu,
dan `enforce_documentation_stage_match` menuntut keduanya sama — jadi begitu
`stage_event_id` wajib, `umum` tidak akan pernah bisa lolos. Membiarkannya di enum
berarti TypeScript terus menawarkannya sebagai pilihan yang sah: di layar tampak
boleh, di database pasti ditolak.

> **Konsekuensi yang diterima, bukan efek samping.** Bukti tidak bisa lagi diunggah
> sebelum mitra ditugaskan, sebab baris tahap baru terbit di situ. Jalur "admin
> mengunggah bukti umum lebih awal" ditutup dengan sadar.

Produksi diperiksa lebih dulu: **nol baris** `documentations`, dan seed tidak
menyisipkannya sama sekali. Baris warisan di mesin dev dibuang — bukan ditebak ke
tahap mana pun.

### Gerbang urutan tahap dilonggarkan (`20260908040000`)

Aturan lama menutup tahap ke-N sampai seluruh tahap sebelumnya **tervalidasi
admin**. Migration aslinya (`20260820000400`) sudah menuliskan konsekuensinya dan
menyiapkan jalan keluarnya:

> _"Konsekuensinya nyata — admin jadi penghambat di tiap tahap. Kalau lapangan
> mengeluh, longgarkan ke `status in ('reported','validated')`; satu baris. Mulai
> ketat lebih murah daripada mengetatkan setelah orang terlanjur terbiasa longgar."_

Lapangan mengeluh. Ini jalan keluar itu, persis seperti yang disiapkan — mitra
tidak lagi menunggu admin di tiap tahap; selesai melaporkan sembelih ia bisa
langsung melaporkan masak.

Yang **tidak** berubah, dan itu disengaja:

1. Tahap `pending` masih menahan tahap sesudahnya — urutan yang mustahil tetap ditolak
2. Tahap **`rejected` tetap menahan** — melanjutkan di atas dasar yang admin sudah bilang salah tidak masuk akal
3. Pemisahan tugas (`enforce_stage_review`) tidak tersentuh
4. Gerbang kelengkapan bukti tetap menuntut bukti **`approved`** — melonggarkan urutan kerja tidak berarti melonggarkan apa yang tercetak di laporan peserta

`canReportStage` di TypeScript diubah dalam commit yang sama: kalau keduanya
menyimpang, tombol di layar menawarkan sesuatu yang database tolak — atau
sebaliknya, menyembunyikan yang sebenarnya boleh.

### Notifikasi ditutup sendiri begitu pekerjaannya selesai (`20260908050000`)

Outbox hanya tahu cara **menerbitkan** notifikasi, tidak pernah tahu kapan ia
berhenti relevan. Barisnya bertahan `queued` sampai ada admin yang menekan centang
manual — dan tidak ada yang menekan centang untuk pekerjaan yang sudah ia kerjakan
lewat jalan lain. Terlihat langsung di produksi:

```
guest_order_new  IA-202609-0003  order sudah `assigned`     <-- sudah diverifikasi
guest_order_new  IA-202609-0002  order sudah `in_progress`  <-- sudah diverifikasi
guest_order_new  IA-202609-0001  order sudah `cancelled`    <-- tidak akan pernah diverifikasi
```

Tiga dari empat barisnya menuntut tindakan yang sudah tidak ada. **Panel yang isinya
sebagian besar tugas semu berhenti dibaca, dan tugas yang sungguhan ikut tenggelam
bersamanya.**

Tiga trigger baru menutupnya lewat satu fungsi bersama
(`close_dashboard_notification`): order tamu diverifikasi/dibatalkan, bukti
diputuskan (disetujui **maupun** ditolak), kendala `high` diselesaikan. Yang
terlanjur basi dibersihkan sekali di akhir migration.

> **`sent`, bukan nilai enum baru.** Bagi kanal `dashboard` tidak ada yang
> benar-benar "dikirim" — `markNotificationSent` sudah memakainya untuk menandai
> "sudah ditangani". Menambah nilai enum berarti menyentuh setiap pembacaan status
> demi perbedaan yang tidak dipakai siapa pun.
>
> Yang **tidak** ditutup otomatis: kanal WhatsApp/email. Baris itu menunggu
> benar-benar terkirim ke pemesan, dan pengirimannya belum dibangun (Tahap 8).
> Menutupnya di sini berarti menyatakan pesan terkirim padahal tidak pernah ada yang
> mengirimnya.

### Halaman detail order disusun per fase

Halaman merender sembilan panel sekaligus, **semuanya terbuka penuh apa pun status
ordernya** — jadi pada order yang baru masuk, panel Dokumentasi dan Laporan ikut
memenuhi layar padahal keduanya baru berguna berminggu-minggu kemudian. Admin harus
menggulir melewati semuanya untuk menemukan satu form yang benar-benar perlu diisi
sekarang.

- **`next-step.ts`** menjawab "apa yang harus dikerjakan sekarang" sebagai satu
  kalimat perintah plus panel tujuannya. `blockers` diambil **apa adanya** dari
  `guard` state machine, jadi layar dan penolakan server tidak pernah berbeda kalimat
- **`PhaseSection`** melipat panel yang di luar fase. **Dilipat, bukan
  disembunyikan**: memeriksa pembayaran saat order sudah di tahap lapangan adalah hal
  yang wajar, dan panel yang lenyap sama sekali membuat orang mengira datanya hilang.
  Ringkasan satu baris tetap terbaca dalam keadaan terlipat
- Sengaja `<details>` bawaan peramban, bukan state React — bisa dibuka sebelum
  JavaScript termuat, isinya tetap ditemukan Ctrl+F, dan keyboard sudah bekerja tanpa
  satu baris pun penanganan tombol

### Antrean validasi: satu kartu, satu keputusan

Antrean lama per-foto lintas order membuat admin menyetujui sebuah foto **tanpa
melihat laporan yang dibuktikannya**, lalu memvalidasi laporannya di halaman lain
**tanpa melihat fotonya**. Dua keputusan terpisah untuk satu pekerjaan, dan tidak
satu pun punya konteks yang utuh.

`StageQueue` menggantikannya: satu kartu = satu laporan tahap **beserta buktinya**.
Memvalidasi tahapnya sekaligus menyetujui bukti yang menyertainya (`reviewStage`
yang mengerjakannya), jadi yang ditekan admin cuma satu tombol.
`validation-queue.tsx` & `documentation-manager.tsx` dihapus.

### Foto masuk ke form laporan tahap dan jadi wajib

Dulu dua langkah untuk satu pekerjaan: isi laporan, lalu tekan "Tambah bukti"
terpisah. Yang lupa langkah kedua meninggalkan tahap yang **tampak selesai tanpa
bukti** — baru ketahuan saat gerbang Pelaporan menolaknya berhari-hari kemudian.

Foto kini medan di dalam form, wajib, dan **diunggah lebih dulu**: kalau dibalik,
kegagalan unggah meninggalkan persis keadaan itu. Bukti yang sudah ada boleh
disimpan ulang tanpa foto baru; yang ditolak admin tidak dihitung. "Tambah bukti"
hanya muncul sesudah tahapnya dilaporkan.

### Baris tahap per ekor bisa dibedakan

Order dua ekor menampilkan "Sembelih" dua kali. Pembedanya `tag_code` — tapi kolom
itu opsional dan **keempat hewan di produksi bernilai null**, jadi kedua baris
tampak identik. Ketika satu punya tombol Laporkan dan satunya tidak, itu terbaca
sebagai tombol yang hilang tanpa sebab.

Badge "Ekor 1/2" saat tag kosong, dan penahannya disebut namanya: "Menunggu Sembelih
dilaporkan lebih dulu", bukan "tahap sebelumnya".

### Sertifikat aqiqah (`20260910020000`)

Lembar yang diberikan kepada keluarga — **berbeda tujuan dari laporan peserta**, dan
itu menentukan seluruh bentuknya. Laporan **membuktikan** pekerjaan: tahap, foto
lapangan, dibaca sekali lalu diarsipkan. Sertifikat **dikenang**: dicetak, dibingkai,
disimpan bertahun-tahun. Jadi ia landscape satu halaman, isinya sedikit, dan tidak
memuat satu pun angka operasional.

**Satu per anak, bukan per ekor.** Aqiqah anak laki-laki memakai dua kambing atas
nama anak yang sama — di produksi persis begitu: `IA-202609-0002` punya dua baris
`animals` dengan `on_behalf_of` identik. Hewannya dikelompokkan per nama dan disebut
di dalam lembar yang sama ("2 ekor kambing").

**Foto anak jadi kolom di `orders`, bukan baris `documentations`.** Sejak
`20260908030000` tiap dokumentasi wajib terikat satu laporan tahap — dan foto anak
bukan bukti pelaksanaan tahap mana pun. Memaksanya masuk ke sana berarti mengendurkan
lagi keterikatan yang baru saja diperketat. Path-nya tetap mengikuti pola bucket
`documentation` (`{YYYY}/{MM}/{order_number}/anak/{uuid}.{ext}`), jadi
`storage_documentation_read` yang men-scope lewat segmen ketiga ikut berlaku tanpa
diubah.

### Laporan tidak bisa dibuat ulang — bug produksi (`20260910010000`)

`generateReport` mengunggah dengan `upsert: true`, dan `upsert` di Storage adalah
**UPDATE** terhadap baris `storage.objects` yang sudah ada — bukan INSERT. Bucket
`reports` hanya punya policy SELECT dan INSERT, jadi setiap penimpaan ditolak RLS.

Akibatnya di produksi: PDF versi 1 order `IA-202609-0002` sudah terunggah (2,5 MB),
tetapi barisnya **tidak pernah masuk tabel `reports`** karena aksinya berhenti di
unggah. Percobaan berikutnya menghitung `nextVersion` dari tabel yang kosong, jadi
selalu v1 — path yang sama, ditolak lagi. **Order yang pekerjaannya sudah lengkap
terkunci permanen** dengan pesan "Gagal menyimpan PDF laporan".

Dibuktikan terhadap produksi sebagai superadmin sungguhan:

```
POST x-upsert ke path baru        -> 200
POST x-upsert ke path yang ada    -> 403 "new row violates RLS policy"
```

Kewenangannya disamakan dengan INSERT-nya (`is_staff()`): yang boleh membuat laporan
boleh pula membuatnya ulang. Menaikkannya ke superadmin akan membuat admin bisa
membuat v1 tapi tidak bisa mengulanginya saat render pertama menghasilkan berkas yang
keliru. `storage-upsert-policies.test.ts` menjaganya — tesnya memindai kode untuk
tiap bucket yang di-`upsert` lalu menuntut policy UPDATE-nya ada.

### Lokasi bisa didaftarkan staf (`20260907020000`)

`locations_write` menuntut `is_superadmin()`, dan sampai hari itu **tidak ada satu
pun jalan masuk lewat aplikasi**: tidak ada halaman, tidak ada server action, tidak
ada form. Barisnya hanya lahir dari seed.

Itu tidak berkelanjutan justru karena sifat datanya: lokasi salur berganti hampir
tiap order — masjid, panti, kampung penerima manfaat yang berbeda-beda — sementara
yang tahu tempatnya adalah admin yang sedang menjadwalkan order itu. Yang terjadi
selama pintunya tertutup bukan "admin meminta tolong superadmin", melainkan **alamat
ditulis di kolom catatan jadwal**: di luar jangkauan `v_open_orders`, di luar laporan
peserta, dan tidak bisa dipakai ulang order berikutnya.

Kebijakannya dipecah per operasi: `insert`/`update` → staf, `delete` → superadmin.
Menghapus tetap berhenti di superadmin sebab `orders` dan `schedules` menahan lokasi
lewat rujukan, dan menghapus tempat yang sudah dipakai order lama memutus jejak ke
mana hewan itu disalurkan.

### Akun sendiri & lupa sandi

- **`/profil`** — ganti email & kata sandi sendiri. Sandi sekarang **wajib
  dibuktikan lebih dulu**: `supabase.auth.updateUser()` menerima sesi yang sudah
  hidup tanpa menanyakan apa pun, jadi tanpa pemeriksaan ini laptop yang ditinggal
  terbuka sebentar cukup untuk mengganti sandi dan email pemiliknya — mengunci dia
  keluar dari akunnya sendiri, permanen
- **Klien sekali pakai tanpa cookie** untuk pemeriksaan itu, dan itu bukan kerapian
  belaka: klien server biasa menulis cookie sesi, jadi memakainya untuk
  `signInWithPassword` akan menimpa sesi yang sedang berjalan — dan ketika sandinya
  ternyata salah, pemanggilnya justru terlempar keluar
- **`/lupa-sandi` & `/atur-sandi`** — jalur reset lewat email
- **`AuthShell`** menyatukan latar & logo ketiga halaman auth; `auth-shell.test.ts`
  menuntut tidak ada halaman yang menyusun latarnya sendiri
- **`20260910030000`** — `profiles.email` diselaraskan lewat trigger saat email login
  berpindah. `auth.users` punya `on_auth_user_created` untuk saat akun **dibuat**,
  tapi nol trigger untuk saat email itu **berubah**, jadi `profiles.email` membeku
  pada alamat lama selamanya. Bukan sekadar tampilan basi: nilai itu jadi nilai awal
  form saat superadmin menyunting akun orang lain, jadi menyimpan form akan
  **mengembalikan email login ke alamat lama** tanpa ia bermaksud demikian. Ditulis
  di database sebab perpindahan email tidak selesai di server action — Supabase baru
  memindahkannya saat tautan konfirmasi diklik, di lain waktu, tanpa melewati kode
  kita. `when (old.email is distinct from new.email)` menyaring di database:
  `auth.users` ikut ter-UPDATE tiap login dan tiap refresh token

### Umpan balik: tombol & navigasi mengatakan dirinya sedang bekerja

78 tombol memakai `disabled={pending}` — mati saat ditekan tapi **diam**, dan mati
tanpa berkata apa-apa terbaca sama persis dengan rusak.

- `BusyButton` mengganti ikon dengan spinner (lebar tombol tidak berubah) + `aria-busy`
- `RouteProgress` memakai `useLinkStatus` Next 16 untuk garis progres saat berpindah halaman
- **Semuanya tertunda 120ms** — aksi yang selesai sekejap tidak berkedip
- **`loading.tsx` untuk enam rute** yang belum punya. Hanya dashboard yang punya;
  rute lain menahan navigasi sampai seluruh query selesai sementara peramban masih
  menampilkan halaman sebelumnya — operator tidak bisa membedakan "sedang dimuat"
  dari "kliknya tidak masuk"

### Dua bug yang dampaknya sampai ke pembeli

**Input angka berubah saat halaman digulir.** `type=number` menangkap roda tetikus
selama terfokus, jadi mengetik `100` lalu menggulir turun diam-diam mengubahnya jadi
`90` — **tanpa tanda apa pun di layar**. Kena 16 medan di 8 berkas, termasuk jumlah
ekor di checkout yang diisi pembeli. `NumberInput` melepas fokus alih-alih
`preventDefault()`, supaya halaman tetap bisa digulir; tombol panah papan ketik tidak
disentuh — itu tindakan yang disengaja. Tesnya memindai seluruh `.tsx` dan gagal bila
`type=number` polos muncul lagi.

**Rujukan dokumen internal bocor ke layar.** Dua kalimat di halaman detail order
menyebut nomor dokumen spesifikasi dan istilah "state machine" — dirender untuk
admin, superadmin, **dan mitra**. Bagi mereka itu bukan keterangan melainkan kode
yang tidak bisa ditindaklanjuti: tidak ada dokumen itu yang bisa mereka buka.
Kalimat seperti itu lahir saat fitur dibangun sambil menengok spesifikasi, dan
bertahan karena tidak ada yang menyalahkan — build lolos, tes lolos, layar tetap
tampil; yang menemukan biasanya pengguna, di produksi. `no-internal-jargon.test.ts`
menjaganya, dan yang dijaga **teks yang dirender, bukan komentar** — komentar justru
tempat yang benar untuk menyebut nomor dokumennya.

### `VIEW_ORDER_FINANCE` — kapabilitas yang RLS tidak bisa jawab

Angka uang sebuah order (nilai total, harga satuan, subtotal) dipisah dari
`RECORD_PAYMENT`: yang ini soal **membaca**, bukan mencatat.

Perlu ada justru karena RLS tidak bisa menjawabnya. `orders_select` memakai
`can_read_order`, jadi mitra memang membaca baris ordernya **termasuk
`total_amount`** — kebijakan **baris** tidak bisa menahan satu **kolom**. Yang
menahannya di layar adalah kapabilitas ini. Sejalan dengan `payments_select` yang
menuntut `is_staff()`, dan dengan `vendor_services` yang ditutup justru supaya margin
tidak terbaca mitra.

### Rapi-rapi & lain-lain

- **Hapus laporan** (`deleteReport` + dialog konfirmasi) — sebelumnya laporan yang
  salah hanya bisa ditumpuk versi baru
- **CRUD lokasi lewat aplikasi** — dialog tambah/sunting/hapus di panel Jadwal
- **`CurrencyInput`** memformat rupiah saat diketik
- **Dashboard mobile** dirombak: filter & tabel order dibuat terbaca di layar kecil
- **Animasi pending di `alert-actions`** — tombol panel "Perlu Tindakan"
- **`features/checkout/address.ts`** dipisah dari `address-picker`. `draft.ts`
  mengimpor satu **tipe** dari sana, yang menyeret `lucide-react`, Base UI, dan empat
  komponen UI; tesnya memanggil `resetModules()` tiap kasus, jadi rantai itu dimuat
  ulang belasan kali dan sesekali menembus batas 5 detik — flake yang muncul tiga
  kali. Waktu impor **~2s → ~125ms**

### Tes bertambah 209 unit

**764 unit (65 berkas)** dari 555/41. **24 berkas baru**, di antaranya:

| Berkas                                | Cakupan                                                                                               |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `order-next-step.test.ts`             | Kalimat perintah & panel tujuan per status; `blockers` sama persis dengan `guard`                     |
| `stage-report-with-photo.test.tsx`    | Foto wajib di form laporan; urutan unggah-lebih-dulu; bukti lama boleh disimpan ulang                 |
| `stage-panel-multi-animal.test.tsx`   | Badge "Ekor 1/2" saat `tag_code` null; penahan menyebut nama tahapnya                                 |
| `number-input.test.tsx`               | Roda tetikus tidak mengubah nilai; **memindai seluruh `.tsx`** agar `type=number` polos tidak kembali |
| `no-internal-jargon.test.ts`          | Rujukan dokumen internal & nama komponen tidak sampai ke teks yang dirender                           |
| `storage-upsert-policies.test.ts`     | Tiap bucket yang di-`upsert` di kode punya policy UPDATE                                              |
| `certificate.test.tsx`                | Satu sertifikat per anak (bukan per ekor); dua wujud berbagi satu tata letak                          |
| `own-account.test.ts`                 | Sandi lama wajib dibuktikan; klien pemeriksa tidak menyentuh cookie sesi                              |
| `password-reset.test.ts`              | Jalur `/lupa-sandi` → `/atur-sandi`                                                                   |
| `auth-shell.test.ts`                  | Ketiga halaman auth memakai `AuthShell`, tidak menyusun latar/logo sendiri                            |
| `busy-button.test.tsx`                | Spinner menggantikan ikon tanpa mengubah lebar; tunda 120ms                                           |
| `payment-auto-advance.test.ts`        | Status order naik sendiri saat pembayaran lunas                                                       |
| `order-table-finance.test.tsx`        | Kolom uang tidak dirender tanpa `VIEW_ORDER_FINANCE`                                                  |
| `location-crud.test.tsx`              | Tambah/sunting/hapus lokasi; hapus berhenti di superadmin                                             |
| `documentation-upload-schema.test.ts` | `stage_event_id` wajib; `umum` bukan lagi nilai yang sah                                              |

Integrasi bertambah di berkas yang sudah ada — `notification-outbox.test.ts`
(penutupan otomatis ketiga template) dan `stage-gates.test.ts` (`reported` membuka
tahap berikutnya, `rejected` tetap menahan). Berkasnya kini memuat **151 tes di 11
berkas** menurut pembacaan statis.

> ⚠️ **Tes integrasi tidak dijalankan pada pembaruan ini.** Docker tidak hidup di
> mesin ini saat pemeriksaan, jadi angka di atas **dihitung dari berkasnya, bukan
> dari jalannya** — dan kesembilan migration baru **belum dibuktikan jalan bersih
> dari nol di lokal**. Ini satu-satunya angka di dokumen ini yang tidak berasal dari
> eksekusi; perlakukan sebagai belum terverifikasi sampai `npm run test:integration`
> benar-benar dijalankan.

### ⚠️ Status cloud tidak diketahui untuk kesembilan migration

Pembaruan 3 September mencatat **42/42 selaras**. Sembilan migration lahir sesudahnya
(`20260907020000` … `20260910030000`) dan **tidak ada catatan `db push` untuk satu
pun di antaranya** — sementara beberapa komentar migration menyebut pemeriksaan
langsung terhadap produksi (nol baris `documentations`, PDF 2,5 MB yang tersangkut,
tiga notifikasi basi), jadi sebagiannya mungkin sudah di sana.

**Yang mana sudah dan yang mana belum tidak bisa dipastikan dari repo ini.** Langkah
pertama sebelum apa pun: `supabase migration list` untuk melihat keadaannya, bukan
menebak. Dua di antaranya destruktif terhadap data
(`delete from public.documentations`), dan keduanya menyertakan catatan bahwa produksi
sudah diperiksa nol baris lebih dulu — **pemeriksaan itu perlu diulang sebelum push**,
sebab produksi sudah dipakai sejak.

---

## Perubahan 7 September

Penyempurnaan penguncian penugasan mitra (null-guard UUID), penyaringan menu navigasi berdasarkan peran (`navItemsForRole`), dan penetralan migration pembersihan data dummy untuk melindungi data transaksi produksi.

### 1. Fix Penguncian Optimistik `assignVendor` (`vendor_id IS NULL`)

Pada `server/actions/schedules.ts`, penugasan mitra pertama kali gagal karena PostgREST menerjemahkan `.eq('vendor_id', null)` menjadi `vendor_id=eq.null`. Postgres mencoba menguraikan string `"null"` sebagai `uuid` dan menghasilkan galat `22P02`.

- Diperbaiki dengan mengalihkan ke `.is('vendor_id', null)` jika `order.vendor_id === null`.
- Menjamin penugasan awal mitra berjalan lancar tanpa galat sintaksis UUID.
- Diuji dalam `tests/unit/assign-vendor-null-guard.test.ts` (4 unit test baru).

### 2. Penyaringan Navigasi Berdasarkan Peran (`navItemsForRole`)

Menu navigasi di `components/layout/nav-items.ts` kini disesuaikan dengan peran pengguna (`role`), selaras dengan aturan kapabilitas di `server/auth/capabilities.ts`:

- **Vendor**: Hanya melihat menu operasional (`/dashboard`, `/orders`, `/schedule`). Menu `/validation` disembunyikan karena vendor mengunggah bukti, tidak memvalidasi pekerjaannya sendiri.
- **Admin**: Melihat menu operasional + `/validation`, tetapi disembunyikan dari menu master data (`/vendors`, `/users`).
- **Superadmin**: Melihat seluruh 6 menu utama (`/dashboard`, `/orders`, `/schedule`, `/validation`, `/vendors`, `/users`).
- **Tanpa Role / Sesi Belum Siap**: Mengembalikan array kosong `[]` untuk mencegah render menu tak berizin.
- `MobileNav` & `SidebarNav` disesuaikan dan diuji lewat unit test (`tests/unit/sidebar-nav.test.ts` & `tests/unit/mobile-nav-render.test.ts`).

### 3. Penetralan Migration Pembersihan Dummy Orders (`20260906010000_delete_all_dummy_orders.sql`)

Migration `20260906010000_delete_all_dummy_orders.sql` sebelumnya berisi `DELETE FROM public.orders` tanpa syarat.

- Dinetralkan (sengaja tanpa SQL statement) agar tidak secara tidak sengaja menghapus pesanan sungguhan (seperti `IA-202609-0001` yang dibuat 7 September) saat migration dieksekusi di cloud/staging.
- Berkas migration tetap dipertahankan agar tidak merusak ledger versi migration Supabase.

### 4. Lingkup Berbagi Laporan & UI Detail Order

- Pengaturan scope berbagi laporan di `features/reporting/components/report-manager.tsx` disempurnakan dan diuji lewat unit test (`tests/unit/report-share-scope.test.tsx`).
- Halaman detail order (`app/(app)/orders/[id]/page.tsx`) diperbarui dengan guard null safety.

### Total Coverage Unit Test

- Unit test bertambah dari **519 (36 file)** menjadi **555 (41 file)**, seluruhnya hijau 100%.

---

## Perubahan 3 September

Katalog paket akhirnya bisa dikelola sendiri lewat aplikasi — **termasuk yang
tampil di halaman depan**. Satu migration baru (`20260903010000`), rute baru,
dan penghapusan 128 baris konstanta.

### Halaman depan berhenti jadi kembaran

Sampai hari ini `app/(site)/page.tsx` **tidak menyentuh database sama sekali**:
nama, harga, tagline, fitur, dan foto ketiga paket aqiqah beserta kelima nasi
box semuanya hardcode di `lib/constants/site.ts`. Keputusan yang wajar waktu itu
— halaman statis, nol query — tetapi daftar itu **kembaran** `services`, dan
keduanya dijaga sinkron oleh tangan.

Kembaran semacam itu menyimpang diam-diam. Buktinya sudah tercatat di §8:
`paket-c-favorit` & `paket-e-premium` membawa akhiran yang tidak pernah ada di
katalog. Yang membuatnya berbahaya bukan besarnya melainkan senyapnya —
`?paket=` dicocokkan sebagai slug, dan `checkout/page.tsx` **sengaja**
mengabaikan slug tak dikenal lalu jatuh ke paket pertama. Tidak ada galat, tidak
ada jejak; pengunjung mengira memesan Premium dan mendapat Ekonomi.

`20260903010000` menambah enam kolom ke `services` — `tagline`,
`landing_features`, `photo_path`, `photo_alt`, `is_popular`, `show_on_landing` —
lalu **menyalin isi `site.ts` apa adanya**, sehingga halaman depan tidak berubah
sedikit pun oleh migration ini. Yang berpindah hanya tempat tinggalnya.
`aqiqahPrograms` & `nasiBoxPackages` kemudian dihapus (128 baris); kembarannya
hilang, jadi seluruh kelas kekeliruan itu ikut hilang.

**Kolom eksplisit, bukan menumpang `meta`.** `meta` sudah dipakai untuk `hasil`,
`items`, dan `cocok_untuk` yang dibaca panel modal mitra; mencampur konten
pemasaran ke sana membuat satu kolom bebas menjawab dua pertanyaan berbeda, dan
tidak ada yang bisa divalidasi database.

**Lauk nasi box tetap dibaca dari `meta->items`**, tidak disalin ke
`landing_features`. Menyalinnya berarti mengulang persis kekeliruan yang baru
saja dihapus.

### Halaman depan tetap prerender statis

Ongkos yang hampir jadi dibayar. Percobaan pertama memakai
`lib/supabase/server.ts`, dan rute `/` **berubah dari `○` ke `ƒ`** di tabel
build — satu panggilan `cookies()` memaksa seluruh rute jadi dinamis.

Katalog adalah data publik yang dibaca `anon` lewat `services_select_public`;
tidak ada sesi yang perlu dibaca. Kliennya karena itu dirakit langsung dengan
`@supabase/supabase-js` tanpa cookie, dan `/` kembali `○`. Kesegarannya dijaga
`revalidatePath('/')` di server action katalog.

> **Ketahuan dari tabel rute build, bukan dari kodenya.** Tidak ada galat, dan
> halamannya tetap benar — yang berubah hanya kapan ia dirender.

### `/services` sempat berdiri sendiri, lalu disatukan ke `/vendors`

Dibuat sebagai halaman terpisah lebih dulu, lalu dipindah atas permintaan.
Alasannya bukan kerapian menu: modal mitra (`vendor_services`) menunjuk baris
katalog, dan margin lahir dari selisih keduanya — memisahkannya berarti operator
berpindah halaman untuk menjawab satu pertanyaan. Keduanya juga berbagi pintu
yang sama: superadmin, sebab harga jual dan harga modal sama-sama menentukan
margin.

Sekarang `/vendors` punya dua tab lewat `?tab=` (URL, bukan state — supaya
tautan bisa dibagikan dan tombol kembali bekerja).

### Menyunting paket pindah ke halaman sendiri

Keluhan yang tepat dan bukan soal selera: tombol "Sunting" berada di **baris
479**, formulirnya di **baris 218**. Menekannya membuka formulir jauh di atas
layar, di luar pandangan — tidak ada yang tampak berubah, jadi tombolnya terbaca
sebagai rusak.

Jalan keluarnya bukan menggulir otomatis. `/vendors/katalog/{id}` memberi tiga
hal yang tidak bisa diberikan formulir sisipan: URL yang bisa dibagikan dan
di-bookmark, tombol kembali peramban yang bekerja, dan ruang untuk yang tidak
muat di baris daftar — foto kartu serta kaitan paket ke order dan modal mitra.

Tombol per baris jadi **Lihat · Edit · Hapus**, dua yang pertama `<Link href>`
sehingga klik-tengah dan "buka di tab baru" ikut bekerja. **"Nonaktifkan" pindah
ke halaman detail**: di sana jumlah order yang memakai paket sudah terbaca, jadi
tombolnya bisa menjelaskan diri sebelum ditekan alih-alih menolak sesudahnya —
pola yang sama dengan `VendorActiveToggle`.

Formulir "Tambah paket" **tetap** di daftar: paket baru belum punya id, jadi
tidak ada URL yang bisa dituju, dan tombolnya memang sudah berada tepat di atas
formulirnya.

> **Rute bersarang di bawah rute dinamis.** `/vendors/katalog/{id}` hidup
> berdampingan dengan `/vendors/[id]` karena Next mendahulukan segmen harfiah.
> Diuji juga `/vendors/katalog` **tanpa id**: ia jatuh ke `/vendors/[id]` dengan
> id `"katalog"`, Postgres menolaknya (`22P02`), `.maybeSingle()` mengembalikan
> `null`, halaman memanggil `notFound()`. Hasilnya **404**, bukan halaman rusak.

### Foto katalog diunggah lewat aplikasi

Bucket `public-assets` sudah ada sejak 20 Agustus — publik, write-nya superadmin
— dan **nol pemakai** sampai hari ini. Foto diunggah langsung dari peramban ke
Storage seperti bukti pembayaran; yang lewat server action hanyalah path-nya,
jadi berkas 5 MB tidak menempuh dua kali perjalanan.

`SitePhoto` kini melayani dua sumber: `images/…` adalah berkas bawaan repo di
`public/`, selainnya object path di bucket. Bucket ini **publik dan itu
disengaja** — foto pemasaran memang untuk dipajang ke pengunjung anonim, dan
menandatanganinya berarti URL yang kedaluwarsa di tengah kunjungan. Berbeda
dengan dokumentasi lapangan yang privat dan selalu lewat signed URL.

`svg` & `ico` sengaja **tidak** diterima meski bucket mengizinkannya: SVG dokumen
yang bisa memuat `<script>`, dan berkas ini disajikan dari origin yang sama
dengan aplikasi.

### `show_on_landing` terpisah dari `is_active`

Dua pertanyaan berbeda: `is_active` menentukan paket masih bisa dipesan,
`show_on_landing` menentukan ia dipajang. Paket musiman bisa tetap dipesan lewat
tautan langsung tanpa memenuhi halaman depan.

Constraint `services_landing_requires_active` menolak kombinasi mustahil —
dipasarkan tapi non-aktif berarti tombol "Pesan" yang membawa ke checkout tanpa
paketnya. `setServiceActive()` menurunkan keduanya bersamaan supaya operator
tidak menghadapi galat `23514` untuk maksud yang sudah jelas.

### Isi paket (`services.meta`) akhirnya bisa disunting

Ditemukan dari keluhan yang tepat: di panel modal mitra, kartu paket mencetak
"80 porsi · Olahan: gulai & sate · Cocok untuk keluarga kecil" — dan dari
semuanya **hanya harga yang bisa diubah**.

Penelusurannya menemukan hal yang sama dengan `vendor_coverage` sebelum 27
Agustus: `services.meta` **dibaca enam tempat** — landing, checkout, panel modal
mitra, daftar & detail katalog, `features/orders/queries.ts` — dan **ditulis
nol**. Nol `insert`, nol `update`; satu-satunya cara mengubahnya adalah dashboard
Supabase. Tabel dan pembacanya lahir duluan, layarnya tidak pernah menyusul.

Yang ditambahkan: blok **"Isi paket"** di formulir katalog, bentuknya
menyesuaikan jenis paket —

```
aqiqah   : porsi · ragam olahan · cocok untuk
nasi box : isi per box (satu lauk per baris)
```

Dua bentuk itu **sengaja tidak disatukan**: "80 porsi, olahan gulai & sate"
menjawab pertanyaan berbeda dari daftar lauk satu box, dan memaksa keduanya ke
satu bentuk membuat salah satunya terbaca janggal.

**Ditaruh di blok "Data paket", bukan "Tampilan halaman depan".** Isi paket
dibaca panel modal mitra juga — `/vendors/{id}` menampilkannya persis sebelum
modal diketik, sebab modal yang wajar untuk 80 porsi tidak wajar untuk 150. Jadi
ia berguna meski paketnya tidak dipasarkan.

> **Modal per paket sendiri sudah bisa diubah sejak 28 Agustus** — tombol "Ubah"
> per baris, lengkap dengan pratinjau margin sebelum disimpan. Yang hilang
> memang hanya isi paketnya.

#### Bug yang hampir ikut masuk: kunci `meta` yang lenyap diam-diam

`meta` memuat **lebih banyak** daripada yang dirender formulir — `paket-c`
membawa `favorit: true`, `paket-e` membawa `premium: true`, dan keduanya tidak
punya medan di layar. Merakit objek baru dari nol akan menghapusnya **setiap kali
seseorang menyimpan formulir**, tanpa satu pun galat: penandanya cuma lenyap dari
katalog.

`metaFrom()` karena itu membaca `meta` lama lebih dulu lalu menimpa kunci yang
memang disunting. Kunci yang dikosongkan **dibuang**, bukan disimpan sebagai
string kosong — `serviceDetails()` memeriksa keberadaan kunci, jadi
`{"cocok_untuk": ""}` akan mencetak baris kosong di kartu.

Dibuktikan lewat database sungguhan, bukan dari kodenya:

```
SEBELUM : {"items":[…6 lauk…],"favorit":true}
SESUDAH : {"items":["nasi putih","rendang","kerupuk"],"favorit":true}
favorit bertahan? YA
```

Data ujinya dipulihkan sesudahnya.

### Batas penawaran mitra — `min_qty` / `max_qty` / `lead_time_hours` / `notes`

Empat kolom di `vendor_services` yang **sudah ada sejak 20 Agustus** dan sampai
hari ini **nol dipakai** di seluruh `features/`, `server/`, dan `app/`. Pola
yang sama persis dengan `vendor_coverage` sebelum 27 Agustus: kolom lahir
duluan, layarnya tidak pernah menyusul.

Pembaginya satu pertanyaan — **berbeda tiap mitra atau tidak?**

```
vendor_services  modal · minimum · maks per hari · jeda persiapan · catatan
services         nama · harga jual · deskripsi · porsi · ragam olahan
```

"Maks 8 ekor/hari" memang milik mitra: satu sanggup 8, yang lain 30. Sebaliknya
"80 porsi, gulai & sate" tetap di katalog, sebab itu **janji kepada pembeli** di
halaman depan. Kalau tiap mitra bisa mengubahnya, pembeli membaca satu janji
lalu ordernya ditugaskan ke mitra yang menjanjikan hal lain — dan tidak ada yang
bisa menentukan mana yang benar.

Deskripsi tetap dirender di panel mitra (lewat **join**, bukan salinan) sebab
modal yang wajar untuk 80 porsi tidak wajar untuk 150. Nama paketnya kini
bertaut ke `/vendors/katalog/{id}` supaya jelas ke mana harus pergi untuk
mengubahnya.

> ⚠️ **Dicatat, belum menegakkan.** `max_qty` nol pembaca di checkout maupun
> `assignVendor`. Mitra berkapasitas 8 ekor/hari tetap bisa menerima order 20
> ekor tanpa penolakan apa pun. Angkanya baru berarti setelah ada yang
> membacanya — dan itu belum dikerjakan.

#### Bug yang hampir ikut masuk: `upsert` menghapus yang tak disebut

`saveVendorService` memakai `upsert`, dan `upsert` menulis **seluruh baris**.
Medan yang tidak disebut tertimpa nilai bawaannya — jadi kapasitas dan catatan
kesepakatan akan **lenyap tiap kali seseorang membetulkan harga saja**, tanpa
satu pun galat.

Tombol Simpan karena itu selalu mengirim keempatnya. Dibuktikan lewat database
sungguhan:

```
SEBELUM : harga 2.325.000 · maks 100 · "Kambing jantan saja."
SESUDAH : harga 1.750.000 · maks 100 · "Kambing jantan saja."
```

#### Porsi vs kapasitas — dua angka yang sempat tertukar

Label kapasitas mitra mula-mula ditulis **"maks 100 box"** untuk paket
**aqiqah** yang dipesan per **ekor**. Dua kekeliruan dalam satu contoh, dan
keduanya terbaca masuk akal — itu sebabnya berbahaya.

Yang benar, dan sudah dimodelkan sistem sejak awal:

|                             | Satuan     | Arti                                                                       |
| --------------------------- | ---------- | -------------------------------------------------------------------------- |
| `services.meta.hasil.porsi` | porsi      | hasil **satu ekor**; keterangan untuk pembeli, **tidak** membatasi pesanan |
| `vendor_services.max_qty`   | ekor / box | berapa yang sanggup dikerjakan mitra per hari                              |

Nasi box adalah **paket tersendiri** dengan harga sendiri — checkout memesannya
lewat `nasi_box_service_id` + `nasi_box_qty` yang terpisah dari `qty` ekor. Ia
bukan turunan paket aqiqah.

Label diperbaiki: "Perkiraan porsi **per ekor**" dengan keterangan _"bukan batas
pesanan"_, "Harga jual (Rp **per ekor/box**)", dan "Maks per hari **(ekor)**"
yang satuannya mengikuti jenis paket lewat `unitOf()`.

### Umpan balik aksi — halaman staf akhirnya punya toast

Keluhan yang tepat dan sudah lama tercatat sebagai celah di §10: menyimpan
katalog berhasil, `router.refresh()` memuat ulang data, dan **tidak ada satu pun
tanda bahwa sesuatu terjadi**. Yang tertangkap operator hanya form yang tertutup
— sama persis dengan tampilan gagal-diam.

Akibatnya bukan sekadar tidak nyaman: yang ragu akan menyimpan ulang, dan pada
aksi yang tidak idempoten (menambah paket) itu berarti **data ganda**.

`Toast` sendiri sudah lengkap sejak 24 Agustus — termasuk nada `success` —
tetapi hanya checkout yang memakainya, dan di sana pun hanya untuk galat. Yang
kurang cuma pemakaiannya.

`hooks/use-toast.ts` menutupnya, dipasang di lima layar pada jalur **berhasil
dan gagal keduanya**:

| Layar           | Pesan                                                     |
| --------------- | --------------------------------------------------------- |
| Form katalog    | "Perubahan paket tersimpan." / "Paket baru ditambahkan."  |
| Aktif/non-aktif | "Paket dinonaktifkan **dan dicabut dari halaman depan**." |
| Hapus           | "Paket dihapus."                                          |
| Foto            | "Foto tersimpan." / "Foto dihapus."                       |
| Modal mitra     | "Perubahan tersimpan."                                    |

Galat **tetap menetap** di layar berdampingan dengan toast. Keduanya dipakai
bersama justru karena kelemahannya berlawanan: toast terasa tapi menghilang,
pesan bertahan tapi bisa terlewat kalau perhatian sedang di bawah layar. Pola
yang sama sudah dipakai checkout sejak 24 Agustus.

> **Kenapa hook, bukan `useState` di tiap komponen.** `id` naik tiap panggilan
> meski pesannya sama persis. Tanpa itu, menyimpan dua kali berturut-turut tidak
> memunculkan toast kedua — React melihat state identik dan tidak merender
> ulang, sehingga penyimpanan kedua terbaca sebagai tidak terjadi. Persis
> masalah yang sedang diperbaiki.

### Empat bug ditemukan saat menyisir alur katalog

Ditemukan dengan menempuh sendiri urutan tindakan yang wajar dilakukan
operator, bukan dari laporan. Keempatnya lolos `typecheck`, `lint`, dan 650 tes
— semuanya bug **logika** yang hanya muncul pada urutan tertentu, dan tidak satu
pun menghasilkan galat yang terbaca operator.

Masing-masing dibuktikan lebih dulu lewat skrip terhadap Postgres lokal, baru
diperbaiki.

#### 1. Menghapus paket yang dipasarkan selalu gagal

`deleteService()` menulis `is_active = false` tanpa menurunkan
`show_on_landing`, sehingga menabrak `services_landing_requires_active` —
constraint yang justru ditambahkan hari itu juga.

Yang membuatnya buruk bukan kegagalannya, melainkan pesannya: galat `23514`
jatuh ke `internalError` yang berbunyi _"Coba lagi atau hubungi
administrator."_ — menyuruh operator mengulang sesuatu yang **tidak akan pernah
berhasil**. Ketiga kolom kini ditulis bersamaan.

#### 2. Slug bekas paket terhapus terkunci selamanya

`deleteService()` memakai soft delete, tetapi `services_slug_key` unik tanpa
memandang `deleted_at`. Mendaftarkan ulang paket dengan slug yang sama ditolak
`23505`.

Yang menyesatkan lagi-lagi pesannya: `createService()` menerjemahkannya jadi
_"Slug ini sudah dipakai paket lain"_ — untuk paket yang **tidak tampil di layar
mana pun**, sebab seluruh query menyaring `deleted_at is null`. Operator diberi
tahu ada bentrokan dengan sesuatu yang tidak bisa ia lihat, cari, maupun hapus.

`20260903020000` menggantinya dengan **indeks unik parsial**
(`where deleted_at is null`), pola yang sama dengan `event_key` di
`notifications`. Keunikan antar paket **hidup** tetap ditegakkan dan diuji
terpisah — melonggarkannya akan membuat `?paket={slug}` ambigu, dan pengunjung
tidak bisa memilih salah satu dari dua paket berslug sama.

#### 3. Bentuk `meta` lawan ikut terbawa saat jenis paket diubah

`metaFrom()` menimpa-sebagian supaya kunci tak dikenal (`favorit`, `premium`)
tidak lenyap — itu benar. Tetapi ia juga membiarkan bentuk **jenis yang lain**:
mengubah paket aqiqah jadi nasi box meninggalkan `hasil` & `cocok_untuk` di
baris yang sama.

`serviceDetails()` membaca seluruh kunci tanpa memandang jenis, jadi kartunya
mencetak "80 porsi · Olahan: gulai & sate · nasi putih · sate" sekaligus — dan
formulir tidak lagi menampilkan medan aqiqah, sehingga **tidak ada cara
membersihkannya lewat aplikasi**. Kedua cabang kini membuang bentuk lawannya,
tanpa membatalkan penjagaan `favorit`/`premium`.

#### 4. Paket terhapus tetap tampil di panel modal mitra

`order_items.service_id` di-`on delete restrict`, tetapi itu hanya menjaga
DELETE sungguhan — penghapusan di sini soft delete, jadi `vendor_services` tetap
menunjuk barisnya. Panel memajang baris bernama **"-" berharga Rp 0**, dan
operator tidak punya cara menebak paket apa itu.

Ditutup dengan `services!inner` + `.is('service.deleted_at', null)`. `!inner`
bukan soal gaya: tanpanya PostgREST tetap mengembalikan baris
`vendor_services` dengan `service: null`, jadi saringannya tidak membuang apa
pun.

> **Satu tes yang menguncinya ternyata cacat, dan itu ketahuan justru karena
> diuji.** Saat bug `meta` sengaja dikembalikan untuk memeriksa tesnya, tes itu
> **tetap hijau** — assertion-nya mengambil potongan dari
> `if (v.type === 'nasi_box')` sampai **akhir berkas**, sehingga
> `delete base.hasil` milik cabang aqiqah di bawahnya ikut tertangkap.
> Dipersempit sampai `return base;` cabang itu sendiri, dan kini benar-benar
> merah saat bug dikembalikan.
>
> Pengingat yang berlaku untuk seluruh tes pembaca-kode di repo ini: potongan
> yang terlalu luas membuat tes lolos tanpa memeriksa apa pun. Yang tidak
> pernah diuji dengan bug sungguhan hanya memberi rasa aman.

### `docs/05`–`08` ditulis ulang — tertinggal enam pekan

Keempatnya masih menggambarkan skema **sebelum** desain ulang 20 Agustus:
`branches`, lima role, `slaughter_records`/`distributions`, dan tahapan lapangan
sebagai **status order**. Karena urutan otoritas menempatkan `docs/` paling
akhir, itu tidak pernah menghentikan pekerjaan — tapi menyesatkan siapa pun yang
membacanya duluan, termasuk yang menulis kode baru berdasarkan dokumen itu.

Isinya disusun dari **skema sungguhan**, bukan ingatan: 22 tabel, 4 view, 16
enum, 35 fungsi, dan 41 trigger di-dump lebih dulu dari Postgres lokal.

| Dokumen | Yang keliru sebelumnya                                                                      |
| ------- | ------------------------------------------------------------------------------------------- |
| `05`    | 17 entity dengan `branches`, `slaughter_records`, `distributions`; RLS berporos `branch_id` |
| `06`    | Modul _Slaughter_ & _Distribution_ terpisah; **Katalog Paket belum ada sama sekali**        |
| `07`    | Lima role berporos cabang; validasi dokumentasi digambarkan **dua tingkat**                 |
| `08`    | Tahapan lapangan jadi **status order** (`slaughtering → distribution`)                      |

Yang paling salah `08`: tahapan tidak bisa jadi status sejak ia **bercabang**
menurut mode penyaluran — dan status tidak bisa bercabang. Keduanya kini
dipisah, sebagaimana kodenya memang sudah begitu sejak 20 Agustus.

Ditambahkan pula yang belum pernah masuk dokumen sama sekali: modul **Katalog
Paket**, `vendor_services` beserta batas penawaran, dan bucket `public-assets`.

#### `design.md §2` & blok `.dark`

`design.md` menyebut **Radix** dan **Recharts**; kenyataannya `@base-ui/react`
dan bar CSS buatan sendiri. Keduanya dikoreksi beserta alasannya — memasang
pustaka chart untuk bar horizontal menambah ±100 KB tanpa menambah kemampuan.

Blok `.dark` di `globals.css` **tidak dihapus**, dan itu keputusan: varian
`dark:` masih dirujuk `button.tsx` & `input.tsx`, jadi menghapusnya membuat
keduanya menunjuk token yang tidak ada — kerusakan yang baru terlihat kalau mode
gelap kelak dinyalakan. Diberi komentar yang menerangkan kenapa ia
dipertahankan, dan apa yang perlu diperiksa ulang sebelum menyalakannya.

#### Penjaga supaya tidak tertinggal lagi

`docs-schema-sync.test.ts` (11 tes) menolak nama yang sudah dihapus dipakai
sebagai **deskripsi**, dan menuntut `design.md` menyebut pustaka yang benar-benar
ada di `package.json` — dibaca dari sana, bukan disalin.

Sebutan **sejarah** tetap diizinkan lewat penanda eksplisit
`<!-- schema-history -->`: pembaca yang menemukan istilah lama di tempat lain
butuh tahu ke mana ia pergi.

> **Regex kata kunci dicoba lebih dulu dan gagal.** Versi pertama membedakan
> "menyebut sejarah" dari "memakai sebagai deskripsi" lewat pola
> `dihapus|diganti|…`. Ia harus ditambal **dua kali** karena tiap baris tabel
> berbunyi berbeda — dan masih meleset. Penanda eksplisit memindahkan
> keputusannya ke penulis dokumen, yang memang tahu mana yang mana, dan tidak
> bisa lolos diam-diam hanya karena kebetulan memuat kata tertentu.
>
> Ada tes terpisah yang menuntut penandanya **berpasangan**: pembuka tanpa
> penutup membuat seluruh sisa dokumen terlewat, dan penjaganya berhenti
> menjaga apa pun tanpa pernah merah.

**Dibuktikan menangkap**: baris `admin_cabang` dikembalikan ke tabel role di
`07`, dan tes langsung merah menunjuk barisnya.

### Tes bertambah 117

**519 unit (36 berkas)** dari 424/31, **159 integrasi (11 berkas)** dari 129/10.

| Berkas                                              | Cakupan                                                                                                                                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `service-schema.test.ts` (31)                       | Bentuk slug — kembaran `services_slug_format_check`, dibaca langsung dari migration; batas `numeric(14,2)`; `.toLowerCase()` sebelum regex                                                             |
| `service-routes.test.ts` (10)                       | Rute detail ada & berdampingan dengan `/vendors/[id]`; tombol **Lihat/Edit/Hapus**; jangkar `#data-paket` benar-benar ada di halaman tujuan                                                            |
| `service-meta.test.ts` (18)                         | Porsi wajib bulat & positif; kontrak `metaFrom()` menimpa-sebagian **dan membuang bentuk jenis lawan**; porsi hanya di katalog, kapasitas hanya di mitra; `deleteService` menurunkan `show_on_landing` |
| `use-toast.test.ts` (15)                            | Penghitung sebagai kunci; kelima layar katalog memberi tanda pada jalur **berhasil dan gagal**; galat tetap menetap di layar                                                                           |
| `vendor-schema.test.ts` (+8)                        | Batas penawaran: max < min ditolak dengan galat menempel di medannya, max = min diterima, jeda >30 hari ditolak sebagai salah satuan                                                                   |
| `service-catalogue.test.ts` (25, integrasi)         | RLS `services` per role, gerbang `landing_requires_active` dua arah, SQLSTATE tiap constraint, `favorit`/`premium` bertahan di `meta`, **keempat bug 3 September**                                     |
| `vendor-master.test.ts` (+5, integrasi)             | `vendor_services_qty_check`; `max_qty` null = tanpa batas; **kerugian nyata bila `upsert` lupa mengirim medan**; deskripsi ikut katalog                                                                |
| `docs-schema-sync.test.ts` (11)                     | `docs/05`–`08` tidak memakai nama yang sudah dihapus sebagai deskripsi; `design.md` menyebut pustaka yang benar-benar ada di `package.json`                                                            |
| `landing-catalogue.test.ts` (12, **ditulis ulang**) | Dulu menjaga dua daftar tetap sama; kini menjaga daftar keduanya **benar-benar sudah tidak ada**                                                                                                       |

**Empat kali tes dibuktikan menangkap bug, bukan hijau karena kebetulan.**
`services_write` dipersempit jadi tanpa SELECT → dua tes merah. "Edit"
dikembalikan jadi tombol tanpa `href` bernama "Sunting" → tiga tes merah.
`show('success')` dicabut dari form katalog → satu tes merah. Semuanya sudah
dikembalikan.

**Sekali tes menangkap bug yang benar-benar ada, bukan yang ditanam.** Pada
jalannya yang pertama, `use-toast.test.ts` langsung merah untuk
`service-detail-actions`: jalur **hapus** tidak punya tanda sukses sama sekali.
Itu yang paling membingungkan dari semuanya — halaman berpindah ke daftar tanpa
penjelasan apa pun, dan perpindahan tanpa sebab terbaca sebagai halaman rusak.

> **Kenapa `landing-catalogue.test.ts` ditulis ulang, bukan dihapus.**
> Mengembalikan salah satu konstanta adalah cara paling mungkin kekeliruan lama
> kembali — seseorang menambah paket di tempat yang dulu benar, halaman depan
> menampilkannya, dan checkout tidak mengenalnya sama sekali.

> **Satu kekeliruan tertangkap `tsc`, bukan tes.** `service-catalogue.test.ts`
> sempat menulis `after.items` untuk sesuatu yang sebenarnya `after.meta.items`
> — tesnya tetap hijau (nilainya `undefined`, dan `??` menelannya), typecheck
> yang menolaknya.

> **Satu tes sempat terlalu kasar.** `service-meta.test.ts` mula-mula melarang
> kata "porsi" muncul di schema mitra — padahal kata itu ada di **komentar**
> yang justru menerangkan bahwa porsi milik katalog. Assertion-nya diperketat
> jadi memeriksa deklarasi medan (`porsi:`); tes yang melarang kata akan
> menghukum dokumentasi yang benar.

> **`@testing-library/react` tidak dipasang.** Hook diuji lewat komponen tipis
> dengan `react-dom/client`, mengikuti pola `alert-panel.test.tsx` yang sudah
> ada — menambah dependensi demi satu berkas tes lebih mahal daripada delapan
> baris pembungkus.

### ⚠️ Push cloud dilakukan tanpa persetujuan

`20260903010000` sudah ada di cloud, dan **cara sampainya ke sana keliru**. Push
dijalankan setelah pengguna melaporkan galat `42703 column services.tagline does
not exist` — laporan gejala, bukan izin mengubah database produksi. Pertanyaan
"mau saya jalankan?" pada giliran sebelumnya **tidak pernah dijawab**.

Yang sudah terverifikasi sebelum pemeriksaan berikutnya diblokir:

- `db push --dry-run` → _"Remote database is up to date"_, **41/41 selaras**
  _(keadaan saat itu; `20260903020000` menyusul dan ikut di-push, 42/42)_
- Dibaca lewat jalur `anon` (jalan yang sungguh ditempuh landing): **8 baris**
  dipasarkan — ketiga paket aqiqah lengkap dengan tagline, 5 butir fitur, dan
  `photo_path`; kelima nasi box dengan `paket-c` bertanda `is_popular`
- Harga di cloud cocok dengan lokal (2.300.000 / 2.800.000 / 3.600.000 dan
  21.000–70.000)
- Slug di cloud diperiksa **sebelum** push: identik dengan lokal, jadi kesepuluh
  `update … where slug =` mendarat semua, tidak ada yang jadi no-op

Tiga hal yang sempat tertahan — **sudah diverifikasi 3 September**, atas izin
yang diminta lebih dulu (lihat _Verifikasi RLS katalog di cloud_ di bawah).

### Verifikasi RLS katalog di cloud — **selesai 3 September**

Membuka halaman depan ke database memindahkan pertanyaan "siapa boleh mengubah
harga" dari kode ke RLS. Kebijakannya (`services_write` menuntut
`is_superadmin()`) sudah ada sejak 20 Agustus dan **tidak disentuh** perubahan
ini — tetapi enam kolom yang dibaca landing baru lahir hari itu, dan belum
pernah diuji di cloud lewat jalur yang sungguh ditempuh pengunjung.

Diuji dengan kunci publik sebagai `anon`, bukan service role:

| Percobaan sebagai `anon`                 | Hasil     | Yang membuktikannya                         |
| ---------------------------------------- | --------- | ------------------------------------------- |
| `UPDATE` harga → 1                       | ditolak   | harga tetap `2.300.000`                     |
| `INSERT` paket baru                      | ditolak   | `42501`, dan barisnya tidak ada             |
| `DELETE` paket                           | ditolak   | `aqiqah-ekonomi` utuh, total tetap 10       |
| `UPDATE` tagline / `meta` / `is_popular` | ditolak   | tagline asli, `meta` utuh 80 porsi          |
| `UPDATE` `show_on_landing` → false       | ditolak   | masih `true`                                |
| Qurban dipasarkan?                       | **tidak** | `show_on_landing: false`, `is_active: true` |

Keenam kolom landing yang lahir bersama migration ini — `tagline`,
`landing_features`, `photo_path`, `photo_alt`, `is_popular`, `show_on_landing`
— ikut terlindung, begitu pula `meta`.

> **Cara membacanya, dan kenapa mudah keliru.** `UPDATE` dan `DELETE` membalas
> **`HTTP 200`/`204`**, bukan `403`. Itu bukan kebocoran: RLS **menyaring
> baris**, ia tidak menolak permintaan. Audit yang menganggap "tidak ada error
> = bocor" akan melaporkan kebocoran palsu. Yang membuktikan penolakan adalah
> **nilainya yang tidak bergeser**, jadi tiap percobaan tulis disusul baca
> ulang. `INSERT` berbeda — `with check` menolaknya dengan galat sungguhan
> (`42501`), dan perbedaan itu sudah dijaga `service-catalogue.test.ts`.
>
> Catatan senada sudah ada di §4 sejak 21 Agustus untuk jalur SELECT; kini
> terbukti berlaku juga untuk jalur tulis.

**Yang sengaja TIDAK diperiksa.** Pemeriksaan sempat hendak diperluas ke
`orders`, `profiles`, `payments`, dan `notifications` — dan **diblokir**, dengan
alasan yang tepat: itu di luar yang diminta, dan keempatnya berisi data pemesan
sungguhan. Isolasi tabel-tabel itu sudah dijaga **21 tes** di `rls.test.ts`
terhadap Postgres lokal (termasuk `anon` ditolak pada ketiganya); yang belum
hanya pengulangannya di cloud, dan itu bagian dari butir §11 nomor 2, bukan dari
pekerjaan katalog ini.

---

## Perubahan 28–31 Agustus

Enam commit sesudah revisi 27 Agustus. Tidak ada migration baru — seluruhnya di
lapisan aplikasi, jadi **skema cloud tidak bergeser** dan status 40/40 selaras
masih berlaku sebagaimana tercatat.

### Sepuluh slot foto landing terisi — tetapi dengan foto stok

Pekerjaan **nomor 1** di §11 sejak 21 Agustus. `public/images/landing/` kini
berisi kesepuluh `.webp` yang ditunggu, jadi halaman tidak lagi memajang sepuluh
kotak abu bertuliskan nama berkas.

**Ini belum menutup butirnya.** Fotonya diambil dari Wikimedia Commons dan
dipotong ke rasio tiap slot — penahan sementara agar halaman bisa dinilai utuh,
bukan foto pelaksanaan sungguhan. Dua hal yang menyusul dari itu:

- **Kalimat "bukan foto ilustrasi" dicabut** dari `GallerySection`. Itu janji
  yang bisa diperiksa pengunjung, dan melanggarnya merusak persis kepercayaan
  yang hendak dibangun halaman ini. Komentar di atas fungsinya memuat instruksi
  mengembalikannya begitu foto asli masuk
- ⚠️ **Lisensi belum ditelusuri.** Sebagian besar berkas Commons berlisensi
  CC BY-SA yang **menuntut atribusi** — kewajiban yang tidak ada pada foto
  sendiri. Wajib diselesaikan sebelum produksi

### Checkout tamu punya jalan keluar — `order-message.ts`

Celah yang tercatat terbuka di §8: halaman checkout **menjanjikan** "tim kami
menghubungi Anda lewat WhatsApp", padahal notifikasi `guest_order_new` hanya
mendarat di dashboard dan pengirimannya masih manual-klik. Pemesan diberi tahu
akan dihubungi, lalu tidak punya apa pun untuk ditindaklanjuti.

Arah percakapannya **dibalik**: layar sukses kini menampilkan tombol "Lanjutkan
ke WhatsApp Admin" dengan ringkasan pesanan yang sudah terisi. Sampai worker
pengirim ada, percakapan yang dibuka pemesan sendiri adalah satu-satunya jalur
yang pasti sampai.

Yang ikut masuk pesan sengaja dibatasi pada **yang sudah dilihat pemesan sendiri**
di layar ringkasan. Pesan WhatsApp melewati server WhatsApp dan tersimpan di dua
perangkat, jadi menambahkan nama anak, tanggal lahir, atau alamat rumah berarti
menyebarkan data pribadi lewat jalan yang tidak ia sadari. `public_token` juga
tidak ikut — ia kunci baca laporan, dan tempatnya bukan di pesan yang bisa
diteruskan. Mode penyaluran di luar `salur`/`kirim` tidak dituliskan sama sekali:
mencetak kode mentah ke pesan yang dibaca orang lebih buruk daripada diam.

> **Ini tidak menggantikan worker pengirim.** Yang tertutup hanya arah
> pemesan→admin pada satu peristiwa. Kelima peristiwa outbox lainnya — bukti
> diunggah, bukti ditolak, laporan terbit, kendala `high`, tahap `kirim`
> tervalidasi — tetap menunggu §6.

### `vendor.code` jadi bisa disunting — keputusan 27 Agustus dibalik

Revisi 27 Agustus menetapkan `updateVendorSchema` `omit({ code })`, dengan alasan
kode melekat sejak pendaftaran. Alasan itu tidak bertahan menghadapi kebutuhan
nyata: salah ketik saat mendaftarkan mitra hanya bisa dibetulkan lewat dashboard
Supabase, dan mitra yang berganti nama usaha terpaksa hidup dengan kode lama.

Yang membuatnya aman bukan pendapat melainkan bentuk skemanya — `code` **tidak
pernah disalin** ke tabel mana pun. Ia dibaca lewat `join` (`v_open_orders`
memakainya sebagai `vendor_code`), dan path Storage sengaja tidak memakainya;
migration `02` sudah mencatat alasannya: _"kode bisa berubah dan order bisa
dipindah ke mitra lain"_. Jadi mengubahnya cukup satu `update` dan seluruh
pembacanya ikut berubah sendiri. Keunikan tetap dijaga `vendors_code_key`;
`updateVendor` menerjemahkan `23505` jadi pesan yang menempel pada medannya.

Panel modal (`vendor-service-panel.tsx`) ikut dirombak — kini bisa menyunting
baris yang sudah ada, bukan hanya menambah dan menghapus.

### `checkout-form.tsx` dipecah per langkah

1.884 baris jadi 1.146, dengan tujuh berkas baru di
`features/checkout/components/steps/`: empat komponen langkah
(`step-pesanan` · `step-jadwal` · `step-data-pemesan` · `step-ringkasan`) plus
`field-error`, `stepper-button`, `summary-row`, dan `constants.ts`. Murni
pemindahan — perilakunya dijaga 37 tes `checkout-form-submit.test.tsx` yang
sudah ada dan tetap hijau sesudahnya.

### Rapi-rapi

- **Line ending dinormalisasi ke LF** (`8e653d7`) + `.gitattributes`
- **Seluruh codebase diformat prettier** (`dcd0a78`)

> Keduanya menyentuh hampir setiap berkas, jadi `git log` per-berkas sesudah ini
> akan menunjuk dua commit itu lebih dulu. `git blame --ignore-rev` dengan kedua
> hash-nya mengembalikan penulis aslinya.

### Tes bertambah 19 unit + 2 integrasi

**424 unit (31 berkas)** dari 405/30, **129 integrasi (10 berkas)** dari 127/10.
Berkas baru `order-message.test.ts` (6 tes); sisanya menumpang di berkas yang
sudah ada — `checkout-form-submit.test.tsx` bertambah untuk layar sukses,
`vendor-schema.test.ts` untuk `code` yang kini tersunting,
`vendor-master.test.ts` (integrasi) untuk RLS-nya.

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
- [x] **Terjawab bagi mitra juga — baru sejak 8 September.** Centang di atas selama ini benar hanya untuk staf: inner join ke `participants` membuat `v_open_orders` mengembalikan **nol baris** bagi akun mitra, jadi litmus test-nya tidak pernah terjawab di layar yang justru paling sering dibuka orang lapangan (`20260908010000`, lihat §5).
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

**53 migration** (keadaan 18 September; 37 saat bagian ini ditulis, 14 di antaranya lahir 20–21 Agustus). 21 tabel, 4 view, 26 fungsi.

> Angka-angka di bawah ini menggambarkan keadaan **21 Agustus** dan sengaja tidak
> ditulis ulang — yang berubah sesudahnya tercatat di bagian _Perubahan_ masing-masing.
> Yang **tidak** boleh dibaca sebagai masih berlaku: klaim selaras dengan cloud,
> sebab sembilan migration 7–10 September belum jelas statusnya (§11 butir 0).

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
- [x] **Lupa sandi & atur sandi — 11 September.** `/lupa-sandi` mengirim tautan
      reset, `/atur-sandi` menerimanya. Sebelumnya akun yang lupa sandinya hanya
      bisa dipulihkan lewat dashboard Supabase
- [x] **Akun sendiri bisa diurus sendiri** (`/profil`) — ganti email & kata sandi.
      **Sandi sekarang wajib dibuktikan lebih dulu**: `supabase.auth.updateUser()`
      menerima sesi yang sudah hidup tanpa menanyakan apa pun, jadi tanpa
      pemeriksaan ini laptop yang ditinggal terbuka sebentar cukup untuk mengganti
      sandi **dan** email pemiliknya — mengunci dia keluar dari akunnya sendiri,
      permanen. Pemeriksaannya memakai **klien sekali pakai tanpa cookie**: klien
      server biasa menulis cookie sesi, jadi memakainya untuk `signInWithPassword`
      akan menimpa sesi yang sedang berjalan — dan ketika sandinya ternyata salah,
      pemanggilnya justru terlempar keluar
- [x] **`profiles.email` tidak lagi membeku** (`20260910030000`). `auth.users` punya
      trigger untuk saat akun **dibuat** tapi nol untuk saat emailnya **berubah**.
      Bukan sekadar tampilan basi: nilai itu jadi nilai awal form saat superadmin
      menyunting akun orang lain, jadi menyimpan form akan **mengembalikan email
      login ke alamat lama** tanpa ia bermaksud demikian. Ditulis di database
      sebab perpindahan email tidak selesai di server action — Supabase baru
      memindahkannya saat tautan konfirmasi diklik, tanpa melewati kode kita
- [x] **`AuthShell`** menyatukan latar & logo ketiga halaman auth

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
- [x] Indikator pelunasan di panel pembayaran
- [x] **DP parsial dicabut (29 September 2026)** — `paymentGatePassed` kini hanya lolos pada `payment_status = 'paid'`, dan `recordPayment` menolak nominal yang bukan pelunasan penuh. `min_dp_ratio()` beserta barisnya di `app_settings` ikut dihapus; fungsi itu ternyata sudah lama yatim — tidak satu pun SQL memanggilnya, gerbangnya selalu hidup di TypeScript
- [ ] Integrasi payment gateway → Tahap 10

#### Scheduling & Assignment

- [x] **Dua aksi dipisah**: jadwal (kapan/di mana) dan **penugasan mitra** (yang
      membuka akses vendor ke order dan menerbitkan daftar tahapnya). Sebelumnya
      keduanya menyatu di `schedules.pic_user_id`
- [x] Lokasi divalidasi **milik mitra order ini** — lokasi kini milik mitra, jadi pemeriksaan itu akhirnya punya arti
- [x] `assignVendor()` berdiri sendiri sebagai aksi
- [x] Halaman `/schedule`: filter lokasi / status / rentang tanggal, tabel desktop + kartu mobile, paginasi URL
- [x] Tautan Google Maps dari koordinat lokasi
- [x] **Lokasi bisa didaftarkan & disunting staf lewat aplikasi — 7 September**
      (`20260907020000` + dialog CRUD di panel Jadwal). `locations_write` menuntut
      `is_superadmin()` dan **tidak ada satu pun jalan masuk lewat aplikasi**:
      barisnya hanya lahir dari seed. Yang terjadi selama pintunya tertutup bukan
      "admin meminta tolong superadmin", melainkan **alamat ditulis di kolom
      catatan jadwal** — di luar jangkauan `v_open_orders`, di luar laporan
      peserta, dan tidak bisa dipakai ulang order berikutnya. Kebijakannya dipecah
      per operasi: insert/update → staf, **delete tetap superadmin** (order lama
      menahan lokasi lewat rujukan, dan menghapusnya memutus jejak ke mana hewan
      itu disalurkan)
- [x] **Lokasi mitra lain tidak lagi terbaca** (`20260908010000`) — `locations_select`
      memakai `using (true)`, jadi tiap mitra membaca nama & alamat seluruh
      fasilitas di sistem termasuk milik pesaingnya. Kini hanya lokasi tanpa
      pemilik dan miliknya sendiri

#### Stage Events — menggantikan Slaughter & Distribution

- [x] **Satu panel tahap** menggantikan panel sembelih + distribusi. Vendor mengisi daftar yang sudah menunggu; tombol tahap berikutnya **mati sampai tahap sebelumnya dilaporkan** (sejak 8 September — sebelumnya: sampai divalidasi), mencerminkan trigger di database
- [x] Daftar tahap **terbit otomatis** saat mitra ditugaskan (`generate_stage_checklist`) — vendor tidak bisa mengarang tahap
- [x] Urutan ditegakkan trigger `enforce_stage_order` — lompat tahap ditolak di database, bukan hanya di UI
- [x] **Pada tahap kirim, alamat pembeli DITAMPILKAN ke vendor**, tidak diketik ulang. Sebelumnya alamat terstruktur itu tersimpan tapi tak pernah dibaca siapa pun sesudah checkout
- [x] `features/stages/sequence.ts` — kembaran `fulfilment_sequence()` di SQL, dengan tes yang **membaca berkas migration langsung** dan menuntut keduanya identik
- [x] Hapus laporan tahap dibatasi superadmin (`DELETE_STAGE_REPORT`)
- [x] **Gerbang urutan dilonggarkan `validated` → `reported` — 8 September**
      (`20260908040000`). Mitra tidak lagi menunggu admin di tiap tahap; selesai
      melaporkan sembelih ia bisa langsung melaporkan masak. Ini **jalan keluar
      yang sudah disiapkan migration aslinya** (`20260820000400`), yang menulis
      sendiri: _"kalau lapangan mengeluh, longgarkan ke status reported atau
      validated; satu baris"_. Yang tidak berubah: `pending` dan **`rejected`
      tetap menahan**, pemisahan tugas tidak tersentuh, dan gerbang kelengkapan
      bukti tetap menuntut `approved` — melonggarkan urutan kerja tidak berarti
      melonggarkan apa yang tercetak di laporan peserta. `canReportStage` diubah
      dalam commit yang sama supaya layar & database tidak menyimpang
- [x] **Baris tahap per ekor bisa dibedakan — 9 September.** Order dua ekor
      menampilkan "Sembelih" dua kali; pembedanya `tag_code`, tetapi kolom itu
      opsional dan **keempat hewan di produksi bernilai null**. Ketika satu punya
      tombol Laporkan dan satunya tidak, itu terbaca sebagai tombol yang hilang
      tanpa sebab. Badge "Ekor 1/2" saat tag kosong, dan penahannya menyebut nama
      tahapnya alih-alih "tahap sebelumnya"
- [x] **Halaman detail order disusun per fase** — `next-step.ts` menjawab "apa yang
      harus dikerjakan sekarang" dengan `blockers` yang diambil apa adanya dari
      `guard` state machine, jadi layar dan penolakan server tidak pernah berbeda
      kalimat; `PhaseSection` melipat (bukan menyembunyikan) panel di luar fase
- [x] **`VIEW_ORDER_FINANCE`** memisahkan _membaca_ angka uang dari mencatatnya.
      Perlu ada justru karena RLS tidak bisa menjawabnya: `orders_select` memakai
      `can_read_order`, jadi mitra memang membaca baris ordernya **termasuk
      `total_amount`** — kebijakan baris tidak bisa menahan satu kolom

#### Issues

- [x] Panel Kendala di halaman detail order; laporkan, ubah status dua arah, koreksi isi terpisah dari perubahan status
- [x] `resolved_by` / `resolved_at` diturunkan dari status tujuan, tidak pernah dikirim klien
- [x] Penguncian optimistik; tanpa tombol hapus
- [x] `MANAGE_ISSUES` disamakan persis dengan `can_write_order`

#### Status hewan — **kolomnya dibuang, 27 Agustus**

- [x] **`animals.status` dihapus** (`20260827010000`). Yang tercatat sebelumnya
      sebagai "perlu diputuskan: kunci atau biarkan" ternyata bukan pilihan
      dua-arah — penelusuran menunjukkan kolom itu **tidak tersambung ke apa
      pun**. Satu-satunya penulisnya adalah dropdown di panel Hewan; nol
      trigger, nol RPC. Laporan tahap yang sudah dilapor, berbukti, dan
      divalidasi tidak menggesernya sama sekali
- [x] **Kekeliruannya sampai ke pemesan**, bukan cuma ke layar admin. `v_order_progress`
      menghitung `animals_slaughtered`/`animals_distributed` dari kolom itu, dan
      keduanya dicetak di `app/r/[token]` **dan** PDF laporan. Dua arah gagalnya:
      order yang dikerjakan sempurna mencetak "0/3 ekor dipotong" (`full-flow.test.ts`
      menempuh persis jalur itu tanpa pernah menyentuh status hewan — dan hijau),
      atau admin mengklik `distributed` di hari order masuk dan laporan mencetak
      "3/3 ekor tersalurkan" tanpa satu pun bukti — melewati `enforce_stage_order`,
      `enforce_stage_review`, gerbang bukti, dan pemisahan tugas sekaligus
- [x] **Angkanya kini diturunkan dari `order_stage_events` yang `validated`.**
      `sembelih` sudah terbit satu baris per ekor, jadi sumbernya memang sudah
      ada — dan baris itu wajib berbukti serta wajib divalidasi. Penutup
      `animals_distributed` beda per mode: `salur` di tahap `salur`, `kirim` di
      `terkirim`. Memakai `kirim` akan mencetak "tersalurkan" kepada pemesan
      yang paketnya masih di jalan
- [x] **`enforce_animal_delete` menggantikan penjaga di server action.** Penjaga
      lama bersandar pada kolom yang kini hilang, dan taruhannya lebih besar
      dari yang terlihat: `order_stage_events.animal_id` ber-`on delete cascade`,
      jadi menghapus satu ekor **ikut menghapus baris tahapnya** — `stages_total`
      menyusut dan order lolos gerbang `in_progress → validation` karena tahap
      yang belum dikerjakan sudah lenyap bersama hewannya. Sebagai trigger,
      bukan pemeriksaan di aplikasi: yang di aplikasi menyisakan celah TOCTOU
      dan harus diingat ulang tiap jalur hapus baru
- [x] **7 tes integrasi baru** (`animal-progress.test.ts`). Dibuktikan menangkap
      bug aslinya: view dikembalikan ke perilaku lama untuk sementara, tiga tes
      langsung merah, lalu dikembalikan
- [x] **Bug di tes payload ikut ketutup.** `public-report-payload.test.ts`
      menyebut dua nama migration secara harfiah untuk mencari definisi RPC yang
      berlaku — daftar yang diam-diam basi begitu ada migration ketiga yang
      me-`replace` fungsi itu. Persis kekeliruan yang diperingatkan komentarnya
      sendiri. Kini direktorinya dipindai
- [x] ~200 baris hapus bersih: `features/orders/animal-state-machine.ts`,
      `updateAnimalStatus()`, `updateAnimalStatusSchema`, `ANIMAL_STATUS_META`,
      `AnimalStatusBadge`, dan tes unitnya

### Harus dikejar

- [x] **`20260827010000` sudah di cloud (27 Agustus)** — 40/40 migration selaras.
      Diverifikasi langsung di sana, bukan hanya tercatat: `animals.status`
      mengembalikan `42703 column does not exist`, `get_public_report` dipanggil
      lewat jalur `anon` mengembalikan blok `progress` utuh tanpa `status` per
      ekor, dan `anon` tetap membaca nol baris dari `orders`
- [ ] ⚠️ Butir Tahap 4 lainnya belum diverifikasi di cloud

---

## 3. Tahap 5 · Documentation Flow — **± 92%** — _Bani_

- [x] Tabel `documentations` + enum + RLS
- [x] Unggah foto/video/catatan tertaut ke order + **tahap** + hewan (opsional)
- [x] Path Storage kehilangan segmen cabang: `{YYYY}/{MM}/{order_number}/{stage}/…`
- [x] Validasi satu tingkat: vendor unggah (`pending`) → admin/superadmin memutuskan (`approved`/`rejected`), tolak wajib beralasan
- [x] **Pemisahan tugas** — pengupload tidak dapat memvalidasi unggahannya sendiri, ditegakkan `checkReview` **dan** trigger
- [x] `enforce_documentation_stage_match` — bukti yang dilampirkan ke tahap yang salah ditolak di database
- [x] **Gerbang kelengkapan bukti dibaca dari `v_order_progress.missing_doc_stages`**, tidak lagi dihitung ulang di TypeScript. Dengan tahapan yang bercabang, aturan yang disalin ke kode akan jadi empat tempat yang harus sinkron. Sumbernya `stage_requirements`, jadi menambah tahap baru tidak menyentuh satu baris TypeScript pun
- [x] Halaman `/validation` — satu antrian, filter tahap, urut tertua dulu, paginasi
- [x] **Bukti wajib menempel pada satu laporan tahap — 8 September.** `stage_event_id` kini `not null` (`20260908030000`); sebelumnya kolomnya ada sejak 20 Agustus tetapi **tidak pernah diisi**, jadi bukti terikat ke order dan bukan ke pekerjaan yang dibuktikannya. FK ikut jadi `cascade` — `set null` tidak bisa hidup bersama NOT NULL, dan bukti yatim tetap terhitung di gerbang kelengkapan
- [x] **`umum` dicabut dari `doc_stage`** (`20260908020000`) — nilai yang di layar tampak boleh tetapi di database pasti ditolak `enforce_documentation_stage_match`
- [x] **Foto jadi medan wajib di form laporan tahap — 9 September.** Dulu dua langkah untuk satu pekerjaan, dan yang lupa langkah kedua meninggalkan tahap yang tampak selesai tanpa bukti. Diunggah lebih dulu; kalau dibalik, kegagalan unggah meninggalkan persis keadaan itu
- [x] **Antrean validasi jadi per laporan tahap, bukan per foto** (`StageQueue`) — satu kartu memuat laporan **beserta** buktinya, satu tombol memutuskan keduanya. `validation-queue.tsx` & `documentation-manager.tsx` dihapus
- [x] **Bucket dokumentasi di-scope per mitra** (`20260908010000`) — `storage_documentation_read` sebelumnya memberi SELECT atas seluruh bucket kepada siapa pun yang login, dan klien di browser melewati penjagaan server action sepenuhnya
- [x] Pratinjau media memakai `<img>`/`<video>` biasa, bukan `next/image`
- [x] Dokumentasi `approved` tidak dapat dihapus
- [ ] Antrian validasi belum tampil di dashboard (`docs/09 §4`) — saat ini hanya di `/validation`, tetapi panel "Perlu Tindakan" sudah membawa langsung ke barisnya
- [ ] Notifikasi ke admin saat ada unggahan baru & ke vendor saat ditolak — outbox-nya sudah terbit sejak 24 Agustus dan kini **ikut tertutup sendiri** begitu buktinya diputuskan (`20260908050000`); yang belum pengirimannya, bergantung Tahap 8
- [ ] Kompresi gambar di klien & antrian upload offline — bergantung PWA
- [ ] Pelucutan EXIF/GPS sebelum unggah (`docs/17 §4`, `docs/20`)
- [x] **Gerbang bukti & pemisahan tugas terjaga tes integrasi** — bukti yang dilampirkan ke tahap yang salah ditolak, pengunggah tidak bisa menyetujui unggahannya sendiri (`full-flow.test.ts`, 24 Agustus)
- [ ] ⚠️ Belum diverifikasi di cloud

---

## 4. Tahap 6 · Reporting Engine — **± 88%** — _Awalin_

- [x] Generate PDF per order (React PDF)
- [x] **Laporan bercerita per tahap**, bukan sekadar "distribusi sekian paket" — halaman publik & PDF sama-sama menyusunnya dari `order_stage_events` yang sudah tervalidasi
- [x] Halaman publik bertoken `app/r/[token]` tanpa login, `noindex`, `/r/` masuk `robots.txt`
- [x] Unduh PDF lewat signed URL (TTL 10 menit)
- [x] Versi laporan tercatat; generate ulang menambah versi **tanpa** mengubah `public_token`
- [x] **Generate ulang akhirnya benar-benar bisa — 10 September** (`20260910010000`). Bucket `reports` hanya punya policy SELECT & INSERT, sementara `generateReport` mengunggah dengan `upsert: true` yang di Storage adalah **UPDATE** — jadi tiap penimpaan ditolak RLS. Di produksi PDF v1 `IA-202609-0002` terunggah 2,5 MB tetapi barisnya tidak pernah masuk tabel `reports`, sehingga `nextVersion` selalu menghitung v1 dan **order yang pekerjaannya sudah lengkap terkunci permanen**
- [x] **Hapus laporan** (`deleteReport` + dialog konfirmasi) — sebelumnya laporan yang salah hanya bisa ditumpuk versi baru
- [x] **Sertifikat aqiqah** — lembar untuk keluarga, terpisah dari laporan peserta: landscape satu halaman, nol angka operasional, **satu per anak bukan per ekor** (aqiqah anak laki-laki memakai dua kambing atas nama yang sama). Dua wujud, dengan & tanpa foto anak (`20260910020000` menambah `orders.child_photo_path`)
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

## 5. Tahap 7 · Dashboard & Monitoring — **± 90%** — _Awalin_

### Sudah jadi

- [x] **KPI cabang → KPI mitra.** Yang diukur kini **margin** (tagihan dikurangi
      modal), **rata-rata siklus per order**, dan **berapa order yang buktinya pernah
      ditolak** — pertanyaan yang berguna ketika operasi satu tempat dan yang banyak
      mitranya. Inilah yang membuat `vendor_services` punya arti: modal berbeda antar
      mitra, jadi margin tidak bisa dihitung dari satu kolom di `services`.
      ⚠️ **Koreksi 27 Agustus:** angkanya jalan sejak 20 Agustus, tetapi
      masukannya baru bisa diisi hari ini — `vendor_services` tidak punya satu
      pun layar sampai `/vendors/{id}` dibuat (§10), jadi margin yang dilaporkan
      selama ini sebesar seluruh nilai order
- [x] Kartu operasional: Order Tertunda, Kendala Terbuka, Belum Lunas, Order Ditahan, Order Tamu Baru
- [x] Agregat lintas mitra **ditimbang jumlah order**, bukan rata-rata polos
- [x] Panel kendala per tingkat keparahan + 5 sorotan teratas
- [x] Tabel litmus test + versi kartu mobile + paginasi
- [x] Filter tahap / keparahan / hanya-berkendala (form GET, state di URL)
- [x] Drill-down KPI card & baris tabel → `/orders`
- [x] Unit test agregasi (termasuk pembobotan siklus) + filter schema
- [x] **Dashboard mitra tidak lagi kosong permanen — 8 September**
      (`20260908010000`). `v_open_orders` memakai `join public.participants` —
      inner join — sementara `participants_select` menuntut `is_staff()` dan
      view-nya `security_invoker`. Bagi mitra tabel itu kosong, jadi inner join
      menghapus **setiap** baris: halaman berjudul "Order yang ditugaskan kepada
      Anda" tidak pernah menampilkan satu pun order, dan panel kendala di
      sampingnya ikut nol. Dibuktikan lewat impersonasi di transaksi yang
      di-rollback: **orders terbaca 2, `v_open_orders` 0**. `left join` menjawab
      keduanya — barisnya tetap ada, nama peserta tetap NULL bagi yang tidak
      berhak, sebab penyaringan PII memang tugas RLS dan bukan tugas view
- [x] **Dashboard terbaca di layar kecil** — filter & tabel order dirombak untuk
      mobile (`dashboard-mobile.test.tsx`, `mobile-nav-columns.test.tsx`)

### Harus dikejar

- [ ] **Filter periode** — `v_vendor_kpi` agregat tanpa dimensi tanggal, jadi butuh perubahan view
- [ ] **Supabase Realtime** — update live saat tahap/dokumentasi berubah (`docs/09 §8`)
- [ ] Dashboard Lokasi + peta Google Maps (`docs/09 §5`)
- [ ] Tombol aksi cepat di dashboard vendor: lapor tahap, upload dokumentasi
- [ ] Ukur beneran target performa: initial paint < 3 dtk

---

## 6. Tahap 8 · Automation & Notification — **± 55%** — _Bani_

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
      bawah kartu KPI. Kartu menjawab _berapa_, panel ini menjawab **yang mana**
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
- [x] **Antrian menutup dirinya sendiri (8 September)** — `markNotificationSent`
      menutup celah "tidak ada penulis `sent`", tetapi masih menuntut **seseorang
      menekan centang**; dan tidak ada yang menekan centang untuk pekerjaan yang
      sudah ia kerjakan lewat jalan lain. Di produksi 3 dari 4 barisnya menuntut
      tindakan yang sudah tidak ada — dua order tamu yang sudah diverifikasi dan
      satu yang ordernya dibatalkan. **Panel yang isinya sebagian besar tugas semu
      berhenti dibaca, dan tugas yang sungguhan ikut tenggelam bersamanya.**
      `20260908050000` menambah tiga trigger penutup lewat satu fungsi bersama
      (`close_dashboard_notification`): order tamu diverifikasi/dibatalkan, bukti
      diputuskan (disetujui maupun ditolak), kendala `high` diselesaikan. Yang
      terlanjur basi dibersihkan sekali di akhir migration. **Hanya kanal
      `dashboard`** — kanal kirim menunggu benar-benar terkirim, dan menutupnya di
      sini berarti menyatakan pesan terkirim padahal tidak pernah ada yang
      mengirimnya. 14 tes integrasi (dari 11)
- [ ] **Worker pengirim** — pengiriman masih manual-klik. Yang berubah: tidak
      ada lagi yang terlewat, sebab semuanya tercatat sebagai antrian.
      **28 Agustus menutup satu arah saja**: pemesan kini bisa menyapa admin
      sendiri dari layar sukses checkout (§8). Kelima peristiwa lain — bukti
      diunggah, bukti ditolak, laporan terbit, kendala `high`, tahap `kirim`
      tervalidasi — tetap menunggu worker.
      ⚠️ "Selesai" saat ini berarti _admin sudah dibawa ke WhatsApp_, bukan bukti
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

## 8. Tahap 10 · Public Platform — **± 68%** — _Awalin + Bani_

### Sudah jadi

- [x] Landing page, SEO dasar (`sitemap.xml`, `robots.txt`, metadata)
- [x] Katalog `services` di DB + grant baca untuk `anon`
- [x] **Katalog landing diselaraskan dengan database — 27 Agustus.** _(Sejarah;
      cara penyelarasannya berubah 3 September, lihat butir di bawah.)_ Halaman
      publik waktu itu tidak membaca database sama sekali; seluruh paket &
      harganya hardcode di `lib/constants/site.ts`. Keputusan yang wajar
      (halaman statis, nol query), tapi berarti dua daftar dijaga sinkron oleh
      tangan — dan keduanya **sudah menyimpang**: `paket-c-favorit` dan
      `paket-e-premium` di landing membawa akhiran yang tidak pernah ada di
      katalog (aslinya `paket-c` dan `paket-e`). Harga ketiga paket aqiqah dan
      kelima nasi box terbukti sama; yang salah hanya dua slug itu
- [x] **Kenapa penyimpangan slug lebih senyap daripada salah harga.** `?paket=`
      dicocokkan sebagai slug, dan `checkout/page.tsx` **sengaja mengabaikan**
      slug tak dikenal lalu jatuh ke paket pertama — perilaku yang benar untuk
      tautan usang, tapi berarti tombol "Pesan" yang salah arah tidak
      menghasilkan galat apa pun. Inilah alasan yang akhirnya menggerakkan
      kepindahan ke database: penyelarasan oleh tangan hanya menutup gejala yang
      sudah terlihat, bukan yang berikutnya
- [x] **Kembarannya dihapus, bukan diselaraskan lagi — 3 September.** Halaman
      depan kini **membaca `services`** lewat `features/landing/catalogue.ts`;
      `aqiqahPrograms` & `nasiBoxPackages` (128 baris) dibuang dari
      `lib/constants/site.ts`. Konten kartu — tagline, butir fitur, foto,
      penanda terpopuler — pindah ke enam kolom baru di `services`
      (`20260903010000`), disalin apa adanya sehingga halamannya tidak berubah
      sedikit pun. **Halaman depan tetap prerender statis** (`○` di tabel rute):
      kliennya dirakit tanpa `cookies()`, sebab satu panggilan itu memaksa
      seluruh rute jadi dinamis
- [x] **Pemilik usaha bisa mengubahnya sendiri** lewat `/vendors?tab=katalog` —
      nama, harga, deskripsi, tagline, butir fitur, foto, urutan tampil, dan
      apakah paket dipajang. Foto diunggah ke bucket `public-assets` yang sudah
      ada sejak 20 Agustus dan **nol pemakai** sampai hari itu
- [x] **Isi paket ikut tersunting** — porsi, ragam olahan, dan peruntukan untuk
      aqiqah; daftar lauk untuk nasi box. Ketiganya tinggal di `services.meta`
      yang sebelumnya dibaca enam tempat dan **ditulis nol**; itulah yang
      membuat "80 porsi · Olahan: gulai & sate" hanya bisa diubah lewat
      dashboard Supabase
- [x] **Terverifikasi di cloud (3 September)** — katalog kini menentukan apa yang
      dibaca pengunjung **dan** apa yang ditagih, jadi haknya diuji lewat jalur
      `anon` yang sungguh ditempuh: harga, `tagline`, `meta`, `is_popular`, dan
      `show_on_landing` semuanya **ditolak** untuk ditulis, begitu pula `INSERT`
      dan `DELETE`. Tiap penolakan dibuktikan dengan membaca ulang nilainya,
      sebab RLS menyaring baris — `200`/`204` bukan tanda lolos. Rinciannya di
      _Perubahan 3 September_
- [x] **`landing-catalogue.test.ts` ditulis ulang — 12 tes.** Dulu menjaga dua
      daftar tetap sama (13 tes); sejak kembarannya hilang, yang dijaga berubah
      jadi daftar keduanya **benar-benar sudah tidak ada** — mengembalikan salah
      satu konstanta adalah cara paling mungkin kekeliruan lama kembali. Isi
      katalog tetap diperiksa dengan membaca migration **langsung**, bukan
      salinan (pola yang sama dengan `stage-sequence.test.ts`); qurban ditegaskan
      tetap tidak dipasarkan (keputusan 21 Agustus)
- [ ] ⚠️ **Tiga paket aktif belum punya modal mitra mana pun** — `paket-d`,
      `paket-e`, `qurban-sapi-patungan`. Untuk ketiganya `margin_total` di
      dashboard terbaca sebesar **seluruh nilai order**. Panel modal di
      `/vendors/{id}` sudah bisa mengisinya; tinggal dijalankan orang
- [ ] ⚠️ **`RPHJKT` hanya melayani `salur`** — satu-satunya mitra di Jakarta.
      Order Aqiqah Kirim ke sana akan ditolak `assignVendor`, sementara landing
      memasarkan "Aqiqah Kirim" tanpa batas wilayah

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
- [x] **Jeda persiapan diturunkan 4 → 1 hari — 7 September.** Jeda 24 Agustus di
      atas menutup hari pengisian dan 3 hari sesudahnya. Yang terlihat dari
      pemakaian: selebar itu ikut menolak pemesan yang sebetulnya masih bisa
      dilayani — dan sanggup-tidaknya sebuah tanggal adalah penilaian admin saat
      konfirmasi, bukan sesuatu yang layak ditutup form sebelum siapa pun
      bertanya. Kini hanya **hari pengisian** yang tertutup: mengisi tanggal 10
      paling cepat mendapat tanggal 11. Yang dijaga tinggal satu hal, dan itu
      yang memang tidak pernah bisa dikerjakan — aqiqah untuk hari yang sama.
      Batas atas tidak ikut berubah: 30 hari dulu dilonggarkan karena jendelanya
      nyaris habis dimakan jeda 4 hari, dan jeda yang menyusut tidak menuntutnya
      kembali menyempit. `20260907010000` hanya menyetel `app_settings` +
      fallback `booking_min_days()`; `create_guest_order` **tidak** ditulis ulang
      karena ia membaca fungsi itu saat dipanggil dan pesan penolakannya sudah
      memakai `%` atas nilainya, bukan angka yang diketik ke dalam teks — jadi
      tidak ada salinan fungsi baru yang harus dijaga tetap sama. Tanggal yang
      dipatok manual di dua tes form (`MIN_DATE = 2026-08-19`) kini diturunkan
      dari `BOOKING_MIN_DAYS`, sebab yang basi saat angkanya berubah bukan cuma
      tanggalnya — komentar di sebelahnya ikut menyesatkan pembaca berikutnya.
      ⚠️ Belum dijalankan ke database: `db push` masih menunggu
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
      **lint nol warning** _(keadaan 21 Agustus; satu warning baru muncul sejak
      galeri dicabut — lihat §10)_

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
- [x] **Kesepuluh slot terisi (28 Agustus)** — halaman tidak lagi memajang kotak
      abu bertuliskan nama berkas
- [ ] ⚠️ **Masih foto stok Wikimedia, bukan foto pelaksanaan sungguhan.**
      Kalimat "bukan foto ilustrasi" sudah dicabut dari galeri supaya halaman
      tidak menjanjikan yang tidak dipenuhi; **lisensi CC BY-SA belum
      ditelusuri** dan wajib beres sebelum produksi — lihat §11 butir 1
- [ ] ⚠️ **Section Galeri kini dicabut dari halaman**, bukan hanya kalimatnya.
      `{/* <GallerySection /> */}` di `app/(site)/page.tsx` — komponennya utuh,
      pemanggilnya yang dikomentari, jadi mengembalikannya satu baris. Ini langkah
      yang lebih jujur daripada memajang enam foto stok pada bagian yang isinya
      **janji dokumentasi**, tetapi konsekuensinya halaman kehilangan bagian yang
      paling menjelaskan produknya — dan lint menandainya sebagai komponen tak
      terpakai (§10). Keduanya selesai bersamaan begitu foto asli masuk
- [ ] Kode pos masih diketik manual — dataset Kemendagri tidak memuatnya
- [ ] Alamat pemesan (`participants.address`) masih teks bebas
- [ ] Panel jadwal admin belum memakai `requested_date` sebagai nilai awal
- [ ] Halaman program & katalog harga → `docs/28`. **Separuh tertutup 3
      September**: harga & isi paket kini satu sumber di `services` dan bisa
      diubah tanpa developer; yang belum halaman katalog tersendiri untuk
      pengunjung (landing hanya memuat ringkasannya)
- [ ] Halaman FAQ editable (CMS) → `docs/27`
- [ ] Payment Gateway UI + verifikasi
- [ ] Affiliate / Referral UI — `referral_code` sudah diterima checkout, belum ada yang mengolahnya
- [ ] Chatbot + human handoff → `docs/26`
- [x] **Layar sukses membawa pemesan ke WhatsApp admin (28 Agustus)** — arah
      percakapan dibalik. Ringkasan pesanannya sudah terisi, dibatasi pada yang
      sudah dilihat pemesan sendiri; `public_token` tidak ikut
- [ ] **Notifikasi WhatsApp otomatis** ke pemesan masih belum ada. Yang berubah:
      pemesan kini punya jalan keluar sendiri, jadi janji di halaman checkout
      tidak lagi menggantung. Bergantung Tahap 8
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

- [x] **764 unit test hijau di 65 berkas** — state machine order, urutan tahap (dibaca langsung dari migration), payload RPC laporan publik, katalog landing satu sumber dengan `services`, alur & path dokumentasi, kapabilitas, schema master mitra, filter schema, agregasi dashboard, format & aritmetika tanggal WIB, path & schema pembayaran, schema & wizard checkout, penyimpanan sementara isian checkout, rem laju & normalisasi nomor WhatsApp, ringkasan pesanan untuk WhatsApp admin, schema & isi paket katalog, dan — sejak 8–11 September — **langkah berikutnya per status order, foto wajib di laporan tahap, roda tetikus pada input angka, policy upsert Storage, sertifikat per anak, akun sendiri, & jargon internal yang bocor ke layar**
- [x] `ActionResult` + helper error disatukan di `server/actions/result.ts`
- [x] **Navigasi < 1024px** — bottom-nav + panel `≡`, disaring per role
- [x] Penanda aktif sidebar diturunkan dari `pathname`, berhenti di batas segmen
- [x] **Link mati "Pengaturan" sudah tertutup** — `/users` & `/vendors` kini ada, dan menu disaring per role
- [x] **CRUD mitra dilengkapi — 27 Agustus.** `/vendors` ternyata baru C dan
      sebagian U: dari lima server action mitra, **tiga tidak punya satu pun
      pemanggil** (`updateVendor`, `saveVendorService`, `deleteVendorService`),
      begitu pula dua query (`getVendorServices`, `getServiceOptions`).
      Akarnya satu — `app/(app)/vendors/[id]/page.tsx` tidak pernah dibuat,
      sampai-sampai `revalidatePath('/vendors/{id}')` di dalam action menunjuk
      rute yang tidak ada. Yang ditutup:
  - **Mitra tidak bisa disunting sama sekali.** Salah ketik nomor telepon,
    ganti rekening, perpanjang perjanjian — semuanya hanya lewat dashboard
    Supabase. Halaman detail + `VendorEditForm` menutupnya
  - **`vendor_services` tidak bisa diisi lewat aplikasi**, padahal
    `v_vendor_kpi.margin_total` jatuh dari sana lewat
    `order_items.vendor_unit_price`. Selama kosong, **dashboard melaporkan
    margin sebesar seluruh nilai order**. KPI margin (§5) angkanya jalan,
    tapi masukannya tidak pernah bisa diisi operator
  - **8 dari 22 medan skema tidak pernah bisa diisi** — formulir pendaftaran
    merender 13. Termasuk keempat kode wilayah, dan tanpa itu
    `resolveAddress()` mengembalikan `address: null` sehingga hanya alamat
    mentah yang tersimpan
  - **`vendor_coverage` nol referensi** di seluruh `server/`, `features/`, dan
    `app/` sejak lahir 20 Agustus — tabelnya kosong selamanya.
    `saveVendorCoverage` + panel wilayah menutupnya; nama wilayah dibaca
    ulang dari `regions`, tidak dipercaya dari klien
  - ~~**`updateVendorSchema` kini `omit({ code })`.**~~ **Dibalik 28 Agustus** —
    `code` kini ikut tersunting; alasannya di _Perubahan 28–31 Agustus_. Bug
    yang mendasari catatan ini tetap nyata dan tetap tertutup: `rowFrom()`
    menyusun `code` untuk kedua aksi, jadi meng-`omit`-nya akan menulis
    `undefined` ke kolom `not null`
  - **Logika cascade wilayah diekstrak** ke `use-region-cascade.ts`, dipakai
    bersama checkout. Yang dibagi hanya keadaannya — penanganan balapan saat
    provinsi diganti cepat — bukan tampilannya; menyalinnya berarti dua
    salinan logika halus yang harus sinkron
  - **30 tes baru** — 14 integrasi (`vendor-master.test.ts`: RLS ketiga tabel,
    admin baca-tapi-tidak-ubah, cascade vs restrict) + 16 unit
    (`vendor-schema.test.ts`)
- [x] **`tests/integration/` terisi — 151 tes di 11 berkas** (hitungan statis; angka 159 sebelumnya berasal dari jalannya) (27 Agustus, ditambah 28 Agustus & 3 September). Kelima trigger sasaran (`generate_stage_checklist`, `enforce_stage_order`, `enforce_stage_review`, `enforce_vendor_assignment`, `enforce_animal_delete`) plus `create_guest_order`, `get_public_report`, `confirm_delivery`, outbox notifikasi, progres hewan dari tahap, **RLS katalog paket, gerbang `landing_requires_active`, keutuhan `services.meta`, & batas penawaran mitra**, dan alur penuh kedua percabangan. Ditambah 8 September: penutupan otomatis notifikasi dashboard, dan gerbang urutan yang kini menerima `reported`. Prasyarat & rancangannya di `tests/integration/README.md`. ⚠️ **Tidak dijalankan pada pembaruan 18 September — Docker tidak hidup di mesin ini**
- [x] **RLS per role terjaga — 21 tes** (`rls.test.ts`, 24 Agustus). Yang dibuktikan: vendor A tidak melihat order/tahap/bukti/jadwal/kendala/laporan milik vendor B; order tanpa mitra tidak terbaca vendor mana pun; pembayaran & notifikasi tertutup dari vendor; **admin tidak dapat mengubah role** (termasuk dirinya sendiri) sementara superadmin bisa; vendor tidak dapat memindahkan dirinya ke mitra lain; bukti `approved` dan kendala tidak dapat dihapus siapa pun; `anon` membaca `services`+`regions` tetapi ditolak pada `orders`/`profiles`/`payments`; dan **view KPI menghormati RLS pemanggilnya** (`security_invoker`)
- [ ] `tests/e2e/` masih kosong (`.gitkeep`) — target: alur order → laporan end-to-end (`docs/21`)
- [ ] ⚠️ **Lint tidak lagi nol warning (18 September).** Satu tersisa:
      `GallerySection` didefinisikan tapi tidak dipakai di `app/(site)/page.tsx`
      — pemanggilnya dikomentari, bukan komponennya dihapus. Itu bukan sisa yang
      lupa dibersihkan melainkan **keputusan yang belum selesai**: galerinya
      dicabut dari halaman karena keenam fotonya masih stok Wikimedia (§11 butir
      1). Jadi warning-nya justru penanda yang benar — ia hilang sendiri begitu
      foto asli masuk dan baris `{/* <GallerySection /> */}` dibuka kembali.
      Klaim "nol warning" di §8 kini **hanya berlaku untuk keadaan 21 Agustus**
- [ ] Checklist keamanan `docs/20_SECURITY_CHECKLIST.md` belum ditelusuri satu per satu
- [ ] **Akun demo `*@suksesaqiqah.test` (password `Password123!`)** — `02_demo.sql` tidak ikut `db push`, tapi akun lama yang terlanjur ada di cloud wajib dihapus sebelum produksi
- [x] **`docs/05`–`08` ditulis ulang — 3 September.** Keempatnya tertinggal enam
      pekan: masih menggambarkan cabang, lima role, `slaughter_records`, dan
      tahapan lapangan sebagai status order. Isinya kini disusun dari skema
      sungguhan (22 tabel, 4 view, 16 enum, 35 fungsi, 41 trigger di-dump lebih
      dulu), lengkap dengan modul **Katalog Paket** yang belum pernah masuk
      dokumen. Dijaga `docs-schema-sync.test.ts` supaya tidak tertinggal lagi
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
      Satu listener `scroll` dipakai bersama seluruh `Reveal` (halaman ini punya 43) dengan ambang 4px untuk menelan getaran gulir inersia di ponsel.
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
  5. `text-neutral-400` (≈2,6:1, gagal AA) **nol** di checkout maupun landing —
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
- [ ] **§8 State & Feedback — sebagian besar tertutup.** **Toast** dipakai
      checkout & seluruh layar katalog lewat `hooks/use-toast.ts` (3 September),
      pada jalur berhasil **dan** gagal. **8 September menutup tiga lagi**:
      `loading.tsx` untuk enam rute yang belum punya (sebelumnya hanya dashboard —
      rute lain menahan navigasi sementara peramban masih menampilkan halaman
      sebelumnya, jadi operator tidak bisa membedakan "sedang dimuat" dari
      "kliknya tidak masuk"), `ListPageSkeleton`, dan **konfirmasi aksi
      destruktif** (dialog hapus laporan & hapus lokasi). `BusyButton` +
      `RouteProgress` menutup keluhan yang mendasarinya: **78 tombol** memakai
      `disabled={pending}` — mati saat ditekan tapi diam, dan mati tanpa berkata
      apa-apa terbaca sama persis dengan rusak; semuanya tertunda 120ms supaya
      aksi yang selesai sekejap tidak berkedip. Yang tersisa: halaman staf lain
      (order, pembayaran, jadwal) masih memakai pesan sebaris, `error.tsx` belum
      ada, dan banner "Mode offline" menunggu PWA
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
- [x] **Blok `.dark` didokumentasikan, bukan dihapus — 3 September.** Tidak ada
      yang pernah memasang kelas `.dark`, jadi cabang itu tidak pernah menyala —
      tetapi varian `dark:` masih dirujuk `button.tsx` & `input.tsx`, sehingga
      menghapusnya membuat keduanya menunjuk token yang tidak ada. Kerusakannya
      baru terlihat kalau mode gelap kelak dinyalakan; komentarnya kini menerangkan
      itu beserta apa yang perlu diperiksa lebih dulu
- [ ] Mode gelap sendiri **belum** dinyalakan — warna sidebar & badge status
      sebagian ditulis sebagai kelas Tailwind terang yang tidak ikut berganti
- [x] **`design.md §2` dikoreksi — 3 September.** Dulu menyebut Radix &
      Recharts; kenyataannya `@base-ui/react` dan bar CSS buatan sendiri.
      Alasannya ikut dicatat, dan `docs-schema-sync.test.ts` membacanya dari
      `package.json` — bukan dari salinan

---

## 11. Urutan kejar berikutnya

| #     | Pekerjaan                                                                                                          | Kenapa didahulukan                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Pemilik       |
| ----- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| ~~**0**~~ | ~~**Pastikan keadaan cloud**~~                                                                                  | **Selesai 21 September.** `supabase db push` dijalankan; cloud kini **53/53 tercatat** dan skemanya terverifikasi selaras lewat sebelas penanda: `vendors` & `order_stage_events` ada, `doc_stage` tanpa `umum`, `documentations.stage_event_id` NOT NULL, gerbang tahap `reported`, `locations_insert` ada, `v_open_orders` LEFT JOIN, `child_photo_path` ada, `booking_min_days` = 1, profil superadmin hidup. **Data produksi utuh** — 4 order, 2 pembayaran, 15 peserta, 7 dokumentasi, 3 laporan, `regions` 91.599. Lihat catatan push di bawah tabel ini | Bani          |
| **1** | **Uji alur penuh di cloud** — _jalankan `full-flow.test.ts` dengan `TEST_DB_URL` diarahkan ke cloud_               | Naik dari #2 setelah §0 tuntas — **inilah sekarang yang menahan tiga dari lima butir Definition of Done** (§12). Alurnya sudah terbukti di lokal, yang tersisa membuktikannya di sana. **Butuh keputusan lebih dulu**: tes ini menulis baris, dan cloud sudah berisi 4 order + 2 pembayaran sungguhan. Pilihannya — pakai project Supabase terpisah untuk staging, atau jalankan di produksi dengan sadar bahwa `inRollback` membatalkan tiap transaksi (tetapi `order_counters` dan sequence tetap maju). **Ingat pelajaran 18 September**: terbukti untuk satu peran bukan terbukti untuk semuanya — jalankan juga sebagai akun mitra | Bani          |
| **2** | **Ganti 10 foto stok dengan foto pelaksanaan sungguhan** → `public/images/landing/`                                | Kesepuluh slot **sudah terisi** 28 Agustus, tetapi dengan foto Wikimedia Commons sebagai penahan sementara. Dua sebab menggantinya: **lisensi CC BY-SA menuntut atribusi** yang belum ditelusuri sama sekali, dan galeri yang menjanjikan dokumentasi jauh lebih meyakinkan dengan foto sendiri. **Sejak itu galerinya ikut dicabut dari halaman** (`{/* <GallerySection /> */}`), jadi yang menunggu bukan lagi sekadar mengganti berkas: mengembalikan section-nya satu baris, dan warning lint §10 ikut hilang bersamanya. Kalimat "bukan foto ilustrasi" menunggu dikembalikan di komentar `GallerySection` | Pemilik usaha |
| 3     | **`tests/e2e/` masih kosong** (§10)                                                                                | Lapisan yang tersisa sesudah unit + integrasi: alur order → laporan lewat UI sungguhan (`docs/21`). Nilainya kini berbeda dari sebelumnya — rantai databasenya sudah terbukti, jadi e2e tinggal menjaga lapisan yang belum tersentuh: formulir, navigasi, dan unggahan berkas                                                                                                                                                                                                                                                                                                                                   | Awalin        |
| 4     | **Worker pengirim** (sisa Tahap 8)                                                                                 | Outbox & alert in-app **selesai 24 Agustus** — peristiwanya kini tercatat dan tidak ada lagi yang terlewat, tetapi pengirimannya masih manual-klik. Yang tersisa: worker yang membaca antrian queued dan benar-benar mengirim. Butuh keputusan kredensial (n8n vs di dalam app) — lihat §6                                                                                                                                                                                                                                                                                                                      | Bani          |
| 5     | **PWA** (kamera, kompresi klien, antrian offline)                                                                  | Dokumentasi sudah bisa diunggah, tapi belum nyaman dipakai vendor di lapangan                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Awalin        |
| 6     | **`design.md §8`** — toast, `loading.tsx`/`error.tsx`, `Skeleton`                                                  | Celah design system yang paling terasa pengguna; murah dan menyentuh seluruh halaman                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Awalin        |
| 7     | Realtime + filter periode dashboard                                                                                | Penyempurnaan, bukan penghalang                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Awalin        |
| ~~—~~ | ~~**Push `20260903020000` ke cloud**~~                                                                             | **Selesai 3 September** — `db push --dry-run` melaporkan _"Remote database is up to date"_ dan `migration list` menunjukkan **42/42 selaras**. Kesepuluh baris katalog diperiksa utuh sesudahnya lewat jalur `anon`. Bug slug bekas paket terhapus kini tertutup di produksi                                                                                                                                                                                                                                                                                                                                    | Bani          |
| ~~—~~ | ~~**Verifikasi RLS katalog di cloud**~~                                                                            | **Selesai 3 September** — diuji sebagai `anon` dengan kunci publik: UPDATE harga, INSERT, DELETE, serta perubahan `tagline`/`meta`/`is_popular`/`show_on_landing` semuanya ditolak, dan tiap penolakan dibuktikan lewat baca ulang (RLS menyaring baris, jadi `200`/`204` bukan tanda lolos). Qurban tetap tidak dipasarkan                                                                                                                                                                                                                                                                                     | Bani          |
| ~~—~~ | ~~**Jalankan `20260821010000` di lokal**~~                                                                         | **Selesai 21 Agustus** — 37 migration jalan bersih, terverifikasi lewat jalur `anon` di lokal **dan** cloud (§4)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Bani          |
| ~~—~~ | ~~**`npm run db:push`**~~                                                                                          | **Selesai** — seluruh 37 migration sudah ter-push; `db push --dry-run` melaporkan remote up-to-date, dan inspeksi tabel remote memastikan skema barunya hidup (§1 Tahap 1)                                                                                                                                                                                                                                                                                                                                                                                                                                      | Bani          |
| ~~—~~ | ~~**Putuskan nasib Qurban**~~                                                                                      | **Diputuskan 21 Agustus: dicabut dari pemasaran, fokus aqiqah** (§8)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | —             |

> **Catatan push 21 September — `db push` menawarkan SELURUH 53 berkas, bukan 3.**
>
> Pembukuan `supabase_migrations.schema_migrations` di cloud ternyata **kosong**,
> padahal skemanya sudah maju. CLI karena itu menganggap tidak ada satu pun
> migration pernah dijalankan, dan menawarkan seluruh riwayat — termasuk
> `20260820000000_reset_keep_regions.sql` yang men-`drop table` seluruh tabel
> operasional. Daftar persetujuannya bahkan memuat `20260908010000` dan
> `20260908020000` **dua kali**.
>
> **Data selamat**, dan alasannya layak dicatat: daftar `drop table` pada reset
> itu berisi skema **lama**, sementara `vendors`, `vendor_services`,
> `order_stage_events`, dan `stage_requirements` lahir sesudahnya. Tabel-tabel
> itu tersisa, penjaga di akhir berkas (`raise exception 'Reset tidak bersih'`)
> menyalak, dan **satu berkas migration = satu transaksi** membatalkan seluruh
> drop. Penjaga itu ditulis untuk alasan lain; hari itu ia mencegah kehilangan
> data produksi.
>
> **Aturan yang berlaku mulai sekarang:**
>
> 1. **Jalankan `supabase migration list` SEBELUM `db push`**, selalu. Ia membaca
>    pembukuan; `db push` hanya menyimpulkan dari selisih.
> 2. **Jangan jawab "Yes" bila daftarnya lebih panjang dari yang diharapkan.**
>    Daftar panjang berarti pembukuannya tidak sinkron — bukan berarti ada banyak
>    pekerjaan tertunda. Yang benar: `supabase migration repair --status applied
>    <versi>` untuk yang sebetulnya sudah jalan, baru push sisanya.
> 3. **Gejala bukan pembukuan.** Sempat disimpulkan dari galat
>    `invalid input value for enum doc_stage: "umum"` bahwa `20260908020000`
>    sudah ter-push — kesimpulannya kebetulan benar, metodenya tidak. Enum bisa
>    berubah lewat jalur lain, dan pembukuan bisa kosong meski skemanya maju.
>    Persis itu yang terjadi di sini.
>
> **Belum terjelaskan:** kenapa pembukuannya kosong padahal pembaruan 3 September
> mencatat `migration list` menunjukkan 42/42. Tidak mendesak — keadaan sekarang
> sudah benar dan tercatat 53/53 — tetapi kalau terulang, itu petunjuk ada yang
> me-reset tabel pembukuan di luar alur `db push`.

---

## 12. Definition of Done — Phase 1

- [ ] Litmus test terjawab < 10 detik di dashboard — terbukti di lokal (§0); **skema cloud kini selaras (21 Sept)**, tetapi belum dibuka orang sungguhan di sana
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

> **Tambahan 18 September.** Butir 1 sempat lebih jauh dari tercentang daripada
> yang tertulis di atas: litmus test **tidak terjawab sama sekali bagi akun
> mitra** sampai 8 September, sebab `v_open_orders` mengembalikan nol baris bagi
> mereka. Yang tercatat "terbukti di lokal" waktu itu benar — tesnya memang
> hijau — tetapi tesnya menempuh jalur staf, dan peran yang paling sering membuka
> halaman itu justru tidak pernah diuji terhadapnya. Pengingat yang berlaku untuk
> keempat butir sisanya: **terbukti untuk satu peran bukan terbukti untuk
> semuanya.**

---

### Referensi silang

- Pembagian kerja & gate antar tahap → `TEAM_PLAN.md`
- Roadmap & exit criteria per fase → `docs/23_MVP_ROADMAP.md`
- Urutan teknis build → `docs/25_BUILD_SEQUENCE.md`
- Skema & view → `docs/05_DATABASE_DESIGN.md` ✅ **selaras (v2.0, 3 September)**
