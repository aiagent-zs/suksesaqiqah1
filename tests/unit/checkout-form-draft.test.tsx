// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { CheckoutPackage, NasiBoxPackage, RegionOption } from '@/features/checkout/queries';

/**
 * Jaring pengaman terhadap **kehilangan isian**.
 *
 * Checkout ini menuntut belasan medan di tiga langkah sebelum pesanan bisa
 * dikirim. Sebelum ada penyimpanan sementara, satu kali muat ulang halaman —
 * atau satu gestur usap-dari-tepi di ponsel — membuang seluruhnya tanpa
 * peringatan apa pun.
 *
 * Yang diuji di sini perilakunya di dalam komponen: kapan tawaran pemulihan
 * muncul, kapan ia justru **tidak** boleh muncul, dan apakah tombol kembali
 * peramban benar-benar memundurkan langkah alih-alih meninggalkan halaman.
 * Bentuk & penyaringan data draft-nya sendiri diuji di `checkout-draft.test.ts`.
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

const fetchRegionChildren = vi.fn(async () => [] as RegionOption[]);
vi.mock('@/features/checkout/regions', () => ({ fetchRegionChildren }));

const { emptyDraft } = await import('@/features/checkout/draft');

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const DRAFT_KEY = 'sa-checkout-draft-v1';

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
const PROVINCES: RegionOption[] = [{ code: '32', name: 'Jawa Barat' }];

const MIN_DATE = '2026-08-19';
const MAX_DATE = '2026-08-26';
const PICKED_DATE = '2026-08-21';
const PICKED_TIME = '09:00';

let root: Root | null = null;
let container: HTMLElement | null = null;

/**
 * Memasang form dari modul yang **baru diimpor**.
 *
 * Wajib diimpor ulang tiap kali, bukan sekali di puncak berkas: modul draft
 * menyinggahkan bacaan `sessionStorage` seumur hidupnya (lihat
 * `getDraftSnapshot` — `useSyncExternalStore` menuntut snapshot yang stabil).
 * Impor yang dipakai bersama membuat kasus uji kedua membaca singgahan milik
 * kasus pertama, dan draft yang baru saja ditanam tidak pernah terlihat.
 *
 * `beforeEach` sudah memanggil `vi.resetModules()`, jadi impor di sini selalu
 * mendapat modul yang segar.
 */
