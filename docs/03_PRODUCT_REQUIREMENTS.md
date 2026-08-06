# 03 — PRODUCT REQUIREMENTS

> **Sukses Aqiqah** — *"Tunaikan Ibadah, Tebarkan Manfaat"*

| Field | Value |
|-------|-------|
| Dokumen | 03_PRODUCT_REQUIREMENTS |
| Versi | 1.0 |
| Tanggal | 2026-06-14 |
| Status | Draft — menunggu approval |

---

## 1. Functional Requirements (FR)

Konvensi prioritas: **M** = Must (MVP), **S** = Should, **C** = Could (Phase 2+).

### 1.1 Authentication & Authorization
| ID | Requirement | Prioritas |
|----|-------------|-----------|
| FR-A1 | Pengguna internal login via email + password (Supabase Auth). | M |
| FR-A2 | Sistem menerapkan RBAC 6 peran (lihat **07_USER_ROLES**). | M |
| FR-A3 | Data ter-scope per cabang untuk Admin Cabang & Petugas. | M |
| FR-A4 | Peserta mengakses laporan tanpa login via link unik bertoken. | M |
| FR-A5 | Reset password & nonaktifkan akun. | S |

### 1.2 Order Management
| ID | Requirement | Prioritas |
|----|-------------|-----------|
| FR-O1 | Admin membuat order dengan jenis layanan: Aqiqah / Qurban / Sedekah Daging. | M |
| FR-O2 | Order menyimpan data peserta, kontak, jumlah & jenis hewan, preferensi, cabang. | M |
| FR-O3 | Setiap order punya nomor unik & status terlihat. | M |
| FR-O4 | Admin mengubah status order sesuai workflow (state machine). | M |
| FR-O5 | Satu order dapat memiliki banyak hewan (Animal). | M |
| FR-O6 | Pencarian & filter order (status, cabang, lokasi, PIC, tanggal, jenis). | M |
| FR-O7 | Riwayat perubahan order tercatat (audit). | M |

### 1.3 Payment Management
| ID | Requirement | Prioritas |
|----|-------------|-----------|
| FR-P1 | Catat tagihan & status pembayaran (Unpaid/Partial/Paid). | M |
| FR-P2 | Upload & verifikasi bukti transfer oleh admin. | M |
| FR-P3 | Order tidak lanjut ke penjadwalan sebelum pembayaran memenuhi gate (lunas **atau** DP ≥ `min_dp`); pelunasan penuh wajib sebelum order selesai. | M |
| FR-P4 | Riwayat pembayaran per order. | S |

### 1.4 Scheduling & Assignment
| ID | Requirement | Prioritas |
|----|-------------|-----------|
| FR-S1 | Tetapkan tanggal pemotongan, lokasi, dan Petugas (PIC) ke order. | M |
| FR-S2 | Lihat jadwal per lokasi & per petugas. | M |
| FR-S3 | Lokasi menyimpan koordinat (Google Maps). | M |

### 1.5 Slaughter & Distribution
| ID | Requirement | Prioritas |
|----|-------------|-----------|
| FR-SL1 | Petugas mencatat pelaksanaan pemotongan per hewan + waktu. | M |
| FR-SL2 | Catat distribusi: titik/penerima, jumlah paket daging. | M |
| FR-SL3 | Progres potong & distribusi terlihat real-time di dashboard. | M |
| FR-SL4 | Penanda kendala/issue pada order (mis. hewan tidak layak). | M |

### 1.6 Documentation Management
| ID | Requirement | Prioritas |
|----|-------------|-----------|
| FR-D1 | Upload foto & video lapangan per order/hewan (kamera PWA). | M |
| FR-D2 | Tambah catatan teks pada dokumentasi. | M |
| FR-D3 | Alur validasi 2 tingkat: Supervisor → Admin Pusat. | M |
| FR-D4 | Status dokumentasi: Pending / Approved / Rejected (+alasan). | M |
| FR-D5 | Order tak bisa "selesai" tanpa dokumentasi tervalidasi. | M |
| FR-D6 | Upload tahan sinyal buruk (antrian offline PWA). | M |

