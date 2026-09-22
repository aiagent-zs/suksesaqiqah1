# 09 — DASHBOARD SPEC

> **Sukses Aqiqah** — *"Tunaikan Ibadah, Tebarkan Manfaat"*
> Scope per role mengikuti **07_USER_ROLES**; sumber data dari views **05 §7**.

| Field | Value |
|-------|-------|
| Dokumen | 09_DASHBOARD_SPEC |
| Versi | 2.0 — disinkronkan ke `features/dashboard/*` |
| Tanggal | 2026-09-21 |
| Status | **Selaras dengan `features/dashboard/queries.ts` & `v_vendor_kpi`** |

> **Kenapa ditulis ulang.** v1.0 (14 Juni) merancang tiga dashboard terpisah
> (Executive / Cabang / Panel Validasi Pusat) yang berporos pada `branches` dan
> lima role. Cabang dihapus 20 Agustus, role tinggal tiga, dan yang dibangun
> adalah **satu** dashboard yang isinya menyesuaikan role lewat RLS. Pertanyaan
> yang berguna ikut berubah: bukan lagi "cabang mana yang tertinggal", melainkan
> **"mitra mana yang lambat, dan mana yang buktinya sering ditolak"**.

---

## 1. Tujuan

Dashboard adalah **jantung monitoring**. Tujuan tunggal: menjawab *"Berapa order belum selesai, di lokasi mana, siapa PIC, apa kendalanya?"* dalam **< 10 detik**, dengan kemampuan drill-down dari agregat ke order individual.

**Prinsip:** muat cepat (< 3 dtk), real-time (Supabase Realtime), ter-scope RBAC, mobile-friendly.

## 2. Satu dashboard, isinya menyesuaikan role

Tidak ada dashboard terpisah per role. Halaman `/dashboard` sama untuk semua,
dan **RLS yang menentukan isinya** — seluruh view memakai `security_invoker = on`,
jadi vendor yang membukanya hanya melihat order yang ditugaskan padanya **tanpa
satu baris kode filter tambahan** (`features/dashboard/queries.ts`).

> Konsekuensinya halus tapi nyata: bug visibilitas mitra tidak muncul sebagai
> galat, melainkan sebagai **dashboard kosong** yang tampak seperti "belum ada
> order". Persis itu yang terjadi sebelum `20260908010000` — lihat **07 §5.1**.

## 3. KPI inti — berporos mitra & margin

Dari `v_vendor_kpi`, diringkas `summarizeVendorKpi()`:

| KPI                     | Definisi                                                      |
| ----------------------- | ------------------------------------------------------------- |
| **Order** total/open/completed/on_hold | Cacah order per keadaan                        |
| **Tagihan** (`revenue_total`) | Jumlah `orders.total_amount`                            |
| **Modal** (`vendor_cost_total`) | Dari `order_items.vendor_unit_price` — **rekaman saat penugasan**, bukan daftar harga mitra hari ini |
| **Margin** + `marginPct`| Selisih keduanya, dan rasionya terhadap tagihan                |
| **Rata-rata siklus**    | Jam dari order dibuat sampai tahap terakhir tervalidasi        |
| **Order dengan penolakan** | Order yang pernah punya laporan tahap ditolak — penanda mutu kerja mitra |
| **Mitra aktif**         | Cacah mitra `is_active`                                        |

> ⚠️ **Order yang ditugaskan sebelum 22 September bermargin terlalu besar.**
> `order_items.vendor_unit_price` tidak pernah diisi kode mana pun sampai
> tanggal itu — `assignVendor` hanya menulis `vendor_id`. Jadi `vendor_cost`
> bernilai nol dan margin terbaca **100%** untuk seluruh order lama.
>
> Sejak diperbaiki, penugasan baru menyalin modalnya dari `vendor_services`.
> **Order lama tidak ikut terbetulkan sendiri**: nilainya tetap NULL sampai
> mitranya ditugaskan ulang — menambalnya dengan daftar harga hari ini justru
> melanggar prinsip rekaman sejarah yang membuat kolom itu ada.
>
> Paket yang belum punya modal untuk mitranya juga tetap NULL, bukan nol: nol
> berarti "modalnya memang nol", dan marginnya terbaca penuh lagi. Daftar
> katalog menandai paket tanpa modal mitra dengan peringatan kuning.

> **Rata-rata siklus ditimbang jumlah order**, bukan dirata-rata polos: mitra
> dengan 2 order tidak boleh berbobot sama dengan yang mengerjakan 200. Mitra
> tanpa order dikeluarkan dari pembagi.

## 4. Tabel "Order Belum Selesai" — litmus test

Dari `v_open_orders`. Inilah yang menjawab pertanyaan < 10 detik:

| Kolom                | Menjawab                                             |
| -------------------- | ---------------------------------------------------- |
| `order_number`       | Order mana                                           |
| `vendor_name`/`phone`| Mitra mana, dan nomor yang bisa dihubungi            |
| `location_name`      | Di mana                                              |
| `current_stage`      | **Sampai mana** — dulu hanya bisa ditebak dari status |
| `pct_stage`          | Berapa persen tahapnya rampung                       |
| `stages_rejected`    | Ada tahap yang ditolak                               |
| `missing_doc_stages` | Tahap yang buktinya belum lengkap, dihitung database dari `stage_requirements` |
| `open_issues` + `max_open_severity` + `latest_issue_title` | Apa kendalanya |
| `age_days`           | Sudah berapa lama menggantung                        |

Diurutkan **keparahan kendala lebih dulu**, baru umur order.

> ⚠️ **Dua angka yang mudah tertukar.** `stages_total` menghitung **baris**,
> `stages_in_sequence` menghitung **tahap dalam rangkaian mode**. Order 3 ekor
> mode `kirim` punya 7 baris untuk 5 tahap.

## 5. Panel pendamping

- **Antrian validasi** — bukti `pending` menunggu keputusan admin (satu tingkat).
- **Notifikasi dashboard** — dari outbox `notifications`, terisi trigger dan
  **tertutup sendiri** oleh `close_*_notification` saat kendalanya ditangani.
- **Panel kendala** — `issues` terbuka, diurutkan keparahan.

## 6. Real-time & performa

- **Agregasi di SQL**, bukan di aplikasi: `v_order_progress`, `v_vendor_kpi`,
  `v_open_orders`.
- **Caching:** Server Components + revalidasi; data tetap ter-RLS.
- **Target:** initial paint < 3 dtk; jawaban litmus test < 10 dtk.

---

### Referensi silang
- Views & entity → **05_DATABASE_DESIGN**
- Role/scope → **07_USER_ROLES**
- UI/komponen → **14_UI_UX_SPEC**
- AI summary/risk → **19_AI_LAYER**
