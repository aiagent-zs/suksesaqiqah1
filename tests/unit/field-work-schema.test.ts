import { describe, expect, it } from 'vitest';
import { recordSlaughterSchema } from '@/features/slaughter/schema';
import { recordDistributionSchema } from '@/features/distribution/schema';

const ANIMAL_ID = '9d8c7b6a-5e4f-4321-8a9b-0c1d2e3f4a5b';
const ORDER_ID = '3f1a9c62-5f4b-4c1e-9a2d-8e7b6c5d4a3f';

describe('recordSlaughterSchema', () => {
  it('menormalkan waktu dari input datetime-local menjadi ISO', () => {
    // `<input type="datetime-local">` mengirim "YYYY-MM-DDTHH:mm" tanpa zona;
    // kolomnya `timestamptz`, jadi nilainya dinormalkan sebelum dikirim.
    const result = recordSlaughterSchema.parse({
      animal_id: ANIMAL_ID,
      performed_at: '2026-08-07T06:30',
    });
    expect(result.performed_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(Number.isNaN(Date.parse(result.performed_at as string))).toBe(false);
  });

  it('mengizinkan waktu kosong — kolomnya berdefault now()', () => {
    const result = recordSlaughterSchema.safeParse({ animal_id: ANIMAL_ID, performed_at: '' });
    expect(result.success).toBe(true);
  });

  it('menolak waktu yang tidak bisa diurai', () => {
    expect(
      recordSlaughterSchema.safeParse({ animal_id: ANIMAL_ID, performed_at: 'kemarin sore' })
        .success,
    ).toBe(false);
  });

  it('menolak animal_id yang bukan uuid', () => {
    expect(recordSlaughterSchema.safeParse({ animal_id: 'hewan-1' }).success).toBe(false);
  });
});

describe('recordDistributionSchema', () => {
  it('menerima penyaluran lengkap beserta hewan yang tercakup', () => {
    const result = recordDistributionSchema.parse({
      order_id: ORDER_ID,
      recipient_name: '  Panti Asuhan Al-Amin  ',
      recipient_area: 'Kel. Cibadak',
      packages_count: '25',
      animal_ids: [ANIMAL_ID],
    });

    expect(result.recipient_name).toBe('Panti Asuhan Al-Amin');
    expect(result.packages_count).toBe(25);
    expect(result.animal_ids).toEqual([ANIMAL_ID]);
  });

  it('mengizinkan nol paket tapi menolak negatif dan pecahan', () => {
    // Nol sah untuk penyaluran yang dicatat lebih dulu lalu dilengkapi;
    // negatif dan pecahan ditolak constraint `packages_count >= 0` / tipe int.
    expect(
      recordDistributionSchema.safeParse({ order_id: ORDER_ID, packages_count: 0 }).success,
    ).toBe(true);
    expect(
      recordDistributionSchema.safeParse({ order_id: ORDER_ID, packages_count: -1 }).success,
    ).toBe(false);
    expect(
      recordDistributionSchema.safeParse({ order_id: ORDER_ID, packages_count: '2.5' }).success,
    ).toBe(false);
  });

  it('menolak koordinat di luar rentang bumi', () => {
    expect(
      recordDistributionSchema.safeParse({ order_id: ORDER_ID, packages_count: 1, lat: 91 })
        .success,
    ).toBe(false);
    expect(
      recordDistributionSchema.safeParse({ order_id: ORDER_ID, packages_count: 1, lng: -181 })
        .success,
    ).toBe(false);
    expect(
      recordDistributionSchema.safeParse({
        order_id: ORDER_ID,
        packages_count: 1,
        lat: -6.914744,
        lng: 107.60981,
      }).success,
    ).toBe(true);
  });

  it('menolak id hewan yang bukan uuid', () => {
    expect(
      recordDistributionSchema.safeParse({
        order_id: ORDER_ID,
        packages_count: 1,
        animal_ids: ['bukan-uuid'],
      }).success,
    ).toBe(false);
  });

  it('mengizinkan penyaluran tanpa penerima — data lapangan sering menyusul', () => {
    const result = recordDistributionSchema.safeParse({ order_id: ORDER_ID, packages_count: 10 });
    expect(result.success).toBe(true);
  });
});
