import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

export type UserRole = Database['public']['Enums']['user_role'];
export type Profile = Database['public']['Tables']['profiles']['Row'];

export type SessionUser = {
  id: string;
  email: string | undefined;
  profile: Profile | null;
};

/**
 * Ambil sesi + profile user dari Supabase.
 * Kembalikan null jika tidak ada sesi.
 */
export async function getSession(): Promise<SessionUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  // Ambil profile (role, branch_id, dll)
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  return {
    id: user.id,
    email: user.email,
    profile: profile ?? null,
  };
}

/**
 * Wajib ada sesi. Jika tidak → redirect ke /login.
 */
export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return session;
}

/**
 * Wajib ada sesi + salah satu dari role yang diizinkan.
 * Jika role tidak sesuai → redirect ke /dashboard (403-friendly).
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<SessionUser> {
  const session = await requireAuth();

  const userRole = session.profile?.role;
  if (!userRole || !allowedRoles.includes(userRole)) {
    redirect('/dashboard?error=access_denied');
  }

  return session;
}

/**
 * Cek apakah user punya role tertentu (tanpa redirect — untuk conditional rendering).
 */
export function hasRole(profile: Profile | null, roles: UserRole[]): boolean {
  if (!profile) return false;
  return roles.includes(profile.role);
}

/**
 * Pihak internal — superadmin atau admin.
 *
 * Lawannya vendor, yang hanya melihat order yang ditugaskan padanya. Cerminan
 * `public.is_staff()` di database; keduanya harus bergerak bersama.
 */
export function isStaff(profile: Profile | null): boolean {
  return hasRole(profile, ['superadmin', 'admin']);
}

/** Cerminan `public.is_superadmin()`. */
export function isSuperadmin(profile: Profile | null): boolean {
  return hasRole(profile, ['superadmin']);
}
