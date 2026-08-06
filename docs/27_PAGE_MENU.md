# FOOTER, SEO & CMS PAGE MANAGEMENT REQUIREMENTS

## OBJECTIVE
Seluruh halaman yang ditampilkan pada Footer wajib:

* Memiliki halaman khusus.
* Dapat dikelola melalui CMS.
* Dapat diubah oleh Super Admin.
* Terindeks Google.
* Terindeks AI Search Engine.
* Masuk ke XML Sitemap otomatis.

---

# FOOTER STRUCTURE
Footer terdiri dari 3 kelompok menu utama.

---
# LAYANAN
## Proses

URL:
```text
/proses
```

Isi:
* Alur Aqiqah
* Alur Qurban
* Tahapan Pemesanan
* Tahapan Pembayaran
* Tahapan Produksi
* Tahapan Pengiriman
* Tahapan Pelaporan

CMS Editable:
✅ Ya

---

## Paket
URL:

```text
/paket
```

Isi:
* Paket Aqiqah
* Paket Qurban
* Paket Sedekah Daging
* Harga
* Fasilitas
* Benefit

CMS Editable:
✅ Ya
---

## Galeri

URL:

```text
/galeri
```

Isi:

* Foto Kegiatan
* Video Kegiatan
* Dokumentasi Distribusi
* Dokumentasi Pemotongan

CMS Editable:

✅ Ya

---

# BANTUAN

## FAQ

URL:

```text
/faq
```

Isi:

* Frequently Asked Questions
* Search FAQ
* FAQ Category

CMS Editable:

✅ Ya

---

## Syarat Layanan

URL:

```text
/syarat-layanan
```

Isi:

* Terms of Service
* Ketentuan Penggunaan
* Kebijakan Order
* Kebijakan Pembayaran
* Kebijakan Vendor

CMS Editable:

✅ Ya

---

## Kebijakan Privasi

URL:

```text
/kebijakan-privasi
```

Isi:

* Privacy Policy
* Data Collection
* Data Storage
* Cookies Policy
* User Rights

CMS Editable:

✅ Ya

---

## Sitemap

URL:

```text
/sitemap.xml
```

dan

```text
/sitemap
```

Tujuan:

* Memudahkan indexing Google.
* Memudahkan indexing AI Search.
* Memudahkan crawling website.

---

# KONTAK

## WhatsApp

Ambil dari:

```env
NEXT_PUBLIC_WHATSAPP_NUMBER=
```

Tampilkan:

```text
WhatsApp
```

Link:

```text
https://wa.me/
```

Jangan hardcoded.

---

## Instagram

Default:

```text
@zakatsukses
```

Ambil dari CMS atau Environment Variable.

Contoh:

```env
NEXT_PUBLIC_INSTAGRAM_URL=
```

---

# CMS PAGE MANAGEMENT

Buat menu baru:

## Content Management

### Pages

Kelola:

* Proses
* Paket
* Galeri
* FAQ
* Syarat Layanan
* Kebijakan Privasi

---

# PAGE BUILDER

Super Admin dapat:

* Edit Judul
* Edit Konten
* Upload Gambar
* Upload Video
* Publish / Draft
* SEO Meta Title
* SEO Meta Description
* SEO Keywords
* Open Graph Image

---

# FAQ MANAGEMENT

Super Admin dapat:

* Tambah FAQ
* Edit FAQ
* Hapus FAQ
* Kategori FAQ
* Urutkan FAQ

Contoh Kategori:

* Pemesanan
* Pembayaran
* Aqiqah
* Qurban
* Pengiriman
* Vendor

---

# SEO REQUIREMENTS

Setiap halaman wajib memiliki:

* Meta Title
* Meta Description
* Canonical URL
* Open Graph Tags
* Twitter Card
* Structured Data

---
# GEO (AI SEARCH OPTIMIZATION)
Buat halaman mudah dibaca AI:
* FAQ Schema
* Organization Schema
* Website Schema
* Breadcrumb Schema

Gunakan:
JSON-LD

---

# XML SITEMAP
Generate otomatis:
```text
/sitemap.xml
```

Mencakup:
* Landing Page
* Proses
* Paket
* Galeri
* FAQ
* Syarat Layanan
* Kebijakan Privasi
* Blog (future)
* Program (future)

---

# ROBOTS.TXT
Generate otomatis:

```text
/robots.txt
```

Mencantumkan:

```text
Sitemap: https://domainanda.com/sitemap.xml
```

---

# AI SEARCH READY
Pastikan halaman:
* Dapat di-crawl AI Search Engine.
* Memiliki semantic HTML yang baik.
* Menggunakan heading structure yang benar.
* Memiliki FAQ Schema.
* Memiliki Organization Schema.

Agar mudah ditemukan oleh:
* ChatGPT Search
* Gemini
* Claude
* Perplexity
* Google AI Overview

---
# SUPER ADMIN CONTROL
Seluruh menu footer wajib:
✅ Bisa diaktifkan/nonaktifkan
✅ Bisa diubah urutannya
✅ Bisa diubah judulnya
✅ Bisa diubah URL slug-nya
✅ Bisa diubah kontennya
Tanpa perlu mengubah kode aplikasi.