async function mount() {
  const { CheckoutForm } = await import('@/features/checkout/components/checkout-form');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      <CheckoutForm
        packages={PACKAGES}
        nasiBoxes={NASI_BOXES}
        provinces={PROVINCES}
        minDate={MIN_DATE}
        maxDate={MAX_DATE}
      />,
    );
  });
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} tidak ditemukan`);
  return el as T;
}

function type(id: string, value: string) {
  const el = byId<HTMLInputElement | HTMLTextAreaElement>(id);
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
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

function stored() {
  const raw = window.sessionStorage.getItem(DRAFT_KEY);
  return raw ? JSON.parse(raw) : null;
}

function seed(step: number, draft: Record<string, unknown>) {
  window.sessionStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({ savedAt: Date.now(), step, draft: { ...emptyDraft(PACKAGES[0].id), ...draft } }),
  );
}

/** Maju ke langkah 2 dengan isian yang sah. */
function advanceToStep2() {
  clickText('Anak Laki-laki');
  clickText('Lanjut ke');
}

/**
 * Impor perdana harus mentranspilasi seluruh graf modul komponen, dan itu
 * sendirian bisa melewati batas waktu 5 detik milik kasus uji pertama.
 * Dipanaskan sekali di sini supaya batas waktu mengukur perilaku form, bukan
 * kecepatan bundler.
 */
beforeAll(async () => {
  await import('@/features/checkout/components/checkout-form');
}, 30_000);

beforeEach(() => {
  createGuestOrderAction.mockClear();
  window.sessionStorage.clear();
  // Modulnya menyinggahkan bacaan draft seumur halaman, jadi tiap kasus uji
  // harus memulai dari modul yang segar — kalau tidak, kasus kedua hanya
  // membaca singgahan milik kasus pertama.
  vi.resetModules();
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  window.sessionStorage.clear();
});

describe('menyimpan isian', () => {
  it('tidak menulis apa pun sebelum ada yang disentuh', async () => {
    await mount();
    // Menyimpan draft kosong berarti menawarkan pemulihan kepada orang yang
    // belum mengisi apa pun — satu keputusan tanpa manfaat.
    expect(stored()).toBeNull();
  });

  it('menyimpan begitu isian berubah, beserta langkahnya', async () => {
    await mount();
    advanceToStep2();
    type('co-date', PICKED_DATE);

    const saved = stored();
    expect(saved.draft.aqiqah_for).toBe('laki_laki');
    expect(saved.draft.requested_date).toBe(PICKED_DATE);
    expect(saved.step).toBe(2);
  });
});

describe('menawarkan pemulihan', () => {
  it('menawarkan draft yang berhenti di tengah jalan', async () => {
    seed(3, { aqiqah_for: 'laki_laki', name: 'Budi Santoso' });
    await mount();

    expect(document.body.textContent).toContain('Lanjutkan isian sebelumnya');
  });

  it('tidak menawarkan draft yang masih di langkah 1', async () => {
    seed(1, { aqiqah_for: 'laki_laki' });
    await mount();

    // Belum ada yang layak diselamatkan — pemesan menutup tab sebelum
    // menyelesaikan satu langkah pun.
    expect(document.body.textContent).not.toContain('Lanjutkan isian sebelumnya');
  });

  it('tidak menawarkan apa pun bila tidak ada draft', async () => {
    await mount();
    expect(document.body.textContent).not.toContain('Lanjutkan isian sebelumnya');
  });

  it('"Mulai baru" membuang draft-nya, bukan sekadar menyembunyikan', async () => {
    seed(3, { aqiqah_for: 'laki_laki', name: 'Budi Santoso' });
    await mount();

    clickText('Mulai baru');

    expect(window.sessionStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(document.body.textContent).not.toContain('Lanjutkan isian sebelumnya');
    // Isian tetap kosong — yang ditolak memang tidak boleh terpasang.
    expect(document.body.textContent).toContain('Aqiqah untuk siapa');
  });

  it('"Lanjutkan" memasang isian dan melompat ke langkahnya', async () => {
    seed(3, {
      aqiqah_for: 'laki_laki',
      requested_date: PICKED_DATE,
      requested_time: PICKED_TIME,
      distribution_mode: 'salur',
      name: 'Budi Santoso',
    });
    await mount();

    clickText('Lanjutkan');

    // Langkah 3 = Data Pemesan; medannya harus sudah terisi.
    expect(byId<HTMLInputElement>('co-name').value).toBe('Budi Santoso');
    expect(document.body.textContent).not.toContain('Lanjutkan isian sebelumnya');
  });
});

describe('tombol kembali peramban', () => {
  it('memundurkan langkah alih-alih meninggalkan halaman', async () => {
    await mount();
    advanceToStep2();

    // Langkah 2 dikenali dari pemilih tanggalnya.
    expect(document.getElementById('co-date')).not.toBeNull();

    act(() => {
      window.history.back();
    });
    // jsdom memproses `popstate` secara asinkron pada antrean tugas.
    act(() => {
      window.dispatchEvent(
        Object.assign(new PopStateEvent('popstate', { state: { saStep: 1 } })),
      );
    });

    expect(document.getElementById('co-date')).toBeNull();
    expect(document.body.textContent).toContain('Aqiqah untuk siapa');
  });

  it('menandai langkah di riwayat saat maju', async () => {
    await mount();
    advanceToStep2();

    expect((window.history.state as { saStep?: number } | null)?.saStep).toBe(2);
  });
});
