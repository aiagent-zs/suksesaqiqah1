import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_COOKIE_MAX_AGE_S,
  HEARTBEAT_INTERVAL_MS,
  IDLE_CHECK_INTERVAL_MS,
  IDLE_TIMEOUT_MS,
  isIdle,
  parseActivity,
} from '@/lib/auth/idle';

const NOW = 1_760_000_000_000;

describe('IDLE_TIMEOUT_MS', () => {
  // Angka pastinya sengaja tidak dikunci di sini — ambang menganggur adalah
  // setelan kebijakan yang wajar disetel ulang. Yang dijaga hanya bahwa
  // nilainya masuk akal; perilaku batasnya diuji relatif terhadap konstanta ini
  // di blok `isIdle` di bawah, jadi menyetel angkanya tidak merusak apa pun.
  it('berada pada rentang yang masuk akal untuk sesi operasional', () => {
    expect(IDLE_TIMEOUT_MS).toBeGreaterThanOrEqual(60 * 1000);
    expect(IDLE_TIMEOUT_MS).toBeLessThanOrEqual(8 * 60 * 60 * 1000);
  });

  it('adalah jumlah menit bulat, supaya pesan di /login tidak berkoma', () => {
    // Halaman login menampilkan `IDLE_TIMEOUT_MS / 60000` menit.
    expect(IDLE_TIMEOUT_MS % 60_000).toBe(0);
  });
});

describe('isIdle', () => {
  it('belum menganggur tepat sebelum ambang', () => {
    expect(isIdle(NOW - (IDLE_TIMEOUT_MS - 1), NOW)).toBe(false);
  });

  it('belum menganggur tepat di ambang', () => {
    // Ambangnya "lebih dari", jadi detik ke-300 pas masih dianggap aktif.
    expect(isIdle(NOW - IDLE_TIMEOUT_MS, NOW)).toBe(false);
  });

  it('menganggur satu milidetik setelah ambang', () => {
    expect(isIdle(NOW - (IDLE_TIMEOUT_MS + 1), NOW)).toBe(true);
  });

  it('aktivitas barusan tidak dianggap menganggur', () => {
    expect(isIdle(NOW, NOW)).toBe(false);
  });

  it('cap waktu rusak diperlakukan sebagai menganggur', () => {
    // Gagal ke arah aman: nilai yang tidak bisa dipercaya tidak boleh
    // memperpanjang sesi.
    expect(isIdle(Number.NaN, NOW)).toBe(true);
    expect(isIdle(Number.POSITIVE_INFINITY, NOW)).toBe(true);
  });

  it('cap waktu di masa depan diperlakukan sebagai menganggur', () => {
    // Kalau tidak, menggeser jam perangkat menjadi cara memperpanjang sesi
    // tanpa batas.
    expect(isIdle(NOW + 60_000, NOW)).toBe(true);
  });
});

describe('parseActivity', () => {
  it('membaca cap waktu yang wajar', () => {
    expect(parseActivity(String(NOW))).toBe(NOW);
  });

  it('mengembalikan null untuk cookie yang tidak ada atau kosong', () => {
    expect(parseActivity(undefined)).toBeNull();
    expect(parseActivity(null)).toBeNull();
    expect(parseActivity('')).toBeNull();
  });

  it('mengembalikan null untuk isi yang bukan angka', () => {
    // Middleware memperlakukan null sebagai "belum ada catatan" lalu menyetel
    // yang baru — bukan sebagai izin melewati pemeriksaan.
    expect(parseActivity('kemarin')).toBeNull();
  });
});

describe('hubungan antar konstanta', () => {
  it('heartbeat jauh lebih rapat daripada ambang menganggur', () => {
    // Kalau tidak, user yang aktif tapi tidak berpindah halaman (mengisi form
    // panjang) bisa dikeluarkan justru saat sedang mengetik.
    expect(HEARTBEAT_INTERVAL_MS).toBeLessThan(IDLE_TIMEOUT_MS / 2);
  });

  it('pemeriksaan klien lebih rapat daripada heartbeat', () => {
    expect(IDLE_CHECK_INTERVAL_MS).toBeLessThan(HEARTBEAT_INTERVAL_MS);
  });

  it('umur cookie jauh melebihi ambang menganggur', () => {
    // Cookie yang ikut kedaluwarsa di menit ke-5 akan hilang, dan cookie yang
    // hilang tidak bisa dibedakan dari "baru login" — sesi yang seharusnya
    // berakhir malah dianggap segar.
    expect(ACTIVITY_COOKIE_MAX_AGE_S * 1000).toBeGreaterThan(IDLE_TIMEOUT_MS * 100);
  });
});
