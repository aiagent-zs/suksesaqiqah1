// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

/**
 * Tombol centang di panel "Perlu Tindakan".
 *
 * ## Kenapa berkas ini ada
 *
 * Menekannya menandai baris selesai lalu memuat ulang panel — dan barisnya
 * **lenyap** dari layar. Selama jeda antara klik dan hilangnya baris itu,
 * tombolnya dulu hanya mati tanpa berkata apa-apa.
 *
 * Pada panel yang barisnya memang akan hilang, diam itu lebih menyesatkan
 * daripada di tempat lain: admin tidak bisa membedakan "sedang diproses" dari
 * "kliknya tidak masuk", dan yang ragu menekannya lagi — menerbitkan
 * permintaan kedua untuk baris yang sudah ditandai.
 *
 * "Kirim WA" ikut dijaga karena ia memanggil `markSent` yang sama.
 */
const markNotificationSent = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/server/actions/notifications', () => ({
  markNotificationSent: (...a: unknown[]) => markNotificationSent(...a),
}));

const { AlertActions } = await import('@/features/notifications/components/alert-actions');

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLElement | null = null;

function mount(waHref: string | null = 'https://wa.me/62812') {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<AlertActions id="n1" waHref={waHref} />));
  return container;
}

const checkButton = (el: HTMLElement) =>
  el.querySelector('button[aria-label="Tandai sudah ditangani"]') as HTMLButtonElement;

beforeEach(() => {
  markNotificationSent.mockReset();
  markNotificationSent.mockResolvedValue({ ok: true, data: null });
  refresh.mockReset();
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('saat diam', () => {
  it('menampilkan centang, bukan spinner', () => {
    const el = mount();
    expect(el.querySelector('.lucide-check')).not.toBeNull();
    expect(el.querySelector('.lucide-loader-circle')).toBeNull();
  });

  it('tombolnya bisa ditekan', () => {
    expect(checkButton(mount()).disabled).toBe(false);
  });
});

describe('selagi menandai', () => {
  /** Aksi yang menggantung — jendela waktu yang justru sedang diuji. */
  function mountPending() {
    markNotificationSent.mockReturnValue(new Promise(() => {}));
    const el = mount();
    act(() => checkButton(el).click());
    return el;
  }

  it('centangnya berganti spinner', () => {
    const el = mountPending();
    expect(el.querySelector('.lucide-loader-circle')).not.toBeNull();
    // Menggantikan, bukan menumpuk: kotaknya 32px dan tidak muat keduanya.
    expect(el.querySelector('.lucide-check')).toBeNull();
  });

  it('menolak klik kedua', () => {
    const el = mountPending();
    expect(checkButton(el).disabled).toBe(true);

    act(() => checkButton(el).click());
    expect(markNotificationSent).toHaveBeenCalledTimes(1);
  });

  it('mengumumkan dirinya sedang sibuk', () => {
    // Tanpa `aria-busy`, pembaca layar hanya mendengar tombolnya tidak aktif —
    // tanpa alasannya.
    expect(checkButton(mountPending()).getAttribute('aria-busy')).toBe('true');
  });

  it('tombol Kirim WA ikut meredup', () => {
    // Ia memanggil `markSent` yang sama; menekannya lagi menerbitkan
    // permintaan kedua untuk baris yang sudah ditandai.
    const el = mountPending();
    const wa = el.querySelector('a[href^="https://wa.me"]');
    expect(wa?.getAttribute('aria-busy')).toBe('true');
  });

  it('tautan WA tetap bisa ditekan', () => {
    // Membukanya ke WhatsApp adalah pekerjaan yang sedang dikerjakan admin —
    // menahannya justru menghalangi.
    const el = mountPending();
    const wa = el.querySelector('a[href^="https://wa.me"]') as HTMLAnchorElement;
    expect(wa.getAttribute('href')).toBe('https://wa.me/62812');
  });

  it('memakai kelas gerak terpusat, bukan animasi sendiri', () => {
    // `animate-working` menunda 120ms di `globals.css` — penandaan yang selesai
    // sekejap tidak menampilkan apa pun. Yang berkedip sekejap lebih gelisah
    // daripada diam.
    const el = mountPending();
    expect(el.querySelector('.lucide-loader-circle')?.getAttribute('class')).toContain(
      'animate-working',
    );
  });
});

describe('baris tanpa nomor WhatsApp', () => {
  it('tetap punya tombol centang', () => {
    // `waHref` null saat nomornya tidak bisa dinormalkan; barisnya tetap harus
    // bisa ditandai selesai.
    const el = mount(null);
    expect(checkButton(el)).not.toBeNull();
    expect(el.querySelector('a[href^="https://wa.me"]')).toBeNull();
  });
});
