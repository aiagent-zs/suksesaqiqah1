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

export type CheckoutBranch = {
  id: string;
  name: string;
  code: string;
};

export type CheckoutOptions = {
  packages: CheckoutPackage[];
  branches: CheckoutBranch[];
};

/**
 * Isi pilihan halaman checkout publik.
 *
 * Dibaca sebagai pengunjung anonim, jadi hanya lewat dua jalan yang memang
 * dibuka untuk `anon`: SELECT pada `services` (dibatasi kebijakan
 * `services_public_select`) dan RPC `get_public_branches`. Tabel `branches`
 * sendiri tertutup — isinya termasuk telepon dan alamat internal.
 */
export async function getCheckoutOptions(): Promise<CheckoutOptions> {
  const supabase = await createClient();

  const [servicesResult, branchesResult] = await Promise.all([
    supabase
      .from('services')
      .select('id, type, name, slug, description, price')
      .in('type', ['aqiqah', 'qurban'])
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true }),
    supabase.rpc('get_public_branches'),
  ]);

  const packages = (servicesResult.data ?? []).map((s) => ({
    id: s.id,
    type: s.type as 'aqiqah' | 'qurban',
    name: s.name,
    slug: s.slug,
    description: s.description,
    // `numeric` datang sebagai string dari PostgREST.
    price: Number(s.price),
  }));

  const branches = ((branchesResult.data as unknown as CheckoutBranch[] | null) ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    code: b.code,
  }));

  return { packages, branches };
}

/** Tipe hasil RPC `create_guest_order`, dipakai action & halaman konfirmasi. */
export type GuestOrderResult = {
  order_number: string;
  public_token: string;
  total_amount: number;
  status: Database['public']['Enums']['order_status'];
  payment_status: Database['public']['Enums']['payment_status'];
};
