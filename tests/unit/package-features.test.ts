import { describe, expect, it } from 'vitest';
import { splitCommonFeatures } from '@/features/checkout/package-features';

describe('splitCommonFeatures', () => {
  it('mengangkat baris yang dimiliki semua paket', () => {
    const { common, unique } = splitCommonFeatures([
      ['200 tusuk sate', 'Free Sertifikat', 'Free Acar'],
      ['300 tusuk sate', 'Free Sertifikat', 'Free Acar'],
      ['400 tusuk sate', 'Free Acar', 'Free Sertifikat'],
    ]);
    expect(common).toEqual(['Free Sertifikat', 'Free Acar']);
    expect(unique).toEqual([['200 tusuk sate'], ['300 tusuk sate'], ['400 tusuk sate']]);
  });

  it('satu paket: semuanya tetap di kartunya', () => {
    expect(splitCommonFeatures([['a', 'b']])).toEqual({ common: [], unique: [['a', 'b']] });
  });

  it('tanpa irisan: tidak ada yang diangkat', () => {
    expect(splitCommonFeatures([['a'], ['b']])).toEqual({ common: [], unique: [['a'], ['b']] });
  });
});
