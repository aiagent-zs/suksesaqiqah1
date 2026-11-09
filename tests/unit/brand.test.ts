import { describe, expect, it } from 'vitest';
import { BRANDS, channelFromPath, channelHref, parseChannel } from '@/lib/brand';

/**
 * Nilai kanal datang dari query (`?ch=`) dan cookie, dua-duanya bisa diketik
 * siapa saja. Yang tidak dikenal harus jatuh ke `web`, bukan merek mitra, dan
 * tidak boleh lolos mentah ke header `x-order-channel`.
 */
describe('parseChannel', () => {
  it('mengenali kanal LinkAja', () => {
    expect(parseChannel('linkaja')).toBe('linkaja');
    expect(BRANDS[parseChannel('linkaja')].name).toBe('Aqiqah Aja');
  });

  it('nilai kosong atau asing jatuh ke web', () => {
    for (const raw of [undefined, null, '', 'LinkAja', 'gopay', "linkaja'; drop"]) {
      expect(parseChannel(raw)).toBe('web');
    }
    expect(BRANDS.web.name).toBe('Sukses Aqiqah');
  });
});

describe('area /aqiqahaja', () => {
  it('kanal dibaca dari path, bukan dari awalan yang kebetulan mirip', () => {
    expect(channelFromPath('/aqiqahaja')).toBe('linkaja');
    expect(channelFromPath('/aqiqahaja/checkout/katering')).toBe('linkaja');
    for (const p of ['/', '/checkout', '/aqiqahajaX', '/paket/aqiqahaja']) {
      expect(channelFromPath(p)).toBe('web');
    }
  });

  it('tautan internal LinkAja tetap di dalam areanya', () => {
    expect(channelHref('linkaja', '/')).toBe('/aqiqahaja');
    expect(channelHref('linkaja', '/#faq')).toBe('/aqiqahaja#faq');
    expect(channelHref('linkaja', '/checkout?paket=x')).toBe('/aqiqahaja/checkout?paket=x');
    expect(channelHref('linkaja', '/lacak')).toBe('/aqiqahaja/lacak');
  });

  it('laporan peserta, tautan luar, dan anchor tidak diberi awalan', () => {
    expect(channelHref('linkaja', '/r/abc')).toBe('/r/abc');
    expect(channelHref('linkaja', 'https://wa.me/62')).toBe('https://wa.me/62');
    expect(channelHref('linkaja', '#paket')).toBe('#paket');
  });

  it('web tidak berubah', () => {
    expect(channelHref('web', '/checkout')).toBe('/checkout');
    expect(channelHref('web', '/')).toBe('/');
  });
});
