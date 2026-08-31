'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { isNavItemActive, navItemsForRole } from './nav-items';
import type { Database } from '@/types/database';

type UserRole = Database['public']['Enums']['user_role'];

const ITEM_BASE =
  'flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all';

/**
 * Penanda aktif: garis kiri + latar hijau (design.md — "Primary Green vertical
 * pill on the left edge"). `border-l-4` hanya bermakna saat aktif, tapi item
 * non-aktif tetap diberi `border-l-4 border-transparent` supaya berpindah
 * halaman tidak menggeser teks menu 4px.
 */
const ITEM_ACTIVE = 'border-l-4 border-emerald-500 bg-emerald-600/20 text-emerald-400';
const ITEM_INACTIVE =
  'border-l-4 border-transparent text-slate-300 hover:bg-sidebar-accent hover:text-white';

/**
 * Navigasi sidebar desktop (≥ lg).
 *
 * Client Component karena penanda aktif diturunkan dari `usePathname()` —
 * Server Component tidak bisa membaca URL saat ini, dan itu memang disengaja
 * Next agar state layout bertahan lintas navigasi.
 */
export function SidebarNav({ role }: { role: UserRole | undefined }) {
  const pathname = usePathname();
  const items = navItemsForRole(role);

  return (
    // `min-h-0 overflow-y-auto`: sidebar berbagi tinggi layar dengan brand,
    // ringkasan profil, dan tombol keluar. Di layar pendek — atau saat menu
    // bertambah — daftar inilah yang menggulir, bukan seluruh
    // sidebar; tombol keluar harus tetap terlihat. `min-h-0` wajib: tanpa itu
    // anak flex menolak menyusut di bawah tinggi kontennya dan `overflow` tidak
    // pernah aktif.
    <nav aria-label="Navigasi utama" className="min-h-0 flex-1 space-y-1 overflow-y-auto p-4">
      {items.map((item) => {
        const active = isNavItemActive(pathname, item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            // Dibaca pembaca layar sebagai halaman yang sedang dibuka; warna
            // saja tidak menyampaikan itu.
            aria-current={active ? 'page' : undefined}
            className={cn(ITEM_BASE, active ? ITEM_ACTIVE : ITEM_INACTIVE)}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
