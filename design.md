# 14 — UI/UX SPEC

> **Sukses Aqiqah** — _"Tunaikan Ibadah, Tebarkan Manfaat"_

---

## 1. Prinsip Desain

1. **Clarity over decoration** — operasional dulu; data terbaca cepat.
2. **Mobile-first** untuk petugas, **data-dense responsive** untuk dashboard manajemen.
3. **Konsisten** — satu design system, komponen dapat dipakai ulang.
4. **Aksesibel** — kontras cukup, target sentuh besar, label jelas.
5. **Cepat** — skeleton/loading state, hindari layout shift.

> **Catatan 24 Agustus — batas prinsip 1.** _Clarity over decoration_ pernah
> ditarik sampai halaman publik terbaca datar: latar putih di seluruh section,
> kartu tanpa kedalaman, dan satu-satunya gerakan cuma memudar-masuk. Prinsipnya
> tidak berubah, tapi ia **bukan** larangan atas kedalaman.
>
> Yang dibolehkan: latar bertekstur (pola titik tipis), latar section
> berselang-seling, garis aksen, bayangan halus (`shadow-sm`), dan gerakan yang
> **menerangkan sesuatu** — arah baca, urutan, atau apa yang sedang dituju.
>
> **Uji "AI slop".** Pengayaan berikut sempat ditambahkan lalu dicabut lagi
> karena ia pola landing-page generik, bukan sesuatu yang halaman ini butuhkan:
> lencana dengan titik berdenyut (menandakan "live" padahal tidak ada yang
> live), kotak ikon yang berbalik warna penuh saat hover, garis atas kartu yang
> melebar, gradasi pada tiap kartu, **garis aksen oranye yang digambar di bawah
> judul**, dan pola titik seragam sebagai latar. Patokannya: kalau sebuah efek
> bisa dipindahkan ke produk lain tanpa berubah maknanya, ia hiasan — bukan
> bagian dari desain ini.
>
> Dua yang terakhir layak disebut tersendiri. **Garis aksen** memakai warna
> `accent`, yang di sistem ini berarti _sorotan KPI_ — memakainya untuk menghias
> judul membuat warna itu kehilangan artinya, di samping bentuknya sendiri yang
> memang pola landing-page generik. Penekanan pada judul kini lewat warna teks
> (`text-primary`) pada frasa kuncinya. **Pola titik** adalah tekstur paling umum
> di halaman produk mana pun; diganti kisi garis tipis, yang punya alasan di
> sini — halaman ini menjual pencatatan, dan kertas bergaris adalah rujukan
> visual terdekat untuk itu.
>
> **Latar section punya tiga perlakuan**, bukan selang-seling putih/abu: `plain`,
> `tinted`, dan `grid` (kisi yang menempati satu sudut). Selang-seling dua nilai
> jadi pola yang bisa ditebak setelah dua pergantian.
>
> Yang tetap dilarang, karena menarik perhatian ke dirinya sendiri alih-alih ke
> isinya: **teks bergradasi** (`bg-clip-text` — menurunkan keterbacaan judul),
> **blur dekoratif**, **shadow tebal** (`shadow-xl`/`2xl`), dan **radius di luar
> 8–12px**. Halaman publik diperiksa terhadap keempatnya, dan seluruhnya nol.

## 2. Design System

- **Foundation:** Next.js 16 + **Tailwind CSS**.
- **Komponen:** berbasis **shadcn/ui** (Radix primitives) untuk konsistensi & aksesibilitas.
- **Ikon:** Lucide.
- **Charts:** library ringan (mis. Recharts) untuk KPI dashboard.
- **Font:** Arial (UI) — fallback Helvetica / Liberation Sans / sans-serif. Font sistem, tidak diunduh: nol permintaan jaringan dan nol pergeseran tata letak saat halaman dimuat. PDF laporan memakai Helvetica bawaan React PDF — pasangan metrik Arial; alasannya di `features/reporting/pdf.tsx`.

## 3. Color Palette

| Token             | Hex       | Penggunaan                                 |
| ----------------- | --------- | ------------------------------------------ |
| `primary`         | `#0E7C5A` | Brand (hijau), aksi utama, theme_color PWA |
| `primary-dark`    | `#0A5C43` | Hover/active                               |
| `accent`          | `#F0A500` | Sorotan, highlight KPI                     |
| `success`         | `#16A34A` | Status selesai/approved                    |
| `warning`         | `#D97706` | SLA hampir terlewat, partial               |
| `danger`          | `#DC2626` | Issue high, rejected, gagal                |
| `info`            | `#2563EB` | Info/netral aktif                          |
| `neutral-900..50` | grayscale | Teks & latar                               |

Status warna dipakai konsisten di badge order/dokumentasi/pembayaran.

## 4. Tipografi & Spacing

| Elemen     | Ukuran             |
| ---------- | ------------------ |
| Display/H1 | 28–32px / bold     |
| H2         | 22–24px / semibold |
| H3         | 18px / semibold    |
| Body       | 14–16px            |
| Caption    | 12px               |

