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
    hasCompleteSchedule: true,
    animalsTotal: 2,
    animalsSlaughtered: 2,
    animalsDistributed: 2,
    distributionCount: 1,
    docsApproved: 2,
    docsApprovedSlaughter: 1,
    docsApprovedDistribution: 1,
    reportSent: true,
    ...overrides,
  };
}

describe('gate pembayaran (docs/08 section 2)', () => {
  it('lolos saat lunas', () => {
    expect(paymentGatePassed(ctx({ paymentStatus: 'paid' }))).toBe(true);
  });

  it('lolos saat DP tepat di ambang min_dp_ratio', () => {
    expect(
      paymentGatePassed(
        ctx({ paymentStatus: 'partial', totalAmount: 2_000_000, paidAmount: 1_000_000 }),
      ),
    ).toBe(true);
  });

  it('gagal saat DP kurang dari ambang', () => {
    expect(
      paymentGatePassed(
        ctx({ paymentStatus: 'partial', totalAmount: 2_000_000, paidAmount: 999_999 }),
      ),
    ).toBe(false);
  });

  it('gagal saat belum bayar sama sekali', () => {
    expect(paymentGatePassed(ctx({ paymentStatus: 'unpaid', paidAmount: 0 }))).toBe(false);
  });
});

describe('transisi new → paid', () => {
  it('ditolak saat pembayaran belum memenuhi gate', () => {
    const result = checkTransition(
      'new',
      'paid',
      'admin_cabang',
      ctx({ paymentStatus: 'unpaid', paidAmount: 0 }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('CONFLICT');
  });

  it('diterima saat DP memenuhi gate', () => {
    const result = checkTransition(
      'new',
      'paid',
      'admin_cabang',
      ctx({ paymentStatus: 'partial', totalAmount: 1_000_000, paidAmount: 500_000 }),
    );
    expect(result.ok).toBe(true);
  });
});

describe('transisi paid → scheduled', () => {
  it('ditolak saat jadwal belum lengkap', () => {
    const result = checkTransition(
      'paid',
      'scheduled',
      'admin_cabang',
      ctx({ hasCompleteSchedule: false }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/jadwal belum lengkap/i);
  });

  it('diterima saat jadwal lengkap dan pembayaran memenuhi gate', () => {
    expect(checkTransition('paid', 'scheduled', 'admin_cabang', ctx()).ok).toBe(true);
  });
});

/**
 * docs/10 section 5 menuntut kelengkapan **per tahap**, bukan sekadar "ada satu
 * dokumentasi": minimal 1 bukti pemotongan DAN 1 bukti distribusi yang sudah
 * tervalidasi Admin Pusat.
 */
describe('transisi documentation → reporting', () => {
  it('ditolak tanpa dokumentasi approved sama sekali', () => {
    const result = checkTransition(
      'documentation',
      'reporting',
      'admin_cabang',
      ctx({ docsApproved: 0, docsApprovedSlaughter: 0, docsApprovedDistribution: 0 }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/pemotongan & distribusi/i);
  });

  it('ditolak bila hanya ada bukti pemotongan', () => {
    // Kasus yang lolos pada aturan lama "docsApproved > 0": order bisa naik ke
    // Pelaporan tanpa satu pun bukti penyerahan ke penerima.
    const result = checkTransition(
      'documentation',
      'reporting',
      'admin_cabang',
      ctx({ docsApproved: 3, docsApprovedSlaughter: 3, docsApprovedDistribution: 0 }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/distribusi/i);
  });

  it('ditolak bila hanya ada bukti distribusi', () => {
    const result = checkTransition(
      'documentation',
      'reporting',
      'admin_cabang',
      ctx({ docsApproved: 1, docsApprovedSlaughter: 0, docsApprovedDistribution: 1 }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/pemotongan/i);
  });

  it('diterima saat kedua tahap punya bukti tervalidasi', () => {
    expect(checkTransition('documentation', 'reporting', 'admin_cabang', ctx()).ok).toBe(true);
  });
});

describe('transisi reporting → completed', () => {
  it('ditolak saat belum lunas walau laporan terkirim', () => {
    const result = checkTransition(
      'reporting',
      'completed',
      'admin_cabang',
      ctx({ paymentStatus: 'partial', paidAmount: 1_400_000 }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/pelunasan penuh/i);
  });

  it('ditolak saat laporan belum terkirim', () => {
    const result = checkTransition(
      'reporting',
      'completed',
      'admin_cabang',
      ctx({ reportSent: false }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/laporan/i);
  });

  it('diterima saat lunas dan laporan terkirim', () => {
    expect(checkTransition('reporting', 'completed', 'admin_cabang', ctx()).ok).toBe(true);
  });
});

describe('penegakan role', () => {
  it('petugas lapangan tidak boleh membatalkan order', () => {
    const result = checkTransition('new', 'cancelled', 'petugas_lapangan', ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('FORBIDDEN');
  });

  it('petugas lapangan boleh menaikkan tahap lapangan', () => {
    expect(checkTransition('preparation', 'slaughtering', 'petugas_lapangan', ctx()).ok).toBe(true);
  });

  it('direktur read-only pada jalur operasional', () => {
    const result = checkTransition('new', 'paid', 'direktur', ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('FORBIDDEN');
  });

  it('tanpa role tidak ada opsi transisi', () => {
    expect(getTransitionOptions('new', undefined, ctx())).toHaveLength(0);
  });
});

describe('lompatan status', () => {
  it('new tidak bisa langsung ke completed', () => {
    const result = checkTransition('new', 'completed', 'manager_program', ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('CONFLICT');
  });

  it('status akhir tidak punya transisi keluar', () => {
    expect(getTransitionOptions('completed', 'manager_program', ctx())).toHaveLength(0);
    expect(getTransitionOptions('cancelled', 'manager_program', ctx())).toHaveLength(0);
  });
});

describe('getTransitionOptions', () => {
  it('tetap mengembalikan opsi yang gagal precondition, disertai alasannya', () => {
    const options = getTransitionOptions(
      'new',
      'admin_cabang',
      ctx({ paymentStatus: 'unpaid', paidAmount: 0 }),
    );
    const toPaid = options.find((o) => o.to === 'paid');

    expect(toPaid).toBeDefined();
    expect(toPaid?.allowed).toBe(false);
    expect(toPaid?.reason).toBeTruthy();
  });
});

describe('statusStepIndex', () => {
  it('memberi urutan sesuai rangkaian workflow', () => {
    expect(statusStepIndex('new')).toBe(0);
    expect(statusStepIndex('completed')).toBe(8);
  });

  it('memberi -1 untuk status di luar rangkaian', () => {
    expect(statusStepIndex('on_hold')).toBe(-1);
    expect(statusStepIndex('cancelled')).toBe(-1);
  });
});
