import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type DistributionMode = Database['public']['Enums']['distribution_mode'];

export type VendorRow = {
  id: string;
  code: string;
  name: string;
  ownerName: string | null;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  serviceModes: DistributionMode[];
  dailyCapacity: number | null;
  isActive: boolean;
  /** Akun login mitra ini; null kalau belum dibuatkan. */
  accountEmail: string | null;
  accountActive: boolean | null;
  ordersOpen: number;
};

/**
 * Daftar mitra untuk halaman master.
 *
 * Ikut membawa keadaan akunnya: mitra yang sudah terdaftar tapi belum punya
 * akun tidak akan pernah bisa melapor, dan itu paling gampang terlewat kalau
 * kedua daftarnya dipisah di dua halaman.
 */
export async function listVendors(): Promise<VendorRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('vendors')
    .select(
      `id, code, name, owner_name, phone, whatsapp, email, address, city,
       service_modes, daily_capacity, is_active,
       account:profiles!profiles_vendor_id_fkey ( email, is_active )`,
    )
    .is('deleted_at', null)
    .order('is_active', { ascending: false })
    .order('name');

  if (error) throw new Error(`Gagal memuat daftar mitra: ${error.message}`);

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    code: string;
    name: string;
    owner_name: string | null;
    phone: string;
    whatsapp: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    service_modes: DistributionMode[];
    daily_capacity: number | null;
    is_active: boolean;
    account: Array<{ email: string | null; is_active: boolean }> | null;
  }>;

  // Hitungan order berjalan diambil sekali untuk semua mitra, bukan per baris —
  // satu query, bukan N.
  const { data: openOrders } = await supabase
    .from('orders')
    .select('vendor_id')
    .not('vendor_id', 'is', null)
    .not('status', 'in', '("completed","cancelled")')
    .is('deleted_at', null);

  const openByVendor = new Map<string, number>();
  for (const o of openOrders ?? []) {
    if (!o.vendor_id) continue;
    openByVendor.set(o.vendor_id, (openByVendor.get(o.vendor_id) ?? 0) + 1);
  }

  return rows.map((r) => {
    const account = r.account?.[0] ?? null;
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      ownerName: r.owner_name,
      phone: r.phone,
      whatsapp: r.whatsapp,
      email: r.email,
      address: r.address,
      city: r.city,
      serviceModes: r.service_modes ?? [],
      dailyCapacity: r.daily_capacity,
      isActive: r.is_active,
      accountEmail: account?.email ?? null,
      accountActive: account ? account.is_active : null,
      ordersOpen: openByVendor.get(r.id) ?? 0,
    };
  });
}

export type VendorServiceRow = {
  id: string;
  serviceId: string;
  serviceName: string;
  serviceType: string;
  /** Harga jual ke pembeli — dari katalog, bukan dari mitra. */
  price: number;
  vendorPrice: number;
  /** Selisih keduanya. Inilah yang membuat halaman ini berguna. */
  margin: number;
  isOffered: boolean;
  notes: string | null;
};

/** Daftar modal satu mitra, beserta margin terhadap harga jual katalog. */
export async function getVendorServices(vendorId: string): Promise<VendorServiceRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('vendor_services')
    .select('id, service_id, vendor_price, is_offered, notes, service:services ( name, type, price )')
    .eq('vendor_id', vendorId);

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    service_id: string;
    vendor_price: number | string;
    is_offered: boolean;
    notes: string | null;
    service: { name: string; type: string; price: number | string } | null;
  }>;

  return rows
    .map((r) => {
      const price = Number(r.service?.price ?? 0);
      const vendorPrice = Number(r.vendor_price);
      return {
        id: r.id,
        serviceId: r.service_id,
        serviceName: r.service?.name ?? '-',
        serviceType: r.service?.type ?? '-',
        price,
        vendorPrice,
        margin: price - vendorPrice,
        isOffered: r.is_offered,
        notes: r.notes,
      };
    })
    .sort((a, b) => a.serviceName.localeCompare(b.serviceName));
}

/** Katalog paket untuk dipilih saat menambah modal mitra. */
export async function getServiceOptions() {
  const supabase = await createClient();

  const { data } = await supabase
    .from('services')
    .select('id, name, type, price')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('sort_order');

  return (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    price: Number(s.price),
  }));
}
