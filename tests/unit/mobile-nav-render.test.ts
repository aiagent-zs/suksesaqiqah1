import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * Menguji markup bottom-nav mobile.
 *
 * Berbeda dari `sidebar-nav-render`, komponen ini memakai `useState` /
 * `useEffect`, jadi tidak bisa dipanggil sebagai fungsi biasa — hook-nya butuh
 * mesin React yang sungguhan. Karena itu dirender lewat `react-dom/server`.
 *
 * Panel `≡` tertutup pada render awal, jadi yang tersorot di sini adalah bar
 * navigasinya: jumlah tab, penanda aktif, dan ukuran sentuhnya.
 */
let pathname = '/dashboard';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
// Server Action tidak bisa diimpor di lingkungan uji — badannya menarik klien
// Supabase dan `next/headers`. Yang diuji di sini bentuk markup, bukan logout.
vi.mock('@/server/actions/auth', () => ({ logout: () => {} }));

const { MobileNav } = await import('@/components/layout/mobile-nav');

function render(current: string): string {
  pathname = current;
  return renderToStaticMarkup(
    createElement(MobileNav, {
      fullName: 'Budi Petugas',
      role: 'petugas_lapangan',
      isSupervisor: false,
    }),
  );
}

/** Ambil isi atribut class dari tiap elemen yang membawa aria-current="page". */
function activeTabs(markup: string): string[] {
  return [...markup.matchAll(/<a\b[^>]*aria-current="page"[^>]*>/g)].map((m) => m[0]);
}

describe('MobileNav — bar navigasi bawah', () => {
  it('menyediakan 5 slot: 4 rute + tombol Menu', () => {
    const markup = render('/dashboard');

    for (const href of ['/dashboard', '/orders', '/schedule', '/validation']) {
      expect(markup, href).toContain(`href="${href}"`);
    }
    expect(markup).toContain('Menu');
    expect(markup).toContain('grid-cols-5');
  });

  it('menandai tepat satu tab sebagai halaman aktif', () => {
    for (const current of ['/dashboard', '/orders', '/schedule', '/validation']) {
      const active = activeTabs(render(current));

      expect(active, `di ${current}`).toHaveLength(1);
      expect(active[0], `di ${current}`).toContain(`href="${current}"`);
    }
  });

  it('penanda berpindah saat halaman berganti', () => {
    expect(activeTabs(render('/dashboard'))[0]).toContain('href="/dashboard"');
    expect(activeTabs(render('/schedule'))[0]).toContain('href="/schedule"');
  });

  it('detail order tetap menyalakan tab Pesanan', () => {
    const active = activeTabs(render('/orders/a5000000-0000-4000-8000-000000000004'));

    expect(active).toHaveLength(1);
    expect(active[0]).toContain('href="/orders"');
  });

  it('hanya tab aktif yang berwarna hijau, sisanya border transparan', () => {
    const markup = render('/orders');
    const tabs = [
      ...markup.matchAll(/<a\b[^>]*href="\/(dashboard|orders|schedule|validation)"[^>]*>/g),
    ].map((m) => m[0]);

    expect(tabs).toHaveLength(4);
    expect(tabs.filter((t) => t.includes('border-emerald-500'))).toHaveLength(1);

    // Cegah kembalinya bug geser 2px: tab non-aktif wajib tetap punya border.
    for (const tab of tabs.filter((t) => !t.includes('border-emerald-500'))) {
      expect(tab).toContain('border-transparent');
    }
  });

  it('bar disembunyikan di desktop, tempat sidebar mengambil alih', () => {
    // Sidebar `hidden lg:flex`; kalau ambangnya berbeda, ada rentang lebar
    // layar yang kehilangan kedua navigasi sekaligus.
    expect(render('/dashboard')).toMatch(/<nav[^>]*class="[^"]*\blg:hidden\b/);
  });

  it('tiap tab memenuhi target sentuh minimum', () => {
    // docs/13 section 5 — target sentuh >= 44px. `min-h-14` = 56px.
    const markup = render('/dashboard');
    const tabs = [
      ...markup.matchAll(/<a\b[^>]*href="\/(dashboard|orders|schedule|validation)"[^>]*>/g),
    ];

    for (const [tab] of tabs) expect(tab).toContain('min-h-14');
  });

  it('menyertakan area aman iOS supaya tab tidak tertutup home indicator', () => {
    expect(render('/dashboard')).toContain('env(safe-area-inset-bottom)');
  });
});
