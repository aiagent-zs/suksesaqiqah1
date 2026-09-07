import { describe, expect, it } from 'vitest';
import { isNavItemActive, navItemsForRole } from '@/components/layout/nav-items';

/**
 * Menu yang ditawarkan per role.
 *
 * Ini kenyamanan, bukan pengaman — halamannya memeriksa kapabilitas sendiri dan
 * RLS menolak datanya. Tapi menu yang **selalu** berujung penolakan lebih buruk
 * daripada tidak ada menu: ia mengajak menekan sesuatu yang tidak pernah bisa
 * dipakai, dan itu terbaca sebagai fitur rusak, bukan sebagai batas wewenang.
 *
 * Daftarnya wajib bergerak bersama `CAPABILITIES` di
 * `server/auth/capabilities.ts`; kalau menyimpang, layar menawarkan aksi yang
 * pasti ditolak — atau lebih buruk, menyembunyikan yang sebenarnya boleh.
 */
describe('navItemsForRole', () => {
  const hrefs = (role: 'superadmin' | 'admin' | 'vendor') =>
    navItemsForRole(role).map((i) => i.href);

  it('vendor tidak ditawari Validasi Dokumentasi', () => {
    // `VALIDATE_DOCUMENTATION` berhenti di staf: vendor mengunggah bukti,
    // tidak menilainya. Yang mengerjakan tidak menyatakan pekerjaannya benar.
    expect(hrefs('vendor')).not.toContain('/validation');
  });

  it('vendor hanya melihat tiga menu operasional', () => {
    expect(hrefs('vendor')).toEqual(['/dashboard', '/orders', '/schedule']);
  });

  it('Mitra & Pengguna berhenti di superadmin', () => {
    // Siapa pun yang bisa mengubah role bisa mengangkat dirinya sendiri.
    for (const href of ['/vendors', '/users']) {
      expect(hrefs('superadmin'), href).toContain(href);
      expect(hrefs('admin'), href).not.toContain(href);
      expect(hrefs('vendor'), href).not.toContain(href);
    }
  });

  it('admin melihat Validasi tapi bukan menu master data', () => {
    expect(hrefs('admin')).toEqual(['/dashboard', '/orders', '/schedule', '/validation']);
  });

  it('superadmin melihat semuanya', () => {
    expect(navItemsForRole('superadmin')).toHaveLength(6);
  });

  it('tanpa role, tidak ada menu sama sekali', () => {
    // Profil yang belum termuat tidak boleh diperlakukan sebagai "semua boleh".
    expect(navItemsForRole(undefined)).toEqual([]);
  });
});

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
