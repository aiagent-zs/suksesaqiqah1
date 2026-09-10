'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Drawer } from '@base-ui/react/drawer';
import { LogOut, Menu, UserCog, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { logout } from '@/server/actions/auth';
import { ROLE_LABEL } from '@/lib/constants/roles';
import { isNavItemActive, navItemsForRole } from './nav-items';
import { RouteProgress } from './route-progress';
import type { Database } from '@/types/database';

type UserRole = Database['public']['Enums']['user_role'];

const TAB_BASE =
  // ≥ 44px tinggi sentuh (docs/13 section 5). `min-w-0` supaya label panjang
  // memendek dengan ellipsis, bukan melebarkan kolom grid.
  'flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 border-t-2 px-1 py-2 text-[11px] font-medium transition-colors';

/**
 * Penanda aktif bottom-nav: garis atas + teks hijau — padanan "pill hijau di
 * tepi" milik sidebar (design.md), diputar mengikuti orientasi bar.
 *
 * Tab non-aktif tetap memakai `border-t-2 border-transparent` supaya
 * berpindah halaman tidak menggeser isi tab 2px.
 */
const TAB_ACTIVE = 'border-emerald-500 bg-emerald-600/15 text-emerald-400';
const TAB_INACTIVE = 'border-transparent text-slate-300 active:bg-sidebar-accent';

const SHEET_ITEM =
  'flex min-h-12 w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors';

/**
 * Batas tab yang muat di bottom-nav, di luar tombol "Menu".
 *
 * Empat, bukan lima: pada layar 360px — ukuran ponsel yang paling lazim di
 * sini — lima kolom menyisakan 72px per tab, dan label seperti "Validasi"
 * terpotong jadi "Valida…". Dengan empat, tiap tab dapat 90px dan labelnya
 * utuh.
 */
const MAX_TABS = 4;

/**
 * Kelas kolom yang ditulis lengkap, bukan `grid-cols-${n}`.
 *
 * Tailwind memindai kode sebagai teks; kelas yang dirakit lewat interpolasi
 * tidak pernah ikut ke CSS yang dihasilkan, dan gridnya diam-diam runtuh jadi
 * satu kolom.
 */
const TAB_GRID: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
};

/**
 * Navigasi mobile & tablet (< lg): bottom-nav + panel `≡` untuk sisanya.
 *
 * Polanya mengikuti `docs/14 section 5-6` — `AppShell` disebut "sidebar
 * (desktop) / bottom-nav (mobile)", dan diagramnya berakhir dengan slot `≡`.
 * Sebelum ini sidebar `hidden lg:flex` tidak punya pengganti apa pun, jadi di
 * bawah 1024px tidak ada cara berpindah halaman — termasuk tidak ada cara
 * keluar sistem, karena tombol logout hanya hidup di footer sidebar.
 *
 * Ambang batasnya `lg`, **bukan** 640px seperti baris "mobile" di tabel
 * breakpoint: sidebar baru muncul di `lg`, jadi memakai `sm:hidden` akan
 * membuat rentang 640–1024px (tablet, "admin di lapangan") kehilangan
 * kedua-duanya.
 */
