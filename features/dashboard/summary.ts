/** Satu baris `v_branch_kpi` setelah null-nya dinormalkan (docs/05 section 7). */
export type BranchKpi = {
  branchId: string;
  branchCode: string;
  branchName: string;
  totalOrders: number;
  openOrders: number;
  completedOrders: number;
  onHoldOrders: number;
  unpaidOrders: number;
  pctSlaughter: number;
  pctDistribution: number;
  pctDocumentation: number;
  pctReport: number;
  openIssues: number;
  totalAmount: number;
  paidAmount: number;
};

/** KPI inti lintas cabang untuk kartu atas dashboard (docs/09 section 2). */
export type KpiSummary = {
  totalOrders: number;
  openOrders: number;
  completedOrders: number;
  onHoldOrders: number;
  unpaidOrders: number;
  openIssues: number;
  totalAmount: number;
  paidAmount: number;
  pctSlaughter: number;
  pctDistribution: number;
  pctDocumentation: number;
  pctReport: number;
};

const EMPTY_SUMMARY: KpiSummary = {
  totalOrders: 0,
  openOrders: 0,
  completedOrders: 0,
  onHoldOrders: 0,
  unpaidOrders: 0,
  openIssues: 0,
  totalAmount: 0,
  paidAmount: 0,
  pctSlaughter: 0,
  pctDistribution: 0,
  pctDocumentation: 0,
  pctReport: 0,
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Gabungkan KPI beberapa cabang menjadi satu angka lintas cabang.
 *
 * Persentase **ditimbang jumlah order**, bukan dirata-rata biasa: setiap
 * `pct_*` di `v_branch_kpi` sudah berupa rata-rata per order di cabang itu,
 * jadi rata-rata polos akan membuat cabang dengan 2 order berbobot sama dengan
 * cabang dengan 200 order. Cabang tanpa order otomatis berbobot nol.
 */
export function summarizeBranchKpi(rows: BranchKpi[]): KpiSummary {
  if (rows.length === 0) return EMPTY_SUMMARY;

  const totalOrders = rows.reduce((acc, r) => acc + r.totalOrders, 0);

  const weighted = (pick: (row: BranchKpi) => number): number => {
    if (totalOrders === 0) return 0;
    const sum = rows.reduce((acc, r) => acc + pick(r) * r.totalOrders, 0);
    return round2(sum / totalOrders);
  };

  return {
    totalOrders,
    openOrders: rows.reduce((acc, r) => acc + r.openOrders, 0),
    completedOrders: rows.reduce((acc, r) => acc + r.completedOrders, 0),
    onHoldOrders: rows.reduce((acc, r) => acc + r.onHoldOrders, 0),
    unpaidOrders: rows.reduce((acc, r) => acc + r.unpaidOrders, 0),
    openIssues: rows.reduce((acc, r) => acc + r.openIssues, 0),
    totalAmount: rows.reduce((acc, r) => acc + r.totalAmount, 0),
    paidAmount: rows.reduce((acc, r) => acc + r.paidAmount, 0),
    pctSlaughter: weighted((r) => r.pctSlaughter),
    pctDistribution: weighted((r) => r.pctDistribution),
    pctDocumentation: weighted((r) => r.pctDocumentation),
    pctReport: weighted((r) => r.pctReport),
  };
}
