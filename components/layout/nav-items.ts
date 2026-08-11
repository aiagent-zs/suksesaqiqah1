import {
  CalendarDays,
  FileText,
  LayoutDashboard,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  /** Label pendek untuk bottom-nav mobile, di mana lebarnya hanya ~20% layar. */
  shortLabel: string;
  icon: LucideIcon;
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
];

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
