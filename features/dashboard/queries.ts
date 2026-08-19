import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import type {
  IssueSeverity,
  OrderStatus,
  PaymentStatus,
  ScheduleStatus,
} from '@/lib/constants/order';
import { ISSUE_SEVERITY_ORDER } from '@/lib/constants/order';
import type { DashboardFilterInput } from './schema';
import type { BranchKpi } from './summary';

type Views = Database['public']['Views'];

/**
 * Sumber data dashboard: view agregat, bukan tabel mentah (docs/09 section 8 & section 9).
 *
 * Semua view memakai `security_invoker = on`, jadi pembatasan baris tetap
 * dikerjakan RLS — query di sini sengaja tidak menambahkan filter cabang
 * sendiri kecuali filter eksplisit yang dipilih pengguna.
 */

/**
 * KPI dari `v_branch_kpi`.
 *
 * View-nya masih beragregasi per cabang dan sengaja dibiarkan begitu — yang
 * dicabut 19 Agustus 2026 adalah **filter**-nya, bukan strukturnya. Dengan satu
 * cabang hasilnya satu baris, dan `aggregateBranchKpi` tetap bekerja apa adanya
 * seandainya suatu saat bertambah lagi.
 */
export async function getBranchKpi(): Promise<BranchKpi[]> {
  const supabase = await createClient();

  const query = supabase
    .from('v_branch_kpi')
    .select('*')
    .order('open_orders', { ascending: false });

  const { data, error } = await query;
  if (error) throw new Error(`Gagal memuat KPI cabang: ${error.message}`);

  return (data ?? [])
    .filter((row): row is Views['v_branch_kpi']['Row'] & { branch_id: string } =>
      Boolean(row.branch_id),
    )
    .map((row) => ({
      branchId: row.branch_id,
      branchCode: row.branch_code ?? '-',
      branchName: row.branch_name ?? '-',
      totalOrders: row.total_orders ?? 0,
      openOrders: row.open_orders ?? 0,
      completedOrders: row.completed_orders ?? 0,
      onHoldOrders: row.on_hold_orders ?? 0,
      unpaidOrders: row.unpaid_orders ?? 0,
      pctSlaughter: Number(row.pct_slaughter ?? 0),
      pctDistribution: Number(row.pct_distribution ?? 0),
      pctDocumentation: Number(row.pct_documentation ?? 0),
      pctReport: Number(row.pct_report ?? 0),
      openIssues: row.open_issues ?? 0,
      totalAmount: Number(row.total_amount ?? 0),
      paidAmount: Number(row.paid_amount ?? 0),
    }));
}

export type OpenOrderRow = {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  branchCode: string;
  branchName: string;
  locationName: string | null;
  picName: string | null;
  picPhone: string | null;
  participantName: string;
  scheduledDate: string | null;
  scheduleStatus: ScheduleStatus | null;
  ageDays: number;
  animalsTotal: number;
  animalsSlaughtered: number;
  pctDocumentation: number;
  docsPendingReview: number;
  openIssues: number;
  maxSeverity: IssueSeverity | null;
  latestIssueTitle: string | null;
};

export type OpenOrdersResult = {
  data: OpenOrderRow[];
  page: number;
  page_size: number;
  total: number;
};

const OPEN_ORDER_SELECT = `
  order_id, order_number, status, payment_status, created_at, age_days,
  branch_code, branch_name, location_name, pic_name, pic_phone,
  participant_name, scheduled_date, schedule_status,
  animals_total, animals_slaughtered, pct_documentation, docs_pending_review,
  open_issues, max_open_severity, latest_issue_title
`;

