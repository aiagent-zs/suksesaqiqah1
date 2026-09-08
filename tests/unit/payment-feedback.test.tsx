// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { PaymentSummary } from '@/features/payments/queries';

/**
 * Umpan balik panel pembayaran.
 *
 * ## Kenapa berkas ini ada
 *
 * Mencatat pembayaran **tidak mengatakan apa pun saat berhasil**: formnya
 * tertutup, `router.refresh()` memuat ulang data, dan tidak ada satu pun tanda
 * bahwa sesuatu terjadi. Yang tertangkap operator hanya form yang menghilang —
 * sama persis dengan tampilan gagal-diam.
 *
 * Itu keliru justru karena senyap, dan `recordPayment` **tidak idempoten**: yang
 * ragu akan menyimpan ulang, dan hasilnya dua baris pembayaran untuk satu
 * transfer yang sama. Angka itu ikut menentukan gate DP.
 *
 * Galat tetap ditulis di panel, bukan hanya di toast: toast hilang sendiri
 * setelah 5 detik, jadi ia tidak boleh jadi satu-satunya tempat alasan
 * kegagalan terbaca.
 */
const recordPayment = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/server/actions/payments', () => ({
  recordPayment: (...args: unknown[]) => recordPayment(...args),
  verifyPayment: vi.fn(),
  deletePayment: vi.fn(),
}));
// Panel mengunggah bukti langsung ke Storage sebelum memanggil action; tanpa
// berkas terpilih jalur itu dilewati, jadi klien ini tidak pernah terpakai di
// sini — tetapi impornya tetap harus diselesaikan.
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ storage: {} }) }));

const { PaymentManager } = await import('@/features/payments/components/payment-manager');

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLElement | null = null;

function summary(): PaymentSummary {
  return {
    payments: [],
    verifiedTotal: 0,
    pendingTotal: 0,
    pendingCount: 0,
  } as PaymentSummary;
}

function mount() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      <PaymentManager
        orderId="o1"
        orderNumber="IA-202609-0001"
        summary={summary()}
        totalAmount={2_800_000}
        paidAmount={0}
        minDpRatio={0.5}
        canRecord
        canVerify
      />,
    );
  });
  return container;
}

/** Buka form, isi nominal, lalu tekan Simpan. */
async function submitAmount(el: HTMLElement, amount: string) {
  const buttons = () => [...el.querySelectorAll('button')];
  const byText = (t: string) => buttons().find((b) => b.textContent?.includes(t));

  act(() => byText('Catat pembayaran')?.click());

  const input = el.querySelector('#pay-amount') as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(input, amount);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  await act(async () => {
    byText('Simpan pembayaran')?.click();
  });
}

beforeEach(() => {
  recordPayment.mockReset();
  refresh.mockReset();
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('pencatatan berhasil', () => {
  it('mengatakan bahwa pembayaran tercatat', async () => {
    recordPayment.mockResolvedValue({ ok: true, data: { id: 'p1' } });

    const el = mount();
    await submitAmount(el, '1400000');

    // Inti bug-nya: sebelum ini tidak ada satu pun tanda keberhasilan.
    expect(document.body.textContent).toContain('Pembayaran tercatat');
    expect(refresh).toHaveBeenCalled();
  });
});

describe('pencatatan gagal', () => {
  it('menampilkan alasannya, bukan diam', async () => {
    recordPayment.mockResolvedValue({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Nominal melebihi sisa tagihan.' },
    });

    const el = mount();
    await submitAmount(el, '9999999');

    expect(el.textContent).toContain('Nominal melebihi sisa tagihan.');
    // Gagal tidak boleh memuat ulang: form-nya harus tetap terisi supaya
    // angkanya bisa dibetulkan, bukan diketik ulang dari nol.
    expect(refresh).not.toHaveBeenCalled();
  });

  it('menuliskan galat di panel, bukan hanya di toast', async () => {
    // Toast hilang sendiri setelah 5 detik. Kalau ia satu-satunya tempat
    // alasannya terbaca, operator yang berkedip pada saat yang salah kehilangan
    // seluruh keterangannya.
    recordPayment.mockResolvedValue({
      ok: false,
      error: { code: 'INTERNAL', message: 'Gagal mencatat pembayaran.' },
    });

    const el = mount();
    await submitAmount(el, '1400000');

    const inPanel = el.querySelector('.text-destructive');
    expect(inPanel?.textContent).toContain('Gagal mencatat pembayaran.');
  });
});
