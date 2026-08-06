import { describe, expect, it } from 'vitest';
import {
  ANIMAL_STATUS_FLOW,
  checkAnimalTransition,
  getAnimalStatusOptions,
} from '@/features/orders/animal-state-machine';
import type { AnimalStatus } from '@/lib/constants/order';
import type { Database } from '@/types/database';

type UserRole = Database['public']['Enums']['user_role'];

const FIELD_ROLES: UserRole[] = ['admin_cabang', 'petugas_lapangan'];

describe('checkAnimalTransition — maju', () => {
  it('mengizinkan satu langkah maju bagi petugas lapangan', () => {
    expect(checkAnimalTransition('registered', 'prepared', 'petugas_lapangan').ok).toBe(true);
    expect(checkAnimalTransition('prepared', 'slaughtered', 'petugas_lapangan').ok).toBe(true);
    expect(checkAnimalTransition('slaughtered', 'distributed', 'petugas_lapangan').ok).toBe(true);
  });

  it('menolak lompatan registered → distributed', () => {
    // Inti bug #6: lompatan ini menaikkan animals_distributed di
    // v_order_progress tanpa pemotongan pernah tercatat.
    const result = checkAnimalTransition('registered', 'distributed', 'petugas_lapangan');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('CONFLICT');
    expect(result.message).toContain('Disiapkan');
    expect(result.message).toContain('Dipotong');
  });

  it('menolak lompatan registered → slaughtered', () => {
    const result = checkAnimalTransition('registered', 'slaughtered', 'admin_cabang');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('CONFLICT');
  });

  it('menolak transisi ke status yang sama', () => {
    for (const status of ANIMAL_STATUS_FLOW) {
      const result = checkAnimalTransition(status, status, 'manager_program');
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
    expect(checkAnimalTransition('distributed', 'slaughtered', 'manager_program').ok).toBe(true);
    expect(checkAnimalTransition('prepared', 'registered', 'manager_program').ok).toBe(true);
  });

  it('menolak Manager Program mundur lebih dari satu tahap', () => {
    const result = checkAnimalTransition('distributed', 'registered', 'manager_program');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('CONFLICT');
  });
});

describe('getAnimalStatusOptions', () => {
  it('mengembalikan seluruh status dan menandai status saat ini sebagai boleh', () => {
    const options = getAnimalStatusOptions('prepared', 'petugas_lapangan');

    expect(options.map((o) => o.status)).toEqual(ANIMAL_STATUS_FLOW);
    expect(options.find((o) => o.status === 'prepared')?.allowed).toBe(true);
  });

  it('hanya membuka tahap berikutnya bagi petugas lapangan', () => {
    const allowed = getAnimalStatusOptions('registered', 'petugas_lapangan')
      .filter((o) => o.allowed)
      .map((o) => o.status);

    expect(allowed).toEqual<AnimalStatus[]>(['registered', 'prepared']);
  });

  it('membuka tahap sebelum & sesudah bagi Manager Program', () => {
    const allowed = getAnimalStatusOptions('slaughtered', 'manager_program')
      .filter((o) => o.allowed)
      .map((o) => o.status);

    expect(allowed).toEqual<AnimalStatus[]>(['prepared', 'slaughtered', 'distributed']);
  });

  it('menyertakan alasan pada setiap opsi yang tidak diizinkan', () => {
    for (const option of getAnimalStatusOptions('registered', 'petugas_lapangan')) {
      if (option.allowed) continue;
      expect(option.reason, `${option.status} butuh alasan`).toBeTruthy();
    }
  });
});
