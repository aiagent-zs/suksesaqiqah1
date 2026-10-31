/**
 * Jangkauan pengiriman: Jabodetabek dulu.
 *
 * Dibatasi di tingkat kabupaten/kota (kode Kemendagri `regions.level = 2`),
 * karena tiga provinsinya (DKI, Jawa Barat, Banten) juga memuat kota yang
 * belum kami layani, misalnya Bandung dan Serang. Kepulauan Seribu (31.01)
 * sengaja tidak masuk: antar lewat laut belum bisa kami jalankan.
 *
 * Dipakai pemilih alamat (daftar yang ditawarkan) dan skema zod (yang
 * diterima server). Hanya Aqiqah Kirim dan katering yang terkena; Aqiqah Salur
 * tidak punya alamat tujuan.
 */
export const SERVICE_AREA_LABEL = 'Jabodetabek';

export const SERVICE_AREA_CITIES = [
  '31.71', // Jakarta Pusat
  '31.72', // Jakarta Utara
  '31.73', // Jakarta Barat
  '31.74', // Jakarta Selatan
  '31.75', // Jakarta Timur
  '32.01', // Kabupaten Bogor
  '32.71', // Kota Bogor
  '32.76', // Kota Depok
  '32.16', // Kabupaten Bekasi
  '32.75', // Kota Bekasi
  '36.03', // Kabupaten Tangerang
  '36.71', // Kota Tangerang
  '36.74', // Kota Tangerang Selatan
] as const;

/** Provinsi induk dari kota-kota di atas, untuk daftar provinsi di form. */
export const SERVICE_AREA_PROVINCES = [...new Set(SERVICE_AREA_CITIES.map((c) => c.slice(0, 2)))];

export function isInServiceArea(cityCode: string | null | undefined): boolean {
  return (SERVICE_AREA_CITIES as readonly string[]).includes(cityCode ?? '');
}

export const OUT_OF_AREA_MESSAGE = `Saat ini pengiriman baru melayani ${SERVICE_AREA_LABEL}.`;
