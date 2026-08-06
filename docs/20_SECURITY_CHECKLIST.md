# 20 — SECURITY CHECKLIST

> **Sukses Aqiqah** — *"Tunaikan Ibadah, Tebarkan Manfaat"*
> Menegakkan RBAC (**07**), RLS (**05**), akses storage (**17**), akses publik laporan (**11**).

| Field | Value |
|-------|-------|
| Dokumen | 20_SECURITY_CHECKLIST |
| Versi | 1.0 |
| Tanggal | 2026-06-14 |
| Status | Draft — menunggu approval |

---

## 1. Authentication

- [ ] Login internal via **Supabase Auth** (email+password); password kebijakan kuat.
- [ ] Sesi via JWT; refresh aman; logout membatalkan sesi.
- [ ] Reset password aman (token kedaluwarsa); akun dapat dinonaktifkan.
- [ ] (Opsi Phase 2) 2FA untuk role pusat (Direktur/Manager).
- [ ] Tidak ada kredensial di klien/kode; gunakan env & secret store.

## 2. Authorization (RBAC + RLS)

- [ ] 6 role ditegakkan (**07**); prinsip **least privilege**.
- [ ] **PostgreSQL RLS** aktif di semua tabel operasional; kebijakan berbasis `auth.uid()`, `role`, `branch_id`.
- [ ] Scoping cabang untuk Admin/Petugas; global read hanya pusat.
- [ ] **Defense in depth:** Server Action memvalidasi kapabilitas action-level + RLS (dua lapis).
- [ ] Transisi status hanya via endpoint khusus (tidak patch kolom status langsung).
- [ ] Pemisahan tugas: pengupload dokumentasi ≠ validator akhir.

## 3. File / Storage Access

- [ ] Bucket media **private**; akses via **signed URL** TTL pendek (**17**).
- [ ] Upload via signed upload/Server Action; validasi MIME & ukuran di server.
- [ ] Nama file = uuid; path tanpa data pribadi.
- [ ] EXIF/GPS sensitif dilucuti sesuai kebijakan privasi.
- [ ] Peserta mengakses media hanya lewat alur token laporan (bukan bucket langsung).

## 4. Public Report Page (akses tanpa login)

- [ ] Token panjang, acak, tak tertebak; unik per order; dapat dirotasi bila bocor.
- [ ] Validasi token server-side; hanya data order pemilik token.
- [ ] **Anti-enumerasi:** token invalid → 404 generik + **rate limiting**.
- [ ] Halaman read-only; tidak ada aksi mutasi.
- [ ] Media via signed URL kedaluwarsa.

## 5. Audit Trail

- [ ] `audit_logs` mencatat perubahan status & aksi penting (siapa/kapan/apa, before/after).
- [ ] Aksi validasi dokumentasi, verifikasi pembayaran, generate/kirim laporan teraudit.
- [ ] Aksi otomatis (n8n/system) tercatat dengan aktor `system`.
- [ ] Log tidak dapat diubah oleh role operasional biasa.

## 6. Data Privacy

- [ ] Data peserta (nama, kontak, alamat) diperlakukan **privat**; akses ter-scope.
- [ ] **Data minimization** ke AI & notifikasi (agregat bila cukup — **19**, **12**).
- [ ] Kontak hanya dipakai untuk laporan/reminder terkait order.
- [ ] Retensi & penghapusan sesuai **17**; penghapusan teraudit.
- [ ] Kepatuhan prinsip perlindungan data (mis. PDP/UU terkait) dipertimbangkan.

## 7. Application & Transport Security

- [ ] **HTTPS** di semua endpoint (Vercel/Supabase TLS).
- [ ] Validasi input (schema, mis. Zod) di setiap mutasi; cegah injection.
- [ ] Proteksi CSRF/replay sesuai mekanisme Next.js Server Actions.
- [ ] Rate limiting pada endpoint sensitif & publik.
- [ ] Header keamanan (CSP, HSTS, X-Content-Type-Options) dikonfigurasi.
- [ ] Dependensi dipantau (audit) & diperbarui.

## 8. Secrets & Integrations

- [ ] Secrets (Supabase service key, SMTP, Maps key, Claude API) di env/secret store, **tidak** di repo.
- [ ] Google Maps API key dibatasi domain/referer.
- [ ] Webhook n8n diproteksi secret; akses minimal ke Supabase.
- [ ] Rotasi key terjadwal/saat insiden.

## 9. Operasional & Resilience

- [ ] Backup DB & Storage terjadwal (**22**); uji restore.
- [ ] Monitoring & alert untuk error/anomali (login gagal beruntun, dsb).
- [ ] Pemisahan environment dev/staging/prod; data prod tidak dipakai dev.
- [ ] Rencana respons insiden dasar (siapa, langkah, komunikasi).

## 10. Pemetaan Risiko → Kontrol (ringkas)

| Risiko | Kontrol |
|--------|---------|
| Kebocoran data peserta | RLS + signed URL + token anti-enumerasi + data minimization |
| Akses lintas cabang | RLS `branch_id` + validasi server |
| Manipulasi status/laporan | Endpoint status khusus + audit trail + idempotensi |
| Penyalahgunaan link publik | Token kuat + rate limit + TTL media |
| Kebocoran secret | Secret store + rotasi + key dibatasi |

---

### Referensi silang
- RBAC → **07_USER_ROLES**
- RLS/entity → **05_DATABASE_DESIGN**
- Storage → **17_STORAGE_STRATEGY**
- Laporan publik → **11_REPORTING_ENGINE**
- Deployment/backup → **22_DEPLOYMENT_PLAN**
