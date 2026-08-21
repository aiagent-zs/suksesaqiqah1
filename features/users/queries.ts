import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type UserRole = Database['public']['Enums']['user_role'];

export type UserRow = {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  vendorId: string | null;
  vendorName: string | null;
  createdAt: string;
};

/**
 * Daftar akun untuk halaman pengelolaan.
 *
 * RLS `profiles_select` sudah membatasi: hanya staf yang melihat seluruh baris,
 * vendor hanya dirinya sendiri. Halamannya sendiri berhenti di superadmin lewat
 * `MANAGE_USERS`, jadi ini lapis kedua — bukan satu-satunya.
 */
export async function listUsers(): Promise<UserRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, role, is_active, vendor_id, created_at, vendor:vendors ( name )')
    .is('deleted_at', null)
    .order('is_active', { ascending: false })
    .order('role')
    .order('full_name');

  if (error) throw new Error(`Gagal memuat daftar akun: ${error.message}`);

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    role: UserRole;
    is_active: boolean;
    vendor_id: string | null;
    created_at: string;
    vendor: { name: string } | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    phone: r.phone,
    role: r.role,
    isActive: r.is_active,
    vendorId: r.vendor_id,
    vendorName: r.vendor?.name ?? null,
    createdAt: r.created_at,
  }));
}

/**
 * Mitra yang belum punya akun login.
 *
 * `profiles.vendor_id` unik (satu akun per mitra), jadi mitra yang sudah punya
 * akun tidak boleh ditawarkan lagi — insert-nya akan ditolak indeks unik, dan
 * pesan galatnya jauh kurang berguna daripada tidak menawarkannya sejak awal.
 */
export async function getVendorsWithoutAccount() {
  const supabase = await createClient();

  const [{ data: vendors }, { data: taken }] = await Promise.all([
    supabase
      .from('vendors')
      .select('id, code, name')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name'),
    supabase.from('profiles').select('vendor_id').not('vendor_id', 'is', null),
  ]);

  const used = new Set((taken ?? []).map((p) => p.vendor_id));

  return (vendors ?? [])
    .filter((v) => !used.has(v.id))
    .map((v) => ({ id: v.id, code: v.code, name: v.name }));
}
