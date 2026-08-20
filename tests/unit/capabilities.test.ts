import { describe, expect, it } from 'vitest';
import { CAPABILITIES, canDo } from '@/server/auth/capabilities';
import type { UserRole } from '@/server/auth/session';

const ALL_ROLES: UserRole[] = ['superadmin', 'admin', 'vendor'];

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

  it('superadmin memegang setiap kapabilitas', () => {
    // Janji yang paling gampang dilanggar diam-diam saat menambah kapabilitas
    // baru: "superadmin bisa mengakses semuanya".
    for (const name of Object.keys(CAPABILITIES) as (keyof typeof CAPABILITIES)[]) {
      expect(canDo('superadmin', name), name).toBe(true);
    }
  });
});

describe('UPDATE_ORDER_AMOUNT', () => {
  // total_amount adalah pembanding payment gate
  // (paid_amount >= total_amount * min_dp_ratio). Kalau role lain bisa
  // menurunkannya, order bisa lolos ke `paid` tanpa uang masuk — jadi harga
  // berhenti di superadmin, bukan di admin yang mengurus operasional harian.
  it('hanya superadmin yang boleh mengubah nilai order', () => {
    expect(canDo('superadmin', 'UPDATE_ORDER_AMOUNT')).toBe(true);
    expect(canDo('admin', 'UPDATE_ORDER_AMOUNT')).toBe(false);
    expect(canDo('vendor', 'UPDATE_ORDER_AMOUNT')).toBe(false);
  });

  it('lebih sempit daripada UPDATE_ORDER', () => {
    const amount = CAPABILITIES.UPDATE_ORDER_AMOUNT;
    const update = CAPABILITIES.UPDATE_ORDER;

    expect(amount.length).toBeLessThan(update.length);
    for (const role of amount) expect(update).toContain(role);
  });
});

describe('vendor', () => {
  it('tidak menyentuh uang sama sekali', () => {
    // Uang mengalir antara pembeli dan kami; vendor dibayar di luar alur ini.
    // Cerminan RLS `payments_select` / `payments_write` yang menuntut is_staff().
    expect(canDo('vendor', 'RECORD_PAYMENT')).toBe(false);
    expect(canDo('vendor', 'VERIFY_PAYMENT')).toBe(false);
  });

  it('tidak bisa menugaskan dirinya sendiri', () => {
    // `can_read_order` memberi vendor akses justru lewat `schedules.pic_user_id`.
    // Kalau vendor boleh menulis jadwal, ia bisa membuka order mana pun.
    expect(canDo('vendor', 'MANAGE_SCHEDULE')).toBe(false);
  });

  it('tidak menilai pekerjaannya sendiri', () => {
    expect(canDo('vendor', 'UPLOAD_DOCUMENTATION')).toBe(true);
    expect(canDo('vendor', 'VALIDATE_DOCUMENTATION')).toBe(false);
  });

  it('tidak memutuskan order tamu layak diproses', () => {
    expect(canDo('vendor', 'VERIFY_GUEST_ORDER')).toBe(false);
  });

  it('tetap bisa melapor kendala & mencatat pelaksanaan', () => {
    // Kendala paling sering muncul di lapangan — pelapornya harus orang yang
    // ada di sana. Sama persis dengan cakupan tulis `can_write_order`.
    expect(canDo('vendor', 'MANAGE_ISSUES')).toBe(true);
    expect(canDo('vendor', 'REPORT_STAGE')).toBe(true);
    expect(canDo('vendor', 'MANAGE_ANIMALS')).toBe(true);
    expect(canDo('vendor', 'UPDATE_ORDER_STATUS')).toBe(true);
    // …tapi bukan menyunting data ordernya.
    expect(canDo('vendor', 'UPDATE_ORDER')).toBe(false);
  });
});

describe('admin', () => {
  it('memegang tugas penghubung: verifikasi order, pembayaran, bukti vendor', () => {
    for (const name of [
      'VERIFY_GUEST_ORDER',
      'RECORD_PAYMENT',
      'VERIFY_PAYMENT',
      'MANAGE_SCHEDULE',
      'VALIDATE_DOCUMENTATION',
      'GENERATE_REPORT',
    ] as const) {
      expect(canDo('admin', name), name).toBe(true);
    }
  });

  it('tidak menyentuh master data, harga, maupun penghapusan', () => {
    // Siapa pun yang bisa mengubah role bisa mengangkat dirinya sendiri.
    for (const name of [
      'MANAGE_MASTER_DATA',
      'UPDATE_ORDER_AMOUNT',
      'DELETE_STAGE_REPORT',
    ] as const) {
      expect(canDo('admin', name), name).toBe(false);
    }
  });
});
