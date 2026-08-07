/**
 * Tautan peta dari koordinat lokasi (`prd.md` FR-S3).
 *
 * Memakai URL pencarian Google Maps yang tidak butuh API key — halaman jadwal
 * hanya perlu mengantar petugas ke titiknya, bukan menyematkan peta interaktif.
 * `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` baru diperlukan kalau nanti peta di-embed
 * pada Dashboard Lokasi (docs/09 section 5).
 */
export function googleMapsUrl(lat: number | null, lng: number | null): string | null {
  if (lat === null || lng === null) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  // Koordinat di luar rentang bumi hampir pasti data rusak — lebih baik tidak
  // menampilkan tautan daripada mengirim petugas ke titik yang salah.
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
