// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MobileNav } from '@/components/layout/mobile-nav';

let pathname = '/orders';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.mock('@/server/actions/auth', () => ({ logout: () => {} }));

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
// Tanpa penanda ini React 19 memperingatkan tiap pembaruan state di luar `act`.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLElement | null = null;

function mount() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root!.render(<MobileNav fullName="Budi Vendor" role="vendor" />);
  });
}

/** Render ulang komponen yang sama — dipakai untuk mensimulasikan pindah halaman. */
function rerender(props: { fullName: string; role: string }) {
  act(() => {
    root!.render(<MobileNav {...props} />);
  });
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  pathname = '/orders';
});

/** Tombol `≡` di bar bawah. */
function trigger(): HTMLElement {
  const el = document.querySelector<HTMLElement>('[aria-haspopup="dialog"]');
  if (!el) throw new Error('Tombol Menu tidak ditemukan');
  return el;
}

function openPanel() {
  act(() => {
    trigger().click();
  });
}

/** Teks seluruh dokumen — panel dirender lewat portal, di luar container. */
function bodyText(): string {
  return document.body.textContent ?? '';
}

describe('MobileNav — panel Menu', () => {
  it('panel tertutup pada render awal', () => {
    mount();

    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(bodyText()).not.toContain('Keluar Sistem');
  });

  it('menekan Menu membuka panel', () => {
    mount();
    openPanel();

    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('panel memuat identitas, Pengaturan, dan Keluar Sistem', () => {
    mount();
    openPanel();

    const text = bodyText();
    expect(text).toContain('Budi Vendor');
    // Nama role yang terbaca orang, bukan nilai enumnya.
    expect(text).toContain('Vendor');
    expect(text).toContain('Pengaturan');
    // Inilah yang sebelumnya tidak terjangkau sama sekali di bawah 1024px.
    expect(text).toContain('Keluar Sistem');
  });

  it('tombol Keluar Sistem men-submit form logout', () => {
    mount();
    openPanel();

    const button = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Keluar Sistem'),
    );

    expect(button).toBeDefined();
    expect(button!.getAttribute('type')).toBe('submit');
    expect(button!.closest('form')).not.toBeNull();
  });

  it('panel punya judul yang terhubung ke dialog (aria-labelledby)', () => {
    mount();
    openPanel();

    const dialog = document.querySelector('[role="dialog"]')!;
    const labelledBy = dialog.getAttribute('aria-labelledby');

    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)?.textContent).toContain('Budi Vendor');
  });

  it('tombol tutup mengembalikan panel ke keadaan tertutup', () => {
    mount();
    openPanel();

    const close = document.querySelector<HTMLElement>('[aria-label="Tutup menu"]');
    expect(close).not.toBeNull();

    act(() => close!.click());

    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('tombol Escape menutup panel', () => {
    mount();
    openPanel();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('panel tertutup sendiri begitu halaman berpindah', () => {
    // Menjaga penyesuaian saat render yang menggantikan `useEffect`. Tanpa itu
    // panel bisa tetap menggantung di atas halaman baru setelah tombol
    // "kembali" pada peramban tanpa CloseWatcher.
    mount();
    openPanel();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');

    pathname = '/schedule';
    rerender({ fullName: 'Budi Vendor', role: 'vendor' });

    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('penanda tab ikut berpindah setelah halaman berganti', () => {
    mount();
    expect(document.querySelector('[aria-current="page"]')?.getAttribute('href')).toBe('/orders');

    pathname = '/schedule';
    rerender({ fullName: 'Budi Vendor', role: 'vendor' });

    const active = document.querySelectorAll('[aria-current="page"]');
    expect(active).toHaveLength(1);
    expect(active[0].getAttribute('href')).toBe('/schedule');
  });

  it('menamai role dengan label yang terbaca, bukan nilai enum', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(<MobileNav fullName="Agus Admin" role="superadmin" />);
    });

    openPanel();

    expect(bodyText()).toContain('Agus Admin');
    expect(bodyText()).toContain('Superadmin');
  });
});
