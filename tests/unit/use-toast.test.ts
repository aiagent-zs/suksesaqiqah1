// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { useToast } from '@/hooks/use-toast';

/**
 * Hook diuji lewat komponen tipis, bukan `renderHook`.
 *
 * `@testing-library/react` tidak terpasang di project ini — tes komponen yang
 * sudah ada (`alert-panel`, `reveal`, `checkout-form-*`) memakai
 * `react-dom/client` langsung. Menambah dependensi hanya demi satu berkas tes
 * lebih mahal daripada delapan baris pembungkus ini.
 */
type Api = ReturnType<typeof useToast>;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function mountHook(): { current: Api } {
  const ref = { current: null as unknown as Api };

  function Probe() {
    ref.current = useToast();
    return null;
  }

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(createElement(Probe));
  });

  return ref;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

/**
 * Umpan balik aksi di halaman staf (`design.md §8`).
 *
 * ## Kenapa hook ini ada
 *
 * `Toast` sudah lengkap sejak 24 Agustus — termasuk nada `success` — tetapi
 * **hanya checkout yang memakainya**, dan di sana pun hanya untuk galat.
 * Menyimpan katalog berhasil, `router.refresh()` memuat ulang data, dan tidak
 * ada satu pun tanda bahwa sesuatu terjadi. Yang tertangkap operator hanya
 * form yang tertutup — sama persis dengan tampilan gagal-diam.
 *
 * Akibatnya bukan sekadar tidak nyaman: yang ragu akan menyimpan ulang, dan
 * pada aksi yang tidak idempoten (menambah paket) itu berarti data ganda.
 */
describe('useToast', () => {
  it('mulai tanpa toast', () => {
    const result = mountHook();
    expect(result.current.toast).toBeNull();
  });

  it('menampilkan pesan sukses & galat', () => {
    const result = mountHook();

    act(() => result.current.show('success', 'Perubahan paket tersimpan.'));
    expect(result.current.toast?.tone).toBe('success');
    expect(result.current.toast?.message).toBe('Perubahan paket tersimpan.');

    act(() => result.current.show('error', 'Slug ini sudah dipakai paket lain.'));
    expect(result.current.toast?.tone).toBe('error');
  });

  /**
   * Inti hook ini, dan satu-satunya alasan ia tidak cukup ditulis sebagai
   * `useState` biasa di tiap komponen.
   */
  it('id naik meski pesannya sama persis', () => {
    const result = mountHook();

    act(() => result.current.show('success', 'Perubahan tersimpan.'));
    const first = result.current.toast?.id;

    act(() => result.current.show('success', 'Perubahan tersimpan.'));
    const second = result.current.toast?.id;

    // Tanpa penghitung, state kedua identik dengan yang pertama — React tidak
    // merender ulang, dan penyimpanan kedua terbaca sebagai tidak terjadi.
    // Itu persis keadaan yang hendak diperbaiki: operator yang ragu menyimpan
    // ulang, lalu tetap tidak mendapat tanda apa pun.
    expect(second).toBeGreaterThan(first!);
  });

  it('dismiss mengosongkan, dan toast berikutnya tetap punya id baru', () => {
    const result = mountHook();

    act(() => result.current.show('success', 'Tersimpan.'));
    const before = result.current.toast?.id;

    act(() => result.current.dismiss());
    expect(result.current.toast).toBeNull();

    act(() => result.current.show('success', 'Tersimpan.'));
    // Penghitungnya `useRef`, jadi ia tidak ikut ter-reset saat state dikosongkan.
    expect(result.current.toast?.id).toBeGreaterThan(before!);
  });
});

/**
 * Setiap aksi katalog wajib meninggalkan tanda.
 *
 * Diperiksa lewat berkasnya, bukan dengan merender: keempat komponen ini butuh
 * server action, router Next, dan klien Supabase. Yang benar-benar dijaga di
 * sini adalah **tidak ada jalur yang lupa memanggil `show`** — dan itu terbaca
 * dari kodenya.
 */
describe('umpan balik terpasang di seluruh aksi katalog', () => {
  const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

  const screens = [
    ['features/services/components/service-form.tsx', 'simpan & tambah paket'],
    ['features/services/components/service-detail-actions.tsx', 'aktif/non-aktif & hapus'],
    ['features/services/components/service-photo-field.tsx', 'unggah & hapus foto'],
    ['features/services/components/service-manager.tsx', 'hapus dari daftar'],
    ['features/vendors/components/vendor-service-panel.tsx', 'modal mitra'],
  ] as const;

  it.each(screens)('%s memakai toast (%s)', (path) => {
    const src = read(path);
    expect(src).toContain('useToast');
    expect(src).toContain('<Toast');
  });

  it.each(screens)('%s memberi tanda pada jalur berhasil DAN gagal', (path) => {
    const src = read(path);
    // Jalur gagal yang senyap sama menyesatkannya dengan jalur berhasil yang
    // senyap: keduanya meninggalkan operator menebak.
    expect(src).toContain("show('success'");
    expect(src).toContain("show('error'");
  });

  it('galat tetap menetap di layar, bukan hanya lewat toast', () => {
    // Toast menghilang setelah 5 detik. Kalau ia satu-satunya tempat galat
    // diberitahukan, yang berkedip pada saat yang salah kehilangan seluruh
    // keterangannya — karena itu `setError` tetap dipanggil berdampingan.
    const src = read('features/services/components/service-form.tsx');
    expect(src).toContain('setError(result.error.message)');
  });
});
