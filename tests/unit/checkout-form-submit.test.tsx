// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { CheckoutBranch, CheckoutPackage, NasiBoxPackage } from '@/features/checkout/queries';

/**
 * Menjaga agar pesanan hanya terkirim lewat klik yang disengaja, dan agar alur
 * enam tahapnya tetap utuh.
 */
// Tanda tangannya dinyatakan lewat parameter tipe `vi.fn` supaya
// `mock.calls[0][0]` bisa diperiksa.
type Action = (input: unknown) => Promise<{
  ok: true;
  data: {
    order_number: string;
    public_token: string;
    total_amount: number;
    status: 'new';
    payment_status: 'unpaid';
  };
}>;

const createGuestOrderAction = vi.fn<Action>(async () => ({
  ok: true,
  data: {
    order_number: 'IA-202608-9999',
    public_token: 'x'.repeat(32),
    total_amount: 2300000,
    status: 'new',
    payment_status: 'unpaid',
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
const NASI_BOXES: NasiBoxPackage[] = [
  { id: 'a2000000-0000-4000-8000-000000000011', name: 'Paket A', slug: 'paket-a', price: 21000 },
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
    root!.render(<CheckoutForm packages={PACKAGES} nasiBoxes={NASI_BOXES} branches={BRANCHES} />);
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
 * jsdom tidak mengimplementasikan pengiriman form implisit, jadi "action tidak
 * terpanggil" saja bukan bukti. Yang menentukan `defaultPrevented`.
 */
function pressEnter(id: string): { defaultPrevented: boolean } {
  const el = byId(id);
  const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  act(() => {
    el.dispatchEvent(event);
  });
  return { defaultPrevented: event.defaultPrevented };
}

function advanceClock(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** Lewati tahap 1-5 dengan isian sah, lalu berhenti di tahap 6 (Ringkasan). */
function goToFinalStep({ arm = true }: { arm?: boolean } = {}) {
  mount();
  clickText('Anak Laki-laki'); // 1 · Aqiqah untuk
  clickText('Lanjut ke');
  clickText('Lanjut ke'); // 2 · Paket (sudah terpilih otomatis)
  clickText('Lanjut ke'); // 3 · Nasi box — default "Tidak pakai"
  clickText('Aqiqah Salur'); // 4 · Penyaluran
  clickText('Lanjut ke');
  type('co-name', 'Budi Santoso'); // 5 · Data pemesan
  type('co-phone', '081234567890');
  type('co-email', 'budi@example.com');
  type('co-child', 'Fatih');
  clickText('Lanjut ke');
  if (arm) advanceClock(1000);
}

beforeEach(() => {
  createGuestOrderAction.mockClear();
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

describe('alur enam tahap', () => {
  it('tahap 1 menanyakan aqiqah untuk siapa', () => {
    mount();

    expect(document.body.textContent).toContain('Anak Laki-laki');
    expect(document.body.textContent).toContain('Anak Perempuan');
  });

  it('tidak bisa maju sebelum memilih jenis kelamin', () => {
    mount();
    clickText('Lanjut ke');

    // Masih di tahap 1 — kartu paket belum dirender.
    expect(document.body.textContent).toContain('Aqiqah untuk siapa');
  });

  it('memilih anak laki-laki menganjurkan 2 ekor, perempuan 1 ekor', () => {
    mount();
    clickText('Anak Laki-laki');
    clickText('Lanjut ke');
    expect(document.body.textContent).toContain('Anjuran untuk anak laki-laki: 2 ekor');

    clickText('Kembali');
    clickText('Anak Perempuan');
    clickText('Lanjut ke');
    expect(document.body.textContent).toContain('Anjuran untuk anak perempuan: 1 ekor');
  });

  it('nasi box boleh dilewati lewat "Tidak pakai"', () => {
    mount();
    clickText('Anak Laki-laki');
    clickText('Lanjut ke');
    clickText('Lanjut ke');

    expect(document.body.textContent).toContain('Tidak pakai');
    // Tidak memilih apa pun tetap boleh lanjut.
    clickText('Lanjut ke');
    expect(document.body.textContent).toContain('Cara Penyaluran');
  });

  it('Aqiqah Kirim memunculkan alamat dan mewajibkannya', () => {
    mount();
    clickText('Anak Laki-laki');
    clickText('Lanjut ke');
    clickText('Lanjut ke');
    clickText('Lanjut ke');
    clickText('Aqiqah Kirim');

    expect(document.getElementById('co-delivery')).not.toBeNull();

    clickText('Lanjut ke'); // alamat masih kosong
    expect(document.body.textContent).toContain('Alamat pengiriman wajib diisi');
  });

  it('Aqiqah Salur tidak meminta alamat', () => {
    mount();
    clickText('Anak Laki-laki');
    clickText('Lanjut ke');
    clickText('Lanjut ke');
    clickText('Lanjut ke');
    clickText('Aqiqah Salur');

    expect(document.getElementById('co-delivery')).toBeNull();
  });

  it('tahap 6 menampilkan ringkasan sebelum konfirmasi', () => {
    goToFinalStep();
    const text = document.body.textContent ?? '';

    expect(text).toContain('Rincian Pesanan');
    expect(text).toContain('Anak Laki-laki');
    expect(text).toContain('Fatih');
    expect(text).toContain('Aqiqah Salur');
    expect(text).toContain('Budi Santoso');
    expect(text).toContain('Total Tagihan');
  });
});

describe('pengiriman pesanan hanya lewat klik yang disengaja', () => {
  it('sampai di tahap akhir tanpa mengirim apa pun', () => {
    goToFinalStep();

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

  it('mengirim form secara implisit tidak pernah mencatat pesanan', () => {
    goToFinalStep();
    const form = document.querySelector('form')!;
    act(() => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(createGuestOrderAction).not.toHaveBeenCalled();
  });

  it('klik susulan seketika di posisi tombol Lanjut tidak mengirim pesanan', () => {
    goToFinalStep({ arm: false });
    clickText('Kirim Pesanan');

    expect(createGuestOrderAction).not.toHaveBeenCalled();
  });

  it('setelah jeda singkat, tombol kirim menerima klik yang disengaja', () => {
    goToFinalStep({ arm: false });
    advanceClock(1000);
    clickText('Kirim Pesanan');

    expect(createGuestOrderAction).toHaveBeenCalledOnce();
  });

  it('payload memuat medan tahap baru', () => {
    goToFinalStep();
    clickText('Kirim Pesanan');

    const payload = createGuestOrderAction.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(payload.aqiqah_for).toBe('laki_laki');
    expect(payload.distribution_mode).toBe('salur');
    expect(payload.child_name).toBe('Fatih');
    expect(payload.email).toBe('budi@example.com');
  });
});
