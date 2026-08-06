# 21 — TESTING PLAN

> **Sukses Aqiqah** — *"Tunaikan Ibadah, Tebarkan Manfaat"*
> Memvalidasi FR/NFR (**03**), workflow (**08**), keamanan (**20**).

| Field | Value |
|-------|-------|
| Dokumen | 21_TESTING_PLAN |
| Versi | 1.0 |
| Tanggal | 2026-06-14 |
| Status | Draft — menunggu approval |

---

## 1. Strategi

Piramida uji: banyak **unit**, secukupnya **integration**, sedikit **E2E** untuk alur kritis, ditutup **UAT** & **uji performa**. Setiap fitur memenuhi acceptance criteria (**03**) sebelum dianggap selesai.

| Layer | Alat (usulan) | Fokus |
|-------|---------------|-------|
| Unit | Vitest/Jest | Fungsi, validasi schema, util, state machine |
| Integration | Vitest + Supabase test/local | Server Actions ↔ DB ↔ RLS |
| E2E | Playwright | Alur user lintas halaman (PWA) |
| Performa | k6 / Lighthouse | Beban & kecepatan |
| Security | Checklist **20** + scanning | RLS, akses publik, secrets |

## 2. Unit Testing

- [ ] Validasi input (schema) tiap endpoint (**16**).
- [ ] **State machine order** (**08**): hanya transisi sah; precondition (pembayaran→scheduled, dokumentasi approved→reporting).
- [ ] Perhitungan KPI/progress (potong/distribusi/dokumentasi/laporan).
- [ ] Util kompresi gambar & penamaan path (**17**).
- [ ] Pembuatan `order_number` & `public_token` unik.

## 3. Integration Testing

- [ ] **RLS:** Admin Cabang tidak dapat membaca/menulis data cabang lain.
- [ ] Petugas hanya akses order yang ditugaskan.
- [ ] Alur pembayaran → status order.
- [ ] Upload dokumentasi → record `pending` → validasi 2 tingkat → `approved`.
- [ ] Generate laporan (WF-4) idempoten (versi bertambah, token tetap).
- [ ] Outbox `notifications` diproses & status diperbarui.
- [ ] Endpoint publik laporan: token valid → data benar; invalid → 404.

## 4. E2E (alur kritis)

| Skenario | Langkah | Hasil diharapkan |
|----------|---------|------------------|
| Order → Laporan | Admin buat order → verifikasi bayar → jadwalkan → petugas potong/distribusi → upload → validasi → generate → kirim | Peserta buka `/r/{token}`, lihat & unduh PDF |
| Dokumentasi offline | Petugas offline ambil foto → online | Upload tersinkron, record `pending` |
| Litmus test | Buka Executive Dashboard | "Order belum selesai + lokasi + PIC + kendala" tampil < 10 dtk |
| RBAC negatif | Petugas akses halaman manajemen | 403/redirect |
| Token negatif | Buka token acak | 404 generik, tidak ada data bocor |

## 5. UAT (User Acceptance Testing)

- **Peserta uji:** Direktur, Manager, Admin Cabang, Petugas (pilot 1 cabang).
- **Skenario nyata** tiap role mengikuti user stories (**03**).
- **Kriteria lulus:** acceptance criteria terpenuhi; litmus test terjawab; petugas dapat input & upload tanpa pelatihan panjang (NFR-8).
- **Output:** daftar temuan + perbaikan sebelum rilis luas.

## 6. Performance Testing

| Uji | Target |
|-----|--------|
| Dashboard load (KPI) | < 3 dtk (NFR-1) |
| Query litmus test | < 10 dtk |
| Beban puncak (simulasi Qurban) | Tanpa degradasi fungsional (NFR-2) |
| Upload media di jaringan lambat | Antrian & retry bekerja (PWA) |
| Lighthouse PWA | Pass (instalable, offline shell) |

## 7. Security Testing

- [ ] Jalankan checklist **20** sebagai test case.
- [ ] Uji RLS lintas role/cabang (positif & negatif).
- [ ] Uji anti-enumerasi & rate limit halaman publik.
- [ ] Scan dependensi & konfigurasi header keamanan.
- [ ] Pastikan tidak ada secret bocor di build klien.

## 8. Data Uji & Lingkungan

- **Staging** dengan data dummy realistis (cabang, lokasi, order, media contoh).
- Tidak memakai data peserta nyata di non-prod (**20**).
- Seed script untuk skenario berulang.

## 9. Definition of Done (uji)

Fitur lulus bila: unit & integration hijau, E2E alur terkait hijau, acceptance criteria terpenuhi, tidak ada regresi keamanan, performa dalam target.

## 10. CI

- [ ] Jalankan lint + unit + integration pada setiap PR (lihat **22**).
- [ ] E2E pada branch utama/preview.
- [ ] Gate merge: semua wajib hijau.

---

### Referensi silang
- Requirements/acceptance → **03_PRODUCT_REQUIREMENTS**
- Workflow/state → **08_WORKFLOW_MAP**
- Keamanan → **20_SECURITY_CHECKLIST**
- CI/CD & env → **22_DEPLOYMENT_PLAN**
