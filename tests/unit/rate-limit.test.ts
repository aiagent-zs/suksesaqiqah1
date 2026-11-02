import { describe, expect, it } from 'vitest';
import { RateLimiter, clientIpFrom, rateLimitKey } from '@/lib/security/rate-limit';

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

  it('memakai cf-connecting-ip hanya bila TRUST_CF_HEADER aktif', () => {
    const h = headersOf({ 'cf-connecting-ip': ' 203.0.113.9 ', 'x-real-ip': '10.0.0.2' });
    expect(clientIpFrom(h, true)).toBe('203.0.113.9');
    // Tanpa jaminan firewall, header itu bisa dikarang penembak origin langsung.
    expect(clientIpFrom(h, false)).toBe('10.0.0.2');
  });

  it('mendahulukan x-real-ip dari reverse proxy VPS', () => {
    expect(
      clientIpFrom(headersOf({ 'x-real-ip': '198.51.100.7', 'x-forwarded-for': '6.6.6.6' }), false),
    ).toBe('198.51.100.7');
  });

  it('jatuh ke entri pertama x-forwarded-for bila tidak ada x-real-ip', () => {
    expect(clientIpFrom(headersOf({ 'x-forwarded-for': ' 6.6.6.6 , 10.0.0.1' }), false)).toBe(
      '6.6.6.6',
    );
  });

  it('mengembalikan null bila tidak ada header yang bisa dibaca', () => {
    expect(clientIpFrom(headersOf({}), true)).toBeNull();
    expect(clientIpFrom(headersOf({ 'cf-connecting-ip': '   ' }), true)).toBeNull();
  });
});

describe('rateLimitKey', () => {
  it('IPv4 apa adanya, tanpa IP jadi kunci bersama', () => {
    expect(rateLimitKey('203.0.113.9')).toBe('203.0.113.9');
    expect(rateLimitKey('::ffff:203.0.113.9')).toBe('203.0.113.9');
    expect(rateLimitKey(null)).toBe('unknown');
  });

  it('IPv6 satu /64 berbagi kunci, apa pun penulisannya', () => {
    const key = rateLimitKey('2001:db8:aa:1::1');
    expect(key).toBe('2001:db8:aa:1::/64');
    expect(rateLimitKey('2001:0DB8:00aa:0001:ffff:ffff:ffff:ffff')).toBe(key);
    expect(rateLimitKey('2001:db8:aa:1:dead:beef::7%eth0')).toBe(key);
    // /64 tetangga dihitung terpisah.
    expect(rateLimitKey('2001:db8:aa:2::1')).not.toBe(key);
    expect(rateLimitKey('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(rateLimitKey('::1')).toBe('0:0:0:0::/64');
  });
});

describe('RateLimiter — plafon memori', () => {
  it('membuang kunci tertua bila jumlahnya mencapai plafon', () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 60_000 });
    expect(limiter.consume('pertama', 0).allowed).toBe(true);
    expect(limiter.consume('pertama', 0).allowed).toBe(false);
    for (let i = 0; i < 10_000; i++) limiter.consume(`ip-${i}`, 0);
    // Masih dalam jendela yang sama, tapi kunci tertuanya sudah dibuang.
    expect(limiter.consume('pertama', 0).allowed).toBe(true);
    // Kunci terbaru tetap terhitung.
    expect(limiter.consume('ip-9999', 0).allowed).toBe(false);
  });
});
