// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { CheckoutBranch, CheckoutPackage } from '@/features/checkout/queries';

/**
 * Menjaga agar pesanan hanya terkirim lewat klik yang disengaja.
 *
 * Form dengan satu tombol submit akan terkirim begitu Enter ditekan di
 * sembarang `<input>`. Di langkah terakhir itu berarti order tercatat di
 * database saat pemesan sekadar mengetik — kerusakan yang tidak bisa ia
 * batalkan sendiri.
 */
const createGuestOrderAction = vi.fn(async () => ({
  ok: true as const,
  data: {
    order_number: 'IA-202608-9999',
    public_token: 'x'.repeat(32),
    total_amount: 2300000,
    status: 'new' as const,
    payment_status: 'unpaid' as const,
  },
}));

vi.mock('@/server/actions/checkout', () => ({ createGuestOrderAction }));

const { CheckoutForm } = await import('@/features/checkout/components/checkout-form');

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const PACKAGES: CheckoutPackage[] = [
  {
    id: 'a2000000-0000-4000-8000-000000000001',
    type: 'aqiqah',
    name: 'Aqiqah Ekonomi',
    slug: 'aqiqah-ekonomi',
    description: null,
    price: 2300000,
  },
];
const BRANCHES: CheckoutBranch[] = [
  { id: 'a0000000-0000-4000-8000-000000000001', name: 'Bandung', code: 'BDG' },
];

let root: Root | null = null;
let container: HTMLElement | null = null;

