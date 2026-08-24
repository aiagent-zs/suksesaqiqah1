import { describe, expect, it } from 'vitest';
import {
  checkTransition,
  getTransitionOptions,
  paymentGatePassed,
  statusStepIndex,
  type OrderGuardContext,
} from '@/features/orders/state-machine';

/** Konteks "sudah beres semua" — tiap test menimpa bagian yang diuji saja. */
function ctx(overrides: Partial<OrderGuardContext> = {}): OrderGuardContext {
  return {
    paymentStatus: 'paid',
    totalAmount: 2_800_000,
    paidAmount: 2_800_000,
    minDpRatio: 0.5,
    isGuestOrder: false,
    guestVerified: false,
    hasVendor: true,
    hasSchedule: true,
    animalsTotal: 2,
    stagesTotal: 5,
    stagesValidated: 5,
    stagesRejected: 0,
    missingDocStages: [],
    reportSent: true,
    ...overrides,
  };
}

describe('gate pembayaran', () => {
  it('lolos bila lunas', () => {
    expect(paymentGatePassed(ctx({ paymentStatus: 'paid' }))).toBe(true);
  });

  it('lolos bila DP mencapai rasio minimum', () => {
    expect(
      paymentGatePassed(ctx({ paymentStatus: 'partial', paidAmount: 1_400_000, minDpRatio: 0.5 })),
    ).toBe(true);
  });

  it('tertahan bila DP kurang dari rasio minimum', () => {
    expect(
      paymentGatePassed(ctx({ paymentStatus: 'partial', paidAmount: 1_000_000, minDpRatio: 0.5 })),
    ).toBe(false);
  });

  it('order bernilai nol tidak dianggap lolos', () => {
    // Tanpa ini, order yang total_amount-nya belum diisi akan lolos gate
    // pembayaran hanya karena 0 >= 0.
    expect(paymentGatePassed(ctx({ paymentStatus: 'unpaid', totalAmount: 0, paidAmount: 0 }))).toBe(
      false,
    );
  });
});

describe('verifikasi order tamu', () => {
  it('order tamu tertahan di new sampai diverifikasi', () => {
    const result = checkTransition(
      'new',
      'verified',
      'admin',
      ctx({ isGuestOrder: true, guestVerified: false }),
    );
    expect(result.ok).toBe(false);
  });

  it('order tamu yang sudah diverifikasi boleh lanjut', () => {
    const result = checkTransition(
      'new',
      'verified',
      'admin',
      ctx({ isGuestOrder: true, guestVerified: true }),
    );
    expect(result.ok).toBe(true);
  });

  it('order internal tidak menuntut verifikasi tamu', () => {
    expect(checkTransition('new', 'verified', 'admin', ctx({ isGuestOrder: false })).ok).toBe(true);
  });
});

