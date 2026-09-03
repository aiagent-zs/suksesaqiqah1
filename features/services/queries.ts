import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { metaFields, serviceDetails } from './meta';
import type { Database } from '@/types/database';

type ServiceType = Database['public']['Enums']['service_type'];

export type ServiceRow = {
  id: string;
  type: ServiceType;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  sortOrder: number;
  isActive: boolean;
  /** Rincian dari `meta`, dirakit untuk ditampilkan. */
  details: string[];

  // --- Isi paket, terurai dari `meta` agar bisa disunting -------------------
  //
  // `details` di atas adalah bentuk-tampilnya (sudah dirangkai jadi kalimat);
  // yang di bawah bentuk-suntingnya. Keduanya dari sumber yang sama, jadi
  // tidak ada yang bisa menyimpang.
  porsi: number | null;
  jenisOlahan: string | null;
  cocokUntuk: string | null;
  items: string[];

  // --- Konten landing -------------------------------------------------------
  tagline: string | null;
  landingFeatures: string[];
  photoPath: string | null;
  photoAlt: string | null;
  isPopular: boolean;
  showOnLanding: boolean;
  /** Berapa order pernah memakai paket ini; penentu boleh-tidaknya dihapus. */
  ordersUsing: number;
  /** Berapa mitra sudah punya modal untuk paket ini. */
  vendorsOffering: number;
};

/**
 * Katalog lengkap untuk halaman master — termasuk yang **non-aktif**.
 *
 * Berbeda dari `getServiceOptions()` di `features/vendors/queries.ts` dan dari
 * `features/checkout/queries.ts`, yang keduanya menyaring `is_active`. Di sini
 * justru sebaliknya: paket yang dinonaktifkan harus tetap terlihat, sebab
 * halaman inilah satu-satunya tempat ia bisa diaktifkan lagi.
 *
 * **Konsekuensi RLS yang perlu diketahui.** `services_select_public` hanya
 * membuka baris `is_active and deleted_at is null` — untuk semua peran,
 * termasuk superadmin. Yang membuat baris non-aktif tetap terbaca di sini
 * adalah `services_write` (`for all to authenticated using is_superadmin()`),
 * sebab `for all` mencakup SELECT dan kebijakan bersifat OR. Jadi daftar ini
 * memang hanya utuh di mata superadmin — dan halamannya memang berhenti di
 * sana.
 */
export async function listServices(): Promise<ServiceRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('services')
    .select(
      `id, type, name, slug, description, price, sort_order, is_active, meta,
       tagline, landing_features, photo_path, photo_alt, is_popular, show_on_landing,
       order_items(count),
       vendor_services(count)`,
    )
    .is('deleted_at', null)
    .order('type')
    .order('sort_order');

  if (error) {
    console.error('[services] listServices:', error.code ?? '-', error.message);
    return [];
  }

  return (data ?? []).map((s) => ({
    id: s.id,
    type: s.type,
    name: s.name,
    slug: s.slug,
    description: s.description,
    price: Number(s.price),
    sortOrder: s.sort_order,
    isActive: s.is_active,
    details: serviceDetails(s.meta, s.type),
    ...metaFields(s.meta),
    tagline: s.tagline,
    landingFeatures: s.landing_features ?? [],
    photoPath: s.photo_path,
    photoAlt: s.photo_alt,
    isPopular: s.is_popular,
    showOnLanding: s.show_on_landing,
    ordersUsing: countOf(s.order_items),
    vendorsOffering: countOf(s.vendor_services),
  }));
}

/**
 * Hitungan dari `select('relasi(count)')`.
 *
 * PostgREST mengembalikannya sebagai `[{ count: n }]`, tapi bentuknya berbeda
 * saat relasinya kosong dan antar versi — jadi dibaca defensif alih-alih
 * di-index langsung. Nol adalah jawaban yang benar untuk semua bentuk lain:
 * yang dipakai angka ini hanyalah peringatan sebelum menghapus, dan
 * `on delete restrict` di database tetap jadi penjaga sesungguhnya.
 */
function countOf(rel: unknown): number {
  if (Array.isArray(rel)) {
    const first = rel[0] as { count?: unknown } | undefined;
    return typeof first?.count === 'number' ? first.count : 0;
  }
  if (rel && typeof rel === 'object') {
    const c = (rel as { count?: unknown }).count;
    return typeof c === 'number' ? c : 0;
  }
  return 0;
}

/**
 * Satu paket untuk halaman detailnya.
 *
 * Query terpisah dari `listServices()` alih-alih menyaring hasilnya: halaman
 * detail dibuka lewat URL yang bisa diketik siapa saja, dan membaca seluruh
 * katalog untuk membuang sembilan di antaranya berarti kerja yang dibuang
 * percuma tiap kali halaman dibuka.
 *
 * Mengembalikan `null` untuk id yang tidak ada — pemanggilnya memanggil
 * `notFound()`. Termasuk untuk paket yang sudah di-soft-delete: `deleted_at`
 * disaring di sini, jadi tautan lama ke paket terhapus berakhir 404, bukan
 * halaman sunting atas baris yang sudah tidak berlaku.
 */
export async function getServiceDetail(id: string): Promise<ServiceRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('services')
    .select(
      `id, type, name, slug, description, price, sort_order, is_active, meta,
       tagline, landing_features, photo_path, photo_alt, is_popular, show_on_landing,
       order_items(count),
       vendor_services(count)`,
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    console.error('[services] getServiceDetail:', error.code ?? '-', error.message);
    return null;
  }
  if (!data) return null;

  return {
    id: data.id,
    type: data.type,
    name: data.name,
    slug: data.slug,
    description: data.description,
    price: Number(data.price),
    sortOrder: data.sort_order,
    isActive: data.is_active,
    details: serviceDetails(data.meta, data.type),
    ...metaFields(data.meta),
    tagline: data.tagline,
    landingFeatures: data.landing_features ?? [],
    photoPath: data.photo_path,
    photoAlt: data.photo_alt,
    isPopular: data.is_popular,
    showOnLanding: data.show_on_landing,
    ordersUsing: countOf(data.order_items),
    vendorsOffering: countOf(data.vendor_services),
  };
}
