import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { OrderFilterInput } from './schema';
import type { OrderGuardContext } from './state-machine';
import type { Database } from '@/types/database';
import type { OrderStatus, PaymentStatus } from '@/lib/constants/order';
import { endOfDayExclusiveWib, startOfDayWib } from '@/lib/format/date-range';
import { isScheduleComplete } from '@/features/schedules/status-machine';

type Tables = Database['public']['Tables'];

/** Rasio DP minimum dari app_settings; 0.5 bila baris setting belum ada. */
export async function getMinDpRatio(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'min_dp_ratio')
    .maybeSingle();

  const raw = (data?.value as { ratio?: number } | null)?.ratio;
  return typeof raw === 'number' && raw > 0 && raw <= 1 ? raw : 0.5;
}

/**
 * Bungkus nilai dalam tanda kutip untuk filter PostgREST.
 * Tanpa ini, koma dan kurung pada input pengguna dibaca sebagai sintaks
 * pemisah `or=(...)` dan mengubah arti query.
 */
function quoteFilterValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** Netralkan wildcard LIKE agar `%` dan `_` dicari sebagai karakter biasa. */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Batas atas id peserta yang ikut diperhitungkan dalam pencarian.
 *
 * PostgREST tidak bisa meng-OR kolom lintas tabel dalam satu filter, jadi id
 * peserta yang cocok dicari lebih dulu lalu di-OR-kan dengan nomor order.
 * Angkanya sengaja besar (payload-nya hanya uuid) dan pemotongan dicatat ke log
 * — versi sebelumnya memakai batas 100 tanpa pemberitahuan, sehingga pencarian
 * nama umum diam-diam kehilangan hasil.
 */
const PARTICIPANT_SEARCH_CAP = 2000;

const LIST_SELECT = `
  id, order_number, status, payment_status, total_amount, paid_amount, created_at,
  participant:participants!orders_participant_id_fkey ( id, name, phone ),
  branch:branches!orders_branch_id_fkey ( id, code, name ),
  schedule:schedules ( scheduled_date, scheduled_time, status,
    location:locations ( id, name ),
    pic:profiles ( id, full_name )
  ),
  animals ( count )
`;

export type OrderListRow = {
  id: string;
  order_number: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  total_amount: number;
  paid_amount: number;
  created_at: string;
  participantName: string;
  participantPhone: string | null;
  branchCode: string;
  branchName: string;
  locationName: string | null;
  picName: string | null;
  scheduledDate: string | null;
  animalsCount: number;
};

export type OrderListResult = {
  data: OrderListRow[];
  page: number;
  page_size: number;
  total: number;
};

/**
 * List order + filter + pencarian + paginasi (docs/16 section 1 & 3).
 * Scope baris ditegakkan RLS — query ini tidak menambahkan filter cabang sendiri.
 */
