/**
 * Keluar otomatis saat menganggur (idle logout).
 *
 * Supabase menyegarkan token akses di tiap permintaan lewat middleware, jadi
 * sesi yang dibiarkan terbuka tidak pernah kedaluwarsa sendiri — itulah sebab
 * akun tetap terlihat masuk meski sudah lama ditinggal. Berkas ini memusatkan
 * angka & nama yang dipakai kedua sisi penegakannya:
 *
 * - **Server (middleware)** — sumber kebenaran. Membandingkan cap waktu pada
 *   cookie `httpOnly`; kalau lewat ambang, sesi dicabut dan permintaan
 *   dialihkan ke `/login`. Ini yang berlaku sekalipun JavaScript dimatikan.
 * - **Klien (`IdleLogout`)** — kenyamanan. Tab yang menganggur tidak mengirim
 *   permintaan apa pun, jadi tanpa pengawas di klien user baru "terlempar"
 *   saat menekan sesuatu. Pengawas ini membuat keluarnya terjadi tepat waktu.
 *
 * Keduanya membaca ambang yang sama dari sini supaya tidak pernah berbeda.
 */

/** Ambang menganggur sebelum sesi dicabut. */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Cookie cap waktu aktivitas terakhir.
 *
 * `httpOnly` — hanya middleware yang boleh menulisnya. Kalau skrip halaman
 * bisa menyentuhnya, penanda ini kehilangan arti sebagai kendali keamanan.
 */
export const ACTIVITY_COOKIE = 'sa-last-activity';

/**
 * Umur cookie sengaja jauh lebih panjang dari ambang menganggur.
 *
 * Kalau cookie ikut kedaluwarsa di menit ke-5, ia justru **hilang** — dan
 * cookie yang hilang tidak bisa dibedakan dari "baru saja login", sehingga
 * sesi yang seharusnya berakhir malah dianggap segar. Yang menentukan adalah
 * perbandingan cap waktunya, bukan umur cookie-nya.
 */
export const ACTIVITY_COOKIE_MAX_AGE_S = 30 * 24 * 60 * 60;

/** Nilai `?notice=` di `/login` setelah keluar otomatis. */
export const IDLE_NOTICE = 'idle';

/** Endpoint yang ditembak klien untuk menyegarkan cap waktu aktivitas. */
export const HEARTBEAT_PATH = '/api/session/heartbeat';

/**
 * Jeda minimum antar heartbeat.
 *
 * Harus jauh di bawah `IDLE_TIMEOUT_MS`: user yang aktif tapi tidak berpindah
 * halaman (mengisi form panjang) hanya "terlihat" oleh server lewat heartbeat
 * ini. Kalau jedanya terlalu dekat ke ambang, ia bisa dikeluarkan justru saat
 * sedang mengetik.
 */
export const HEARTBEAT_INTERVAL_MS = 60 * 1000;

/** Seberapa sering klien memeriksa apakah ambang sudah terlewati. */
export const IDLE_CHECK_INTERVAL_MS = 15 * 1000;

/**
 * Kunci `localStorage` untuk berbagi aktivitas antar tab.
 *
 * Tanpa ini, tab yang dibiarkan diam akan mengeluarkan user yang sedang aktif
 * di tab lain — padahal sesinya sama.
 */
export const ACTIVITY_STORAGE_KEY = 'sa:last-activity';

/**
 * Apakah sesi sudah melewati ambang menganggur.
 *
 * Cap waktu yang tidak masuk akal (bukan angka, atau di masa depan karena jam
 * perangkat digeser) diperlakukan sebagai **menganggur**. Memilih sebaliknya
 * berarti menggeser jam menjadi cara memperpanjang sesi tanpa batas.
 */
export function isIdle(lastActivity: number, now: number): boolean {
  if (!Number.isFinite(lastActivity)) return true;
  if (lastActivity > now) return true;
  return now - lastActivity > IDLE_TIMEOUT_MS;
}

/** Baca cap waktu dari nilai cookie/localStorage yang mungkin kosong atau rusak. */
export function parseActivity(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