### 1.7 Reporting Engine
| ID | Requirement | Prioritas |
|----|-------------|-----------|
| FR-R1 | Generate laporan PDF per order (React PDF). | M |
| FR-R2 | Halaman laporan publik per order via link unik (tanpa login). | M |
| FR-R3 | Peserta dapat mengunduh PDF dari halaman publik. | M |
| FR-R4 | Laporan menampilkan ringkasan, foto/video tervalidasi, status distribusi. | M |
| FR-R5 | Kirim link laporan via WA.me & Email. | M |

### 1.8 Dashboard & Monitoring
| ID | Requirement | Prioritas |
|----|-------------|-----------|
| FR-DB1 | Executive Dashboard: KPI agregat semua cabang. | M |
| FR-DB2 | Cabang & Lokasi Dashboard: progres per scope. | M |
| FR-DB3 | Petugas Dashboard: daftar tugas & status. | M |
| FR-DB4 | Jawab "order belum selesai, lokasi, PIC, kendala" dalam < 10 detik. | M |
| FR-DB5 | Filter & drill-down dari agregat ke order individual. | M |

### 1.9 Notification
| ID | Requirement | Prioritas |
|----|-------------|-----------|
| FR-N1 | Notifikasi dashboard (alert in-app) untuk tugas & keterlambatan. | M |
| FR-N2 | Reminder otomatis dokumentasi/distribusi/laporan (n8n). | M |
| FR-N3 | Kirim WA.me & Email ke peserta saat laporan siap. | M |

### 1.10 Audit & Settings
| ID | Requirement | Prioritas |
|----|-------------|-----------|
| FR-AU1 | Audit trail untuk perubahan status & aksi penting (siapa/kapan/apa). | M |
| FR-AU2 | Kelola master data: cabang, lokasi, layanan, pengguna. | M |
| FR-AU3 | Kelola template laporan & branding dasar. | S |

### 1.11 AI Layer (Phase 2)
| ID | Requirement | Prioritas |
|----|-------------|-----------|
| FR-AI1 | AI Executive Summary atas KPI. | C |
| FR-AI2 | AI Risk Detector (order berisiko telat/bermasalah). | C |
| FR-AI3 | AI Report Writer (narasi laporan). | C |

## 2. Non-Functional Requirements (NFR)

| ID | Kategori | Requirement | Target |
|----|----------|-------------|--------|
| NFR-1 | Performa | Dashboard memuat KPI utama | < 3 dtk; query status < 10 dtk |
| NFR-2 | Skalabilitas | Tahan lonjakan musiman (Qurban) | Tanpa degradasi fungsional |
| NFR-3 | Ketersediaan | Uptime layanan inti | ≥ 99% (managed Vercel/Supabase) |
| NFR-4 | Mobile/PWA | Instalable, responsif, offline-tolerant untuk upload | Lighthouse PWA pass |
| NFR-5 | Keamanan | RBAC, signed URL untuk file, enkripsi in-transit | Lihat **20_SECURITY_CHECKLIST** |
| NFR-6 | Privasi | Data peserta hanya untuk yang berhak | Akses ter-scope + audit |
| NFR-7 | Auditability | Semua perubahan status tercatat | 100% event penting |
| NFR-8 | Usability | Petugas baru bisa input order tanpa pelatihan panjang | < 15 menit onboarding tugas inti |
| NFR-9 | Maintainability | Kode & skema terdokumentasi | Sesuai dokumen 04–06, 16, 24 |
| NFR-10 | Observability | Log & metrik operasional tersedia | Dashboard alert + log error |
| NFR-11 | Lokalisasi | Antarmuka Bahasa Indonesia | Default ID |
| NFR-12 | Kompatibilitas | Chrome/Safari/Edge terbaru, Android & iOS via PWA | 2 versi terakhir |

## 3. User Stories & Acceptance Criteria

Format: *Sebagai [role], saya ingin [aksi], agar [nilai].*

### US-1 — Admin Cabang membuat order
> Sebagai **Admin Cabang**, saya ingin membuat order baru dengan jenis layanan & data peserta, agar order tercatat terpusat.

**Acceptance Criteria:**
- [ ] Form order memuat: jenis layanan, peserta, kontak, jumlah/jenis hewan, cabang, preferensi.
- [ ] Saat tersimpan, order mendapat nomor unik & status awal `DRAFT`/`NEW`.
- [ ] Order hanya muncul di scope cabang admin tersebut.
- [ ] Perubahan tercatat di audit trail.

