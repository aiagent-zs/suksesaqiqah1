import { describe, expect, it } from 'vitest';
import {
  ANIMAL_STATUS_FLOW,
  checkAnimalTransition,
  getAnimalStatusOptions,
} from '@/features/orders/animal-state-machine';
import type { AnimalStatus } from '@/lib/constants/order';
import type { Database } from '@/types/database';

type UserRole = Database['public']['Enums']['user_role'];

const FIELD_ROLES: UserRole[] = ['admin', 'vendor'];

describe('checkAnimalTransition — maju', () => {
  it('mengizinkan satu langkah maju bagi petugas lapangan', () => {
    expect(checkAnimalTransition('registered', 'prepared', 'vendor').ok).toBe(true);
    expect(checkAnimalTransition('prepared', 'slaughtered', 'vendor').ok).toBe(true);
    expect(checkAnimalTransition('slaughtered', 'distributed', 'vendor').ok).toBe(true);
  });

  it('menolak lompatan registered → distributed', () => {
    // Inti bug #6: lompatan ini menaikkan animals_distributed di
    // v_order_progress tanpa pemotongan pernah tercatat.
    const result = checkAnimalTransition('registered', 'distributed', 'vendor');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('CONFLICT');
    expect(result.message).toContain('Disiapkan');
    expect(result.message).toContain('Dipotong');
  });

  it('menolak lompatan registered → slaughtered', () => {
    const result = checkAnimalTransition('registered', 'slaughtered', 'admin');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('CONFLICT');
  });

  it('menolak transisi ke status yang sama', () => {
    for (const status of ANIMAL_STATUS_FLOW) {
      const result = checkAnimalTransition(status, status, 'superadmin');
      expect(result.ok, `${status} → ${status}`).toBe(false);
    }
  });
});

describe('checkAnimalTransition — mundur', () => {
  it('menolak mundur bagi role lapangan', () => {
    for (const role of FIELD_ROLES) {
      const result = checkAnimalTransition('slaughtered', 'prepared', role);

      expect(result.ok, `${role} tidak boleh mundur`).toBe(false);
      if (result.ok) continue;
      expect(result.code).toBe('FORBIDDEN');
    }
  });

  it('menolak mundur bagi role tanpa profil', () => {
    expect(checkAnimalTransition('distributed', 'slaughtered', undefined).ok).toBe(false);
  });

  it('mengizinkan Manager Program mundur satu tahap', () => {
    expect(checkAnimalTransition('distributed', 'slaughtered', 'superadmin').ok).toBe(true);
    expect(checkAnimalTransition('prepared', 'registered', 'superadmin').ok).toBe(true);
  });

  it('menolak Manager Program mundur lebih dari satu tahap', () => {
    const result = checkAnimalTransition('distributed', 'registered', 'superadmin');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('CONFLICT');
  });
});

describe('getAnimalStatusOptions', () => {
  it('mengembalikan seluruh status dan menandai status saat ini sebagai boleh', () => {
    const options = getAnimalStatusOptions('prepared', 'vendor');

    expect(options.map((o) => o.status)).toEqual(ANIMAL_STATUS_FLOW);
    expect(options.find((o) => o.status === 'prepared')?.allowed).toBe(true);
  });

  it('hanya membuka tahap berikutnya bagi petugas lapangan', () => {
    const allowed = getAnimalStatusOptions('registered', 'vendor')
      .filter((o) => o.allowed)
      .map((o) => o.status);

    expect(allowed).toEqual<AnimalStatus[]>(['registered', 'prepared']);
  });

  it('membuka tahap sebelum & sesudah bagi Manager Program', () => {
    const allowed = getAnimalStatusOptions('slaughtered', 'superadmin')
      .filter((o) => o.allowed)
      .map((o) => o.status);

    expect(allowed).toEqual<AnimalStatus[]>(['prepared', 'slaughtered', 'distributed']);
  });

  it('menyertakan alasan pada setiap opsi yang tidak diizinkan', () => {
    for (const option of getAnimalStatusOptions('registered', 'vendor')) {
      if (option.allowed) continue;
      expect(option.reason, `${option.status} butuh alasan`).toBeTruthy();
    }
  });
});
