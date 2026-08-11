'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, isNavItemActive } from './nav-items';

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
  'border-l-4 border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-white';

/**
 * Navigasi sidebar desktop (≥ lg).
 *
 * Client Component karena penanda aktif diturunkan dari `usePathname()` —
 * Server Component tidak bisa membaca URL saat ini, dan itu memang disengaja
 * Next agar state layout bertahan lintas navigasi.
 */
export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigasi utama" className="flex-1 space-y-1 p-4">
      {NAV_ITEMS.map((item) => {
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

      {/* Halamannya belum ada (Tahap 11 · Master Data). Sengaja belum masuk
          NAV_ITEMS supaya tidak pernah bisa tampil aktif. */}
      <a href="#" className={cn(ITEM_BASE, ITEM_INACTIVE)}>
        <Settings className="h-4 w-4 shrink-0" />
        <span>Pengaturan</span>
      </a>
    </nav>
  );
}
