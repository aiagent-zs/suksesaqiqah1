import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { OrderStatus, ScheduleStatus } from '@/lib/constants/order';
import { ACTIVE_ORDER_STATUSES } from '@/lib/constants/order';
import type { ScheduleFilterInput } from './schema';

export type LocationOption = {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
};

export type PicOption = {
  id: string;
  name: string;
  phone: string | null;
};

export type ScheduleFormOptions = {
  locations: LocationOption[];
  pics: PicOption[];
};

/**
 * Pilihan lokasi & PIC untuk form jadwal, dibatasi cabang order.
 *
 * Penyaringan per cabang dilakukan eksplisit di sini, bukan diserahkan ke RLS:
 * `locations` dan `profiles` dapat dibaca lintas cabang oleh role pusat, jadi
 * tanpa filter ini seorang Manager Program bisa tidak sengaja menugaskan
 * petugas Jakarta ke pemotongan di Bandung.
 */
export async function getScheduleFormOptions(branchId: string): Promise<ScheduleFormOptions> {
  const supabase = await createClient();

  const [{ data: locations }, { data: pics }] = await Promise.all([
    supabase
      .from('locations')
      .select('id, name, address, lat, lng')
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('profiles')
      .select('id, full_name, phone')
      // Tidak lagi disaring per cabang: vendor bukan pegawai cabang, dan
      // `profiles.branch_id` sudah tidak membatasi apa pun sejak tiga role.
      .eq('role', 'vendor')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('full_name'),
  ]);

  return {
    locations: (locations ?? []).map((l) => ({
      id: l.id,
      name: l.name,
      address: l.address,
      lat: l.lat === null ? null : Number(l.lat),
      lng: l.lng === null ? null : Number(l.lng),
    })),
    pics: (pics ?? []).map((p) => ({
      id: p.id,
      name: p.full_name ?? '(tanpa nama)',
      phone: p.phone,
    })),
  };
}

export type ScheduleRow = {
  orderId: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  participantName: string;
  branchCode: string;
  scheduledDate: string;
  scheduledTime: string | null;
  status: ScheduleStatus;
  locationName: string;
  locationAddress: string | null;
  lat: number | null;
  lng: number | null;
  picName: string | null;
  picPhone: string | null;
  animalsCount: number;
  notes: string | null;
};

export type ScheduleListResult = {
  data: ScheduleRow[];
  page: number;
  page_size: number;
  total: number;
};

const LIST_SELECT = `
  order_id, scheduled_date, scheduled_time, status, notes,
  location:locations!inner ( id, name, address, lat, lng, branch_id ),
  pic:profiles ( id, full_name, phone ),
  order:orders!inner (
    order_number, status, branch_id,
    participant:participants!orders_participant_id_fkey ( name ),
    branch:branches!orders_branch_id_fkey ( code ),
    animals ( count )
  )
`;

/**
 * Daftar jadwal per lokasi / petugas / rentang tanggal (`prd.md` FR-S2).
 * Baris ter-scope RLS lewat `can_read_order` — petugas hanya melihat jadwal
 * yang ia pegang.
 */
export async function listSchedules(filter: ScheduleFilterInput): Promise<ScheduleListResult> {
  const supabase = await createClient();
  const { page, page_size } = filter;

  let query = supabase
    .from('schedules')
    .select(LIST_SELECT, { count: 'exact' })
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true, nullsFirst: true });

  if (filter.location_id) query = query.eq('location_id', filter.location_id);
  if (filter.pic_id) query = query.eq('pic_user_id', filter.pic_id);
  if (filter.status) query = query.eq('status', filter.status);
  if (filter.date_from) query = query.gte('scheduled_date', filter.date_from);
  if (filter.date_to) query = query.lte('scheduled_date', filter.date_to);
  // Cabang ada di tabel order, bukan di schedules — disaring lewat join.
  if (filter.active_only) query = query.in('order.status', ACTIVE_ORDER_STATUSES);

  const from = (page - 1) * page_size;
  const { data, count, error } = await query.range(from, from + page_size - 1);

  if (error) throw new Error(`Gagal memuat daftar jadwal: ${error.message}`);

  const rows = (data ?? []) as unknown as Array<{
    order_id: string;
    scheduled_date: string;
    scheduled_time: string | null;
    status: ScheduleStatus;
    notes: string | null;
    location: {
      name: string;
      address: string | null;
      lat: number | string | null;
      lng: number | string | null;
    } | null;
    pic: { full_name: string | null; phone: string | null } | null;
    order: {
      order_number: string;
      status: OrderStatus;
      participant: { name: string } | null;
      branch: { code: string } | null;
      animals: { count: number }[];
    } | null;
  }>;

  return {
    data: rows.map((r) => ({
      orderId: r.order_id,
      orderNumber: r.order?.order_number ?? '-',
      orderStatus: (r.order?.status ?? 'new') as OrderStatus,
      participantName: r.order?.participant?.name ?? '-',
      branchCode: r.order?.branch?.code ?? '-',
      scheduledDate: r.scheduled_date,
      scheduledTime: r.scheduled_time,
      status: r.status,
      locationName: r.location?.name ?? '-',
      locationAddress: r.location?.address ?? null,
      lat:
        r.location?.lat === null || r.location?.lat === undefined ? null : Number(r.location.lat),
      lng:
        r.location?.lng === null || r.location?.lng === undefined ? null : Number(r.location.lng),
      picName: r.pic?.full_name ?? null,
      picPhone: r.pic?.phone ?? null,
      animalsCount: r.order?.animals?.[0]?.count ?? 0,
      notes: r.notes,
    })),
    page,
    page_size,
    total: count ?? 0,
  };
}

/** Opsi lokasi & vendor untuk filter halaman Jadwal. */
export async function getScheduleFilterOptions() {
  const supabase = await createClient();

  const [{ data: locations }, { data: pics }] = await Promise.all([
    supabase.from('locations').select('id, name').is('deleted_at', null).order('name'),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'vendor')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('full_name'),
  ]);

  return {
    locations: locations ?? [],
    pics: (pics ?? []).map((p) => ({ id: p.id, name: p.full_name ?? '(tanpa nama)' })),
  };
}
