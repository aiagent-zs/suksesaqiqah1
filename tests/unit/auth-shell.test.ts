import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, sep } from 'node:path';

/**
 * Halaman masuk, lupa sandi, dan atur sandi memakai satu kerangka.
 *
 * ## Kenapa berkas ini ada
 *
 * Ketiganya bagian dari satu perjalanan — gagal masuk, minta tautan, buat sandi
 * baru, masuk kembali. Berpindah di antaranya tidak boleh terasa seperti
 * berpindah aplikasi, dan itu persis yang terjadi saat `/lupa-sandi` ditulis
 * dengan latar serta kartunya sendiri: warnanya mirip, tapi logo, gradien, dan
 * lebar kartunya berbeda.
 *
 * Yang dijaga bukan tampilannya, melainkan **sumbernya satu**. Selama tiap
 * halaman menyusun kerangkanya sendiri, perbedaan akan muncul lagi tanpa ada
 * yang sengaja membuatnya: satu halaman diubah, dua lainnya tertinggal, dan
 * tidak ada yang gagal.
 */
const AUTH_DIR = 'app/(auth)';
const SHELL = readFileSync(join(AUTH_DIR, 'auth-shell.tsx'), 'utf8');

/** Tiap `page.tsx` di bawah `app/(auth)`. */
function authPages(dir: string = AUTH_DIR, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) authPages(full, found);
    else if (entry.name === 'page.tsx') found.push(full.split(sep).join('/'));
  }
  return found;
}

const pages = authPages();

describe('penemuannya sendiri harus bekerja', () => {
  it('menemukan ketiga halaman', () => {
    // Kalau penelusurannya patah, tes di bawah hijau tanpa menjaga apa pun.
    expect(pages.length).toBeGreaterThanOrEqual(3);
    for (const nama of ['login', 'lupa-sandi', 'atur-sandi']) {
      expect(
        pages.some((p) => p.includes(nama)),
        `halaman ${nama} tidak ditemukan`,
      ).toBe(true);
    }
  });
});

describe('kerangkanya satu, bukan disalin', () => {
  it.each(pages)('%s memakai AuthShell', (page) => {
    expect(readFileSync(page, 'utf8')).toContain('AuthShell');
  });

  it.each(pages)('%s tidak menyusun latarnya sendiri', (page) => {
    // Gradien latar hanya boleh hidup di satu tempat. Halaman yang
    // menuliskannya sendiri akan menyimpang begitu yang lain diubah.
    const src = readFileSync(page, 'utf8');
    expect(src).not.toContain('radial-gradient');
    expect(src).not.toContain('min-h-screen');
    expect(src).not.toContain('min-h-dvh');
  });

  it.each(pages)('%s tidak memasang logonya sendiri', (page) => {
    expect(readFileSync(page, 'utf8')).not.toContain('logo_new.webp');
  });
});

describe('kelas medan isian dibagi bersama', () => {
  const forms = [
    'app/(auth)/login/page.tsx',
    'app/(auth)/lupa-sandi/forgot-password-form.tsx',
    'app/(auth)/atur-sandi/reset-form.tsx',
  ];

  it('kerangka mengekspornya', () => {
    expect(SHELL).toContain('export const AUTH_FIELD_CLASS');
  });

  it.each(forms)('%s memakainya, bukan salinannya sendiri', (file) => {
    const src = readFileSync(file, 'utf8');
    expect(src).toContain('AUTH_FIELD_CLASS');
    // Warna medan yang ditulis ulang adalah cara termudah membuat satu
    // halaman terlihat berbeda tanpa ada yang sadar.
    expect(src).not.toMatch(/const FIELD_CLASS =/);
  });
});
