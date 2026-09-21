# 16 — API SPEC

> **Sukses Aqiqah** — _"Tunaikan Ibadah, Tebarkan Manfaat"_
> Entity mengikuti **05_DATABASE_DESIGN**; akses mengikuti **07_USER_ROLES**.

| Field   | Value                                                                  |
| ------- | ---------------------------------------------------------------------- |
| Dokumen | 16_API_SPEC                                                            |
| Versi   | 2.0 — ditulis ulang mengikuti yang benar-benar dibangun                 |
| Tanggal | 2026-09-21                                                             |
| Status  | **Selaras dengan `server/actions/*` & `20260820001100_public_rpc.sql`** |

> **Kenapa ditulis ulang.** v1.0 (14 Juni) merancang REST API bergaya
> `/api/orders/{id}/status` lengkap dengan `branch_id`, `pic_user_id`,
> `slaughter_records`, dan validasi dokumentasi dua tingkat. **Tidak satu pun
> dibangun.** Yang ada di `app/` hanya dua route handler; seluruh mutasi berjalan
> lewat **Server Action**. Menyimpan spesifikasi REST yang tak pernah ada
> membuat dokumen ini menggambarkan sistem yang berbeda dari yang berjalan.

---

## 1. Bentuk kontrak

Mutasi adalah **Next.js Server Action**, dipanggil langsung dari komponen klien
sebagai fungsi — bukan lewat URL. Tidak ada lapisan REST di antaranya, dan itu
disengaja: satu lapisan lebih sedikit untuk dijaga sinkron, dan tipe argumennya
diperiksa compiler alih-alih diuraikan dari JSON.

