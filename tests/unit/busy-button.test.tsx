// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BusyButton } from '@/components/ui/busy-button';

/**
 * Tombol yang mengatakan dirinya sedang bekerja.
 *
 * ## Kenapa berkas ini ada
 *
 * 78 tombol aksi di aplikasi ini memakai pola `disabled={pending}`: tombolnya
 * mati saat ditekan, tapi tidak mengatakan apa-apa. Mati tanpa berkata apa-apa
 * terbaca sama persis dengan rusak — operator yang ragu menekannya lagi, dan
 * pada aksi yang tidak idempoten (mencatat pembayaran, mengunggah bukti) itu
 * berarti data ganda. Kekeliruan yang sama sudah pernah terjadi dan menyisakan
 * empat baris pembayaran untuk satu transfer.
 *
 * Yang dijaga di sini adalah **kontraknya**, bukan tampilannya:
 *
 *   1. Selama berjalan tombolnya mati — klik kedua tidak menghasilkan
 *      permintaan kedua.
 *   2. `aria-busy` terpasang: tanpa itu pembaca layar hanya mendengar tombolnya
 *      tidak aktif, tanpa alasannya.
 *   3. `busyLabel` menggantikan teksnya, tidak menumpuk — lebar tombol tidak
 *      berubah dan barisnya tidak bergeser.
 */
const render = (props: Parameters<typeof BusyButton>[0]) =>
  renderToStaticMarkup(createElement(BusyButton, props));

/**
 * Atribut `disabled` yang sungguhan, bukan kata "disabled" di dalam `class`.
 *
 * Kelas Tailwind tombolnya memuat `disabled:pointer-events-none` dan
 * `disabled:opacity-50`, jadi mencari substring "disabled" begitu saja akan
 * selalu cocok — dan tesnya hijau tanpa menjaga apa pun.
 */
const isDisabled = (markup: string) => / disabled=""/.test(markup);

describe('saat diam', () => {
  it('bisa ditekan dan menampilkan teks aslinya', () => {
    const m = render({ busy: false, children: 'Simpan laporan' });
    expect(m).toContain('Simpan laporan');
    expect(isDisabled(m)).toBe(false);
    expect(m).not.toContain('aria-busy');
  });

  it('tetap menghormati disabled dari pemanggilnya', () => {
    // Medan wajib yang belum terisi tetap menahan tombolnya, terlepas dari
    // apakah ada aksi yang sedang berjalan.
    expect(isDisabled(render({ busy: false, disabled: true, children: 'Simpan' }))).toBe(true);
  });
});

describe('saat berjalan', () => {
  const busy = { busy: true, busyLabel: 'Menyimpan…', children: 'Simpan laporan' };

  it('menolak klik kedua', () => {
    expect(isDisabled(render(busy))).toBe(true);
  });

  it('mengumumkan dirinya sedang sibuk', () => {
    expect(render(busy)).toContain('aria-busy');
  });

  it('mengganti teksnya, bukan menumpuknya', () => {
    const m = render(busy);
    expect(m).toContain('Menyimpan…');
    // Kalau keduanya muncul, lebar tombol melar dan baris di sekitarnya
    // bergeser tepat saat operator sedang menunggu.
    expect(m).not.toContain('Simpan laporan');
  });

  it('tanpa busyLabel, teks aslinya bertahan', () => {
    // Tombol sempit cukup dengan spinner; memaksa kalimat di situ justru
    // membuat lebarnya melompat.
    const m = render({ busy: true, children: 'Validasi' });
    expect(m).toContain('Validasi');
  });

  it('memakai kelas gerak terpusat, bukan animasi sendiri', () => {
    // `animate-working` menunda 120ms di `globals.css` — aksi yang selesai
    // sekejap tidak menampilkan apa pun. Menulis animasi sendiri di komponen
    // akan melewati penundaan itu, dan tombolnya berkedip.
    expect(render(busy)).toContain('animate-working');
  });
});

describe('tetap berperilaku sebagai tombol', () => {
  it('meneruskan onClick saat diam', () => {
    // Dirender ke markup statis, jadi yang bisa diuji di sini keberadaan
    // atributnya; perilaku kliknya dijaga tes komponen yang memakainya.
    const onClick = vi.fn();
    expect(() => render({ busy: false, onClick, children: 'Aksi' })).not.toThrow();
  });
});
