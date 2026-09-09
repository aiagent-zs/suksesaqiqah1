// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { NumberInput } from '@/components/ui/number-input';

/**
 * Input angka yang tidak berubah saat halaman digulir.
 *
 * ## Kenapa berkas ini ada
 *
 * `<input type="number">` menangkap roda tetikus selama ia terfokus, dan
 * peramban menaikkan/menurunkan nilainya alih-alih menggulir halaman. Jadi
 * mengetik 100, lalu menggulir turun untuk membaca sisa formulir, diam-diam
 * mengubahnya jadi 90 — **tanpa satu pun tanda di layar**. Yang tersimpan angka
 * yang tidak pernah diketik siapa pun.
 *
 * Akibatnya nyata: jumlah paket menentukan isi laporan peserta, bobot hasil
 * ikut tercetak di situ, dan harga modal mitra menentukan margin. Ketiganya
 * diketik di formulir panjang yang memang harus digulir.
 *
 * Dua hal yang dijaga, dan yang kedua sama pentingnya:
 *
 *   1. Rodanya melepas fokus, sehingga nilainya tidak tersentuh **dan** halaman
 *      tetap bergulir.
 *   2. **Tidak ada `type="number"` polos yang tertinggal** di seluruh kode.
 *      Perbaikan yang hanya menutup medan yang kebetulan dilaporkan akan
 *      terulang di medan berikutnya yang ditambahkan orang lain.
 */
declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLElement | null = null;

function mount(onChange = vi.fn()) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(<NumberInput value="100" onChange={onChange} />);
  });
  return container.querySelector('input') as HTMLInputElement;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('roda tetikus', () => {
  it('melepas fokus, jadi nilainya tidak ikut berubah', () => {
    const input = mount();
    input.focus();
    expect(document.activeElement).toBe(input);

    act(() => {
      input.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 100 }));
    });

    // Peramban hanya mengubah nilai `type=number` selama ia terfokus. Melepas
    // fokus lebih dulu menutup jalannya.
    expect(document.activeElement).not.toBe(input);
  });

  it('tidak mencegah kejadiannya — halaman harus tetap bisa digulir', () => {
    // `preventDefault()` juga menghentikan nilai berubah, tapi sekaligus
    // mematikan gulir halaman di atas medan itu: pembaca yang rodanya kebetulan
    // di atas kotak angka merasa halamannya macet.
    const input = mount();
    input.focus();

    const wheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 100 });
    act(() => {
      input.dispatchEvent(wheel);
    });

    expect(wheel.defaultPrevented).toBe(false);
  });

  it('meneruskan onWheel milik pemanggil', () => {
    const onWheel = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(<NumberInput value="1" onChange={vi.fn()} onWheel={onWheel} />);
    });

    const input = container.querySelector('input') as HTMLInputElement;
    act(() => {
      input.dispatchEvent(new WheelEvent('wheel', { bubbles: true }));
    });

    expect(onWheel).toHaveBeenCalled();
  });
});

describe('tetap sebuah input angka', () => {
  it('bertipe number, jadi papan ketik ponsel tetap menampilkan angka', () => {
    expect(mount().type).toBe('number');
  });

  it('tombol panah papan ketik tidak disentuh', () => {
    // Menaikkan angka dengan ↑/↓ adalah tindakan yang memang disengaja
    // pengetiknya — berbeda dari roda yang terpicu saat membaca.
    const input = mount();
    input.focus();

    const key = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true });
    act(() => {
      input.dispatchEvent(key);
    });

    expect(key.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(input);
  });
});

/** Seluruh berkas `.tsx` di bawah sebuah direktori, ditelusuri rekursif. */
function tsxFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) tsxFiles(full, found);
    else if (entry.name.endsWith('.tsx')) found.push(full.replace(/\\/g, '/'));
  }
  return found;
}

describe('tidak ada yang tertinggal di seluruh kode', () => {
  // Dibaca dari filesystem, bukan `git grep`: berkas yang belum ter-commit
  // tidak terlihat oleh git, dan penjaga yang buta terhadap kode yang baru
  // ditulis persis melewatkan saat ia paling dibutuhkan.
  const files = ['features', 'app', 'components'].flatMap((d) => tsxFiles(d));

  it('memindai berkas dalam jumlah yang masuk akal', () => {
    // Kalau penelusurannya patah, tes di bawah hijau tanpa menjaga apa pun.
    expect(files.length).toBeGreaterThan(50);
  });

  it('tidak ada `type="number"` polos di komponen mana pun', () => {
    // Penjaga sesungguhnya. Tanpa ini, medan angka berikutnya yang ditambahkan
    // orang lain akan mengulang bug yang sama tanpa ada yang tahu.
    const offenders = files.filter((f) => {
      // `number-input.tsx` memang tempatnya; `currency-input.tsx` hanya
      // menyebutnya di dalam komentar yang menerangkan kenapa TIDAK memakainya.
      if (f.endsWith('components/ui/number-input.tsx')) return false;
      if (f.endsWith('components/ui/currency-input.tsx')) return false;

      const src = readFileSync(f, 'utf8');
      if (!src.includes('type="number"')) return false;

      // Prop `type` yang diteruskan ke komponen `Field` lokal, bukan atribut
      // HTML — `Field`-nya sendiri sudah mengarahkannya ke `NumberInput`.
      return !src.includes("type === 'number' ? NumberInput : Input");
    });

    expect(offenders, `masih memakai type="number" polos:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('NumberInput dipakai di berkas yang dulu memakai type="number"', () => {
    const panel = readFileSync('features/stages/components/stage-panel.tsx', 'utf8');
    expect(panel).toContain('NumberInput');
  });
});