Setiap action menerima `unknown`, memvalidasinya dengan Zod, lalu mengembalikan
bentuk yang seragam (`server/actions/result.ts`):

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ActionErrorCode; message: string; fields?: Record<string, string> } };
```

| Kode              | Kapan                                                    |
| ----------------- | -------------------------------------------------------- |
| `UNAUTHENTICATED` | Sesi tidak ada                                           |
| `FORBIDDEN`       | Kapabilitas tidak dimiliki role (`server/auth/capabilities.ts`) |
| `NOT_FOUND`       | Baris tidak ada — **atau** tersaring RLS (lihat §6)      |
| `VALIDATION_ERROR`| Zod menolak; `fields` memetakan `field → pesan` ke form  |
| `CONFLICT`        | Precondition tidak terpenuhi (transisi status, rem laju) |
| `INTERNAL`        | Kegagalan tak terduga; detailnya ke log, bukan ke layar  |

> **Pesan mentah Postgres tidak pernah sampai ke layar** — isinya membocorkan
> nama tabel, kolom, dan kebijakan RLS. Pengecualiannya satu: penolakan yang
> memang ditulis untuk dibaca pengunjung (`23514`, `P0002`, `P0003` dari
> `create_guest_order`), yang pesannya sudah berbahasa Indonesia.

---

## 2. Route handler — hanya dua

| Path                        | Akses  | Untuk                                                  |
| --------------------------- | ------ | ------------------------------------------------------ |
| `app/auth/callback/route.ts`| publik | Pertukaran kode OAuth/magic link Supabase              |
| `app/api/session/heartbeat/route.ts` | login | Penanda aktivitas untuk logout otomatis saat idle |

Keduanya memang harus berupa URL: yang pertama tujuan redirect dari Supabase,
yang kedua dipanggil `fetch` dari peramban.

---

## 3. RPC untuk pengunjung anonim

`anon` ditolak RLS di **setiap** tabel operasional, jadi seluruh penulisan dari
halaman publik lewat fungsi `SECURITY DEFINER` yang mengunci bentuk dan batasnya
di level database — bukan lewat service role yang pembatasannya bergantung pada
kebenaran kode TypeScript.

| RPC                  | Dipanggil dari                    | Mengunci                                            |
| -------------------- | --------------------------------- | --------------------------------------------------- |
| `create_guest_order` | `createGuestOrderAction`          | Harga dibaca dari `services`; kiriman klien diabaikan |
| `get_public_report`  | `server/services/public-report.ts`| Bentuk keluaran; tanpa kontak peserta                |
| `confirm_delivery`   | Halaman `/r/{token}`              | Idempoten; hanya order mode `kirim`                  |

**`create_guest_order` — yang tidak ada di payload:** harga, total, status, dan
jumlah terbayar. Ketiganya ditentukan RPC dari tabel `services`. Menerimanya dari
form berarti siapa pun bisa memesan seharga nol rupiah.

**Yang dikirim hanya kode wilayah**, bukan namanya — nama diambil RPC dari
`regions`, karena yang dibaca kurir adalah namanya dan nama kiriman klien bisa
berbeda dari kodenya.

---

## 4. Server Action per modul

### 4.1 Checkout & order

| Action                  | Kapabilitas         | Catatan                                       |
| ----------------------- | ------------------- | --------------------------------------------- |
| `createGuestOrderAction`| publik              | Rem laju per IP (10/10 menit) sebelum validasi |
| `createOrder`           | `UPDATE_ORDER`      | Lewat RPC `create_order` (bukan SECURITY DEFINER) |
| `updateOrder`           | `UPDATE_ORDER`      |                                               |
| `verifyGuestOrder`      | `VERIFY_GUEST_ORDER`| Pintu pertama order tamu                      |
| `changeOrderStatus`     | `UPDATE_ORDER_STATUS`| Divalidasi `features/orders/state-machine.ts` |
| `addAnimal` / `deleteAnimal` | `MANAGE_ANIMALS`| Hapus ditolak trigger bila tahapnya berjalan  |

### 4.2 Pembayaran

`recordPayment`, `verifyPayment`, `deletePayment` — seluruhnya `is_staff()`.
`paid_amount` dihitung trigger `sync_order_payment`, tidak pernah dikirim klien.

### 4.3 Tahapan lapangan

| Action             | Aktor  | Dijaga                                          |
| ------------------ | ------ | ----------------------------------------------- |
| `reportStage`      | vendor | `enforce_stage_order` — gerbangnya `reported`   |
| `reviewStage`      | admin  | `enforce_stage_review` — pelapor ≠ validator    |
| `resetStageReport` | admin  | Mengembalikan tahap ke `pending`                |

### 4.4 Dokumentasi

`uploadDocumentation`, `reviewDocumentation`, `deleteDocumentation`.

> **Bukti wajib menempel pada satu laporan tahap** sejak 8 September
> (`20260908030000`): `stage_event_id` NOT NULL. `uploadDocumentation`
> menurunkan tahap & order dari baris tahapnya — klien tidak mengirim
> `stage` sendiri, dan `enforce_documentation_stage_match` menegakkannya.

Validasi **satu tingkat**: vendor unggah (`pending`) → staf memutuskan
(`approved`/`rejected`). Dua tingkat pada v1.0 mengandaikan hierarki cabang yang
sudah tidak ada.

### 4.5 Jadwal, lokasi, penugasan

`saveSchedule`, `createLocation`, `updateLocation`, `deleteLocation`,
`assignVendor`.

> `assignVendor` bukan sekadar mengisi kolom: ia **pintu masuk data** (vendor
> tidak melihat order apa pun sebelumnya) sekaligus **penerbit daftar tahap**
> lewat `generate_stage_checklist`.

> `vendor_id` pada lokasi tidak pernah datang dari klien — `createLocation`
> mengisinya dari mitra order yang bersangkutan, dan `saveSchedule` memeriksa
> kepemilikannya lagi saat lokasi itu dipasang ke order.

### 4.6 Laporan

`generateReport`, `generateCertificate`, `setChildPhoto`, `markReportSent`,
`deleteReport`. PDF dirender React PDF di server, disimpan ke bucket `reports`
(privat), diakses lewat signed URL.

### 4.7 Master data

| Modul   | Action                                                                    | Akses      |
| ------- | ------------------------------------------------------------------------- | ---------- |
| Katalog | `createService`, `updateService`, `setServiceActive`, `deleteService`, `setServicePhoto`, `clearServicePhoto` | superadmin |
| Mitra   | `createVendor`, `updateVendor`, `setVendorActive`, `deleteVendor`, `saveVendorService`, `deleteVendorService`, `saveVendorCoverage` | superadmin |
| Akun    | `createUser`, `updateUser`, `setUserActive`, `deleteUser`                 | superadmin |
| Akun sendiri | `changeOwnPassword`, `changeOwnEmail`                                | semua role |

> ⚠️ **Pengelolaan pengguna memakai service role** yang melewati RLS sepenuhnya,
> jadi action-nya memeriksa role sendiri lebih dulu. Ini satu-satunya jalur tanpa
> jaring pengaman kedua di database.

### 4.8 Kendala & notifikasi

`createIssueAction`, `updateIssueAction`, `updateIssueStatusAction` — vendor bisa
melapor pada order yang ia kerjakan. `markNotificationSent` staf saja.

> Outbox notifikasi **diisi trigger database** (`enqueue_notification` +
> `notify_*`), bukan kode aplikasi, dan ditutup otomatis oleh `close_*_notification`
> saat kendalanya ditangani.

---

## 5. Aturan lintas action

- Seluruh input divalidasi **Zod** sebelum mutasi; `fields` dikembalikan supaya
  penolakan menempel pada medan yang tepat di form.
<!-- schema-history -->

- Scoping ditegakkan **`vendor_id` + RLS** (defense in depth) — `branch_id`
  sudah tidak ada sejak 20 Agustus.

<!-- /schema-history -->
- Transisi status hanya lewat `changeOrderStatus`; kolom `status` tidak pernah
  di-patch langsung.
- Unggah berkas lewat Storage; server menyimpan `storage_path` tervalidasi.
  Path dokumentasi `{YYYY}/{MM}/{order_number}/{stage}/{uuid}.{ext}` — segmen
  ketiganya dipakai kebijakan Storage untuk membatasi akses per mitra.
- Jalur publik: tanpa data sensitif di luar milik token; rem laju wajib.

---

## 6. Satu jebakan yang berulang

**RLS menyaring baris, ia tidak menolak permintaan.** SELECT atas baris terlarang
mengembalikan array kosong — bukan error. UPDATE dan DELETE membalas sukses tanpa
menyentuh apa pun. Karena itu:

- Action yang tidak menemukan baris mengembalikan `NOT_FOUND`, dan itu **tidak
  bisa dibedakan** dari "tersaring RLS". Memang disengaja: membedakannya berarti
  memberi tahu penyerang bahwa barisnya ada.
- Tes yang menganggap "tidak ada error = bocor" akan melaporkan kebocoran palsu.
  Yang benar diperiksa: **jumlah baris = 0**, atau **nilainya tidak bergeser**.
- `INSERT` berbeda — `with check` menolaknya dengan galat sungguhan (`42501`).

---

### Referensi silang

- Skema & fungsi → `05_DATABASE_DESIGN.md`
- Role & kapabilitas → `07_USER_ROLES.md`
- Alur & transisi → `08_WORKFLOW_MAP.md`
- Status terkini & utang → `../TASKS.md`