function mapOpenOrder(row: Views['v_open_orders']['Row']): OpenOrderRow {
  return {
    orderId: row.order_id ?? '',
    orderNumber: row.order_number ?? '-',
    status: (row.status ?? 'new') as OrderStatus,
    paymentStatus: (row.payment_status ?? 'unpaid') as PaymentStatus,
    branchCode: row.branch_code ?? '-',
    branchName: row.branch_name ?? '-',
    locationName: row.location_name,
    picName: row.pic_name,
    picPhone: row.pic_phone,
    participantName: row.participant_name ?? '-',
    scheduledDate: row.scheduled_date,
    scheduleStatus: row.schedule_status,
    ageDays: row.age_days ?? 0,
    animalsTotal: row.animals_total ?? 0,
    animalsSlaughtered: row.animals_slaughtered ?? 0,
    pctDocumentation: Number(row.pct_documentation ?? 0),
    docsPendingReview: row.docs_pending_review ?? 0,
    openIssues: row.open_issues ?? 0,
    maxSeverity: row.max_open_severity,
    latestIssueTitle: row.latest_issue_title,
  };
}

/**
 * Tabel inti litmus test: order belum selesai + lokasi + PIC + kendala
 * (docs/08 section 8, docs/09 section 3).
 *
 * Urutan sengaja "yang paling perlu ditindak dulu": keparahan kendala menurun,
 * lalu umur order menurun — bukan tanggal dibuat, supaya order tua yang
 * menggantung tidak tenggelam di halaman belakang.
 */
export async function getOpenOrders(filter: DashboardFilterInput): Promise<OpenOrdersResult> {
  const supabase = await createClient();
  const { page, page_size } = filter;

  let query = supabase
    .from('v_open_orders')
    .select(OPEN_ORDER_SELECT, { count: 'exact' })
    .order('max_open_severity', { ascending: false, nullsFirst: false })
    .order('age_days', { ascending: false });

  if (filter.status) query = query.eq('status', filter.status);
  if (filter.severity) query = query.eq('max_open_severity', filter.severity);
  if (filter.issues_only) query = query.gt('open_issues', 0);

  const from = (page - 1) * page_size;
  const { data, count, error } = await query.range(from, from + page_size - 1);

  if (error) throw new Error(`Gagal memuat order tertunda: ${error.message}`);

  return {
    data: (data ?? []).map((row) => mapOpenOrder(row as Views['v_open_orders']['Row'])),
    page,
    page_size,
    total: count ?? 0,
  };
}

export type IssueBreakdown = {
  counts: Record<IssueSeverity, number>;
  total: number;
  highlights: OpenOrderRow[];
};

const ISSUE_HIGHLIGHT_LIMIT = 5;

/**
 * Panel kendala terbuka (docs/09 section 3).
 *
 * Jumlah per tingkat diambil lewat query `head: true` — hanya angka yang
 * dikirim, tanpa payload baris — supaya hitungannya tetap eksak berapa pun
 * banyaknya order, sementara daftar sorotan dibatasi 5 baris teratas.
 */
export async function getIssueBreakdown(): Promise<IssueBreakdown> {
  const supabase = await createClient();

  const countBySeverity = ISSUE_SEVERITY_ORDER.map(async (severity) => {
    const { count } = await supabase
      .from('v_open_orders')
      .select('order_id', { count: 'exact', head: true })
      .eq('max_open_severity', severity);

    return [severity, count ?? 0] as const;
  });

  const highlightQuery = (async () => {
    const { data } = await supabase
      .from('v_open_orders')
      .select(OPEN_ORDER_SELECT)
      .gt('open_issues', 0)
      .order('max_open_severity', { ascending: false, nullsFirst: false })
      .order('age_days', { ascending: false })
      .limit(ISSUE_HIGHLIGHT_LIMIT);
    return (data ?? []).map((row) => mapOpenOrder(row as Views['v_open_orders']['Row']));
  })();

  const [entries, highlights] = await Promise.all([Promise.all(countBySeverity), highlightQuery]);

  const counts = { high: 0, medium: 0, low: 0 } as Record<IssueSeverity, number>;
  for (const [severity, value] of entries) counts[severity] = value;

  return {
    counts,
    total: counts.high + counts.medium + counts.low,
    highlights,
  };
}
