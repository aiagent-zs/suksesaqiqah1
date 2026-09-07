// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { KpiCards } from '@/features/dashboard/components/kpi-cards';
import type { KpiSummary } from '@/features/dashboard/summary';

/**
 * Pita KPI dashboard.
 *
 * Yang dijaga di sini bukan tata letaknya — itu pekerjaan mata — melainkan tiga
 * hal yang diam-diam menyesatkan kalau patah:
 *
 *   1. **Angka uang tidak boleh membungkus.** Bentuk ringkasnya yang membuat
 *      satu baris KPI tetap sejajar; kalau ia diam-diam kembali panjang, kartu
 *      tumbuh tidak rata dan itu justru keluhan yang memicu perombakan ini.
 *      Nilai persisnya tetap harus terbaca lewat `title`.
 *   2. **Warna menyatakan keadaan, bukan menandai kartu.** Nol = netral. Kalau
 *      kartu bernilai nol ikut menyala, tidak ada lagi yang menonjol saat
 *      benar-benar ada yang mendesak — persis kegagalan versi sebelumnya.
 *   3. **Order tamu `null` tidak dirender sama sekali**, bukan tampil nol:
 *      role yang tidak berhak memverifikasinya tidak boleh melihat antrian yang
 *      tidak bisa ia sentuh.
 */
declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLElement | null = null;

function summary(over: Partial<KpiSummary> = {}): KpiSummary {
  return {
    ordersTotal: 0,
    ordersOpen: 0,
    ordersCompleted: 0,
    ordersOnHold: 0,
    revenueTotal: 0,
    vendorCostTotal: 0,
    marginTotal: 0,
    marginPct: 0,
    avgCycleHours: null,
    ordersWithRejection: 0,
    activeVendors: 0,
    ...over,
  };
}

function mount(s: KpiSummary, pendingGuestOrders: number | null = 0) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(<KpiCards summary={s} pendingGuestOrders={pendingGuestOrders} />);
  });
  return container;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

/** Kartu hitungan yang memuat teks label tertentu. */
function cardFor(el: HTMLElement, label: string): HTMLElement {
  const found = [...el.querySelectorAll('p')].find((p) => p.textContent === label);
  if (!found) throw new Error(`Kartu "${label}" tidak ada di layar`);
  // p > div(baris ikon) > div(kartu)
  return found.closest('div.rounded-xl') as HTMLElement;
}

describe('angka uang', () => {
  it('ditulis ringkas, dengan nilai penuh tetap terbaca', () => {
    // 1,75 miliar: bentuk panjangnya "Rp1.750.000.000" — 15 karakter yang
    // membungkus di kartu dan menaikkan tingginya sendiri.
    const el = mount(summary({ revenueTotal: 1_750_000_000 }));

    const figure = [...el.querySelectorAll('p')].find((p) => p.textContent?.includes('M'));
    expect(figure?.textContent).toMatch(/^Rp\s?1,8\s?M$/);

    // Ketelitiannya tidak boleh hilang, cuma pindah ke tooltip.
    expect(figure?.getAttribute('title')).toMatch(/1\.750\.000\.000/);
  });

  it('tidak memakai tabular-nums pada figur tunggal', () => {
    // Digit selebar "0" membuat angka besar yang berdiri sendiri terlihat
    // renggang; itu untuk kolom yang harus lurus ke bawah, bukan untuk ini.
    const el = mount(summary({ revenueTotal: 121_000_000 }));
    const figure = [...el.querySelectorAll('p')].find((p) => p.textContent?.includes('jt'));
    expect(figure?.className).not.toContain('tabular-nums');
  });
});

describe('warna kartu hitungan', () => {
  it('netral selama nilainya nol', () => {
    const el = mount(summary());
    for (const label of ['Order tamu baru', 'Order tertunda', 'Laporan ditolak', 'Order ditahan']) {
      expect(cardFor(el, label).className, label).toContain('bg-card');
    }
  });

  it('menyala hanya pada kartu yang benar-benar ada isinya', () => {
    const el = mount(summary({ ordersWithRejection: 3 }));

    expect(cardFor(el, 'Laporan ditolak').className).toContain('bg-red-50');
    // Yang lain tetap diam — inilah yang membuat yang menyala berarti.
    expect(cardFor(el, 'Order ditahan').className).toContain('bg-card');
    expect(cardFor(el, 'Order tertunda').className).toContain('bg-card');
  });
});

describe('order tamu', () => {
  it('tidak dirender untuk role yang tidak berhak memverifikasinya', () => {
    const el = mount(summary(), null);
    expect(el.textContent).not.toContain('Order tamu baru');
    // Sisanya tetap utuh — yang hilang cuma satu kartu.
    expect(el.textContent).toContain('Order tertunda');
  });

  it('dirender bernilai nol untuk role yang berhak', () => {
    const el = mount(summary(), 0);
    expect(cardFor(el, 'Order tamu baru')).toBeTruthy();
  });
});

describe('meter margin', () => {
  it('melaporkan persentasenya ke pembaca layar', () => {
    const el = mount(summary({ revenueTotal: 100, marginTotal: 30, marginPct: 30 }));
    const meter = el.querySelector('[role="progressbar"]');
    expect(meter?.getAttribute('aria-valuenow')).toBe('30');
  });

  it('menjepit lebar bar di 0–100 walau persentasenya di luar itu', () => {
    // Margin negatif mungkin: modal ke mitra bisa melebihi tagihan pada order
    // yang dibatalkan setelah mitra dibayar. Tanpa penjepitan, lebarnya jadi
    // negatif dan barnya patah.
    const el = mount(summary({ marginPct: -40 }));
    const fill = el.querySelector('[role="progressbar"] > div') as HTMLElement;
    expect(fill.style.width).toBe('0%');
  });
});
