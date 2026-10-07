# Pemesanan Katering — Rencana & Progres

| Field | Value |
|-------|-------|
| Dokumen | `docs/29_KATERING_PROGRESS.md` |
| Versi | 2.0 — selesai & sudah di produksi |
| Tanggal | 2026-09-22 |
| Status | **Selesai.** 56/56 migration selaras lokal ↔ cloud; paket katering terbaca lewat jalur `anon` di produksi |
| Rencana lengkap | `~/.claude/plans/coba-cek-dan-analisis-golden-sonnet.md` |

---

## 1. Kenapa ini ada

Checkout publik hari ini **hanya melayani Aqiqah**. Pesanan aqiqah menghasilkan
lauknya saja; kalau pembeli ingin dipaketkan dengan nasi, ia menambah **nasi
box** (Paket A–E) sebagai tambahan opsional — dan memang opsional, sebab tidak
semua orang ingin aqiqahnya dikotakkan.

Yang belum ada: memesan **katering saja, tanpa aqiqah**.

Paket A–E tidak bisa merangkap: isinya gulai kambing & sate — itu lauk aqiqah,
bukan menu katering acara. Jadi katering butuh **katalog paketnya sendiri**.

**Keputusan: form dipisah.** Form aqiqah di `/checkout` tidak berubah sama
sekali, termasuk tambahan nasi boxnya.

<details>
<summary>Kenapa dipisah, bukan disatukan</summary>

Aqiqah dan katering berbeda **di bawah** form, bukan hanya di atasnya. Pesanan
aqiqah melahirkan baris `animals`, dan dari situ mengalir: jumlah ekor, data
lahir anak, jenis kelamin anak, tahapan vendor yang memuat penyembelihan,
gerbang "tidak bisa ditugaskan tanpa data hewan", dan sertifikat aqiqah.
Katering tidak punya satu pun dari itu.

Form gabungan berarti setiap aturan jadi bersyarat di **tiga lapis** yang wajib
sepakat selamanya — validasi di layar, zod, dan fungsi database. Begitu
ketiganya berselisih, gejalanya persis yang sudah pernah terjadi di repo ini:
pemesan lolos seluruh isian, menekan konfirmasi, lalu ditolak database dengan
pesan yang tidak ia mengerti.
</details>

---

## 2. Keputusan pemilik — sudah dijawab 21 September

| # | Pertanyaan | Jawaban | Akibatnya pada kode |
|---|-----------|---------|---------------------|
| **K1** | Tahap `persiapan` ikut muncul untuk katering? | **Biarkan** | Nol baris berubah. Vendor menandainya sekali, tanpa bukti (`min_docs = 0`) |
| **K2** | Vendor wajib foto proses masak? | **Tidak wajib** | Lihat catatan di bawah — **tidak** dikerjakan dengan menurunkan `min_docs` |
| **K3** | Satu order: satu paket atau campur? | **Boleh campur** | `items` berupa array di schema & RPC; form punya baris yang bisa ditambah/dihapus |

> **K2 menuntut cara yang tidak terduga.** Yang tampak paling mudah — `update
> stage_requirements set min_docs = 0 where stage = 'masak'` — adalah cara yang
> salah, dan kesalahannya senyap: tabel itu berlaku **per tahap, global**, tidak
> per jenis order. Satu baris itu akan ikut melepas gerbang bukti masak untuk
> **seluruh order aqiqah yang sudah berjalan**, tanpa satu pun galat.
>
> Jadi gerbangnya yang diajari membedakan, bukan aturannya yang dilemahkan:
> `stage_requirements` tetap utuh (masak = 1 bukti), dan `missing_doc_stages` di
> `v_order_progress` mendapat satu syarat tambahan — lewati `masak` bila
> `is_catering_order(o.id)`.
>
> **Ongkos yang diterima:** aturan "tahap mana butuh bukti" kini tinggal di dua
> tempat. Itu nyata. Yang membuatnya tetap lebih murah daripada menambah kolom
> `service_type` ke `stage_requirements`: pengecualian ini satu baris yang
> terbaca apa adanya, sedangkan kolom baru menuntut tiap pembaca tabel itu tahu
> jenis ordernya — dan pembacanya bukan hanya view ini. Kalau kelak
> pengecualiannya bertambah, itulah saatnya berpindah ke tabel per-jenis.

Asumsi yang **sudah** dipakai tanpa perlu ditanya lagi:

- Katering **selalu diantar** (`kirim`). Form tidak menanyakan cara penyaluran.
  Efek sampingnya bagus: pembeli tetap bisa menekan "pesanan sudah saya terima"
  di halaman laporan.
- Rutenya **`/checkout/katering`**. `/checkout` tetap milik aqiqah, jadi tidak
  ada tautan lama yang putus.