function mount() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(<CheckoutForm packages={PACKAGES} branches={BRANCHES} />);
  });
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} tidak ditemukan`);
  return el as T;
}

function type(id: string, value: string) {
  const el = byId<HTMLInputElement | HTMLTextAreaElement>(id);
  const proto = Object.getPrototypeOf(el);
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  act(() => {
    setter?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function clickText(label: string) {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(label));
  if (!btn) throw new Error(`tombol "${label}" tidak ditemukan`);
  act(() => btn.click());
}

/**
 * Menekan Enter, lalu melaporkan apakah aksi bawaannya dibatalkan.
 *
 * jsdom **tidak** mengimplementasikan pengiriman form implisit oleh Enter, jadi
 * "action tidak terpanggil" saja bukan bukti — itu tetap benar walau penjaganya
 * dicabut. Yang menentukan adalah `defaultPrevented`: di peramban sungguhan,
 * itulah satu-satunya hal yang menahan submit implisit.
 */
function pressEnter(id: string): { defaultPrevented: boolean } {
  const el = byId(id);
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    el.dispatchEvent(event);
  });
  return { defaultPrevented: event.defaultPrevented };
}

/** Majukan waktu semu — tombol kirim baru aktif setelah jeda anti klik-susulan. */
function advanceClock(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/**
 * Isi langkah 1 & 2 lalu berhenti di langkah 3.
 *
 * `arm: false` meniru klik yang menyusul seketika setelah "Lanjut" — jam tidak
 * dimajukan, jadi tombol kirim masih dalam jeda ragu-ragu.
 */
function goToFinalStep({ arm = true }: { arm?: boolean } = {}) {
  mount();
  type('co-behalf', 'Ananda Fulan');
  clickText('Lanjut ke');
  type('co-name', 'Budi Santoso');
  type('co-phone', '081234567890');
  clickText('Lanjut ke');
  if (arm) advanceClock(1000);
}

beforeEach(() => {
  createGuestOrderAction.mockClear();
  // Hanya timer yang dipakai penjaga; menyemukan semuanya bisa mengganggu
  // penjadwal React di jsdom.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(1_760_000_000_000);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.useRealTimers();
});

describe('pengiriman pesanan hanya lewat klik yang disengaja', () => {
  it('sampai di langkah terakhir tanpa mengirim apa pun', () => {
    goToFinalStep();

    expect(byId('co-institution')).toBeTruthy();
    expect(createGuestOrderAction).not.toHaveBeenCalled();
  });

  it('Enter di kolom instansi dibatalkan, jadi tidak mengirim pesanan', () => {
    // Inti bug yang dilaporkan: mengetik nama panti lalu menekan Enter langsung
    // mencatat order tanpa pernah menekan tombol konfirmasi.
    goToFinalStep();
    type('co-institution', 'Panti Asuhan Al-Amin');

    expect(pressEnter('co-institution').defaultPrevented).toBe(true);
    expect(createGuestOrderAction).not.toHaveBeenCalled();
  });

  it('Enter di kolom kode referral dibatalkan, jadi tidak mengirim pesanan', () => {
    goToFinalStep();
    type('co-referral', 'SA-BUDI');

    expect(pressEnter('co-referral').defaultPrevented).toBe(true);
    expect(createGuestOrderAction).not.toHaveBeenCalled();
  });

  it('Enter di catatan tidak dibatalkan — textarea butuh baris baru', () => {
    goToFinalStep();

    expect(pressEnter('co-notes').defaultPrevented).toBe(false);
  });

  it('menekan tombol konfirmasi tetap mengirim pesanan', () => {
    // Perbaikannya tidak boleh sampai memblokir jalur yang benar.
    goToFinalStep();
    clickText('Kirim Pesanan');

    expect(createGuestOrderAction).toHaveBeenCalledOnce();
  });

  it('mengirim form secara implisit tidak pernah mencatat pesanan', () => {
    // Apa pun yang memicu submit implisit — Enter, autofill, tombol yang luput
    // diberi `type` — paling jauh hanya boleh memajukan langkah.
    goToFinalStep();
    const form = document.querySelector('form')!;
    act(() => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(createGuestOrderAction).not.toHaveBeenCalled();
  });
});

describe('tombol Lanjut tidak boleh berubah jadi tombol Kirim di tempatnya', () => {
  it('klik kedua pada posisi tombol Lanjut tidak mengirim pesanan', () => {
    // Inti bug yang dilaporkan, dan versi pertama test ini SALAH: ia mengklik
    // variabel tombol lama yang sudah dilepas dari dokumen, jadi kliknya tidak
    // mendarat ke mana pun dan test lolos tanpa menguji apa pun.
    //
    // Di peramban, klik kedua mendarat pada elemen yang KINI menempati titik
    // itu — yaitu tombol "Konfirmasi & Kirim". Jadi yang harus diklik adalah
    // tombol yang sedang dirender, bukan referensi lama.
    mount();
    type('co-behalf', 'Ananda Fulan');
    clickText('Lanjut ke');
    type('co-name', 'Budi Santoso');
    type('co-phone', '081234567890');

    clickText('Lanjut ke'); // -> tiba di langkah 3
    clickText('Kirim Pesanan'); // klik susulan seketika, di titik yang sama

    expect(createGuestOrderAction).not.toHaveBeenCalled();
  });

  it('setelah jeda singkat, tombol kirim menerima klik yang disengaja', () => {
    // Penjaganya tidak boleh sampai memblokir orang yang memang mau memesan.
    goToFinalStep({ arm: false });
    advanceClock(1000);
    clickText('Kirim Pesanan');

    expect(createGuestOrderAction).toHaveBeenCalledOnce();
  });

  it('melompat ke langkah 3 lewat penunjuk langkah juga terkunci sesaat', () => {
    // Jalur pintas itu memakai `goToStep` yang sama, jadi tidak boleh jadi
    // celah yang melewati jeda.
    goToFinalStep({ arm: true });
    clickText('Data Pemesan'); // mundur ke langkah 2
    clickText('Pengiriman'); // lompat maju ke langkah 3
    clickText('Kirim Pesanan');

    expect(createGuestOrderAction).not.toHaveBeenCalled();
  });

  it('tombol kirim adalah elemen DOM baru, bukan tombol Lanjut yang didaur ulang', () => {
    mount();
    type('co-behalf', 'Ananda Fulan');
    clickText('Lanjut ke');
    type('co-name', 'Budi Santoso');
    type('co-phone', '081234567890');

    const nextBtn = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Lanjut ke'),
    )!;
    act(() => nextBtn.click());

    const submitBtn = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Kirim Pesanan'),
    )!;

    expect(submitBtn).toBeTruthy();
    expect(submitBtn).not.toBe(nextBtn);
    // Elemen lama sudah dilepas dari dokumen, jadi tidak bisa lagi menerima
    // fokus maupun klik yang menyusul.
    expect(document.contains(nextBtn)).toBe(false);
  });
});

describe('Enter di langkah awal tetap berguna', () => {
  it('Enter di kolom atas nama memajukan langkah, bukan mengirim', () => {
    mount();
    type('co-behalf', 'Ananda Fulan');
    pressEnter('co-behalf');

    expect(document.getElementById('co-name')).not.toBeNull();
    expect(createGuestOrderAction).not.toHaveBeenCalled();
  });

  it('Enter tidak memajukan langkah bila medan wajib belum sah', () => {
    mount();
    pressEnter('co-behalf');

    // Masih di langkah 1 — kolom nama pemesan belum dirender.
    expect(document.getElementById('co-name')).toBeNull();
    expect(createGuestOrderAction).not.toHaveBeenCalled();
  });
});
