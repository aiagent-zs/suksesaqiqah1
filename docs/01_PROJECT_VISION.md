# 01 — PROJECT VISION

> **Sukses Aqiqah** — *"Tunaikan Ibadah, Tebarkan Manfaat"*
> Operations Command Center untuk Aqiqah, Qurban, dan Sedekah Daging.

| Field | Value |
|-------|-------|
| Dokumen | 01_PROJECT_VISION |
| Versi | 1.0 |
| Tanggal | 2026-06-14 |
| Status | Draft — menunggu approval |
| Pemilik | Zakat Sukses (internal) |

---

## 1. Product Vision

Sukses Aqiqah adalah **Operations Command Center** yang mengubah pengelolaan ibadah Aqiqah, Qurban, dan Sedekah Daging dari proses manual berbasis chat & spreadsheet menjadi satu platform digital modern yang **real-time, terdokumentasi, dan auditable**.

Visi kami: **setiap ekor hewan yang ditunaikan sebagai ibadah dapat ditelusuri penuh** — dari order, pembayaran, pemotongan, hingga daging sampai ke penerima manfaat — dan setiap peserta menerima laporan transparan tanpa perlu menanyakan status.

Pernyataan visi tunggal yang menjadi tolok ukur seluruh desain:

> Sistem harus mampu menjawab dalam **< 10 detik**:
> *"Berapa order yang belum selesai, berada di lokasi mana, siapa PIC-nya, dan apa kendalanya?"*

Jika sebuah fitur tidak membantu menjawab pertanyaan itu atau tidak mendukung operasional, monitoring, dokumentasi, dan pelaporan — fitur tersebut **bukan prioritas MVP**.

## 2. Mission

1. **Sentralisasi operasional** — menyatukan order, jadwal, petugas, dan lokasi dalam satu sumber kebenaran.
2. **Monitoring real-time** — manajemen melihat progres setiap tahap tanpa menelepon petugas.
3. **Dokumentasi terstruktur** — foto, video, dan catatan lapangan tersimpan rapi per order/hewan.
4. **Pelaporan otomatis & transparan** — peserta menerima laporan via link unik tanpa login.
5. **Auditability** — setiap perubahan status tercatat siapa, kapan, dan apa.
6. **Memudahkan petugas lapangan** — antarmuka mobile-first (PWA) yang ringan dan bisa dipakai di kondisi sinyal terbatas.

## 3. Objectives

| Kode | Objective | Deskripsi |
|------|-----------|-----------|
| O1 | Single source of truth | Semua order & status tersimpan terpusat, bukan tersebar di chat/spreadsheet. |
| O2 | Visibilitas end-to-end | Setiap order dapat dilacak dari tahap Order → Laporan. |
| O3 | Dokumentasi wajib | Tidak ada order ditandai "selesai" tanpa bukti dokumentasi tervalidasi. |
| O4 | Laporan peserta otomatis | Laporan PDF + halaman publik dibuat otomatis dan dibagikan via link unik. |
| O5 | Dashboard manajemen | Direktur & Manager melihat KPI agregat real-time per cabang/lokasi. |
| O6 | Operasional mobile | Petugas lapangan dapat bekerja penuh dari ponsel (PWA, kamera, offline-tolerant). |

## 4. Success Metrics

| Metrik | Baseline (manual) | Target MVP |
|--------|-------------------|------------|
| Waktu menjawab "status order X" | Menit–jam (telepon/chat) | **< 10 detik** (dashboard) |
| Order dengan dokumentasi lengkap tervalidasi | Tidak terukur | **≥ 95%** |
| Laporan peserta terkirim tepat waktu | Manual, sering telat | **≥ 90%** dalam SLA |
| Waktu pembuatan 1 laporan peserta | 15–30 menit manual | **< 1 menit** (otomatis) |
| Akurasi data status (vs realita lapangan) | Sering selisih | **≥ 98%** |
| Adopsi petugas lapangan (order diinput via sistem) | 0% | **≥ 90%** di akhir MVP |
| Waktu onboarding admin cabang baru | — | **< 1 hari** |

> Semua metrik di atas dirinci lebih lanjut sebagai KPI dashboard di **09_DASHBOARD_SPEC**.

## 5. Product Scope (MVP — Phase 1)

**Termasuk:**

- **Order Management** — input & kelola order Aqiqah, Qurban, Sedekah Daging.
- **Payment Tracking** — pencatatan & verifikasi status pembayaran (bukan payment gateway).
- **Scheduling** — penjadwalan pemotongan & penetapan PIC/lokasi.
- **Slaughter & Distribution Tracking** — pencatatan progres pemotongan dan distribusi daging.
- **Documentation Management** — upload foto/video/catatan + alur validasi (Supervisor → Admin Pusat).
- **Reporting Engine** — laporan PDF & halaman publik via link unik (peserta tanpa login).
- **Dashboards** — Executive, Cabang, Lokasi, Petugas.
- **Notification** — WA.me, Email, Dashboard Alert.
- **PWA** — instalable, mobile-first, camera upload, offline-tolerant.
- **Auth & RBAC** — 6 peran (Direktur, Manager Program, Admin Pusat, Admin Cabang, Petugas Lapangan, Peserta).
- **Audit Trail** — log perubahan status & aksi penting.

> Phase 2 (AI Layer, advanced monitoring, distribution intelligence) dan Phase 3 (ImpactLivestock OS) didefinisikan di **23_MVP_ROADMAP**.

## 6. Non-Scope (eksplisit TIDAK dibuat pada fase awal)

| Tidak dibuat | Alasan |
|--------------|--------|
| Native mobile app (iOS/Android) | PWA cukup untuk kebutuhan lapangan; hindari biaya & kompleksitas distribusi store. |
| Multi-tenant SaaS | Sistem internal Zakat Sukses; multi-tenant menambah kompleksitas tanpa nilai MVP. |
| Marketplace / katalog publik & checkout | Bukan platform jual-beli; fokus operasional, bukan e-commerce. |
| Payment gateway terintegrasi | MVP cukup mencatat & memverifikasi pembayaran manual; gateway dapat menyusul. |
| Modul akuntansi/keuangan penuh | Di luar fokus operasional; tangani lewat sistem keuangan terpisah. |
| AI generatif kompleks tanpa nilai bisnis | Hanya 3 use case AI bernilai jelas (lihat **19_AI_LAYER**). |
| Integrasi logistik pihak ketiga otomatis | Phase 2+ (distribution intelligence). |

## 7. Guardrails Desain

- **Operasional dulu**, baru fitur pendukung.
- **Real-time monitoring** adalah fitur inti, bukan tambahan.
- Hindari **overengineering** dan kompleksitas marketplace/SaaS.
- Setiap entitas penting harus **auditable** dan **dapat ditelusuri**.
- Arsitektur harus **scalable** untuk pertumbuhan jumlah order & cabang.

---

### Referensi silang
- Kebutuhan bisnis & stakeholder → **02_BUSINESS_REQUIREMENTS**
- Functional/Non-functional requirements → **03_PRODUCT_REQUIREMENTS**
- KPI & dashboard → **09_DASHBOARD_SPEC**
- Roadmap fase → **23_MVP_ROADMAP**
