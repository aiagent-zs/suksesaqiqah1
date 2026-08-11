import { describe, expect, it } from 'vitest';
import { CAPABILITIES, canDo } from '@/server/auth/capabilities';
import type { UserRole } from '@/server/auth/session';

const ALL_ROLES: UserRole[] = [
  'direktur',
  'manager_program',
  'admin_pusat',
  'admin_cabang',
  'petugas_lapangan',
];

describe('canDo', () => {
  it('menolak role yang tidak terdefinisi', () => {
    expect(canDo(undefined, 'UPDATE_ORDER')).toBe(false);
    expect(canDo(undefined, 'UPDATE_ORDER_AMOUNT')).toBe(false);
    expect(canDo(undefined, 'MANAGE_ANIMALS')).toBe(false);
  });

  it('setiap kapabilitas hanya memuat role yang dikenal', () => {
    for (const [name, roles] of Object.entries(CAPABILITIES)) {
      for (const role of roles) {
        expect(ALL_ROLES, `${name} memuat role tak dikenal: ${role}`).toContain(role);
      }
    }
  });
});

describe('UPDATE_ORDER_AMOUNT', () => {
  // total_amount adalah pembanding payment gate
  // (paid_amount >= total_amount * min_dp_ratio). Kalau role lain bisa
  // menurunkannya, order bisa lolos ke `paid` tanpa uang masuk.
  it('hanya Manager Program yang boleh mengubah nilai order', () => {
    expect(canDo('manager_program', 'UPDATE_ORDER_AMOUNT')).toBe(true);

    for (const role of ALL_ROLES.filter((r) => r !== 'manager_program')) {
      expect(canDo(role, 'UPDATE_ORDER_AMOUNT'), `${role} tidak boleh`).toBe(false);
    }
  });

  it('lebih sempit daripada UPDATE_ORDER', () => {
    const amount = CAPABILITIES.UPDATE_ORDER_AMOUNT;
    const update = CAPABILITIES.UPDATE_ORDER;

    expect(amount.length).toBeLessThan(update.length);
    for (const role of amount) expect(update).toContain(role);
  });
});

describe('UPDATE_ORDER', () => {
  it('petugas lapangan tidak boleh mengubah data order', () => {
    expect(canDo('petugas_lapangan', 'UPDATE_ORDER')).toBe(false);
  });

  it('role read-only tidak boleh menulis', () => {
    for (const role of ['direktur', 'admin_pusat'] as UserRole[]) {
      expect(canDo(role, 'UPDATE_ORDER'), `${role} tidak boleh`).toBe(false);
      expect(canDo(role, 'MANAGE_ANIMALS'), `${role} tidak boleh`).toBe(false);
      expect(canDo(role, 'UPDATE_ORDER_STATUS'), `${role} tidak boleh`).toBe(false);
    }
  });
});

describe('MANAGE_ANIMALS', () => {
  it('mengikuti role yang boleh menggerakkan status order di lapangan', () => {
    for (const role of ['manager_program', 'admin_cabang', 'petugas_lapangan'] as UserRole[]) {
      expect(canDo(role, 'MANAGE_ANIMALS')).toBe(true);
    }
  });
});

describe('MANAGE_ISSUES', () => {
  // RLS `issues_insert` / `issues_update` memakai `can_write_order`. Kalau
  // daftar ini menyimpang, UI akan menawarkan tombol yang pasti ditolak
  // database — atau menyembunyikan tombol yang sebenarnya boleh ditekan.
  it('sama persis dengan cakupan tulis can_write_order', () => {
    for (const role of ['manager_program', 'admin_cabang', 'petugas_lapangan'] as UserRole[]) {
      expect(canDo(role, 'MANAGE_ISSUES'), `${role} boleh`).toBe(true);
    }
  });

  it('direktur & admin pusat tetap read-only di jalur operasional', () => {
    for (const role of ['direktur', 'admin_pusat'] as UserRole[]) {
      expect(canDo(role, 'MANAGE_ISSUES'), `${role} tidak boleh`).toBe(false);
    }
  });

  it('petugas lapangan bisa melapor meski tidak boleh mengubah data order', () => {
    // Kendala paling sering muncul di lapangan — pelapornya harus orang yang
    // ada di sana, bukan hanya admin cabang.
    expect(canDo('petugas_lapangan', 'MANAGE_ISSUES')).toBe(true);
    expect(canDo('petugas_lapangan', 'UPDATE_ORDER')).toBe(false);
  });
});
