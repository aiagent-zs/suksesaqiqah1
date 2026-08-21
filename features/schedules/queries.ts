import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { OrderStatus } from '@/lib/constants/order';
import { ACTIVE_ORDER_STATUSES } from '@/lib/constants/order';
import type { ScheduleFilterInput } from './schema';

export type LocationOption = {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  vendorId: string | null;
};

export type VendorOption = {
  id: string;
  code: string;
  name: string;
  phone: string | null;
};

export type ScheduleFormOptions = {
  locations: LocationOption[];
};

/**
 * Pilihan lokasi untuk form jadwal.
 *
 * Tidak lagi disaring per cabang — cabang sudah tidak ada. Yang berarti kini
 * adalah pemiliknya: lokasi milik mitra lain tidak masuk akal untuk order yang
 * dikerjakan mitra ini. `vendorId` dikembalikan supaya pemanggilnya bisa
 * menyaring, dan `saveSchedule` memeriksanya lagi di server.
 */
export async function getScheduleFormOptions(): Promise<ScheduleFormOptions> {
  const supabase = await createClient();

  const { data: locations } = await supabase
    .from('locations')
    .select('id, name, address, lat, lng, vendor_id')
    .is('deleted_at', null)
    .order('name');

  return {
    locations: (locations ?? []).map((l) => ({
      id: l.id,
      name: l.name,
      address: l.address,
      lat: l.lat === null ? null : Number(l.lat),
      lng: l.lng === null ? null : Number(l.lng),
      vendorId: l.vendor_id,
    })),
  };
}

/** Mitra aktif untuk dipilih saat penugasan. */
export async function getVendorOptions(): Promise<VendorOption[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('vendors')
    .select('id, code, name, phone')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name');

  return (data ?? []).map((v) => ({
    id: v.id,
    code: v.code,
    name: v.name,
    phone: v.phone,
  }));
}

export type ScheduleRow = {
  orderId: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  participantName: string;
  scheduledDate: string;
  scheduledTime: string | null;
  locationName: string;
  locationAddress: string | null;
  lat: number | null;
  lng: number | null;
  vendorName: string | null;
  vendorPhone: string | null;
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
  order_id, scheduled_date, scheduled_time, notes,
  location:locations ( id, name, address, lat, lng, vendor_id ),
  order:orders!inner (
    order_number, status, vendor_id,
    participant:participants!orders_participant_id_fkey ( name ),
    vendor:vendors!orders_vendor_id_fkey ( name, phone ),
    animals ( count )
  )
`;

/**
 * Daftar jadwal per lokasi / mitra / rentang tanggal.
 *
 * Baris ter-scope RLS lewat `can_read_order` — mitra hanya melihat jadwal order
 * yang ditugaskan padanya.
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
  // Mitra ada di tabel order, bukan di schedules — disaring lewat join.
  if (filter.vendor_id) query = query.eq('order.vendor_id', filter.vendor_id);
  if (filter.date_from) query = query.gte('scheduled_date', filter.date_from);
  if (filter.date_to) query = query.lte('scheduled_date', filter.date_to);
  if (filter.active_only) query = query.in('order.status', ACTIVE_ORDER_STATUSES);

  const from = (page - 1) * page_size;
  const { data, count, error } = await query.range(from, from + page_size - 1);

  if (error) throw new Error(`Gagal memuat daftar jadwal: ${error.message}`);

  const rows = (data ?? []) as unknown as Array<{
    order_id: string;
    scheduled_date: string;
    scheduled_time: string | null;
    notes: string | null;
    location: {
      name: string;
      address: string | null;
      lat: number | string | null;
      lng: number | string | null;
    } | null;
    order: {
      order_number: string;
      status: OrderStatus;
      participant: { name: string } | null;
      vendor: { name: string; phone: string | null } | null;
      animals: { count: number }[];
    } | null;
  }>;

  return {
    data: rows.map((r) => ({
      orderId: r.order_id,
      orderNumber: r.order?.order_number ?? '-',
      orderStatus: (r.order?.status ?? 'new') as OrderStatus,
      participantName: r.order?.participant?.name ?? '-',
      scheduledDate: r.scheduled_date,
      scheduledTime: r.scheduled_time,
      locationName: r.location?.name ?? '-',
      locationAddress: r.location?.address ?? null,
      lat:
        r.location?.lat === null || r.location?.lat === undefined ? null : Number(r.location.lat),
      lng:
        r.location?.lng === null || r.location?.lng === undefined ? null : Number(r.location.lng),
      vendorName: r.order?.vendor?.name ?? null,
      vendorPhone: r.order?.vendor?.phone ?? null,
      animalsCount: r.order?.animals?.[0]?.count ?? 0,
      notes: r.notes,
    })),
    page,
    page_size,
    total: count ?? 0,
  };
}

/** Opsi lokasi & mitra untuk filter halaman Jadwal. */
export async function getScheduleFilterOptions() {
  const supabase = await createClient();

  const [{ data: locations }, { data: vendors }] = await Promise.all([
    supabase.from('locations').select('id, name').is('deleted_at', null).order('name'),
    supabase
      .from('vendors')
      .select('id, name')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name'),
  ]);

  return {
    locations: locations ?? [],
    vendors: vendors ?? [],
  };
}
