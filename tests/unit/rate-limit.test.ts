import { describe, expect, it } from 'vitest';
import { RateLimiter, clientIpFrom } from '@/lib/security/rate-limit';

/**
 * Rem laju checkout publik. Waktu selalu disuntikkan lewat parameter `now`
 * supaya perilaku lintas jendela bisa diuji tanpa timer palsu maupun menunggu.
 */
describe('RateLimiter', () => {
  it('mengizinkan tepat sebanyak batas, lalu menolak', () => {
    const limiter = new RateLimiter({ limit: 3, windowMs: 60_000 });

    expect(limiter.consume('1.2.3.4', 0).allowed).toBe(true);
    expect(limiter.consume('1.2.3.4', 0).allowed).toBe(true);
    expect(limiter.consume('1.2.3.4', 0).allowed).toBe(true);
    expect(limiter.consume('1.2.3.4', 0).allowed).toBe(false);
  });

  it('menghitung tiap kunci secara terpisah', () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 60_000 });

    expect(limiter.consume('1.1.1.1', 0).allowed).toBe(true);
    expect(limiter.consume('1.1.1.1', 0).allowed).toBe(false);
    // Pemesan lain di jaringan berbeda tidak boleh ikut terkena.
    expect(limiter.consume('2.2.2.2', 0).allowed).toBe(true);
  });

  it('membuka kembali setelah jendelanya lewat', () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 60_000 });

    expect(limiter.consume('1.2.3.4', 0).allowed).toBe(true);
    expect(limiter.consume('1.2.3.4', 59_999).allowed).toBe(false);
    expect(limiter.consume('1.2.3.4', 60_000).allowed).toBe(true);
  });

  it('melaporkan sisa jendela agar pesannya bisa menyebut waktu tunggu', () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 600_000 });

    limiter.consume('1.2.3.4', 0);
    const blocked = limiter.consume('1.2.3.4', 120_000);

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(480_000);
  });

  it('tidak pernah melaporkan sisa jatah negatif saat dibanjiri', () => {
    const limiter = new RateLimiter({ limit: 2, windowMs: 60_000 });

    for (let i = 0; i < 20; i++) limiter.consume('1.2.3.4', 0);

    expect(limiter.consume('1.2.3.4', 0).remaining).toBe(0);
  });

  it('membuang jendela yang sudah lewat saat prune', () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 1_000 });

    limiter.consume('1.2.3.4', 0);
    limiter.prune(2_000);

    // Kalau bucket-nya benar-benar terbuang, permintaan berikutnya memulai
    // jendela baru — bukan meneruskan hitungan lama.
    expect(limiter.consume('1.2.3.4', 2_000).remaining).toBe(0);
    expect(limiter.consume('1.2.3.4', 2_000).allowed).toBe(false);
  });
});

describe('clientIpFrom', () => {
  function headersOf(map: Record<string, string>) {
    return { get: (name: string) => map[name] ?? null };
  }

  it('mengambil entri pertama x-forwarded-for — itulah klien aslinya', () => {
    expect(clientIpFrom(headersOf({ 'x-forwarded-for': '203.0.113.9, 70.41.3.18' }))).toBe(
      '203.0.113.9',
    );
  });

  it('membuang spasi di sekitar alamat', () => {
    expect(clientIpFrom(headersOf({ 'x-forwarded-for': '  203.0.113.9 , 70.41.3.18' }))).toBe(
      '203.0.113.9',
    );
  });

  it('jatuh ke x-real-ip bila x-forwarded-for tidak ada', () => {
    expect(clientIpFrom(headersOf({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7');
  });

  it('mengembalikan null bila tidak ada header yang bisa dibaca', () => {
    expect(clientIpFrom(headersOf({}))).toBeNull();
    // Header ada tapi kosong bukan alamat — jangan sampai seluruh permintaan
    // tanpa IP berbagi satu kunci rem yang sama.
    expect(clientIpFrom(headersOf({ 'x-forwarded-for': '   ' }))).toBeNull();
  });
});
