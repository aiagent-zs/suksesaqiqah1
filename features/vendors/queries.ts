import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import type { RegionOption } from '@/features/checkout/queries';

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

/**
 * Satu mitra utuh — seluruh kolom yang bisa disunting.
 *
 * Berbeda dari `VendorRow` yang sengaja ramping untuk daftar: formulir sunting
 * perlu setiap medan yang diterima `vendorSchema`, termasuk delapan yang tidak
 * pernah tampil di daftar (nama badan hukum, NPWP, periode perjanjian, nama
 * pemilik rekening, dan empat kode wilayah).
 */
export type VendorDetail = {
  id: string;
  code: string;
  name: string;
  legalName: string | null;
  ownerName: string | null;
  npwp: string | null;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  provinceCode: string | null;
  provinceName: string | null;
  cityCode: string | null;
  cityName: string | null;
  districtCode: string | null;
  districtName: string | null;
  villageCode: string | null;
  villageName: string | null;
  postalCode: string | null;
  addressDetail: string | null;
  address: string | null;
  agreementNumber: string | null;
  agreementStart: string | null;
  agreementEnd: string | null;
  dailyCapacity: number | null;
  serviceModes: DistributionMode[];
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
  notes: string | null;
  isActive: boolean;
  accountEmail: string | null;
  accountActive: boolean | null;
  ordersOpen: number;
};

export async function getVendorDetail(vendorId: string): Promise<VendorDetail | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('vendors')
    .select(
      `id, code, name, legal_name, owner_name, npwp, phone, whatsapp, email,
       province_code, province, city_code, city, district_code, district,
       village_code, village, postal_code, address_detail, address,
       agreement_number, agreement_start, agreement_end, daily_capacity,
       service_modes, bank_name, bank_account_no, bank_account_name, notes, is_active,
       account:profiles!profiles_vendor_id_fkey ( email, is_active )`,
    )
    .eq('id', vendorId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!data) return null;

  const s = data as unknown as VendorDetailRaw & {
    account: Array<{ email: string | null; is_active: boolean }> | null;
  };
  const account = s.account?.[0] ?? null;

  // Order berjalan menentukan boleh-tidaknya mitra dinonaktifkan; dihitung di
  // sini supaya tombolnya bisa menjelaskan diri sebelum ditekan, bukan menolak
  // sesudahnya.
  const { count } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('vendor_id', vendorId)
    .not('status', 'in', '("completed","cancelled")')
    .is('deleted_at', null);

  return {
    id: s.id,
    code: s.code,
    name: s.name,
    legalName: s.legal_name,
    ownerName: s.owner_name,
    npwp: s.npwp,
    phone: s.phone,
    whatsapp: s.whatsapp,
    email: s.email,
    provinceCode: s.province_code,
    provinceName: s.province,
    cityCode: s.city_code,
    cityName: s.city,
    districtCode: s.district_code,
    districtName: s.district,
    villageCode: s.village_code,
    villageName: s.village,
    postalCode: s.postal_code,
    addressDetail: s.address_detail,
    address: s.address,
    agreementNumber: s.agreement_number,
    agreementStart: s.agreement_start,
    agreementEnd: s.agreement_end,
    dailyCapacity: s.daily_capacity,
    serviceModes: s.service_modes ?? [],
    bankName: s.bank_name,
    bankAccountNo: s.bank_account_no,
    bankAccountName: s.bank_account_name,
    notes: s.notes,
    isActive: s.is_active,
    accountEmail: account?.email ?? null,
    accountActive: account ? account.is_active : null,
    ordersOpen: count ?? 0,
  };
}

type VendorDetailRaw = {
  id: string;
  code: string;
  name: string;
  legal_name: string | null;
  owner_name: string | null;
  npwp: string | null;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  province_code: string | null;
  province: string | null;
  city_code: string | null;
  city: string | null;
  district_code: string | null;
  district: string | null;
  village_code: string | null;
  village: string | null;
  postal_code: string | null;
  address_detail: string | null;
  address: string | null;
  agreement_number: string | null;
  agreement_start: string | null;
  agreement_end: string | null;
  daily_capacity: number | null;
  service_modes: DistributionMode[];
  bank_name: string | null;
  bank_account_no: string | null;
  bank_account_name: string | null;
  notes: string | null;
  is_active: boolean;
};

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

  // --- Batas penawaran mitra ------------------------------------------------
  // Berbeda tiap mitra, karena itu tinggal di `vendor_services` dan bukan di
  // katalog: RPH Amanah sanggup 100 box, Dapur Berkah 300.
  minQty: number;
  /** `null` = tanpa batas, bukan nol. */
  maxQty: number | null;
  leadTimeHours: number | null;

  /** Kalimat pemasaran paket, apa adanya dari katalog. */
  description: string | null;
  /** Apa saja yang didapat pembeli — dirakit dari `services.meta`. */
  details: string[];
};

