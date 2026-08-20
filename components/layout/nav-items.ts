import {
  CalendarDays,
  FileText,
  LayoutDashboard,
  ShoppingBag,
  Store,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Database } from '@/types/database';

type UserRole = Database['public']['Enums']['user_role'];

export type NavItem = {
  href: string;
  label: string;
  /** Label pendek untuk bottom-nav mobile, di mana lebarnya hanya ~20% layar. */
  shortLabel: string;
  icon: LucideIcon;
  /**
   * Role yang boleh melihat menu ini. Kosong = semua role.
   *
   * Ini kenyamanan, bukan pengaman: halamannya sendiri memeriksa kapabilitas,
   * dan RLS menolak datanya. Yang dihindari di sini adalah menu yang membawa
   * orang ke halaman yang pasti menolaknya.
   */
  roles?: UserRole[];
};

/**
 * Isi navigasi utama — dipakai sidebar desktop **dan** bottom-nav mobile.
 *
 * Satu daftar untuk keduanya supaya menu tidak pernah berbeda antar breakpoint.
 * Bukan turunan `PROTECTED_PREFIXES` di `lib/supabase/middleware.ts` dan memang
 * tidak seharusnya: tidak semua rute terproteksi layak jadi menu (`/orders/new`
 * sudah diwakili `/orders`), dan menu butuh label serta ikon yang tidak dimiliki
 * daftar itu.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', shortLabel: 'Dashboard', icon: LayoutDashboard },
  { href: '/orders', label: 'Pesanan (Orders)', shortLabel: 'Pesanan', icon: ShoppingBag },
  { href: '/schedule', label: 'Jadwal', shortLabel: 'Jadwal', icon: CalendarDays },
  { href: '/validation', label: 'Validasi Dokumentasi', shortLabel: 'Validasi', icon: FileText },
  {
    href: '/vendors',
    label: 'Mitra',
    shortLabel: 'Mitra',
    icon: Store,
    roles: ['superadmin'],
  },
  {
    href: '/users',
    label: 'Pengguna',
    shortLabel: 'Pengguna',
    icon: Users,
    roles: ['superadmin'],
  },
];

/** Menu yang layak ditampilkan untuk sebuah role. */
export function navItemsForRole(role: UserRole | undefined): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}

/**
 * Apakah sebuah menu sedang aktif untuk pathname tertentu.
 *
 * Kecocokan berhenti di batas segmen (`===` atau diikuti `/`), aturan yang sama
 * dengan `isProtectedRoute` di middleware. Awalan mentah (`startsWith(href)`)
 * akan membuat `/orders-arsip` ikut menyalakan menu `/orders`.
 *
 * Halaman anak tetap menyalakan menu induknya — membuka `/orders/{id}` harus
 * tetap terbaca "saya sedang di Pesanan".
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
