/**
 * Konversi tanggal kalender (YYYY-MM-DD) menjadi batas rentang timestamptz.
 *
 * Filter tanggal di UI adalah tanggal kalender menurut operator, sedangkan
 * kolom `created_at` bertipe timestamptz. Batasnya wajib dinyatakan dalam zona
 * waktu operasional — memakai `Z` menggeser rentang 7 jam, sehingga order yang
 * dibuat pukul 00:00–07:00 WIB terhitung di hari yang salah.
 */

/** Zona waktu operasional. Indonesia tidak menerapkan DST, jadi offsetnya tetap. */
export const WIB_OFFSET = '+07:00';

/** Awal hari (inklusif) pukul 00:00 WIB — pasangan untuk `.gte()`. */
export function startOfDayWib(date: string): string {
  return `${date}T00:00:00.000${WIB_OFFSET}`;
}

/**
 * Batas akhir hari sebagai nilai EKSKLUSIF: pukul 00:00 WIB pada hari
 * berikutnya — pasangan untuk `.lt()`.
 *
 * Sengaja eksklusif, bukan `23:59:59.999`: timestamptz menyimpan presisi
 * mikrodetik, jadi batas inklusif akan menjatuhkan baris yang jatuh di antara
 * 23:59:59.999001 dan 23:59:59.999999.
 */
export function endOfDayExclusiveWib(date: string): string {
  // Aritmetika kalender dilakukan di UTC supaya penambahan hari tidak
  // terpengaruh zona waktu mesin yang menjalankan proses.
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return `${next.toISOString().slice(0, 10)}T00:00:00.000${WIB_OFFSET}`;
}
