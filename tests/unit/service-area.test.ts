import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SERVICE_AREA_CITIES,
  SERVICE_AREA_PROVINCES,
  isInServiceArea,
} from '@/features/checkout/service-area';

describe('jangkauan Jabodetabek', () => {
  it('menerima kota Jabodetabek, menolak Bandung, Serang, dan Kepulauan Seribu', () => {
    expect(isInServiceArea('31.74')).toBe(true); // Jakarta Selatan
    expect(isInServiceArea('32.76')).toBe(true); // Depok
    expect(isInServiceArea('32.73')).toBe(false); // Kota Bandung
    expect(isInServiceArea('36.73')).toBe(false); // Kota Serang
    expect(isInServiceArea('31.01')).toBe(false); // Kepulauan Seribu
    expect(isInServiceArea('')).toBe(false);
  });

  it('provinsi yang ditawarkan hanya DKI, Jawa Barat, Banten', () => {
    expect([...SERVICE_AREA_PROVINCES].sort()).toEqual(['31', '32', '36']);
  });

  it('daftar kota di trigger database sama dengan daftar di kode', () => {
    const sql = readFileSync(
      join(process.cwd(), 'supabase/migrations/20261027020000_service_area_jabodetabek.sql'),
      'utf8',
    );
    const inSql = [...sql.matchAll(/'(\d{2}\.\d{2})'/g)].map((m) => m[1]).sort();
    expect(inSql).toEqual([...SERVICE_AREA_CITIES].sort());
  });
});
