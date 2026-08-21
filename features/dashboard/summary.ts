/** Satu baris `v_vendor_kpi` setelah null-nya dinormalkan. */
export type VendorKpi = {
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  isActive: boolean;
  ordersTotal: number;
  ordersOpen: number;
  ordersCompleted: number;
  ordersOnHold: number;
  revenueTotal: number;
  vendorCostTotal: number;
  marginTotal: number;
  /** Rata-rata jam dari order dibuat sampai tahap terakhir tervalidasi. */
  avgCycleHours: number | null;
  /** Order yang pernah punya laporan tahap ditolak — penanda mutu kerja mitra. */
  ordersWithRejection: number;
};

/** KPI inti lintas mitra untuk kartu atas dashboard. */
export type KpiSummary = {
  ordersTotal: number;
  ordersOpen: number;
  ordersCompleted: number;
  ordersOnHold: number;
  revenueTotal: number;
  vendorCostTotal: number;
  marginTotal: number;
  /** Persentase margin terhadap tagihan. 0 bila belum ada order. */
  marginPct: number;
  avgCycleHours: number | null;
  ordersWithRejection: number;
  activeVendors: number;
};

const EMPTY_SUMMARY: KpiSummary = {
  ordersTotal: 0,
  ordersOpen: 0,
  ordersCompleted: 0,
  ordersOnHold: 0,
  revenueTotal: 0,
  vendorCostTotal: 0,
  marginTotal: 0,
  marginPct: 0,
  avgCycleHours: null,
  ordersWithRejection: 0,
  activeVendors: 0,
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Gabungkan KPI beberapa mitra menjadi satu angka lintas mitra.
 *
 * Rata-rata siklus **ditimbang jumlah order**, bukan dirata-rata polos:
 * `avg_cycle_hours` di `v_vendor_kpi` sudah berupa rata-rata per order milik
 * mitra itu, jadi rata-rata polos akan membuat mitra dengan 2 order berbobot
 * sama dengan mitra yang mengerjakan 200. Mitra tanpa order otomatis berbobot
 * nol — dan sengaja dikeluarkan dari pembagi, supaya mitra yang belum pernah
 * dapat order tidak menyeret angkanya.
 */
export function summarizeVendorKpi(rows: VendorKpi[]): KpiSummary {
  if (rows.length === 0) return EMPTY_SUMMARY;

  const ordersTotal = rows.reduce((acc, r) => acc + r.ordersTotal, 0);
  const revenueTotal = rows.reduce((acc, r) => acc + r.revenueTotal, 0);
  const marginTotal = rows.reduce((acc, r) => acc + r.marginTotal, 0);

  // Hanya mitra yang punya angka siklus yang ikut dihitung.
  const withCycle = rows.filter((r) => r.avgCycleHours !== null && r.ordersTotal > 0);
  const cycleWeight = withCycle.reduce((acc, r) => acc + r.ordersTotal, 0);
  const avgCycleHours =
    cycleWeight === 0
      ? null
      : round2(
          withCycle.reduce((acc, r) => acc + (r.avgCycleHours as number) * r.ordersTotal, 0) /
            cycleWeight,
        );

  return {
    ordersTotal,
    ordersOpen: rows.reduce((acc, r) => acc + r.ordersOpen, 0),
    ordersCompleted: rows.reduce((acc, r) => acc + r.ordersCompleted, 0),
    ordersOnHold: rows.reduce((acc, r) => acc + r.ordersOnHold, 0),
    revenueTotal,
    vendorCostTotal: rows.reduce((acc, r) => acc + r.vendorCostTotal, 0),
    marginTotal,
    marginPct: revenueTotal === 0 ? 0 : round2((marginTotal / revenueTotal) * 100),
    avgCycleHours,
    ordersWithRejection: rows.reduce((acc, r) => acc + r.ordersWithRejection, 0),
    activeVendors: rows.filter((r) => r.isActive).length,
  };
}