export function MobileNav({ fullName, role }: { fullName: string; role: UserRole | undefined }) {
  const pathname = usePathname();
  const items = navItemsForRole(role);
  const [open, setOpen] = useState(false);

  /**
   * Menu dibagi dua: yang muat jadi tab, sisanya masuk panel.
   *
   * Jumlahnya berbeda per role — mitra 3, admin 4, superadmin 6 — sementara
   * gridnya dulu dipatok `grid-cols-5`. Akibatnya mitra menyisakan satu kolom
   * kosong di kanan (terlihat di layar 360px sebagai ruang menganga), dan
   * superadmin menjejalkan 7 kolom ke ruang 5: labelnya terpotong dan lebar
   * sentuhnya turun di bawah 44px.
   *
   * Yang berlebih **harus** ikut ke panel. Memotongnya begitu saja membuat
   * superadmin kehilangan jalan ke Mitra dan Pengguna dari ponsel sama sekali.
   */
  const tabs = items.slice(0, MAX_TABS);
  const overflow = items.slice(MAX_TABS);
  const [renderedPathname, setRenderedPathname] = useState(pathname);

  // Panel ditutup begitu halaman berpindah.
  //
  // Panel ini modal, jadi tab di baliknya tidak bisa ditekan selagi terbuka —
  // satu-satunya perpindahan yang mungkin adalah tombol "kembali" peramban yang
  // tidak mendukung CloseWatcher (yang didukung akan menutup panel, bukan
  // bernavigasi). Penyesuaiannya dilakukan saat render, bukan lewat
  // `useEffect`: menyetel state di dalam efek memaksa satu putaran render
  // tambahan setelah panel sempat tergambar di halaman baru.
  //
  // Kalau nanti ada tautan **di dalam** panel, bungkus dengan `Drawer.Close`
  // agar menutup dan bernavigasi terjadi bersamaan.
  if (pathname !== renderedPathname) {
    setRenderedPathname(pathname);
    setOpen(false);
  }

  return (
    <Drawer.Root open={open} onOpenChange={setOpen} swipeDirection="down">
      <nav
        aria-label="Navigasi utama"
        className="border-sidebar-border bg-sidebar fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className={cn('grid', TAB_GRID[tabs.length + 1])}>
          {tabs.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            const Icon = item.icon;

            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(TAB_BASE, active ? TAB_ACTIVE : TAB_INACTIVE)}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="max-w-full truncate">{item.shortLabel}</span>
                  {/* Di dalam `<Link>` — lihat catatan di `RouteProgress`. */}
                  <RouteProgress />
                </Link>
              </li>
            );
          })}

          <li className="min-w-0">
            <Drawer.Trigger className={cn(TAB_BASE, TAB_INACTIVE, 'w-full')}>
              <Menu className="h-5 w-5 shrink-0" />
              <span className="max-w-full truncate">Menu</span>
            </Drawer.Trigger>
          </li>
        </ul>
      </nav>

      <Drawer.Portal>
        <Drawer.Backdrop
          className={cn(
            'fixed inset-0 z-40 min-h-dvh bg-black/60 lg:hidden',
            'transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0',
            // Selama diseret, opasitas mengikuti jarak seret alih-alih transisi.
            'data-swiping:duration-0',
          )}
        />

        <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center lg:hidden">
          <Drawer.Popup
            className={cn(
              'border-sidebar-border bg-sidebar w-full rounded-t-2xl border-t pb-[env(safe-area-inset-bottom)] text-white outline-none',
              // Semua state memakai properti `transform` yang sama supaya
              // gerakan seret dan animasi buka/tutup tidak saling menimpa.
              '[transform:translateY(var(--drawer-swipe-movement-y,0px))]',
              'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
              'data-ending-style:[transform:translateY(100%)] data-starting-style:[transform:translateY(100%)]',
              'data-swiping:duration-0 data-swiping:select-none',
            )}
          >
            {/* Pegangan seret — sekaligus penanda visual bahwa panel bisa
                ditarik ke bawah untuk ditutup. */}
            <Drawer.SwipeArea className="flex justify-center py-3">
              <span className="h-1 w-10 rounded-full bg-slate-600" />
            </Drawer.SwipeArea>

            <Drawer.Content className="px-4 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Drawer.Title className="truncate text-sm font-semibold text-white">
                    {fullName}
                  </Drawer.Title>
                  <Drawer.Description className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                      {role ? (ROLE_LABEL[role] ?? role) : 'Tanpa peran'}
                    </span>
                  </Drawer.Description>
                </div>

                <Drawer.Close
                  aria-label="Tutup menu"
                  className="active:bg-sidebar-accent flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors"
                >
                  <X className="h-5 w-5" />
                </Drawer.Close>
              </div>

              {/* Menu yang tidak muat jadi tab. Tanpa blok ini superadmin
                  kehilangan jalan ke Mitra dan Pengguna dari ponsel. */}
              {overflow.length > 0 && (
                <div className="border-sidebar-border/80 mt-4 space-y-1 border-t pt-4">
                  {overflow.map((item) => {
                    const active = isNavItemActive(pathname, item.href);
                    const Icon = item.icon;

                    return (
                      <Drawer.Close
                        key={item.href}
                        render={
                          <Link
                            href={item.href}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                              SHEET_ITEM,
                              active
                                ? 'bg-emerald-600/20 text-emerald-400'
                                : 'active:bg-sidebar-accent text-slate-300',
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span>{item.label}</span>
                          </Link>
                        }
                      />
                    );
                  })}
                </div>
              )}

              <div className="border-sidebar-border/80 mt-4 space-y-1 border-t pt-4">
                {/* Di desktop jalannya lewat blok profil di sidebar; pengguna
                    ponsel tidak pernah melihat blok itu, jadi tanpa baris ini
                    mereka tidak punya jalan sama sekali ke halaman akunnya. */}
                {/* `Drawer.Close` membungkus tautannya — persis yang disarankan
                    docblock di atas: menutup panel dan bernavigasi terjadi
                    bersamaan, jadi panelnya tidak sempat tergambar di halaman
                    baru sebelum menutup. */}
                <Drawer.Close
                  render={
                    <Link
                      href="/profil"
                      className={cn(SHEET_ITEM, 'active:bg-sidebar-accent text-slate-300')}
                    >
                      <UserCog className="h-4 w-4 shrink-0" />
                      <span>Profil Saya</span>
                    </Link>
                  }
                />

                <form action={logout}>
                  <button
                    type="submit"
                    className={cn(SHEET_ITEM, 'text-slate-300 active:bg-red-950/30')}
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    <span>Keluar Sistem</span>
                  </button>
                </form>
              </div>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
