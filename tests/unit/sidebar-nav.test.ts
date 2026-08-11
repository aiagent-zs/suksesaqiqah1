import { describe, expect, it } from 'vitest';
import { isNavItemActive } from '@/components/layout/nav-items';

describe('isNavItemActive', () => {
  it('menyalakan menu yang pathname-nya persis sama', () => {
    expect(isNavItemActive('/dashboard', '/dashboard')).toBe(true);
    expect(isNavItemActive('/orders', '/orders')).toBe(true);
    expect(isNavItemActive('/schedule', '/schedule')).toBe(true);
    expect(isNavItemActive('/validation', '/validation')).toBe(true);
  });

  it('hanya satu menu yang menyala di tiap halaman', () => {
    // Inti bug-nya: dulu Dashboard di-hardcode aktif, jadi di halaman manapun
    // penandanya tidak pernah berpindah.
    const items = ['/dashboard', '/orders', '/schedule', '/validation'];

    for (const pathname of items) {
      const active = items.filter((href) => isNavItemActive(pathname, href));
      expect(active, `di ${pathname}`).toEqual([pathname]);
    }
  });

  it('halaman anak tetap menyalakan menu induknya', () => {
    // Membuka detail order harus tetap terbaca "saya sedang di Pesanan".
    expect(isNavItemActive('/orders/a5000000-0000-4000-8000-000000000004', '/orders')).toBe(true);
    expect(isNavItemActive('/orders/new', '/orders')).toBe(true);
  });

  it('halaman anak tidak menyalakan menu lain', () => {
    expect(isNavItemActive('/orders/new', '/dashboard')).toBe(false);
    expect(isNavItemActive('/orders/new', '/schedule')).toBe(false);
  });

  it('kecocokan berhenti di batas segmen, bukan awalan mentah', () => {
    // `startsWith('/orders')` polos akan salah menyalakan menu Pesanan di sini.
    expect(isNavItemActive('/orders-arsip', '/orders')).toBe(false);
    expect(isNavItemActive('/dashboardx', '/dashboard')).toBe(false);
  });

  it('halaman di luar menu tidak menyalakan apa pun', () => {
    for (const href of ['/dashboard', '/orders', '/schedule', '/validation']) {
      expect(isNavItemActive('/login', href), href).toBe(false);
    }
  });
});