/**
 * Isi paket sebagai daftar yang bisa dibaca, dari `services.meta`.
 *
 * Dirakit di server, bukan di komponen: `meta` bertipe `Json` bebas dan
 * bentuknya berbeda per jenis paket (`hasil`+`cocok_untuk` untuk aqiqah,
 * `items` untuk nasi box, kosong untuk qurban). Membiarkan layar membongkarnya
 * berarti setiap layar yang menampilkan paket harus tahu ketiga bentuk itu.
 *
 * Bentuk yang tidak dikenali menghasilkan daftar kosong, bukan galat — `meta`
 * adalah kolom bebas, jadi kunci baru akan muncul tanpa memberi tahu siapa pun.
 */
export function serviceDetails(meta: unknown): string[] {
  if (!meta || typeof meta !== 'object') return [];
  const m = meta as Record<string, unknown>;
  const out: string[] = [];

  const hasil = m.hasil as { porsi?: number; jenis?: string } | undefined;
  if (hasil?.porsi) out.push(`${hasil.porsi} porsi`);
  if (hasil?.jenis) out.push(`Olahan: ${hasil.jenis}`);

  if (Array.isArray(m.items)) {
    out.push(...m.items.filter((i): i is string => typeof i === 'string'));
  }

  if (typeof m.cocok_untuk === 'string') out.push(`Cocok untuk ${m.cocok_untuk}`);

  return out;
}

/** Daftar modal satu mitra, beserta margin terhadap harga jual katalog. */
export async function getVendorServices(vendorId: string): Promise<VendorServiceRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('vendor_services')
    .select(
      `id, service_id, vendor_price, is_offered, notes,
       min_qty, max_qty, lead_time_hours,
       service:services!inner ( name, type, price, description, meta, deleted_at )`,
    )
    .eq('vendor_id', vendorId)
    // Paket yang sudah dihapus tidak lagi punya baris di layar mana pun, tapi
    // `vendor_services` tetap menunjuk kepadanya (`on delete restrict` hanya
    // menjaga DELETE sungguhan, sedangkan penghapusan di sini soft delete).
    // Tanpa saringan ini panel mitra memajang baris bernama "-" berharga
    // Rp 0 — dan operator tidak punya cara menebak paket apa itu.
    //
    // `!inner` bukan sekadar gaya: tanpa itu PostgREST tetap mengembalikan
    // baris `vendor_services` dengan `service: null`, jadi saringannya tidak
    // membuang apa pun.
    .is('service.deleted_at', null);

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    service_id: string;
    vendor_price: number | string;
    is_offered: boolean;
    notes: string | null;
    min_qty: number;
    max_qty: number | null;
    lead_time_hours: number | null;
    service: {
      name: string;
      type: string;
      price: number | string;
      description: string | null;
      meta: unknown;
      deleted_at: string | null;
    } | null;
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
        minQty: r.min_qty,
        maxQty: r.max_qty,
        leadTimeHours: r.lead_time_hours,
        description: r.service?.description ?? null,
        details: serviceDetails(r.service?.meta),
      };
    })
    .sort((a, b) => a.serviceName.localeCompare(b.serviceName));
}

export type CoverageRow = {
  regionCode: string;
  regionName: string;
  level: number;
};

/** Wilayah layanan satu mitra, terurut sebagaimana dibaca orang. */
export async function getVendorCoverage(vendorId: string): Promise<CoverageRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('vendor_coverage')
    .select('region_code, region_name, level')
    .eq('vendor_id', vendorId)
    .order('region_name');

  return (data ?? []).map((r) => ({
    regionCode: r.region_code,
    regionName: r.region_name,
    level: r.level,
  }));
}

/**
 * Provinsi untuk pemilih alamat mitra.
 *
 * Tingkat teratas saja — 38 baris. Tiga tingkat di bawahnya diambil peramban
 * lewat `fetchRegionChildren` saat induknya dipilih, pola yang sama dengan
 * checkout: memuat 91.599 wilayah di muka jelas bukan pilihan.
 */
export async function listProvinces(): Promise<RegionOption[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('regions')
    .select('code, name')
    .eq('level', 1)
    .order('name', { ascending: true });

  return (data ?? []).map((r) => ({ code: r.code, name: r.name }));
}

/** Katalog paket untuk dipilih saat menambah modal mitra. */
export async function getServiceOptions() {
  const supabase = await createClient();

  const { data } = await supabase
    .from('services')
    .select('id, name, type, price, description, meta')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('sort_order');

  return (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    price: Number(s.price),
    description: s.description,
    details: serviceDetails(s.meta),
  }));
}
