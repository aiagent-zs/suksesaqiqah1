import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { faqs, landingPhotos } from '@/lib/constants/site';
import { BRANDS } from '@/lib/brand';

/**
 * Kanal LinkAja menampilkan merek "Aqiqah Aja". FAQ landing dulu menulis
 * "Sukses Aqiqah" secara tetap, jadi merek kanal web bocor ke kanal LinkAja.
 */
describe('FAQ landing mengikuti merek kanal', () => {
  it('kanal linkaja tidak menyebut "Sukses Aqiqah" sama sekali', () => {
    const text = JSON.stringify(faqs(BRANDS.linkaja.name));
    expect(text).not.toContain('Sukses Aqiqah');
    expect(text).toContain(`Apa itu ${BRANDS.linkaja.name}?`);
    expect(text).toContain(`${BRANDS.linkaja.name} adalah layanan`);
  });

  it('kanal web tetap berbunyi seperti sebelumnya', () => {
    expect(faqs(BRANDS.web.name)[0].question).toBe('Apa itu Sukses Aqiqah?');
  });

  it('JSON-LD FAQPage memakai daftar yang sama dengan yang dirender', () => {
    const page = readFileSync(join(process.cwd(), 'app/(site)/page.tsx'), 'utf8');
    expect(page).toContain('const faqList = faqs(brand.name)');
    expect(page).toContain('<JsonLd faqList={faqList} />');
    expect(page).toContain('mainEntity: faqList.map(');
  });

  it('alt foto hero tidak membawa nama merek', () => {
    expect(landingPhotos.hero.alt).not.toContain('Sukses Aqiqah');
  });
});
