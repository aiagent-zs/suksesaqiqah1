// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { MobileNav } from '@/components/layout/mobile-nav';
import { navItemsForRole } from '@/components/layout/nav-items';

/**
 * Bottom-nav: jumlah kolomnya mengikuti jumlah menu.
 *
 * ## Kenapa berkas ini ada
 *
 * Menu berbeda per role — mitra 3, admin 4, superadmin 6 — sementara gridnya
 * dipatok `grid-cols-5`. Dua akibatnya berlawanan, dan keduanya salah:
 *
 *   - **Mitra** menyisakan satu kolom kosong di kanan. Di layar 360px itu
 *     terbaca sebagai ruang menganga, seolah ada menu yang gagal dimuat.
 *   - **Superadmin** menjejalkan 7 kolom ke ruang 5: labelnya terpotong dan
 *     lebar sentuhnya turun jauh di bawah 44px yang dituntut `docs/13 §5`.
 *
 * Batasnya empat tab, bukan lima: pada 360px lima kolom menyisakan 72px per
 * tab dan "Validasi" terpotong jadi "Valida…". Dengan empat, tiap tab dapat
 * 90px.
 *
 * Yang berlebih **harus** ikut ke panel `≡`. Memotongnya begitu saja membuat
 * superadmin kehilangan jalan ke Mitra dan Pengguna dari ponsel sama sekali —
 * bug yang jauh lebih buruk daripada tata letak yang miring.
 */
let pathname = '/dashboard';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.mock('@/server/actions/auth', () => ({ logout: () => {} }));

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLElement | null = null;

type Role = 'superadmin' | 'admin' | 'vendor';

function mount(role: Role) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<MobileNav fullName="Uji" role={role} />));
  return container;
}

/** `<ul>` bottom-nav — panel `≡` dirender lewat portal, jadi tidak tercampur. */
const tabList = (el: HTMLElement) => el.querySelector('nav ul') as HTMLElement;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  pathname = '/dashboard';
});

describe('kolomnya pas, tanpa celah dan tanpa jejalan', () => {
  it('mitra: 3 menu + Menu = 4 kolom', () => {
    // Bentuk yang terlihat di layar 360px — dulu menyisakan satu kolom kosong.
    const el = mount('vendor');
    expect(tabList(el).className).toContain('grid-cols-4');
    expect(tabList(el).children).toHaveLength(4);
  });

  it('admin: 4 menu + Menu = 5 kolom', () => {
    const el = mount('admin');
    expect(tabList(el).className).toContain('grid-cols-5');
    expect(tabList(el).children).toHaveLength(5);
  });

  it('superadmin: 6 menu dipotong jadi 4 tab + Menu = 5 kolom', () => {
    // Bukan 7 kolom yang dijejalkan ke ruang 5.
    const el = mount('superadmin');
    expect(tabList(el).className).toContain('grid-cols-5');
    expect(tabList(el).children).toHaveLength(5);
  });

  it('jumlah kolom selalu sama dengan jumlah anaknya', () => {
    // Penjagaan yang tidak bergantung pada angka: kolom yang tidak cocok
    // dengan isinya selalu menghasilkan celah atau tumpukan.
    for (const role of ['vendor', 'admin', 'superadmin'] as Role[]) {
      const el = mount(role);
      const ul = tabList(el);
      const cols = Number(ul.className.match(/grid-cols-(\d)/)?.[1]);
      expect(cols, `role ${role}`).toBe(ul.children.length);
      act(() => root?.unmount());
      container?.remove();
    }
  });

  it('kelas kolomnya ditulis lengkap, bukan dirakit', () => {
    // Tailwind memindai kode sebagai teks; `grid-cols-${n}` tidak pernah ikut
    // ke CSS dan gridnya diam-diam runtuh jadi satu kolom.
    const el = mount('vendor');
    expect(tabList(el).className).not.toContain('${');
  });
});

