# 14 · UI/UX SPEC

> **Sukses Aqiqah** · _"Tunaikan Ibadah, Tebarkan Manfaat"_

| Field   | Value                                                  |
| ------- | ------------------------------------------------------ |
| Versi   | 2.0, dial antislop ditetapkan                          |
| Tanggal | 2026-09-22                                             |
| Filter  | `.claude/skills/antislop/` (core + skill UI)           |

---

## 0. Dial: seberapa keras desain ini menyapa

Ditetapkan 22 September. Tiga angka ini mengikat dari section pertama sampai
terakhir, dan tiap keputusan visual diuji terhadapnya.

| Dial       | Nilai        | Artinya di sini                                                    |
| ---------- | ------------ | ------------------------------------------------------------------ |
| **ENERGY** | **3** Berani | Halaman publik boleh tampil kuat, bukan sekadar rapi               |
| **RHYTHM** | **3** Varied | Komposisi antar-section wajib berbeda, bukan cuma latarnya         |
| **MOTION** | **2** Sedang | Scroll-reveal terasa dan berarah, bukan sekadar memudar-masuk      |

**Dial ini berlaku untuk halaman publik** (landing, checkout, laporan bertoken).
Layar operasional (dashboard, daftar order, validasi) tetap **ENERGY 1 / RHYTHM 1
/ MOTION 1**: yang dipakai berjam-jam tiap hari dinilai dari kecepatan membaca,
bukan dari kesan pertama.

> **Kenapa dua nilai, bukan satu.** Halaman publik dan layar kerja melayani orang
> yang berbeda dalam keadaan yang berbeda. Pemesan membuka landing sekali, tiga
> menit, sambil membandingkan dengan penyedia lain: di situ karakter menentukan
> apakah ia melanjutkan. Admin membuka dashboard tiap pagi selama berbulan-bulan:
> di situ karakter yang sama justru jadi gangguan. Memaksakan satu dial untuk
> keduanya berarti salah satunya dikorbankan.

### Motif identitas

Satu pola yang berulang dan spesifik: **kisi garis tipis**, rujukan visual ke
kertas bergaris. Alasannya bukan estetika, melainkan isi: halaman ini menjual
**pencatatan yang bisa dibuktikan**, dan kertas bergaris adalah benda terdekat
untuk itu.

Motif ini dikembangkan, bukan hanya jadi latar dua section. Bentuk lain yang sah
dari motif yang sama: garis pemisah yang sejajar dengan kisinya, penomoran
section yang terbaca seperti nomor halaman, dan tabel yang barisnya berjarak
seperti garis buku catatan.

### Aksen tunggal

`accent` (`#F0A500`) berarti **sorotan KPI** dan tidak berarti yang lain.
Memakainya untuk menghias judul atau garis bawah membuat warna itu kehilangan
artinya di layar yang benar-benar membutuhkannya.

---

## 1. Prinsip Desain

1. **Clarity over decoration.** Operasional dulu, data terbaca cepat.
2. **Mobile-first** untuk petugas, **data-dense responsive** untuk dashboard manajemen.
3. **Konsisten:** satu design system, komponen dapat dipakai ulang.
4. **Aksesibel:** kontras cukup, target sentuh besar, label jelas.
5. **Cepat:** skeleton/loading state, hindari layout shift.

> **Batas prinsip 1, ditegaskan ulang 22 September.** "Clarity over decoration"
> adalah urutan prioritas, **bukan larangan atas karakter**. Ia berarti: ketika
> kejelasan dan hiasan bertabrakan, kejelasan menang. Ia tidak berarti halaman
> harus datar.
>
> Dengan dial ENERGY 3 / RHYTHM 3 pada halaman publik, prinsip ini dibaca begini:
> **komposisi boleh berani selama tiap elemennya punya alasan yang bisa ditulis
> satu baris.** Yang dilarang tetap yang sama, yaitu efek yang menarik perhatian
> ke dirinya sendiri alih-alih ke isinya.
>
> Uji pembedanya satu kalimat: *kalau efek ini dipindahkan ke produk lain tanpa
> berubah maknanya, ia hiasan.* Kisi garis lolos uji ini karena ia menunjuk pada
> pencatatan. Blur di belakang kartu tidak lolos karena ia bisa dipindahkan ke
> mana saja.

### 1.1 Yang dilarang, dan kenapa

Daftar ini lahir 24 Agustus dari pengayaan yang **sempat ditambahkan lalu
dicabut**, bukan dari teori. Dial 22 September tidak mencabut satu pun: ENERGY 3
menuntut karakter, dan tiap butir di bawah justru **tidak** memberi karakter,
hanya keramaian yang bisa ditempel di produk mana pun.