### US-2 — Admin memverifikasi pembayaran
> Sebagai **Admin Cabang**, saya ingin memverifikasi bukti pembayaran, agar order bisa lanjut dijadwalkan.

**Acceptance Criteria:**
- [ ] Admin mengunggah/menandai bukti pembayaran.
- [ ] Status pembayaran berubah `Unpaid → Partial/Paid`.
- [ ] Order tidak bisa masuk tahap `SCHEDULED` jika syarat pembayaran belum terpenuhi.

### US-3 — Admin menjadwalkan & menetapkan PIC
> Sebagai **Admin Cabang**, saya ingin menetapkan tanggal, lokasi, dan petugas, agar pelaksanaan jelas penanggung jawabnya.

**Acceptance Criteria:**
- [ ] Order memiliki tanggal pemotongan, lokasi (dengan koordinat), dan Petugas (PIC).
- [ ] Jadwal tampil di Petugas Dashboard milik PIC.
- [ ] Penjadwalan hanya bisa jika pembayaran memenuhi gate (lunas atau DP ≥ `min_dp`).
- [ ] Status order menjadi `SCHEDULED`.

### US-4 — Petugas mengunggah dokumentasi di lapangan
> Sebagai **Petugas Lapangan**, saya ingin mengunggah foto/video & catatan dari ponsel meski sinyal lemah, agar bukti pelaksanaan terekam.

**Acceptance Criteria:**
- [ ] Bisa ambil foto/video langsung dari kamera (PWA).
- [ ] Jika offline, unggahan masuk antrian dan terkirim saat online.
- [ ] Dokumentasi terhubung ke order/hewan yang benar.
- [ ] Status dokumentasi awal `PENDING`.

### US-5 — Supervisor & Admin Pusat memvalidasi dokumentasi
> Sebagai **Supervisor** (Admin Cabang/Manager ditunjuk) lalu **Admin Pusat**, saya ingin memvalidasi dokumentasi, agar hanya bukti sah yang masuk laporan.

**Acceptance Criteria:**
- [ ] Supervisor dapat Approve/Reject (dengan alasan) di tingkat pertama.
- [ ] **Admin Pusat** (role `admin_pusat`) memberi validasi akhir.
- [ ] Hanya dokumentasi `APPROVED` yang muncul di laporan peserta.
- [ ] Order tak bisa `COMPLETED` tanpa dokumentasi tervalidasi.

### US-6 — Peserta melihat laporan tanpa login
> Sebagai **Peserta**, saya ingin membuka laporan via link unik tanpa login, agar mudah melihat bukti ibadah saya.

**Acceptance Criteria:**
- [ ] Link unik bertoken membuka halaman publik read-only.
- [ ] Halaman menampilkan ringkasan, foto/video tervalidasi, status distribusi.
- [ ] Tersedia tombol unduh PDF.
- [ ] Tidak ada data peserta lain yang bocor lewat link.

### US-7 — Direktur memantau KPI
> Sebagai **Direktur**, saya ingin melihat KPI agregat semua cabang, agar bisa mengambil keputusan cepat.

**Acceptance Criteria:**
- [ ] Executive Dashboard menampilkan Total Order, Progress Potong/Distribusi/Dokumentasi/Laporan.
- [ ] Bisa drill-down ke cabang/lokasi/order.
- [ ] Pertanyaan "order belum selesai, lokasi, PIC, kendala" terjawab < 10 detik.

### US-8 — Reminder otomatis
> Sebagai **Manager Program**, saya ingin sistem mengingatkan tugas yang tertunda, agar tidak ada order terbengkalai.

**Acceptance Criteria:**
- [ ] n8n mengirim reminder dokumentasi/distribusi/laporan sesuai SLA.
- [ ] Alert juga tampil di dashboard terkait.

## 4. Definition of Done (global)

Sebuah fitur dianggap selesai jika: memenuhi acceptance criteria, ter-scope sesuai RBAC, menulis audit trail bila relevan, responsif/PWA-friendly, lulus uji (**21_TESTING_PLAN**), dan terdokumentasi di spec terkait (04–06, 16).

---

### Referensi silang
- Visi & metrik → **01_PROJECT_VISION**
- Workflow & state machine → **08_WORKFLOW_MAP**
- Entity & skema → **05_DATABASE_DESIGN**
- API → **16_API_SPEC**
- KPI dashboard → **09_DASHBOARD_SPEC**
