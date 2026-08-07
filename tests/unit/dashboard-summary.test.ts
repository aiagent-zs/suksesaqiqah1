import { describe, expect, it } from 'vitest';
import { summarizeBranchKpi, type BranchKpi } from '@/features/dashboard/summary';
import { dashboardFilterSchema } from '@/features/dashboard/schema';

function branch(overrides: Partial<BranchKpi>): BranchKpi {
  return {
    branchId: 'b1',
    branchCode: 'BDG',
    branchName: 'Bandung',
    totalOrders: 0,
    openOrders: 0,
    completedOrders: 0,
    onHoldOrders: 0,
    unpaidOrders: 0,
    pctSlaughter: 0,
    pctDistribution: 0,
    pctDocumentation: 0,
    pctReport: 0,
    openIssues: 0,
    totalAmount: 0,
    paidAmount: 0,
    ...overrides,
  };
}

describe('summarizeBranchKpi', () => {
  it('menjumlahkan hitungan absolut lintas cabang', () => {
    const result = summarizeBranchKpi([
      branch({ branchId: 'b1', totalOrders: 100, openOrders: 30, openIssues: 4, paidAmount: 500 }),
      branch({ branchId: 'b2', totalOrders: 50, openOrders: 12, openIssues: 1, paidAmount: 250 }),
    ]);

    expect(result.totalOrders).toBe(150);
    expect(result.openOrders).toBe(42);
    expect(result.openIssues).toBe(5);
    expect(result.paidAmount).toBe(750);
  });

  it('menimbang persentase dengan jumlah order, bukan rata-rata polos', () => {
    // Cabang besar 100% dan cabang kecil 0%: rata-rata polos menghasilkan 50%,
    // padahal 200 dari 202 order sebenarnya sudah selesai dipotong.
    const result = summarizeBranchKpi([
      branch({ branchId: 'b1', totalOrders: 200, pctSlaughter: 100 }),
      branch({ branchId: 'b2', totalOrders: 2, pctSlaughter: 0 }),
    ]);

    expect(result.pctSlaughter).toBeCloseTo(99.01, 2);
  });

  it('mengabaikan cabang tanpa order saat menimbang', () => {
    const withEmpty = summarizeBranchKpi([
      branch({ branchId: 'b1', totalOrders: 10, pctDocumentation: 80 }),
      branch({ branchId: 'b2', totalOrders: 0, pctDocumentation: 0 }),
    ]);

    expect(withEmpty.pctDocumentation).toBe(80);
  });

  it('mengembalikan nol saat belum ada cabang atau belum ada order sama sekali', () => {
    expect(summarizeBranchKpi([]).totalOrders).toBe(0);
    expect(summarizeBranchKpi([]).pctSlaughter).toBe(0);

    const noOrders = summarizeBranchKpi([branch({ totalOrders: 0, pctSlaughter: 42 })]);
    expect(noOrders.pctSlaughter).toBe(0);
  });
});

/**
 * Sama seperti filter order: isinya query string yang bisa disunting siapa saja
 * lewat tautan, dan halaman /dashboard memanggil `.parse()` langsung.
 */
describe('dashboardFilterSchema — masukan ngawur', () => {
  it('tidak pernah melempar untuk query string sembarang', () => {
    expect(() =>
      dashboardFilterSchema.parse({
        branch_id: 'bukan-uuid',
        status: 'completed',
        severity: 'parah',
        issues_only: '0',
        page: 'abc',
        page_size: '9999',
      }),
    ).not.toThrow();
  });

  it('membuang status di luar daftar order terbuka', () => {
    // v_open_orders tidak memuat completed/cancelled — meneruskannya hanya
    // menghasilkan tabel kosong tanpa penjelasan.
    expect(dashboardFilterSchema.parse({ status: 'completed' }).status).toBeUndefined();
    expect(dashboardFilterSchema.parse({ status: 'cancelled' }).status).toBeUndefined();
    expect(dashboardFilterSchema.parse({ status: 'slaughtering' }).status).toBe('slaughtering');
  });

  it('membuang tingkat keparahan di luar enum Postgres', () => {
    expect(dashboardFilterSchema.parse({ severity: 'parah' }).severity).toBeUndefined();
    expect(dashboardFilterSchema.parse({ severity: 'high' }).severity).toBe('high');
  });

  it('hanya menyalakan issues_only untuk nilai "1"', () => {
    expect(dashboardFilterSchema.parse({ issues_only: '1' }).issues_only).toBe('1');
    expect(dashboardFilterSchema.parse({ issues_only: '0' }).issues_only).toBeUndefined();
    expect(dashboardFilterSchema.parse({}).issues_only).toBeUndefined();
  });

  it('mengembalikan paginasi ke default saat nilainya tidak masuk akal', () => {
    expect(dashboardFilterSchema.parse({ page: 'abc' }).page).toBe(1);
    expect(dashboardFilterSchema.parse({ page_size: '9999' }).page_size).toBe(20);
  });
});
