import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import type { IssueSeverity, OrderStatus, PaymentStatus } from '@/lib/constants/order';
import { ISSUE_SEVERITY_ORDER } from '@/lib/constants/order';
import type { FulfilmentStage, DistributionMode } from '@/features/stages/sequence';
import type { DashboardFilterInput } from './schema';
import type { VendorKpi } from './summary';

type Views = Database['public']['Views'];

/**
 * Sumber data dashboard: view agregat, bukan tabel mentah.
 *
 * Semua view memakai `security_invoker = on`, jadi pembatasan baris tetap
 * dikerjakan RLS — query di sini sengaja tidak menambahkan filter sendiri
 * kecuali filter eksplisit yang dipilih pengguna. Vendor yang membuka dashboard
 * hanya melihat order yang ditugaskan padanya, tanpa satu baris kode tambahan.
 */

/**
 * KPI per mitra dari `v_vendor_kpi`.
 *
 * Menggantikan KPI per cabang. Dengan operasi satu tempat dan banyak mitra,
 * pertanyaan yang berguna berubah: bukan lagi "cabang mana yang tertinggal",
 * melainkan "mitra mana yang lambat dan mana yang buktinya sering ditolak".
 */
export async function getVendorKpi(): Promise<VendorKpi[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('v_vendor_kpi')
    .select('*')
    .order('orders_open', { ascending: false });

  if (error) throw new Error(`Gagal memuat KPI mitra: ${error.message}`);

  return (data ?? [])
    .filter((row): row is Views['v_vendor_kpi']['Row'] & { vendor_id: string } =>
      Boolean(row.vendor_id),
    )
    .map((row) => ({
      vendorId: row.vendor_id,
      vendorCode: row.vendor_code ?? '-',
      vendorName: row.vendor_name ?? '-',
      isActive: row.is_active ?? false,
      ordersTotal: Number(row.orders_total ?? 0),
      ordersOpen: Number(row.orders_open ?? 0),
      ordersCompleted: Number(row.orders_completed ?? 0),
      ordersOnHold: Number(row.orders_on_hold ?? 0),
      revenueTotal: Number(row.revenue_total ?? 0),
      vendorCostTotal: Number(row.vendor_cost_total ?? 0),
      marginTotal: Number(row.margin_total ?? 0),
      avgCycleHours: row.avg_cycle_hours === null ? null : Number(row.avg_cycle_hours),
      ordersWithRejection: Number(row.orders_with_rejection ?? 0),
    }));
}

export type OpenOrderRow = {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  distributionMode: DistributionMode | null;
  vendorName: string | null;
  vendorPhone: string | null;
  locationName: string | null;
  participantName: string;
  scheduledDate: string | null;
  /** Tahap yang sedang dikerjakan — jawaban "sampai mana" yang dulu hanya bisa ditebak. */
  currentStage: FulfilmentStage | null;
  pctStage: number;
  stagesRejected: number;
  /** Tahap yang buktinya belum lengkap, dihitung database dari stage_requirements. */
  missingDocStages: string[];
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
  distribution_mode, vendor_name, vendor_phone, location_name,
  participant_name, scheduled_date,
  current_stage, pct_stage, stages_rejected, missing_doc_stages,
  animals_total, animals_slaughtered, pct_documentation, docs_pending_review,
  open_issues, max_open_severity, latest_issue_title
`;

function mapOpenOrder(row: Views['v_open_orders']['Row']): OpenOrderRow {
  return {
    orderId: row.order_id ?? '',
    orderNumber: row.order_number ?? '-',
    status: (row.status ?? 'new') as OrderStatus,
    paymentStatus: (row.payment_status ?? 'unpaid') as PaymentStatus,
    distributionMode: row.distribution_mode,
    vendorName: row.vendor_name,
    vendorPhone: row.vendor_phone,
    locationName: row.location_name,
    participantName: row.participant_name ?? '-',
    scheduledDate: row.scheduled_date,
    currentStage: row.current_stage,
    pctStage: Number(row.pct_stage ?? 0),
    stagesRejected: Number(row.stages_rejected ?? 0),
    missingDocStages: row.missing_doc_stages ?? [],
    ageDays: row.age_days ?? 0,
    animalsTotal: Number(row.animals_total ?? 0),
    animalsSlaughtered: Number(row.animals_slaughtered ?? 0),
    pctDocumentation: Number(row.pct_documentation ?? 0),
    docsPendingReview: Number(row.docs_pending_review ?? 0),
    openIssues: Number(row.open_issues ?? 0),
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
