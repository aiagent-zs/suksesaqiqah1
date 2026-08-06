# 17 — STORAGE STRATEGY

> **Sukses Aqiqah** — *"Tunaikan Ibadah, Tebarkan Manfaat"*
> Storage: **Supabase Storage**. Path direferensikan oleh `documentations.storage_path`, `payments.proof_path`, `reports.pdf_path` (**05**).

| Field | Value |
|-------|-------|
| Dokumen | 17_STORAGE_STRATEGY |
| Versi | 1.0 |
| Tanggal | 2026-06-14 |
| Status | Draft — menunggu approval |

---

## 1. Buckets

| Bucket | Visibilitas | Isi |
|--------|-------------|-----|
| `documentation` | **private** | Foto & video lapangan |
| `payment-proofs` | **private** | Bukti transfer |
| `reports` | **private** | PDF laporan |
| `public-assets` | public | Logo, ikon PWA, aset statis non-sensitif |

> Semua media operasional **private**; akses lewat **signed URL** (kedaluwarsa). Tidak ada listing publik.

## 2. Image & Video Storage

| Aspek | Foto | Video |
|-------|------|-------|
| Format | JPEG/WebP | MP4 (H.264) |
| Kompresi | Klien (resize maks sisi panjang ~1600px, kualitas ~0.7) | Klien batasi durasi & bitrate |
| Batas ukuran | ≤ ~2 MB/foto (target) | ≤ ~25 MB/klip (target, durasi pendek) |
| Thumbnail | Dibuat untuk galeri/laporan | Poster frame |

Kompresi dilakukan di klien (PWA) sebelum masuk upload queue (**13**) untuk hemat data lapangan.

## 3. Naming Convention

Path terstruktur dan dapat ditelusuri:

```
documentation/{branch_code}/{YYYY}/{MM}/{order_number}/{stage}/{uuid}.{ext}
payment-proofs/{branch_code}/{order_number}/{uuid}.{ext}
reports/{order_number}/v{version}/{order_number}.pdf
```

Contoh:
```
documentation/BDG/2026/06/IA-202606-0012/slaughter/4f3c....jpg
reports/IA-202606-0012/v1/IA-202606-0012.pdf
```

**Aturan:** nama file = `uuid` (hindari tabrakan & kebocoran info); ekstensi sesuai MIME tervalidasi; tidak menyertakan data pribadi pada nama path.

## 4. Akses & Keamanan

| Mekanisme | Aturan |
|-----------|--------|
| Signed URL | TTL pendek (mis. 5–15 menit) untuk lihat/unduh |
| Upload | Signed upload URL / Server Action; server simpan `storage_path` tervalidasi |
| RLS/Policy | Akses bucket privat hanya untuk role berwenang (**07**); peserta hanya via alur token laporan (**11**) |
| Validasi | MIME & ukuran dicek server; tolak tipe tak diizinkan |
| EXIF | Lucuti metadata sensitif (mis. GPS) sesuai kebijakan privasi (**20**) |

## 5. Retention Policy

| Kategori | Retensi | Aksi |
|----------|---------|------|
| Dokumentasi `approved` | Permanen selama order aktif/arsip | Simpan; bagian bukti audit |
| Dokumentasi `rejected`/`pending` lama | 90 hari | Bersihkan terjadwal (n8n) bila tak dipakai |
| Bukti pembayaran | Sesuai kebijakan akuntansi (mis. ≥ 5 tahun) | Arsip |
| PDF laporan (semua versi) | Permanen | Simpan untuk audit & re-share |
| File orphan (upload gagal/yatim) | 7 hari | Pembersihan terjadwal |

> Penghapusan apa pun bersifat **soft/terjadwal** dengan jejak `audit_logs`; tidak ada hard-delete media bukti pada order aktif.

## 6. Backup & Integritas

- Mengandalkan backup Supabase (DB + Storage) sesuai **22_DEPLOYMENT_PLAN**.
- `storage_path` di DB adalah sumber kebenaran relasi; job pemeliharaan mendeteksi mismatch (record tanpa file / file tanpa record).
- Operasi penting (generate report, hapus terjadwal) idempoten & teraudit.

## 7. Biaya & Skala

- Kompresi klien + thumbnail menekan bandwidth & storage.
- Bucket privat + signed URL memanfaatkan CDN Supabase untuk pengiriman cepat.
- Pantau pertumbuhan saat puncak Qurban (kapasitas & kuota).

---

### Referensi silang
- Entity → **05_DATABASE_DESIGN**
- Upload/kompresi/queue → **13_PWA_ARCHITECTURE**
- Alur dokumentasi → **10_DOCUMENTATION_FLOW**
- Laporan/PDF → **11_REPORTING_ENGINE**
- Keamanan/privasi → **20_SECURITY_CHECKLIST**
- Backup/deploy → **22_DEPLOYMENT_PLAN**