---

## 3. Temuan yang membatalkan bagian termahal rencana

**Urutan tahap tidak perlu diubah sama sekali.**

Rencana awal menyebut ini bagian paling mahal: mengganti tanda tangan
`fulfilment_sequence()` supaya katering melewati penyembelihan, lalu
membongkar-pasang empat view yang bergantung padanya.

Ternyata tidak perlu. Cabang `sembelih` di trigger mengambil barisnya **dari
tabel hewan** (`20260820000400_stage_events.sql:150-156`) — order tanpa hewan
menghasilkan nol baris sembelih dengan sendirinya.

Sudah ada tesnya, dan namanya persis itu:

> `tests/integration/stage-checklist.test.ts:116`
> *"order tanpa hewan tetap menerbitkan tahap non-sembelih"* → `['persiapan', 'masak', 'salur']`

Jadi order katering otomatis mendapat **`persiapan → masak → kirim → terkirim`**
tanpa satu baris pun diubah.

Yang tersisa sebagai ongkos: tahap `persiapan` ikut muncul padahal tidak ada
yang perlu disiapkan. Tahap itu **tidak menuntut bukti** (`min_docs = 0`), jadi
vendor cukup menandainya sekali. Pertukaran yang murah — itulah isi **K1**.

**Akibatnya rencana menyusut banyak:** tidak ada pembongkaran view, tidak ada
perubahan tanda tangan fungsi, tidak ada perubahan pada kembaran TypeScript
`features/stages/sequence.ts`, dan `tests/unit/stage-sequence.test.ts` tetap
hijau.

---

## 4. Progres

**Tahap 1–5 selesai & terverifikasi 21 September.** `npm run typecheck` ✅ ·
`npm run lint` ✅ · `npm run build` ✅ (24 rute, `/checkout/katering` terdaftar,
landing tetap prerender statis) · **798 unit test hijau** (dari 770 — 28 baru) ·
**183 tes integrasi hijau**, termasuk `catering-rpc.test.ts` **19/19**.

Ketiga migration jalan bersih lewat `db reset`, dan `types/database.ts`
di-generate ulang dari database — suntingan tangan sementara tertimpa,
sebagaimana mestinya.

> **Menjalankan tes integrasi juga membongkar 7 tes yang sudah patah sejak
> 8 September**, tidak ada hubungannya dengan katering: semuanya menyisipkan
> `documentations` tanpa `stage_event_id`, yang menjadi NOT NULL lewat
> `20260908030000`. Diperbaiki dengan helper `attachDoc()`. Rincian di
> `TASKS.md`.

### Prasyarat

| Status | Butir | Catatan |
|:---:|---|---|
| ✅ | **Samakan migration lokal ↔ cloud** | Selesai 21 Sept — cloud 53/53 tercatat, skema terverifikasi 11 penanda, data utuh |
| ✅ | Supabase CLI | Terpasang |
| ✅ | Docker & database lokal | Hidup; `db reset` + `test:integration` berjalan |

### Tahap 1 — Database

| Status | Butir | Berkas |
|:---:|---|---|
| ✅ | Nilai enum `katering` | `20260921010000_service_type_katering.sql` — **sendirian**, sesuai §5 |
| ✅ | Seed paket katering (3 paket) + `is_catering_order()` + gerbang K2 | `20260921020000_catering_packages.sql` |
| ✅ | RPC `create_catering_order` | `20260921030000_create_catering_order.sql` |
| ✅ | `npm run db:types` | Di-generate dari database; suntingan tangan sementara sudah tertimpa |

### Tahap 2 — Katalog (admin bisa mengisi paket)

| Status | Butir | Berkas |
|:---:|---|---|
| ✅ | zod enum + `'katering'` | `features/services/schema.ts` |
| ✅ | `TYPE_LABEL` + `TYPE_ORDER` | `service-form.tsx` |
| ✅ | 4 cabang `nasi_box` → `isPerBoxType()` | `service-form.tsx` — dipusatkan jadi satu fungsi, bukan disalin empat kali |
| ✅ | Cabang `meta` ikut menerima katering | `server/actions/services.ts` |
| ✅ | Satuan "per box" di panel modal mitra | `vendor-service-panel.tsx` |

### Tahap 3 — Form publik

| Status | Butir | Berkas |
|:---:|---|---|
| ✅ | Halaman | `app/(site)/checkout/katering/page.tsx` |
| ✅ | Schema | `features/catering/schema.ts` |
| ✅ | Query pilihan paket | `features/catering/queries.ts` |
| ✅ | Draft — kunci `sa-catering-draft-v1` | `features/catering/draft.ts` |
| ✅ | Form 3 langkah, baris item bisa ditambah/dihapus (K3) | `features/catering/components/catering-form.tsx` |
| ✅ | Server action + rem laju per IP (instance sendiri) | `server/actions/catering.ts` |
| ✅ | Blok katering di landing | `app/(site)/page.tsx` |