export async function listOrders(filter: OrderFilterInput): Promise<OrderListResult> {
  const supabase = await createClient();
  const { page, page_size } = filter;

  // Filter lokasi/PIC ada di tabel schedules → butuh inner join agar bisa difilter.
  const needsScheduleJoin = Boolean(filter.location_id || filter.pic_id);
  const select = needsScheduleJoin
    ? LIST_SELECT.replace('schedule:schedules (', 'schedule:schedules!inner (')
    : LIST_SELECT;

  let query = supabase
    .from('orders')
    .select(select, { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filter.status) query = query.eq('status', filter.status);
  if (filter.payment_status) query = query.eq('payment_status', filter.payment_status);
  if (filter.branch_id) query = query.eq('branch_id', filter.branch_id);
  if (filter.date_from) query = query.gte('created_at', startOfDayWib(filter.date_from));
  if (filter.date_to) query = query.lt('created_at', endOfDayExclusiveWib(filter.date_to));
  if (filter.location_id) query = query.eq('schedules.location_id', filter.location_id);
  if (filter.pic_id) query = query.eq('schedules.pic_user_id', filter.pic_id);

  const q = filter.q?.trim();
  if (q) {
    const pattern = `%${escapeLikePattern(q)}%`;

    // Pencarian menyentuh dua tabel: nomor order (orders) dan nama peserta
    // (participants). PostgREST tidak bisa OR lintas tabel dalam satu filter,
    // jadi id peserta yang cocok dicari lebih dulu lalu di-OR-kan.
    const { data: participants } = await supabase
      .from('participants')
      .select('id')
      .ilike('name', pattern)
      .limit(PARTICIPANT_SEARCH_CAP);

    const ids = (participants ?? []).map((p) => p.id);

    if (ids.length === PARTICIPANT_SEARCH_CAP) {
      console.warn(
        `[orders] pencarian "${q}" mengenai >= ${PARTICIPANT_SEARCH_CAP} peserta; hasil dipotong.`,
      );
    }

    const orderNumberFilter = `order_number.ilike.${quoteFilterValue(pattern)}`;
    query = query.or(
      ids.length > 0
        ? `${orderNumberFilter},participant_id.in.(${ids.join(',')})`
        : orderNumberFilter,
    );
  }

  const from = (page - 1) * page_size;
  const { data, count, error } = await query.range(from, from + page_size - 1);

  if (error) throw new Error(`Gagal memuat daftar order: ${error.message}`);

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    order_number: string;
    status: OrderStatus;
    payment_status: PaymentStatus;
    total_amount: number;
    paid_amount: number;
    created_at: string;
    participant: { id: string; name: string; phone: string | null } | null;
    branch: { id: string; code: string; name: string } | null;
    schedule: {
      scheduled_date: string | null;
      location: { id: string; name: string } | null;
      pic: { id: string; full_name: string | null } | null;
    } | null;
    animals: { count: number }[];
  }>;

  return {
    data: rows.map((r) => ({
      id: r.id,
      order_number: r.order_number,
      status: r.status,
      payment_status: r.payment_status,
      total_amount: Number(r.total_amount),
      paid_amount: Number(r.paid_amount),
      created_at: r.created_at,
      participantName: r.participant?.name ?? '-',
      participantPhone: r.participant?.phone ?? null,
      branchCode: r.branch?.code ?? '-',
      branchName: r.branch?.name ?? '-',
      locationName: r.schedule?.location?.name ?? null,
      picName: r.schedule?.pic?.full_name ?? null,
      scheduledDate: r.schedule?.scheduled_date ?? null,
      animalsCount: r.animals?.[0]?.count ?? 0,
    })),
    page,
    page_size,
    total: count ?? 0,
  };
}

export type OrderDetail = {
  order: Tables['orders']['Row'];
  participant: Tables['participants']['Row'] | null;
  branch: Tables['branches']['Row'] | null;
  creatorName: string | null;
  items: Array<{
    id: string;
    qty: number;
    unit_price: number;
    meta: unknown;
    serviceName: string;
    serviceType: string;
  }>;
  animals: Tables['animals']['Row'][];
  schedule:
    | (Tables['schedules']['Row'] & {
        locationName: string | null;
        locationAddress: string | null;
        /** Koordinat lokasi untuk tautan peta (prd.md FR-S3). */
        lat: number | null;
        lng: number | null;
        picName: string | null;
      })
    | null;
  guard: OrderGuardContext;
};

/**
 * Detail order lengkap untuk halaman /orders/{id}.
 * Angka guard diambil dari view v_order_progress supaya perhitungan progres
 * hanya punya satu sumber kebenaran (docs/05 section 7).
 */
