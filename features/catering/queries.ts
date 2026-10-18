import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import { metaItems } from '@/features/services/meta';
import type { RegionOption } from '@/features/checkout/queries';

export type CateringPackage = {
  id: string;
  type: Database['public']['Enums']['service_type'];
  name: string;
  slug: string;
  description: string | null;
  price: number;
  /** Isi satu box, dari `meta->items` — sama seperti nasi box. */
  items: string[];
};

export type CateringOptions = {
  packages: CateringPackage[];
  /**
   * Provinsi dirender di server; tiga tingkat di bawahnya diambil peramban saat
   * induknya dipilih. Alasan yang sama seperti checkout aqiqah — memuat 83 ribu
   * kelurahan di muka jelas bukan pilihan.
   */
  provinces: RegionOption[];
};

/**
 * Isi pilihan halaman `/checkout/katering`.
 *
 * Dibaca sebagai pengunjung anonim, jadi hanya lewat jalan yang memang dibuka
 * untuk `anon`: SELECT pada `services` (dibatasi `services_select_public`) dan
 * pada `regions`.
 *
 * Alamat **selalu** dibutuhkan di sini — berbeda dari checkout aqiqah yang baru
 * memerlukannya ketika pemesan memilih mode `kirim` — sebab katering selalu
 * diantar. Karena itu provinsi tidak pernah sia-sia dimuat.
 */
export async function getCateringOptions(): Promise<CateringOptions> {
  const supabase = await createClient();

  const [servicesResult, provincesResult] = await Promise.all([
    supabase
      .from('services')
      .select('id, type, name, slug, description, price, meta')
      .in('type', ['katering_ayam', 'katering_daging', 'katering_kebuli'])
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true }),
    supabase.from('regions').select('code, name').eq('level', 1).order('name', { ascending: true }),
  ]);

  const packages = (servicesResult.data ?? []).map((s) => ({
    id: s.id,
    type: s.type,
    name: s.name,
    slug: s.slug,
    description: s.description,
    // `numeric` datang sebagai string dari PostgREST.
    price: Number(s.price),
    items: metaItems(s.meta),
  }));

  const provinces = (provincesResult.data ?? []).map((r) => ({ code: r.code, name: r.name }));

  return { packages, provinces };
}

/** Tipe hasil RPC `create_catering_order`; bentuknya sama dengan checkout aqiqah. */
export type CateringOrderResult = {
  order_number: string;
  public_token: string;
  total_amount: number;
  status: Database['public']['Enums']['order_status'];
  payment_status: Database['public']['Enums']['payment_status'];
};
