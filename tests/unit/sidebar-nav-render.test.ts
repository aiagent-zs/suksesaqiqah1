import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Menguji keluaran render `SidebarNav`, bukan hanya helper pencocokannya.
 *
 * Bug aslinya hidup di JSX — kelas aktif di-hardcode pada tautan Dashboard —
 * jadi menguji `isNavItemActive` saja tidak akan pernah menangkapnya. Di sini
 * `usePathname` di-mock lalu komponennya dipanggil langsung; karena hook-nya
 * sudah diganti, hasilnya berupa pohon elemen React biasa yang bisa ditelusuri
 * tanpa DOM maupun renderer.
 */
let pathname = '/dashboard';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

const { SidebarNav } = await import('@/components/layout/sidebar-nav');

type Rendered = { props: Record<string, unknown>; children?: unknown };

/** Kumpulkan seluruh anak <nav> sebagai daftar props yang bisa diperiksa. */
function navItems(): Array<{ href?: string; ariaCurrent?: string; className: string }> {
  const nav = SidebarNav({ role: 'superadmin' }) as unknown as Rendered;
  const children = (nav.props.children as unknown[]).flat(Infinity).filter(Boolean);

  return (children as Array<{ props: Record<string, unknown> }>).map((child) => ({
    href: child.props.href as string | undefined,
    ariaCurrent: child.props['aria-current'] as string | undefined,
    className: String(child.props.className ?? ''),
  }));
}

describe('SidebarNav — penanda aktif mengikuti halaman', () => {
  beforeEach(() => {
    pathname = '/dashboard';
  });

  it('menandai tepat satu menu sebagai halaman aktif', () => {
    for (const current of ['/dashboard', '/orders', '/schedule', '/validation']) {
      pathname = current;
      const marked = navItems().filter((i) => i.ariaCurrent === 'page');

      expect(marked, `di ${current}`).toHaveLength(1);
      expect(marked[0].href, `di ${current}`).toBe(current);
    }
  });

  it('penanda benar-benar berpindah saat halaman berganti', () => {
    // Inti laporan bug: dulu Dashboard selalu tampak aktif.
    pathname = '/dashboard';
    const onDashboard = navItems().find((i) => i.ariaCurrent === 'page');

    pathname = '/orders';
    const onOrders = navItems().find((i) => i.ariaCurrent === 'page');

    expect(onDashboard?.href).toBe('/dashboard');
    expect(onOrders?.href).toBe('/orders');
  });

  it('hanya menu aktif yang membawa kelas penanda hijau', () => {
    pathname = '/schedule';
    const items = navItems();

    const active = items.filter((i) => i.className.includes('border-emerald-500'));
    expect(active).toHaveLength(1);
    expect(active[0].href).toBe('/schedule');

    // Yang lain harus tetap punya border transparan selebar 4px, supaya
    // berpindah halaman tidak menggeser teks menu.
    for (const item of items.filter((i) => i.href !== '/schedule')) {
      expect(item.className, String(item.href)).toContain('border-l-4');
      expect(item.className, String(item.href)).toContain('border-transparent');
    }
  });

  it('detail order tetap menyalakan menu Pesanan', () => {
    pathname = '/orders/a5000000-0000-4000-8000-000000000004';
    const marked = navItems().filter((i) => i.ariaCurrent === 'page');

    expect(marked).toHaveLength(1);
    expect(marked[0].href).toBe('/orders');
  });

  it('placeholder Pengaturan tidak pernah tampil aktif', () => {
    for (const current of ['/dashboard', '/orders', '/schedule', '/validation']) {
      pathname = current;
      // Item placeholder adalah satu-satunya yang href-nya '#'.
      const settings = navItems().find((i) => i.href === '#');
      expect(settings?.ariaCurrent, `di ${current}`).toBeUndefined();
    }
  });
});
