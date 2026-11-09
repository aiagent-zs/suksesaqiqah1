// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { CateringPackage } from '@/features/catering/queries';

/**
 * Bagian Pesanan checkout katering: jenis katering jadi tab, paket jadi baris.
 *
 * Sebelumnya ketiga jenis ditumpuk sebagai kartu, dan pemesan harus menggulir
 * melewati semuanya untuk sampai ke jenis yang dicari.
 */
vi.mock('@/server/actions/catering', () => ({ createCateringOrderAction: vi.fn() }));
vi.mock('@/features/checkout/regions', () => ({ fetchRegionChildren: vi.fn(async () => []) }));

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const pkg = (n: number, type: CateringPackage['type'], name: string): CateringPackage => ({
  id: `c3000000-0000-4000-8000-00000000000${n}`,
  type,
  name,
  slug: name.toLowerCase().replace(/ /g, '-'),
  description: null,
  price: 25000,
  items: ['Nasi', 'Lauk'],
});

const PACKAGES = [
  pkg(1, 'katering_ayam', 'Ayam Bakar'),
  pkg(2, 'katering_ayam', 'Ayam Goreng'),
  pkg(3, 'katering_daging', 'Rendang'),
  pkg(4, 'katering_kebuli', 'Nasi Kebuli'),
];

let root: Root | null = null;
let container: HTMLElement | null = null;

async function mount(initialServiceId?: string) {
  const { CateringForm } = await import('@/features/catering/components/catering-form');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      <CateringForm
        packages={PACKAGES}
        provinces={[]}
        minDate="2026-11-01"
        maxDate="2026-12-01"
        initialServiceId={initialServiceId}
      />,
    );
  });
}

const tabs = () => [...container!.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
const tab = (label: string) => tabs().find((t) => t.textContent?.startsWith(label))!;
const rows = () =>
  [...container!.querySelectorAll('[role="tabpanel"] li label')].map((l) => l.textContent);

beforeEach(() => {
  vi.resetModules();
  window.sessionStorage.clear();
  window.scrollTo = vi.fn();
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

// Impor pertama form ini lambat (seluruh pohon checkout ikut ter-transform).
describe('pemilih paket katering', { timeout: 30_000 }, () => {
  it('jenis katering tampil sebagai tab, hanya satu jenis terlihat', async () => {
    await mount();
    expect(tabs().map((t) => t.textContent)).toEqual(['Ayam', 'Daging', 'Kebuli']);
    expect(tab('Ayam').getAttribute('aria-selected')).toBe('true');
    expect(rows()).toEqual(['Ayam Bakar', 'Ayam Goreng']);

    act(() => tab('Daging').click());
    expect(rows()).toEqual(['Rendang']);
  });

  it('kartu paket hanya disorot setelah diberi jumlah', async () => {
    // Sorotan menandai keadaan nyata (paket ini ikut dipesan), bukan hiasan:
    // paket yang belum diberi jumlah tetap netral.
    await mount();
    const row = () => container!.querySelector('[role="tabpanel"] li')!;
    expect(row().className).not.toMatch(/border-primary/);

    act(() =>
      container!
        .querySelector<HTMLButtonElement>('[aria-label="Tambah 10 box Ayam Bakar"]')!
        .click(),
    );
    expect(row().className).toMatch(/border-primary/);
  });

  it('paket dari halaman depan membuka tab jenisnya', async () => {
    await mount(PACKAGES[3].id);
    expect(tab('Kebuli').getAttribute('aria-selected')).toBe('true');
    expect(rows()).toEqual(['Nasi Kebuli']);
  });

  it('jumlah box tetap tersimpan saat pindah tab, dan tab menandai pilihannya', async () => {
    await mount();
    const plus = container!.querySelector<HTMLButtonElement>(
      '[aria-label="Tambah 10 box Ayam Bakar"]',
    )!;
    act(() => plus.click());

    act(() => tab('Kebuli').click());
    act(() => tab('Ayam').click());
    expect(container!.querySelector<HTMLInputElement>(`#kt-qty-${PACKAGES[0].id}`)!.value).toBe(
      '10',
    );
    expect(tab('Ayam').textContent).toContain('1 paket dipilih');
    expect(container!.textContent).toContain('10 box dari 1 paket');
  });

  it('jumlah pecahan ditolak dan tidak ikut dihitung', async () => {
    await mount();
    const input = container!.querySelector<HTMLInputElement>(`#kt-qty-${PACKAGES[0].id}`)!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => {
      setter.call(input, '2.5');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container!.textContent).toContain('Jumlah box harus bilangan bulat');
    const send = [...container!.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Kirim Pesanan'),
    )!;
    act(() => send.click());
    expect(container!.textContent).toContain('Ayam Bakar: Jumlah box harus bilangan bulat');
  });

  it('satu kali kirim menyebut seluruh isian yang kurang', async () => {
    // Wizard dicabut 9 November: dulu yang kurang muncul langkah demi langkah.
    await mount();
    act(() =>
      container!
        .querySelector<HTMLButtonElement>('[aria-label="Tambah 10 box Ayam Bakar"]')!
        .click(),
    );
    const send = [...container!.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Kirim Pesanan'),
    )!;
    act(() => send.click());
    const text = container!.textContent ?? '';
    expect(text).toContain('Pilih tanggal pengiriman');
    expect(text).toContain('Pilih provinsi tujuan');
    expect(text).toContain('Nama pemesan wajib diisi');
    expect(container!.querySelector('[aria-current="step"]')).toBeNull();
  });

  it('tombol kirim ada di bar yang menempel di bawah, bertipe button', async () => {
    await mount();
    const send = [...container!.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Kirim Pesanan'),
    )!;
    expect(send.type).toBe('button');
    expect(send.parentElement!.className).toMatch(/sticky bottom-0/);
  });
});