| Dilarang                                     | Sebabnya                                                     |
| -------------------------------------------- | ------------------------------------------------------------ |
| Lencana dengan titik berdenyut                | Menandakan "live" padahal tidak ada yang live                |
| Kotak ikon berbalik warna penuh saat hover    | Gerakan yang tidak menerangkan apa pun                       |
| Garis atas kartu yang melebar saat hover      | Sama                                                          |
| Gradasi pada tiap kartu                       | Gradasi sebagai default, bukan sebagai pembeda hierarki      |
| Garis aksen di bawah judul                    | Memakai `accent` untuk hiasan, mencuri artinya dari KPI      |
| Pola titik sebagai latar                      | Tekstur paling umum di halaman produk mana pun               |
| Teks bergradasi (`bg-clip-text`)              | Menurunkan keterbacaan judul                                 |
| Blur dekoratif                                | Meratakan hierarki, semua permukaan jadi satu lapis beku     |
| Shadow tebal (`shadow-xl` / `shadow-2xl`)     | Kalau semua terangkat, tidak ada yang terangkat              |
| Radius di luar 8–12px                         | Radius adalah alat hierarki, bukan dekorasi                  |
| Emoji di teks antarmuka                       | Suara generik; kalau perlu penanda, pakai ikon yang relevan  |
| Em dash (`—`) di teks yang dibaca pengguna    | Tanda baca paling khas tulisan mesin                         |

**Penekanan judul** lewat warna teks (`text-primary`) pada frasa kuncinya, bukan
garis bawah.

**Latar section punya tiga perlakuan** (`plain`, `tinted`, `grid`), bukan
selang-seling dua nilai yang bisa ditebak setelah dua pergantian. Dengan RHYTHM 3
ini **batas bawah, bukan target**: latar yang berbeda saja tidak cukup, komposisi
di dalamnya juga harus berbeda (lihat §7).

> **Cakupan pemeriksaan.** Catatan 24 Agustus menulis halaman publik "diperiksa
> terhadap keempatnya, dan seluruhnya nol". Audit 22 September menemukan
> pemeriksaan itu **tidak mencakup `app/(auth)/`**, yang memakai blur, shadow
> tebal, dan radius 16px sekaligus. Halaman masuk bukan halaman pemasaran, tetapi
> ia layar pertama yang dilihat mitra, dan daftar di atas tidak menyebut
> pengecualian.

## 2. Design System

- **Foundation:** Next.js 16 + **Tailwind CSS**.
- **Komponen:** pola **shadcn/ui** di atas **`@base-ui/react`**, bukan Radix.
  Komponennya disalin ke `components/ui/` dan disunting di tempat, jadi yang
  dipakai adalah salinan milik project ini, bukan paket yang di-upgrade.
- **Ikon:** Lucide untuk layar operasional; **SVG buatan sendiri**
  (`components/site/icons.tsx`) untuk halaman publik. Pembagian ini punya dua
  alasan: layar kerja butuh kosakata ikon yang lazim dan langsung dikenali,
  sedangkan halaman publik tidak perlu menyeret seluruh pustaka demi belasan
  glif. Nol dependency tambahan, dan tiap ikon bisa disunting di tempat.

  > ⚠️ **Utang yang belum dibayar.** Ikon publik saat ini digambar "gaya Lucide"
  > (`strokeLinecap: round`, tebal 1.75), jadi ia buatan sendiri tetapi terlihat
  > sama dengan pustaka default mana pun. Dengan dial ENERGY 3, itu kesempatan
  > karakter yang terbuang: motif kisi garis menunjuk ke goresan tegas, bukan
  > sudut membulat. Lihat audit temuan #8.
- **Charts:** **bar CSS buatan sendiri**, bukan Recharts. Yang dibutuhkan
  dashboard sejauh ini hanya bar horizontal dan angka besar; memasang pustaka
  chart untuk itu menambah ±100 KB ke bundel tanpa menambah kemampuan.
  Pasang Recharts kalau kelak ada grafik deret waktu.
- **Font:** Arial (UI), dengan fallback Helvetica / Liberation Sans / sans-serif.
  Font sistem, tidak diunduh: nol permintaan jaringan dan nol pergeseran tata
  letak saat halaman dimuat. PDF laporan memakai Helvetica bawaan React PDF,
  pasangan metrik Arial; alasannya di `features/reporting/pdf.tsx`.

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
tempuh lewat bentuk: bidang warna di belakangnya yang digeser sedikit, garis
pemisah, atau latar bertekstur. Bukan dengan menaikkan radius atau menebalkan
bayangan. `shadow-sm` adalah batas atas.

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

## 7. Page Structure

### Layar operasional: satu pola, sengaja

Dial ENERGY 1 / RHYTHM 1 berlaku di sini, jadi keseragaman adalah **keputusan**,
bukan kelalaian. Admin yang membuka sepuluh halaman daftar per hari tidak boleh
mempelajari sepuluh tata letak.

- Halaman list: **Header (judul + aksi) → FilterBar → Konten → Pagination**
- Halaman detail: **Header (nomor + status) → panel berurutan → aksi kontekstual**

### Halaman publik: komposisi wajib berbeda antar-section

Dial RHYTHM 3 berlaku, dan ini pembedanya dari layar operasional. Enam section
yang seluruhnya memakai *eyebrow + judul tengah + lead + kisi kartu* adalah
tata letak yang dipilih template, bukan oleh isinya. Yang berbeda cuma latar
belakangnya tidak cukup.