**Dipakai ulang apa adanya — jangan disalin:** `features/checkout/address.ts`,
`use-region-cascade.ts`, `components/address-picker.tsx`, `steps/field-error.tsx`,
`steps/summary-row.tsx`, `steps/stepper-button.tsx`, `bookingMinDate()`,
`bookingMaxDate()`, `BOOKING_TIME_SLOTS`, `useToast`, `ActionResult`.

`checkout-form.tsx` yang 1146 baris **tidak di-fork** — form katering jauh lebih
pendek, tulis versinya sendiri dengan pola yang sama.

### Tahap 4 — Layar admin, vendor, pembeli

| Status | Butir | Berkas |
|:---:|---|---|
| ✅ | Gerbang "belum ada data hewan" tidak menjerat katering | `state-machine.ts` — lewat `ctx.isCateringOrder` |
| ✅ | Panel **Hewan** disembunyikan | `app/(app)/orders/[id]/page.tsx` |
| ✅ | `paid: ['jadwal','hewan']` disaring + judul langkah disesuaikan | `features/orders/next-step.ts` |
| ✅ | Kartu "Dipotong/Terdistribusi N ekor" disembunyikan | `app/r/[token]/page.tsx` |
| ✅ | Blok yang sama di PDF | `features/reporting/pdf.tsx` |
| ✅ | Saringan katering di landing | `features/landing/catalogue.ts` |

> **`isCateringOrder` diturunkan dari item yang sudah dimuat**, bukan query
> tambahan: `getOrderDetail` sudah memuat `service.type` per item. Cerminan
> `public.is_catering_order()` di database — keduanya menjawab pertanyaan yang
> sama dari data yang sama.
>
> Kartu per-ekor di halaman laporan & PDF disembunyikan berdasarkan
> `animalsTotal > 0`, bukan jenis ordernya: pesanan tanpa hewan selalu bernilai
> 0/0, dan "Dipotong 0/0 ekor" pada halaman yang dibaca pembeli terbaca seperti
> pekerjaan yang belum jalan.

**Tidak perlu disentuh** — sudah aman dengan sendirinya:
panel sertifikat (`page.tsx:418`, sudah bersyarat `childNames.length > 0`),
RLS `services_select_public`, `assignVendor` (katering tetap `kirim`),
`enforce_vendor_assignment`, notifikasi order tamu (bersandar `created_by IS NULL`).

### Tahap 5 — Tes

| Status | Butir | Berkas |
|:---:|---|---|
| ✅ | **Patah:** menuntut `'katering'` ditolak → contohnya diganti `'laundry'` | `tests/unit/service-schema.test.ts` |
| ✅ | **Patah:** memeriksa teks sumber cabang `nasi_box` (3 tempat, bukan 2) | `tests/unit/service-meta.test.ts` |
| ✅ | Baru — schema katering (24 tes) | `tests/unit/catering-schema.test.ts` |
| ✅ | Baru — katering tidak lenyap dari landing (4 tes) | `tests/unit/landing-catalogue.test.ts` |
| ✅ | Baru — RPC: harga tak pernah dari klien, **nol baris `animals`**, K2 (19 tes) | `tests/integration/catering-rpc.test.ts` — **19/19 hijau** |
| ✅ | Baru — tahap katering persis 4, lewat `assigned` | `tests/integration/stage-checklist.test.ts` — hijau |

Tiga helper `ctx()` di tes state machine ikut mendapat medan `isCateringOrder`
(`order-state-machine`, `order-next-step`, `payment-auto-advance`).

`tests/unit/stage-sequence.test.ts` **tetap hijau** — itulah gunanya tidak
menyentuh tanda tangan fungsi (§3).

### Sudah di produksi — 22 September

`supabase migration list` melaporkan **56/56 selaras**, dan ketiga paket katering
terbaca lewat jalur `anon` di `uerdxyurhgoywewbineg` (project yang dipakai
aplikasi). RPC `create_catering_order` terdaftar dan menolak payload kosong
dengan pesan validasinya sendiri.

> **Jalan ke sana sempat tersesat, dan itu layak dicatat.** `supabase link`
> semula menunjuk `zvqlxntmrwcfwnemtioc` — project milik akun CLI yang berbeda
> dari pemilik produksi. Push 21 September mendarat di sana, bukan di produksi.
> Yang menyelamatkan: project itu baru berumur 5 hari dan kosong.
>
> Gejalanya membingungkan justru karena tampak masuk akal: pembukuan migration
> "kosong" padahal skemanya maju — dua fakta yang berasal dari **dua project
> berbeda**. Pelajarannya sudah ditulis di `TASKS.md §11`: jalankan
> `supabase projects list` dan pastikan link-nya benar sebelum `db push`, dan
> jangan jawab "Yes" bila daftarnya lebih panjang dari yang diharapkan.

