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
  return `${addCalendarDays(date, 1)}T00:00:00.000${WIB_OFFSET}`;
}

/**
 * Geser tanggal kalender sejumlah hari, tetap dalam bentuk `YYYY-MM-DD`.
 *
 * Aritmetikanya dilakukan di UTC supaya penambahan hari tidak terpengaruh zona
 * waktu mesin yang menjalankan proses — tanggalnya sendiri sudah merupakan
 * tanggal WIB, jadi tidak ada konversi zona di sini, hanya hitung-hitungan
 * kalender.
 */
export function addCalendarDays(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

/**
 * Tanggal hari ini menurut jam operasional (WIB), bukan menurut zona waktu
 * mesin maupun UTC.
 *
 * Dipakai batas bawah pemesanan di checkout publik. Kalau memakai UTC, pemesan
 * yang membuka form pukul 00:30 WIB akan melihat "hari ini" versi kemarin dan
 * tanggal yang ia pilih tertolak sebagai masa lalu. Aturan yang sama ditegakkan
 * ulang di `create_guest_order` lewat `now() at time zone 'Asia/Jakarta'`.
 *
 * `now` bisa disuntik supaya perilakunya bisa diuji tanpa menyentuh jam sistem.
 */
export function todayWib(now: Date = new Date()): string {
  // +7 jam lalu dibaca sebagai UTC: hasilnya komponen kalender WIB.
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