describe('penugasan mitra', () => {
  it('paid tidak dapat naik ke assigned tanpa mitra', () => {
    const result = checkTransition('paid', 'assigned', 'admin', ctx({ hasVendor: false }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('Mitra');
  });

  it('juga menuntut data hewan', () => {
    const result = checkTransition('paid', 'assigned', 'admin', ctx({ animalsTotal: 0 }));
    expect(result.ok).toBe(false);
  });

  it('lolos ketika mitra dan hewan sudah ada', () => {
    expect(checkTransition('paid', 'assigned', 'admin', ctx()).ok).toBe(true);
  });
});

describe('tahap pelaksanaan', () => {
  it('assigned tertahan bila daftar tahap belum terbit', () => {
    const result = checkTransition('assigned', 'in_progress', 'vendor', ctx({ stagesTotal: 0 }));
    expect(result.ok).toBe(false);
  });

  it('in_progress tidak dapat naik ke validation bila ada tahap belum tervalidasi', () => {
    const result = checkTransition(
      'in_progress',
      'validation',
      'vendor',
      ctx({ stagesTotal: 5, stagesValidated: 3 }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('2 tahap');
  });

  it('lolos ketika seluruh tahap tervalidasi', () => {
    expect(
      checkTransition('in_progress', 'validation', 'vendor', ctx({ stagesValidated: 5 })).ok,
    ).toBe(true);
  });
});

describe('kelengkapan bukti', () => {
  it('validation tertahan bila ada tahap yang buktinya kurang', () => {
    const result = checkTransition(
      'validation',
      'reporting',
      'admin',
      ctx({ missingDocStages: ['sembelih', 'masak'] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('sembelih, masak');
  });

  it('lolos ketika tidak ada tahap yang kurang', () => {
    expect(
      checkTransition('validation', 'reporting', 'admin', ctx({ missingDocStages: [] })).ok,
    ).toBe(true);
  });
});

describe('penyelesaian order', () => {
  it('menuntut pelunasan penuh, bukan sekadar DP', () => {
    const result = checkTransition(
      'reporting',
      'completed',
      'admin',
      ctx({ paymentStatus: 'partial' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('Pelunasan');
  });

  it('menuntut laporan sudah terkirim', () => {
    const result = checkTransition('reporting', 'completed', 'admin', ctx({ reportSent: false }));
    expect(result.ok).toBe(false);
  });

  it('lolos ketika lunas dan laporan terkirim', () => {
    expect(checkTransition('reporting', 'completed', 'admin', ctx()).ok).toBe(true);
  });
});

describe('wewenang per role', () => {
  it('vendor tidak boleh memverifikasi order', () => {
    const result = checkTransition('new', 'verified', 'vendor', ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('FORBIDDEN');
  });

  it('vendor tidak boleh menyelesaikan order', () => {
    const result = checkTransition('reporting', 'completed', 'vendor', ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('FORBIDDEN');
  });

  it('vendor boleh menggerakkan tahap lapangan', () => {
    expect(checkTransition('assigned', 'in_progress', 'vendor', ctx()).ok).toBe(true);
  });

  it('tanpa role, tidak ada transisi yang tersedia', () => {
    expect(getTransitionOptions('new', undefined, ctx())).toEqual([]);
  });
});

describe('transisi yang tidak ada di peta', () => {
  it('lompatan status ditolak sebagai CONFLICT', () => {
    const result = checkTransition('new', 'completed', 'superadmin', ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('CONFLICT');
  });

  it('status akhir tidak punya transisi keluar', () => {
    expect(getTransitionOptions('completed', 'superadmin', ctx())).toEqual([]);
    expect(getTransitionOptions('cancelled', 'superadmin', ctx())).toEqual([]);
  });
});

describe('getTransitionOptions', () => {
  it('mengembalikan opsi yang gagal guard sebagai disabled + alasan', () => {
    const options = getTransitionOptions('paid', 'admin', ctx({ hasVendor: false }));
    const assigned = options.find((o) => o.to === 'assigned');

    // Tombolnya tetap muncul — operator perlu tahu APA yang kurang, bukan
    // sekadar menemukan tombolnya hilang tanpa penjelasan.
    expect(assigned).toBeDefined();
    expect(assigned?.allowed).toBe(false);
    expect(assigned?.reason).toContain('Mitra');
  });

  it('menyembunyikan transisi yang role-nya tidak berhak', () => {
    const options = getTransitionOptions('new', 'vendor', ctx());
    expect(options.find((o) => o.to === 'verified')).toBeUndefined();
  });
});

describe('statusStepIndex', () => {
  it('mengikuti urutan rangkaian administratif', () => {
    expect(statusStepIndex('new')).toBe(0);
    expect(statusStepIndex('verified')).toBe(1);
    expect(statusStepIndex('completed')).toBe(7);
  });

  it('status di luar rangkaian mengembalikan -1', () => {
    expect(statusStepIndex('on_hold')).toBe(-1);
    expect(statusStepIndex('cancelled')).toBe(-1);
  });
});
