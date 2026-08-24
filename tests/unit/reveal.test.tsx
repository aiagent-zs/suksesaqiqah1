// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

/**
 * Gerakan reveal yang mengikuti arah gulir.
 *
 * Yang dijaga di sini justru hal yang paling mudah patah tanpa terlihat: elemen
 * harus tampil **lagi** saat digulir balik (versi sebelumnya memanggil
 * `unobserve` sehingga hanya sekali seumur halaman), dan arah gerakannya harus
 * melawan arah gulir — sebab gerakan yang searah dorongan tangan itulah yang
 * terbaca kaku.
 */

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** Callback observer yang sedang aktif, supaya tes bisa memicunya sendiri. */
let observerCb: ((entries: unknown[]) => void) | null = null;
const unobserved: Element[] = [];

class StubObserver {
  constructor(cb: (entries: unknown[]) => void) {
    observerCb = cb;
  }
  observe() {}
  unobserve(el: Element) {
    unobserved.push(el);
  }
  disconnect() {}
}

vi.stubGlobal('IntersectionObserver', StubObserver);

/**
 * Diimpor ulang tiap tes.
 *
 * `Reveal` menyimpan arah gulir & `lastY` sebagai state modul — satu listener
 * dipakai bersama oleh seluruh instance, yang di halaman sungguhan justru yang
 * diinginkan (40+ `Reveal` tidak perlu 40 listener). Tapi di sini state itu
 * bocor antar kasus uji: posisi gulir akhir satu tes jadi titik awal tes
 * berikutnya, dan ambang 4px menilai selisih terhadap angka yang salah.
 */
let Reveal: typeof import('@/components/site/Reveal').Reveal;

let root: Root | null = null;
let container: HTMLElement | null = null;

function mount() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(<Reveal>isi</Reveal>);
  });
  return container.firstElementChild as HTMLElement;
}

/** Gulir ke posisi Y, lalu biarkan listener `scroll` menghitung arahnya. */
function scrollTo(y: number) {
  window.scrollY = y;
  act(() => {
    window.dispatchEvent(new Event('scroll'));
  });
}

/** Elemen masuk / lepas dari layar. */
function intersect(el: HTMLElement, visible: boolean) {
  act(() => {
    observerCb?.([
      { target: el, isIntersecting: visible, intersectionRatio: visible ? 1 : 0 },
    ]);
  });
}

beforeEach(async () => {
  observerCb = null;
  unobserved.length = 0;
  Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
  vi.resetModules();
  ({ Reveal } = await import('@/components/site/Reveal'));
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('Reveal — gerakan mengikuti arah gulir', () => {
  it('menggulir turun: elemen datang dari bawah', () => {
    const el = mount();
    scrollTo(500);
    intersect(el, true);

    expect(el.dataset.reveal).toBe('shown');
    // Tanpa penanda `from` berarti arah bawaan — dari bawah.
    expect(el.dataset.revealFrom).toBe('down');
  });

  it('menggulir naik: elemen datang dari atas', () => {
    const el = mount();
    scrollTo(800);
    intersect(el, false);
    scrollTo(200); // berbalik arah
    intersect(el, true);

    expect(el.dataset.reveal).toBe('shown');
    expect(el.dataset.revealFrom).toBe('up');
  });

  it('tampil LAGI setelah lepas dari layar dan kembali', () => {
    // Ini inti keluhannya: versi sebelumnya memanggil `unobserve` begitu elemen
    // tampil, jadi menggulir balik menampilkan halaman yang sepenuhnya diam.
    const el = mount();
    scrollTo(500);
    intersect(el, true);
    expect(el.dataset.reveal).toBe('shown');

    intersect(el, false);
    expect(el.dataset.reveal, 'status tidak di-reset saat lepas layar').toBe('');

    scrollTo(900);
    intersect(el, true);
    expect(el.dataset.reveal).toBe('shown');
    expect(unobserved, 'elemen tidak boleh berhenti diamati').toHaveLength(0);
  });

  it('tidak menyentuh status selama elemen masih terlihat sebagian', () => {
    // Menggoyang layar sedikit di sekitar batas tidak boleh memicu apa pun —
    // itulah kegelisahan yang dulu dihindari dengan `unobserve`.
    const el = mount();
    scrollTo(500);
    intersect(el, true);

    act(() => {
      observerCb?.([{ target: el, isIntersecting: false, intersectionRatio: 0.4 }]);
    });
    expect(el.dataset.reveal, 'ter-reset padahal masih terlihat').toBe('shown');
  });

  it('mengabaikan getaran gulir di bawah 4px', () => {
    // Gulir inersia di ponsel menghasilkan pergerakan 1-2px saat hampir
    // berhenti; tanpa ambang, arahnya berbalik-balik di detik terakhir.
    const el = mount();
    scrollTo(500);
    intersect(el, false);
    expect(el.dataset.reveal).toBe('');

    scrollTo(498); // naik 2px — di bawah ambang, harus diabaikan
    intersect(el, true);

    expect(el.dataset.revealFrom, 'arah berbalik karena getaran kecil').toBe('down');
  });
});