export async function getOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const supabase = await createClient();

  // Hitungan dokumentasi `approved` per tahap tidak tersedia di
  // `v_order_progress` (view-nya hanya menyimpan total), dan menambahkannya
  // berarti mengubah view — schema satu pintu di Bani. Dua query `head: true`
  // di sini hanya mengembalikan angka, tanpa payload baris.
  const approvedByStage = async (stage: 'slaughter' | 'distribution') => {
    const { count } = await supabase
      .from('documentations')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', orderId)
      .eq('stage', stage)
      .eq('status', 'approved');
    return count ?? 0;
  };

  const [
    { data: row, error },
    { data: progress },
    minDpRatio,
    docsApprovedSlaughter,
    docsApprovedDistribution,
  ] = await Promise.all([
    supabase
      .from('orders')
      .select(
        `
        *,
        participant:participants!orders_participant_id_fkey ( * ),
        branch:branches!orders_branch_id_fkey ( * ),
        creator:profiles!orders_created_by_fkey ( full_name ),
        items:order_items ( id, qty, unit_price, meta, service:services ( name, type ) ),
        animals ( * ),
        schedule:schedules (
          *,
          location:locations ( name, address, lat, lng ),
          pic:profiles ( full_name )
        )
      `,
      )
      .eq('id', orderId)
      .maybeSingle(),
    supabase.from('v_order_progress').select('*').eq('order_id', orderId).maybeSingle(),
    getMinDpRatio(),
    approvedByStage('slaughter'),
    approvedByStage('distribution'),
  ]);

  if (error) throw new Error(`Gagal memuat detail order: ${error.message}`);
  if (!row) return null;

  const r = row as unknown as Tables['orders']['Row'] & {
    participant: Tables['participants']['Row'] | null;
    branch: Tables['branches']['Row'] | null;
    creator: { full_name: string | null } | null;
    items: Array<{
      id: string;
      qty: number;
      unit_price: number;
      meta: unknown;
      service: { name: string; type: string } | null;
    }>;
    animals: Tables['animals']['Row'][];
    schedule:
      | (Tables['schedules']['Row'] & {
          location: {
            name: string;
            address: string | null;
            lat: number | string | null;
            lng: number | string | null;
          } | null;
          pic: { full_name: string | null } | null;
        })
      | null;
  };

  const schedule = r.schedule;
  // Aturan "jadwal lengkap" hidup di satu tempat bersama panel jadwal, supaya
  // guard state machine dan pesan "apa yang kurang" tidak pernah berbeda.
  const hasCompleteSchedule = isScheduleComplete(schedule);

  return {
    order: r,
    participant: r.participant,
    branch: r.branch,
    creatorName: r.creator?.full_name ?? null,
    items: (r.items ?? []).map((i) => ({
      id: i.id,
      qty: i.qty,
      unit_price: Number(i.unit_price),
      meta: i.meta,
      serviceName: i.service?.name ?? '-',
      serviceType: i.service?.type ?? '-',
    })),
    animals: (r.animals ?? []).sort((a, b) => (a.tag_code ?? '').localeCompare(b.tag_code ?? '')),
    schedule: schedule
      ? {
          ...schedule,
          locationName: schedule.location?.name ?? null,
          locationAddress: schedule.location?.address ?? null,
          lat: schedule.location?.lat == null ? null : Number(schedule.location.lat),
          lng: schedule.location?.lng == null ? null : Number(schedule.location.lng),
          picName: schedule.pic?.full_name ?? null,
        }
      : null,
    guard: {
      paymentStatus: r.payment_status,
      totalAmount: Number(r.total_amount),
      paidAmount: Number(r.paid_amount),
      minDpRatio,
      hasCompleteSchedule,
      animalsTotal: progress?.animals_total ?? 0,
      animalsSlaughtered: progress?.animals_slaughtered ?? 0,
      animalsDistributed: progress?.animals_distributed ?? 0,
      distributionCount: progress?.distribution_count ?? 0,
      docsApproved: progress?.docs_approved ?? 0,
      docsApprovedSlaughter,
      docsApprovedDistribution,
      reportSent: progress?.report_sent ?? false,
    },
  };
}

export type TimelineEntry = {
  id: string;
  action: string;
  createdAt: string;
  actorName: string | null;
  fromStatus: string | null;
  toStatus: string | null;
};

/**
 * Riwayat audit order (docs/16 section 3 — GET /api/orders/{id}/timeline).
 * Mengembalikan array kosong bila role pemanggil tidak berhak membaca audit_logs.
 */
export async function getOrderTimeline(orderId: string): Promise<TimelineEntry[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, action, created_at, before, after, actor:profiles ( full_name )')
    .eq('entity', 'orders')
    .eq('entity_id', orderId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return [];

  return (data ?? []).map((rowValue) => {
    const row = rowValue as unknown as {
      id: string;
      action: string;
      created_at: string;
      before: { status?: string } | null;
      after: { status?: string } | null;
      actor: { full_name: string | null } | null;
    };
    return {
      id: row.id,
      action: row.action,
      createdAt: row.created_at,
      actorName: row.actor?.full_name ?? null,
      fromStatus: row.before?.status ?? null,
      toStatus: row.after?.status ?? null,
    };
  });
}

/** Opsi untuk FilterBar & form order. */
export async function getOrderFormOptions() {
  const supabase = await createClient();

  const [{ data: branches }, { data: services }, { data: participants }] = await Promise.all([
    supabase.from('branches').select('id, code, name').is('deleted_at', null).order('name'),
    supabase
      .from('services')
      .select('id, name, type, price, slug')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order'),
    supabase.from('participants').select('id, name, phone').order('name').limit(200),
  ]);

  return {
    branches: branches ?? [],
    services: services ?? [],
    participants: participants ?? [],
  };
}