Cara yang sah membedakan komposisi:

| Sumbu               | Pilihan                                                        |
| ------------------- | -------------------------------------------------------------- |
| **Perataan judul**  | Tengah · kiri · berdampingan dengan isinya                     |
| **Bentuk isi**      | Kisi kartu · daftar bernomor · dua kolom teks+visual · tabel    |
| **Lebar**           | Terbatas (prosa) · penuh (kisi) · melebar keluar kolom (galeri) |
| **Titik fokus**     | Judul · angka · foto · satu kalimat panjang                     |

Aturannya: **dua section berurutan tidak boleh sama pada lebih dari dua sumbu.**
Itu bisa diperiksa, tidak seperti "harus bervariasi".

Daftar halaman lengkap → **15_PAGE_MAP**.

## 8. State & Feedback

- Loading: skeleton; Aksi: toast sukses/gagal; Error: pesan jelas + retry.
- **Gerakan**: satu sistem gerak terpusat di `app/globals.css`. Easing tunggal
  `cubic-bezier(.22,.61,.36,1)` (easeOutQuad) supaya semuanya terbaca berasal
  dari satu sistem. Komponen memilihnya lewat `<Reveal anim="...">`, bukan
  menulis keyframe sendiri.

### Tiga durasi, bukan sembilan

Audit 22 September menemukan sembilan nilai durasi berbeda di kode, tiga di
antaranya angka sembarang (`420ms`, `380ms`, `320ms`) tanpa alasan tertulis.
Sembilan nilai berarti tidak ada sistem gerak, hanya angka yang kebetulan
dipilih saat menulis.

| Tingkat    | Nilai   | Untuk                                              |
| ---------- | ------- | -------------------------------------------------- |
| **Cepat**  | `150ms` | Hover, fokus, `active:scale`, perubahan warna       |
| **Sedang** | `300ms` | Buka/tutup panel, dialog, akordeon, pergantian tab  |
| **Lambat** | `500ms` | Scroll-reveal, transformasi yang menempuh jarak     |

Di luar tiga nilai ini butuh alasan tertulis di tempatnya. `duration-0` sah untuk
mematikan gerakan pada elemen yang tidak boleh bergerak.
- **Gerakan reveal mengikuti arah gulir, dan berulang.** Menggulir turun, blok
  datang dari bawah; menggulir naik, ia datang dari atas. Gerakan yang melawan
  arah gulir terbaca kaku: isinya seolah didorong berlawanan dengan tangan yang
  menggulir. Blok juga tampil **lagi** setiap kali masuk layar, bukan sekali
  seumur halaman: menggulir balik ke halaman yang sepenuhnya diam terasa mati.
  Reset hanya terjadi setelah blok benar-benar lepas dari layar, sehingga
  menggoyang layar di sekitar batas tidak memicu apa pun.
- **Umpan balik sentuh**: setiap kontrol yang bisa ditekan punya `active:scale`.
  Di ponsel `hover:` tidak pernah menyala, jadi tanpa itu tombol terasa mati.
- Seluruh gerakan mati otomatis pada `prefers-reduced-motion: reduce` lewat satu
  aturan sapu-bersih, tidak perlu didaftar ulang per animasi.
- Form: validasi inline, tombol disabled saat submit, konfirmasi untuk aksi destruktif.
- Offline (petugas): banner "Mode offline, upload akan tersinkron".

## 9. Aksesibilitas & i18n

- Kontras WCAG AA; fokus keyboard terlihat; label ARIA pada komponen interaktif.
- Bahasa default **Indonesia**; teks terpusat agar mudah ditambah bahasa lain (Phase 2).

---

### Referensi silang

- Halaman → **15_PAGE_MAP**
- Dashboard → **09_DASHBOARD_SPEC**
- PWA/mobile → **13_PWA_ARCHITECTURE**
- Folder komponen → **24_FOLDER_STRUCTURE**
- Temuan yang belum dikerjakan → `anti-slop/audit-001-2026-09-22.md`

---

## Catatan versi

**v2.0 (22 September 2026)** menetapkan dial dan merekonsiliasi prinsip 1
terhadapnya.

Yang berubah: dial ditetapkan dua nilai (publik berani, operasional tenang),
motif identitas dinamai, "Clarity over decoration" ditegaskan sebagai **urutan
prioritas** bukan larangan karakter, komposisi section publik diberi aturan yang
bisa diperiksa, dan durasi gerak dipadatkan dari sembilan nilai jadi tiga.

Yang **tidak** berubah: seluruh daftar larangan §1.1. Dial yang lebih berani
tidak mencabut satu pun, sebab tiap butir di sana tidak memberi karakter, hanya
keramaian yang bisa ditempel di produk mana pun.

Kodenya sendiri **belum** mengikuti v2.0 ini. Audit `anti-slop/audit-001` mencatat
selisihnya, dan yang paling besar: enam section landing masih satu komposisi
(RHYTHM 3 menuntut berbeda), dan sembilan durasi masih tersebar di kode.
