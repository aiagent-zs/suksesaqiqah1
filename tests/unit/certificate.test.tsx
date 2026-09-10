import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { certificateNumber, groupAnimalsByChild } from '@/features/reporting/certificate';
import type { ReportData } from '@/features/reporting/types';

/**
 * Sertifikat aqiqah.
 *
 * ## Kenapa berkas ini ada
 *
 * Aturan yang paling mudah salah, dan paling mahal salahnya: **satu sertifikat
 * per anak, bukan per ekor.** Aqiqah anak laki-laki memakai dua kambing atas
 * nama anak yang sama — di produksi persis begitu, IA-202609-0002 punya dua
 * baris `animals` dengan `on_behalf_of` identik. Merender per baris hewan akan
 * menerbitkan dua lembar untuk satu anak, dan keluarga menerima dua sertifikat
 * yang seolah menyatakan dua ibadah berbeda.
 *
 * Sertifikat dicetak, dibingkai, dan disimpan bertahun-tahun. Kekeliruan di
 * sini bertahan jauh lebih lama daripada kekeliruan di layar.
 */
const animal = (onBehalfOf: string | null, species: 'kambing' | 'sapi' = 'kambing') =>
  ({ species, tagCode: null, onBehalfOf }) as ReportData['animals'][number];

describe('satu sertifikat per anak', () => {
  it('dua kambing atas nama yang sama jadi SATU lembar', () => {
    // Bentuk aqiqah anak laki-laki, dan alasan utama berkas ini ada.
    const children = groupAnimalsByChild([animal('udin udin'), animal('udin udin')]);

    expect(children).toHaveLength(1);
    expect(children[0].name).toBe('udin udin');
    expect(children[0].summary).toBe('2 ekor kambing');
  });

  it('satu kambing jadi satu lembar', () => {
    const children = groupAnimalsByChild([animal('Gaida')]);
    expect(children).toHaveLength(1);
    expect(children[0].summary).toBe('1 ekor kambing');
  });

  it('nama berbeda jadi lembar berbeda', () => {
    // Aqiqah dua anak dalam satu order — tiap anak berhak lembarannya sendiri.
    const children = groupAnimalsByChild([animal('Aisyah'), animal('Umar'), animal('Umar')]);

    expect(children.map((c) => c.name)).toEqual(['Aisyah', 'Umar']);
    expect(children[1].summary).toBe('2 ekor kambing');
  });

  it('jenis hewan campuran disebut terpisah', () => {
    const children = groupAnimalsByChild([
      animal('Hasan'),
      animal('Hasan'),
      animal('Hasan', 'sapi'),
    ]);
    expect(children[0].summary).toContain('2 ekor kambing');
    expect(children[0].summary).toContain('1 ekor sapi');
  });
});

describe('hewan tanpa nama', () => {
  it('dilewati, bukan diberi nama sandaran', () => {
    // Nama anak adalah isi pokok lembarannya. Sertifikat bernama "-" lebih
    // buruk daripada tidak ada sertifikat.
    expect(groupAnimalsByChild([animal(null)])).toEqual([]);
  });

  it('tidak ikut terhitung pada anak lain', () => {
    const children = groupAnimalsByChild([animal('Fatimah'), animal(null)]);
    expect(children).toHaveLength(1);
    expect(children[0].summary).toBe('1 ekor kambing');
  });
});

describe('nomor sertifikat', () => {
  it('membawa nomor order supaya bisa ditelusuri balik', () => {
    expect(certificateNumber('IA-202609-0002', 0)).toBe('SA/IA-202609-0002/1');
  });

  it('berbeda antar anak dalam satu order', () => {
    expect(certificateNumber('IA-202609-0002', 1)).toBe('SA/IA-202609-0002/2');
  });
});

describe('sisi server tidak ikut ke bundel browser', () => {
  const panel = readFileSync('features/reporting/components/certificate-panel.tsx', 'utf8');

  it('panel klien tidak mengimpor modul ber-server-only', () => {
    // `certificate.tsx` dan `child-photo.server.ts` keduanya `'server-only'`.
    // Mengimpornya dari komponen klien menggagalkan seluruh build dengan pesan
    // yang menyebut Pages Router — dan sama sekali tidak menyebut berkas mana
    // yang keliru. Sudah pernah terjadi saat panel ini ditulis.
    expect(panel).not.toContain("from '../certificate'");
    expect(panel).not.toContain('child-photo.server');
  });

  it('modul yang dipakai klien memang bebas server-only', () => {
    // Diperiksa sebagai **direktif di awal baris**, bukan substring: docblock
    // berkas itu menyebut `'server-only'` justru untuk menerangkan kenapa ia
    // tidak ada di sana, dan pencarian polos akan cocok pada kalimat itu.
    const shared = readFileSync('features/reporting/child-photo.ts', 'utf8');
    expect(shared).not.toMatch(/^import 'server-only';/m);
  });

  it('yang mengunduh foto tetap terkunci di server', () => {
    // Ia memegang klien Supabase ber-service dan membaca berkas orang lain;
    // kebocorannya ke browser bukan sekadar galat build.
    const server = readFileSync('features/reporting/child-photo.server.ts', 'utf8');
    expect(server).toMatch(/^import 'server-only';/m);
  });
});
