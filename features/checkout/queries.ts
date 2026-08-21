import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

export type CheckoutPackage = {
  id: string;
  type: 'aqiqah' | 'qurban';
  name: string;
  slug: string;
  description: string | null;
  price: number;
};

/** Paket nasi box — tambahan opsional, bukan pesanan yang berdiri sendiri. */
export type NasiBoxPackage = {
  id: string;
  name: string;
  slug: string;
  price: number;
};

/** Satu pilihan wilayah pada pemilih alamat bertingkat. */
export type RegionOption = {
  code: string;
  name: string;
};

export type CheckoutOptions = {
  packages: CheckoutPackage[];
  nasiBoxes: NasiBoxPackage[];
  /**
   * Provinsi ikut dirender di server — 38 baris, tingkat teratas, dan selalu
   * dibutuhkan begitu pemesan memilih Aqiqah Kirim. Tiga tingkat di bawahnya
   * diambil dari peramban saat induknya dipilih; memuat 83 ribu kelurahan di
   * muka jelas bukan pilihan.
   */
  provinces: RegionOption[];
};

/**
 * Isi pilihan halaman checkout publik.
 *
 * Dibaca sebagai pengunjung anonim, jadi hanya lewat jalan yang memang dibuka
 * untuk `anon`: SELECT pada `services` (dibatasi `services_public_select`) dan
 * SELECT pada `regions` (`regions_public_select` — daftar wilayah administratif,
 * memang terbuka).
 *
 * Daftar cabang tidak lagi diambil — pemilih wilayah layanan dicabut dari form
 * pada 19 Agustus 2026, dan `create_guest_order` menentukan cabangnya sendiri
 * dari `branches.is_default`.
 */
export async function getCheckoutOptions(): Promise<CheckoutOptions> {
  const supabase = await createClient();

  const [servicesResult, boxesResult, provincesResult] = await Promise.all([
    supabase
      .from('services')
      .select('id, type, name, slug, description, price')
      .eq('type', 'aqiqah')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true }),
    supabase
      .from('services')
      .select('id, name, slug, price')
      .eq('type', 'nasi_box')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true }),
    supabase.from('regions').select('code, name').eq('level', 1).order('name', { ascending: true }),
  ]);

  const nasiBoxes = (boxesResult.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    price: Number(s.price),
  }));

  const packages = (servicesResult.data ?? []).map((s) => ({
    id: s.id,
    type: s.type as 'aqiqah' | 'qurban',
    name: s.name,
    slug: s.slug,
    description: s.description,
    // `numeric` datang sebagai string dari PostgREST.
    price: Number(s.price),
  }));

  const provinces = (provincesResult.data ?? []).map((r) => ({ code: r.code, name: r.name }));

  return { packages, nasiBoxes, provinces };
}

/** Tipe hasil RPC `create_guest_order`, dipakai action & halaman konfirmasi. */
export type GuestOrderResult = {
  order_number: string;
  public_token: string;
  total_amount: number;
  status: Database['public']['Enums']['order_status'];
  payment_status: Database['public']['Enums']['payment_status'];
};
