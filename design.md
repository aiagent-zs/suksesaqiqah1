# 14 — UI/UX SPEC

> **Sukses Aqiqah** — *"Tunaikan Ibadah, Tebarkan Manfaat"*

---

## 1. Prinsip Desain

1. **Clarity over decoration** — operasional dulu; data terbaca cepat.
2. **Mobile-first** untuk petugas, **data-dense responsive** untuk dashboard manajemen.
3. **Konsisten** — satu design system, komponen dapat dipakai ulang.
4. **Aksesibel** — kontras cukup, target sentuh besar, label jelas.
5. **Cepat** — skeleton/loading state, hindari layout shift.

## 2. Design System

- **Foundation:** Next.js 16 + **Tailwind CSS**.
- **Komponen:** berbasis **shadcn/ui** (Radix primitives) untuk konsistensi & aksesibilitas.
- **Ikon:** Lucide.
- **Charts:** library ringan (mis. Recharts) untuk KPI dashboard.
- **Font:** Inter (UI) — fallback system-ui.

## 3. Color Palette

| Token | Hex | Penggunaan |
|-------|-----|-----------|
| `primary` | `#0E7C5A` | Brand (hijau), aksi utama, theme_color PWA |
| `primary-dark` | `#0A5C43` | Hover/active |
| `accent` | `#F0A500` | Sorotan, highlight KPI |
| `success` | `#16A34A` | Status selesai/approved |
| `warning` | `#D97706` | SLA hampir terlewat, partial |
| `danger` | `#DC2626` | Issue high, rejected, gagal |
| `info` | `#2563EB` | Info/netral aktif |
| `neutral-900..50` | grayscale | Teks & latar |

Status warna dipakai konsisten di badge order/dokumentasi/pembayaran.

## 4. Tipografi & Spacing

| Elemen | Ukuran |
|--------|--------|
| Display/H1 | 28–32px / bold |
| H2 | 22–24px / semibold |
| H3 | 18px / semibold |
| Body | 14–16px |
| Caption | 12px |

Spacing skala 4px (4/8/12/16/24/32). Radius default 8–12px. Shadow halus untuk card.

## 5. Komponen Inti (reusable)

| Komponen | Fungsi |
|----------|--------|
| `AppShell` | Layout: sidebar (desktop) / bottom-nav (mobile) + header |
| `KpiCard` | Angka besar + label + tren |
| `StatusBadge` | Warna per status (order/doc/payment) |
| `DataTable` | Tabel order: filter, sort, paginate, klik-baris |
| `FilterBar` | Periode, cabang, lokasi, status, PIC |
| `OrderCard` | Ringkasan order (mobile) |
| `Timeline` | Riwayat status/audit per order |
| `MediaUploader` | Kamera + preview + queue indicator |
| `MediaGallery` | Grid foto/video (approved) |
| `MapView` | Google Maps marker lokasi |
| `ValidationQueue` | Daftar dokumentasi untuk approve/reject |
| `AlertList` | Notifikasi dashboard |
| `EmptyState` / `Skeleton` | Kondisi kosong & loading |

## 6. Responsive Layout

| Breakpoint | Target | Pola |
|-----------|--------|------|
| < 640px (mobile) | Petugas | Bottom-nav, kartu 1 kolom, aksi 1-tap |
| 640–1024px (tablet) | Admin di lapangan | 2 kolom, tabel ringkas |
| > 1024px (desktop) | Manajemen/Admin | Sidebar + grid KPI + tabel penuh |

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