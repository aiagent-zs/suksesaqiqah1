import { describe, expect, it } from 'vitest';
import { BRANDS, parseChannel } from '@/lib/brand';

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
