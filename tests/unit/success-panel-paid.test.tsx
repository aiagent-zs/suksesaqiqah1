// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

/**
 * Panel sukses checkout berganti sendiri begitu pembayaran lunas.
 *
 * Halaman bayar Durianpay berakhir di halaman suksesnya sendiri tanpa jalan
 * kembali, jadi tab pesanan inilah satu-satunya tempat pemesan diberi tahu.
 */
const getPaymentStatus = vi.fn();
vi.mock('@/server/actions/payment-status', () => ({
  getPaymentStatus: (...a: unknown[]) => getPaymentStatus(...a),
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/checkout' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { SuccessPanel } = await import('@/features/checkout/components/steps/success-panel');

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  getPaymentStatus.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

const render = (paymentUrl: string | null) =>
  act(() =>
    root.render(
      <SuccessPanel
        orderNumber="IA-202611-0001"
        total={2_300_000}
        paymentUrl={paymentUrl}
        phone="0812-3456-7890"
        waHref="https://wa.me/"
      />,
    ),
  );

describe('panel sukses checkout', () => {
  it('berganti ke "Pembayaran ... diterima" begitu status lunas', async () => {
    getPaymentStatus.mockResolvedValueOnce('unpaid').mockResolvedValue('paid');
    render('https://links.durianpay.id/payment/x');
    expect(host.textContent).toContain('Bayar Sekarang');

    await act(async () => vi.advanceTimersByTimeAsync(5_000));
    expect(host.textContent).toContain('Menunggu pembayaran');

    await act(async () => vi.advanceTimersByTimeAsync(5_000));
    expect(host.textContent).toContain('Pembayaran Anda sudah kami terima');
    expect(host.textContent).not.toContain('Bayar Sekarang');
    // Kunci yang dipakai sama dengan halaman Lacak: 4 digit akhir HP.
    expect(getPaymentStatus).toHaveBeenCalledWith('IA-202611-0001', '7890');
  });

  it('tidak bertanya apa pun bila tidak ada tautan bayar', async () => {
    render(null);
    await act(async () => vi.advanceTimersByTimeAsync(20_000));
    expect(getPaymentStatus).not.toHaveBeenCalled();
  });
});
