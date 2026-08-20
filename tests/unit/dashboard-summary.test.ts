import { describe, expect, it } from 'vitest';
import { summarizeVendorKpi, type VendorKpi } from '@/features/dashboard/summary';
import { dashboardFilterSchema } from '@/features/dashboard/schema';

function vendor(overrides: Partial<VendorKpi>): VendorKpi {
  return {
    vendorId: 'v1',
    vendorCode: 'MITRA1',
    vendorName: 'Dapur Mitra Satu',
    isActive: true,
    ordersTotal: 0,
    ordersOpen: 0,
    ordersCompleted: 0,
    ordersOnHold: 0,
    revenueTotal: 0,
    vendorCostTotal: 0,
    marginTotal: 0,
    avgCycleHours: null,
    ordersWithRejection: 0,
    ...overrides,
  };
}

describe('summarizeVendorKpi', () => {
  it('menjumlahkan hitungan absolut lintas mitra', () => {
    const result = summarizeVendorKpi([
      vendor({ vendorId: 'v1', ordersTotal: 100, ordersOpen: 30, revenueTotal: 500 }),
      vendor({ vendorId: 'v2', ordersTotal: 50, ordersOpen: 12, revenueTotal: 250 }),
    ]);

    expect(result.ordersTotal).toBe(150);
    expect(result.ordersOpen).toBe(42);
    expect(result.revenueTotal).toBe(750);
  });

  it('menghitung margin sebagai selisih tagihan dan modal', () => {
    const result = summarizeVendorKpi([
      vendor({ ordersTotal: 10, revenueTotal: 1000, vendorCostTotal: 800, marginTotal: 200 }),
    ]);

    expect(result.marginTotal).toBe(200);
    expect(result.marginPct).toBe(20);
  });

  it('margin nol persen ketika belum ada tagihan — bukan pembagian nol', () => {
    expect(summarizeVendorKpi([vendor({})]).marginPct).toBe(0);
  });

  it('menimbang rata-rata siklus dengan jumlah order, bukan rata-rata polos', () => {
    // Mitra besar 10 jam (100 order) dan mitra kecil 100 jam (1 order):
    // rata-rata polos menghasilkan 55 jam, padahal hampir semua order sebenarnya
    // selesai dalam 10 jam.
    const result = summarizeVendorKpi([
      vendor({ vendorId: 'v1', ordersTotal: 100, avgCycleHours: 10 }),
      vendor({ vendorId: 'v2', ordersTotal: 1, avgCycleHours: 100 }),
    ]);

    expect(result.avgCycleHours).toBeCloseTo(10.89, 1);
  });

  it('mitra tanpa order tidak menyeret rata-rata siklus', () => {
    const result = summarizeVendorKpi([
      vendor({ vendorId: 'v1', ordersTotal: 10, avgCycleHours: 20 }),
      vendor({ vendorId: 'v2', ordersTotal: 0, avgCycleHours: 999 }),
    ]);

    expect(result.avgCycleHours).toBe(20);
  });

  it('null bila belum ada siklus tercatat sama sekali', () => {
    expect(summarizeVendorKpi([vendor({ ordersTotal: 5 })]).avgCycleHours).toBeNull();
  });

  it('menghitung mitra aktif saja', () => {
    const result = summarizeVendorKpi([
      vendor({ vendorId: 'v1', isActive: true }),
      vendor({ vendorId: 'v2', isActive: false }),
    ]);

    expect(result.activeVendors).toBe(1);
  });

  it('daftar kosong menghasilkan nol, bukan NaN', () => {
    expect(summarizeVendorKpi([]).ordersTotal).toBe(0);
    expect(summarizeVendorKpi([]).marginPct).toBe(0);
    expect(summarizeVendorKpi([]).avgCycleHours).toBeNull();
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
    expect(dashboardFilterSchema.parse({ status: 'in_progress' }).status).toBe('in_progress');
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