### Yang menyusul sesudah katering jalan

| Tanggal | Perubahan |
| --- | --- |
| 22 Sept | Halaman depan: tab penyaring jenis (Pilihan/Aqiqah/Katering), kartu seragam untuk aqiqah & katering |
| 22 Sept | Nasi box **dikembalikan** ke blok ringkas — ia tambahan atas aqiqah, dan `create_guest_order` menolaknya sebagai paket utama |
| 22 Sept | Tautan kartu membawa `?paket={slug}`; checkout katering membacanya |
| 22 Sept | Enam layar CRUD dipindah ke modal; primitif `components/ui/modal.tsx` lahir |
| 22 Sept | `vendor_unit_price` akhirnya terisi saat penugasan — margin dashboard tidak lagi terbaca 100% |

### Satu hal yang ditemukan saat menempuh tesnya

**Order katering tetap menunggu verifikasi admin.** `create_catering_order`
menghasilkan order tamu (`created_by IS NULL`), jadi
`enforce_guest_order_verification` menahannya di `new` sampai admin memeriksa —
aturan yang sama persis dengan order aqiqah dari checkout publik.

Itu bukan kekeliruan yang perlu diperbaiki, melainkan perilaku yang benar:
pesanan dari orang yang belum pernah dihubungi harus dilihat manusia sebelum
mitra ditugaskan. Tes yang semula melompatinya justru yang keliru, dan sekarang
menempuh `verified → assigned` sebagaimana admin sungguhan.

### Yang tersisa — bukan kode

Dua hal, keduanya keputusan & pekerjaan pemilik usaha:

| Butir | Cara |
| --- | --- |
| **`show_on_landing` ketiga paket katering masih `false`** — tab Katering di halaman depan kosong sampai dinyalakan | Vendors → Katalog → **Edit** → centang "Dipasarkan di halaman depan" |
| **Belum ada foto** untuk paket katering | Modal Edit yang sama, bagian foto di atas formulir. JPG/PNG/WebP, maks 5 MB |

Kartu tanpa foto tetap rapi (blok gambarnya hilang, bukan kotak kosong), jadi
ini bisa menunggu sampai fotonya siap.

Harga & menu ketiga paket bawaan juga **contoh awal** — memang untuk disunting
pemilik lewat halaman katalog, bukan angka yang mengikat.

---

## 5. Jebakan yang sudah diketahui

**Nilai enum wajib sendirian di satu berkas migration.** Postgres menolak nilai
enum baru **dipakai** dalam transaksi yang sama dengan yang menambahkannya, dan
`supabase db push` membungkus tiap berkas sebagai satu transaksi. Jadi seed
paket katering dan RPC-nya **wajib** di berkas berikutnya. Digabung = gagal.

**Kunci draft harus berbeda, bukan sekadar versi dinaikkan.** `draft.ts` memakai
singgahan tingkat-modul; kunci yang sama akan memulihkan isian aqiqah ke dalam
form katering.

**Definisi view yang hidup bukan yang paling mudah ditemukan.** `v_order_progress`
dan `v_open_orders` yang berlaku ada di `20260908020000_doc_stage_drop_umum.sql`,
**bukan** di `20260820000700_views.sql`. Begitu pula `create_guest_order`:
versi hidupnya di `20260824010000_booking_lead_time.sql:49`. (Relevan hanya bila
K1 dijawab B.)

---

## 6. Dua bug lama yang ditemukan di jalan

Bukan bagian pekerjaan ini. Dicatat supaya tidak hilang.

1. **Order buatan staf tidak bisa ditugaskan ke mitra sama sekali.**
   `createOrderSchema` (`features/orders/schema.ts:39`) tidak pernah
   mengumpulkan `distribution_mode`, sementara `assignVendor`
   (`server/actions/schedules.ts:341`) dan trigger `generate_stage_checklist`
   sama-sama menolak tanpanya. Order dari checkout publik tidak kena.
   **Ikut menjerat katering** kalau kelak staf membuatnya dari dalam aplikasi.
   Perbaikannya kecil: satu `<Select>` di `order-form.tsx` + medannya di schema —
   `create_order` sudah membaca `distribution_mode` dari payload.

2. Cabang `qurban` di `create_guest_order` tidak terjangkau —
   `getCheckoutOptions` hanya memuat `type = 'aqiqah'`.