describe('menu yang berlebih tidak hilang', () => {
  it('superadmin tetap punya jalan ke Mitra dan Pengguna', () => {
    // Kalau ini gagal, superadmin tidak bisa membuka kedua halaman itu dari
    // ponsel sama sekali — bukan sekadar tata letak yang miring.
    //
    // Diperiksa sebagai **tautan yang bisa ditekan**, bukan sebagai teks di
    // dalam dokumen: kata "Mitra" dan "Pengguna" juga muncul di tab bottom-nav
    // saat gridnya masih dipatok 5, jadi pencarian teks polos tetap hijau
    // meski panelnya kosong — celah yang tertangkap saat menguji tes ini
    // terhadap regresi.
    const el = mount('superadmin');

    const trigger = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Menu'));
    act(() => trigger?.click());

    // Panelnya lewat portal, jadi dicari di seluruh dokumen — tapi khusus di
    // luar `<nav>` bottom-nav.
    const panelLinks = [...document.querySelectorAll('a[href]')].filter((a) => !a.closest('nav'));
    const hrefs = panelLinks.map((a) => a.getAttribute('href'));

    expect(hrefs).toContain('/vendors');
    expect(hrefs).toContain('/users');
  });

  it('tab + isi panel menutup seluruh menu role itu', () => {
    // Tidak ada satu pun yang jatuh di antara keduanya.
    const el = mount('superadmin');
    const trigger = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Menu'));
    act(() => trigger?.click());

    const teks = document.body.textContent ?? '';
    for (const item of navItemsForRole('superadmin')) {
      expect(teks, `menu ${item.href} hilang`).toContain(item.shortLabel);
    }
  });

  it('mitra tidak mendapat blok berlebih yang kosong', () => {
    // Garis pemisah untuk daftar yang tidak berisi apa-apa hanya menambah
    // ruang mati di panel.
    const el = mount('vendor');
    const trigger = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Menu'));
    act(() => trigger?.click());

    const teks = document.body.textContent ?? '';
    expect(teks).not.toContain('Pengguna');
    expect(teks).not.toContain('Validasi');
  });
});

describe('tautan di panel tetap berupa tautan', () => {
  /**
   * `Drawer.Close` menganggap yang direndernya `<button>` secara default
   * (`nativeButton` = true). Merender `<Link>` tanpa mematikannya membuat Base
   * UI memasang semantik tombol pada tautan — konsol dev dipenuhi peringatan,
   * dan pembaca layar mengumumkan "tombol" untuk sesuatu yang sebenarnya
   * berpindah halaman.
   *
   * **Tidak diuji lewat konsol.** Peringatan Base UI hanya menyala saat
   * `NODE_ENV === 'development'`, sementara vitest berjalan di `test` — tes
   * yang menyadapnya akan selalu hijau tanpa menjaga apa pun. Yang diuji di
   * sini akibatnya yang bisa diamati: elemennya `<a>`, dan tidak memakai
   * atribut tombol yang dipasang Base UI saat ia menyangka itu tombol.
   */
  function openPanel(role: Role) {
    const el = mount(role);
    const trigger = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Menu'));
    act(() => trigger?.click());
    return el;
  }

  it('dirender sebagai <a>, bukan <button>', () => {
    openPanel('superadmin');
    const profil = document.querySelector('[href="/profil"]');
    expect(profil?.tagName).toBe('A');
  });

  it('menu berlebih juga tetap <a>', () => {
    openPanel('superadmin');
    for (const href of ['/vendors', '/users']) {
      expect(document.querySelector(`[href="${href}"]`)?.tagName, href).toBe('A');
    }
  });

  it('tidak memakai role="button" yang dipasang Base UI', () => {
    // Yang muncul saat `nativeButton` dibiarkan true pada elemen non-tombol.
    openPanel('superadmin');
    const profil = document.querySelector('[href="/profil"]');
    expect(profil?.getAttribute('role')).not.toBe('button');
  });

  it('setiap Drawer.Close yang merender tautan mematikan nativeButton', () => {
    // Penjagaan terhadap penambahan berikutnya: yang lupa menyetelnya tidak
    // akan ketahuan dari DOM, karena Base UI tetap merender `<a>` — yang
    // berubah hanya atribut dan peringatan di konsol dev.
    const src = readFileSync('components/layout/mobile-nav.tsx', 'utf8');

    // Tiap blok `<Drawer.Close ... />`, dipotong pada penutup mandiri di awal
    // baris: `/>` juga menutup elemen anak di dalamnya, jadi pola yang tidak
    // menambatkan diri akan berhenti terlalu cepat.
    const blocks = [...src.matchAll(/<Drawer\.Close[\s\S]*?\n\s*\/>/g)].map((m) => m[0]);
    const renderingLink = blocks.filter((b) => b.includes('<Link'));

    // Kalau polanya patah, `renderingLink` kosong dan perulangan di bawah tidak
    // menguji apa pun.
    expect(renderingLink.length, 'pola tidak menemukan Drawer.Close mana pun').toBeGreaterThan(0);

    for (const block of renderingLink) {
      expect(block, 'Drawer.Close merender <Link> tanpa nativeButton={false}').toContain(
        'nativeButton={false}',
      );
    }
  });
});