Spacing skala 4px (4/8/12/16/24/32). Radius default 8–12px. Shadow halus untuk card.

**Kedalaman tanpa melanggar radius/shadow.** Ketika sebuah blok perlu terangkat,
tempuh lewat bentuk — bidang warna di belakangnya yang digeser sedikit, garis
aksen, atau latar bergradasi tipis — bukan dengan menaikkan radius atau
menebalkan bayangan. `shadow-sm` adalah batas atas.

## 5. Komponen Inti (reusable)

| Komponen                  | Fungsi                                                   |
| ------------------------- | -------------------------------------------------------- |
| `AppShell`                | Layout: sidebar (desktop) / bottom-nav (mobile) + header |
| `KpiCard`                 | Angka besar + label + tren                               |
| `StatusBadge`             | Warna per status (order/doc/payment)                     |
| `DataTable`               | Tabel order: filter, sort, paginate, klik-baris          |
| `FilterBar`               | Periode, cabang, lokasi, status, PIC                     |
| `OrderCard`               | Ringkasan order (mobile)                                 |
| `Timeline`                | Riwayat status/audit per order                           |
| `MediaUploader`           | Kamera + preview + queue indicator                       |
| `MediaGallery`            | Grid foto/video (approved)                               |
| `MapView`                 | Google Maps marker lokasi                                |
| `ValidationQueue`         | Daftar dokumentasi untuk approve/reject                  |
| `AlertList`               | Notifikasi dashboard                                     |
| `EmptyState` / `Skeleton` | Kondisi kosong & loading                                 |

## 6. Responsive Layout

| Breakpoint          | Target            | Pola                                  |
| ------------------- | ----------------- | ------------------------------------- |
| < 640px (mobile)    | Petugas           | Bottom-nav, kartu 1 kolom, aksi 1-tap |
| 640–1024px (tablet) | Admin di lapangan | 2 kolom, tabel ringkas                |
| > 1024px (desktop)  | Manajemen/Admin   | Sidebar + grid KPI + tabel penuh      |

```
Desktop                         Mobile
┌────┬───────────────────┐      ┌───────────────┐
│Side│ Header  [filters] │      │ Header        │
│bar │ ┌──┬──┬──┬──┬──┐  │      │ KPI (scroll)  │
│    │ │KPI cards     │  │      │ ┌───────────┐ │
│    │ ├──────────────┤  │      │ │ OrderCard │ │
│    │ │ DataTable    │  │      │ └───────────┘ │
└────┴───────────────────┘      │ [Tugas][📷][≡]│
                                └───────────────┘
```

## 7. Page Structure (pola umum)

Setiap halaman list: **Header (judul + aksi) → FilterBar → Konten (table/cards) → Pagination**.
Setiap halaman detail: **Header (nomor + status) → Tab/section (Info, Hewan, Dokumentasi, Distribusi, Riwayat) → aksi kontekstual**.

Daftar halaman lengkap → **15_PAGE_MAP**.

## 8. State & Feedback

- Loading: skeleton; Aksi: toast sukses/gagal; Error: pesan jelas + retry.
- **Gerakan**: satu sistem gerak terpusat di `app/globals.css`. Easing tunggal
  `cubic-bezier(.22,.61,.36,1)` (easeOutQuad) supaya semuanya terbaca berasal
  dari satu sistem. Komponen memilihnya lewat `<Reveal anim="...">`, bukan
  menulis keyframe sendiri.
- **Gerakan reveal mengikuti arah gulir, dan berulang.** Menggulir turun, blok
  datang dari bawah; menggulir naik, ia datang dari atas. Gerakan yang melawan
  arah gulir terbaca kaku — isinya seolah didorong berlawanan dengan tangan yang
  menggulir. Blok juga tampil **lagi** setiap kali masuk layar, bukan sekali
  seumur halaman: menggulir balik ke halaman yang sepenuhnya diam terasa mati.
  Reset hanya terjadi setelah blok benar-benar lepas dari layar, sehingga
  menggoyang layar di sekitar batas tidak memicu apa pun.
- **Umpan balik sentuh**: setiap kontrol yang bisa ditekan punya `active:scale`.
  Di ponsel `hover:` tidak pernah menyala, jadi tanpa itu tombol terasa mati.
- Seluruh gerakan mati otomatis pada `prefers-reduced-motion: reduce` lewat satu
  aturan sapu-bersih — tidak perlu didaftar ulang per animasi.
- Form: validasi inline, tombol disabled saat submit, konfirmasi untuk aksi destruktif.
- Offline (petugas): banner "Mode offline — upload akan tersinkron".

## 9. Aksesibilitas & i18n

- Kontras WCAG AA; fokus keyboard terlihat; label ARIA pada komponen interaktif.
- Bahasa default **Indonesia**; teks terpusat agar mudah ditambah bahasa lain (Phase 2).

---

### Referensi silang

- Halaman → **15_PAGE_MAP**
- Dashboard → **09_DASHBOARD_SPEC**
- PWA/mobile → **13_PWA_ARCHITECTURE**
- Folder komponen → **24_FOLDER_STRUCTURE**
