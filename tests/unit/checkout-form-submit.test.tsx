// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { CheckoutPackage, NasiBoxPackage, RegionOption } from '@/features/checkout/queries';

/**
 * Menjaga agar pesanan hanya terkirim lewat klik yang disengaja, dan agar alur
 * empat tahapnya tetap utuh.
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

/**
 * Wilayah di bawah provinsi diambil pemilih alamat langsung dari Supabase.
 * Di sini jalurnya dipotong: yang diuji perilaku formnya, bukan PostgREST —
 * dan tanpa mock ini komponennya menuntut kredensial Supabase yang sungguhan.
 */
const REGION_CHILDREN: Record<string, RegionOption[]> = {
  '32': [{ code: '32.73', name: 'Kota Bandung' }],
  '32.73': [{ code: '32.73.24', name: 'Cibeunying Kidul' }],
  '32.73.24': [{ code: '32.73.24.1003', name: 'Sukapada' }],
};

const fetchRegionChildren = vi.fn(async (parentCode: string) => REGION_CHILDREN[parentCode] ?? []);

vi.mock('@/features/checkout/regions', () => ({ fetchRegionChildren }));

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
/**
 * Jendela tanggal datang sebagai prop dari server, jadi di sini cukup nilai
 * tetap — tesnya tidak ikut bergeser tiap hari.
 */
const PROVINCES: RegionOption[] = [{ code: '32', name: 'Jawa Barat' }];

const MIN_DATE = '2026-08-19';
const MAX_DATE = '2026-08-26';
const PICKED_DATE = '2026-08-21';
const PICKED_TIME = '09:00';

let root: Root | null = null;
let container: HTMLElement | null = null;

function mount() {
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
  const proto = Object.getPrototypeOf(el);
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  act(() => {
    setter?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function pickOption(id: string, value: string) {
  const el = byId<HTMLSelectElement>(id);
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(el, value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

/**
 * Tunggu permintaan wilayah selesai dan React selesai me-render ulang.
 *
 * `act` sinkron tidak cukup: isi tiap tingkat datang dari promise, jadi tanpa
 * ini `<option>`-nya belum terpasang saat hendak dipilih.
 */
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
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

/** Lewati tahap 1-3 dengan isian sah, lalu berhenti di tahap 4 (Ringkasan). */
function goToFinalStep({ arm = true }: { arm?: boolean } = {}) {
  mount();
  // 1 · Pesanan — aqiqah untuk, paket (terpilih otomatis), nasi box (opsional).
  clickText('Anak Laki-laki');
  clickText('Lanjut ke');
  type('co-date', PICKED_DATE); // 2 · Jadwal & penyaluran
  clickText(PICKED_TIME);
  clickText('Aqiqah Salur');
  clickText('Lanjut ke');
  type('co-name', 'Budi Santoso'); // 3 · Data pemesan
  type('co-phone', '081234567890');
  type('co-email', 'budi@example.com');
  type('co-child', 'Fatih');
  clickText('Lanjut ke');
  if (arm) advanceClock(1000);
}

beforeEach(() => {
  createGuestOrderAction.mockClear();
  fetchRegionChildren.mockClear();
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

describe('alur empat tahap', () => {
  it('tahap 1 memuat aqiqah untuk, paket, dan nasi box sekaligus', () => {
    // Ketiganya dulu tahap terpisah; disatukan 19 Agustus 2026.
    mount();
    const text = document.body.textContent ?? '';

    expect(text).toContain('Aqiqah untuk siapa');
    expect(text).toContain('Pilih Paket');
    expect(text).toContain('Aqiqah Ekonomi');
    expect(text).toContain('Nasi Box');
    expect(text).toContain('Tidak pakai');
    expect(text).toContain('Jumlah Ekor');
  });

  it('tidak bisa maju sebelum memilih jenis kelamin', () => {
    mount();
    clickText('Lanjut ke');

    // Masih di tahap 1 — pemilih tanggal belum dirender.
    expect(document.getElementById('co-date')).toBeNull();
    expect(document.body.textContent).toContain('Pilih salah satu terlebih dahulu');
  });

  it('memilih anak laki-laki menganjurkan 2 ekor, perempuan 1 ekor', () => {
    mount();
    clickText('Anak Laki-laki');
    expect(document.body.textContent).toContain('Anjuran untuk anak laki-laki: 2 ekor');

    clickText('Anak Perempuan');
    expect(document.body.textContent).toContain('Anjuran untuk anak perempuan: 1 ekor');
  });

  it('nasi box boleh dilewati lewat "Tidak pakai"', () => {
    mount();
    clickText('Anak Laki-laki');

    // Tidak memilih box apa pun tetap boleh lanjut, dan kolom jumlahnya tidak
    // muncul selama belum ada paket box terpilih.
    expect(document.getElementById('co-boxqty')).toBeNull();
    clickText('Lanjut ke');
    expect(document.body.textContent).toContain('Cara Penyaluran');
  });

  it('memilih paket nasi box menuntut jumlahnya', () => {
    mount();
    clickText('Anak Laki-laki');
    clickText('Paket A');

    expect(document.getElementById('co-boxqty')).not.toBeNull();
    type('co-boxqty', '0');
    clickText('Lanjut ke');
    expect(document.body.textContent).toContain('Isi jumlah box');
  });

  it('Aqiqah Kirim memunculkan pemilih alamat dan mewajibkannya', () => {
    mount();
    clickText('Anak Laki-laki');
    clickText('Lanjut ke');
    clickText('Aqiqah Kirim');

    for (const id of ['co-prov', 'co-city', 'co-dist', 'co-vill', 'co-postal', 'co-detail']) {
      expect(document.getElementById(id), id).not.toBeNull();
    }

    clickText('Lanjut ke'); // alamat masih kosong
    const text = document.body.textContent ?? '';
    expect(text).toContain('Pilih provinsi tujuan');
    expect(text).toContain('Kode pos wajib diisi');
    expect(text).toContain('Isi nama jalan dan nomor rumah');
  });

  it('Aqiqah Salur tidak meminta alamat', () => {
    mount();
    clickText('Anak Laki-laki');
    clickText('Lanjut ke');
    clickText('Aqiqah Salur');

    expect(document.getElementById('co-prov')).toBeNull();
  });

  it('tahap terakhir menampilkan ringkasan sebelum konfirmasi', () => {
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
    expect(payload.requested_date).toBe(PICKED_DATE);
    expect(payload.requested_time).toBe(PICKED_TIME);
  });

  it('tidak mengirim cabang — wilayah ditentukan server', () => {
    goToFinalStep();
    clickText('Kirim Pesanan');

    const payload = createGuestOrderAction.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(payload).not.toHaveProperty('branch_id');
  });
});

describe('jadwal pelaksanaan', () => {
  /** Berhenti di tahap 2, dengan tahap 1 sudah sah. */
  function goToScheduleStep() {
    mount();
    clickText('Anak Laki-laki');
    clickText('Lanjut ke');
  }

  it('menahan langkah selama tanggal atau jam belum dipilih', () => {
    goToScheduleStep();
    clickText('Aqiqah Salur');
    clickText('Lanjut ke');

    expect(document.body.textContent).toContain('Pilih tanggal pelaksanaan');
    expect(document.body.textContent).toContain('Pilih jam pelaksanaan');
  });

  it('membatasi pemilih tanggal pada jendela yang diberikan server', () => {
    goToScheduleStep();
    const input = byId<HTMLInputElement>('co-date');

    expect(input.min).toBe(MIN_DATE);
    expect(input.max).toBe(MAX_DATE);
  });

  it('menolak tanggal di luar jendela sekalipun diketik langsung', () => {
    // Atribut `min`/`max` hanya membantu pemilih tanggal peramban; nilainya
    // tetap bisa diketik, jadi penolakannya harus datang dari validasi.
    goToScheduleStep();
    type('co-date', '2026-09-30');
    clickText(PICKED_TIME);
    clickText('Aqiqah Salur');
    clickText('Lanjut ke');

    expect(document.body.textContent).toContain('Maksimal 7 hari ke depan');
  });
});

describe('pemilih alamat bertingkat', () => {
  async function goToDeliveryStep() {
    mount();
    clickText('Anak Laki-laki');
    clickText('Lanjut ke');
    clickText('Aqiqah Kirim');
    await flush();
  }

  it('mengisi tiap tingkat hanya setelah induknya dipilih', async () => {
    await goToDeliveryStep();

    // Selama provinsi belum dipilih, tidak ada permintaan sama sekali dan
    // tingkat di bawahnya dimatikan.
    expect(fetchRegionChildren).not.toHaveBeenCalled();
    expect(byId<HTMLSelectElement>('co-city').disabled).toBe(true);

    pickOption('co-prov', '32');
    await flush();
    expect(fetchRegionChildren).toHaveBeenCalledWith('32');
    expect(byId<HTMLSelectElement>('co-city').disabled).toBe(false);
    expect(document.body.textContent).toContain('Kota Bandung');

    pickOption('co-city', '32.73');
    await flush();
    expect(document.body.textContent).toContain('Cibeunying Kidul');

    pickOption('co-dist', '32.73.24');
    await flush();
    expect(document.body.textContent).toContain('Sukapada');
  });

  it('mengganti provinsi mengosongkan tingkat di bawahnya', async () => {
    // Kalau tidak, kelurahan dari provinsi lama tertinggal dan menghasilkan
    // alamat yang tidak sejalur — baru ketahuan saat dikirim.
    await goToDeliveryStep();
    pickOption('co-prov', '32');
    await flush();
    pickOption('co-city', '32.73');
    await flush();
    pickOption('co-dist', '32.73.24');
    await flush();
    pickOption('co-vill', '32.73.24.1003');
    await flush();
    expect(byId<HTMLSelectElement>('co-vill').value).toBe('32.73.24.1003');

    pickOption('co-prov', '');
    await flush();
    for (const id of ['co-city', 'co-dist', 'co-vill']) {
      expect(byId<HTMLSelectElement>(id).value, id).toBe('');
    }
  });

  it('kode pos menolak huruf saat diketik', async () => {
    await goToDeliveryStep();
    type('co-postal', '4a0b1c2d5e');

    expect(byId<HTMLInputElement>('co-postal').value).toBe('40125');
  });

  it('mengirim kode wilayahnya saja, tanpa nama maupun alamat satu baris', async () => {
    await goToDeliveryStep();
    pickOption('co-prov', '32');
    await flush();
    pickOption('co-city', '32.73');
    await flush();
    pickOption('co-dist', '32.73.24');
    await flush();
    pickOption('co-vill', '32.73.24.1003');
    await flush();
    type('co-postal', '40125');
    type('co-detail', 'Jl. Cikutra Barat No. 12');

    type('co-date', PICKED_DATE);
    clickText(PICKED_TIME);
    clickText('Lanjut ke');
    type('co-name', 'Budi Santoso');
    type('co-phone', '081234567890');
    type('co-email', 'budi@example.com');
    type('co-child', 'Fatih');
    clickText('Lanjut ke');
    advanceClock(1000);
    clickText('Kirim Pesanan');

    const payload = createGuestOrderAction.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(payload.delivery_province_code).toBe('32');
    expect(payload.delivery_city_code).toBe('32.73');
    expect(payload.delivery_district_code).toBe('32.73.24');
    expect(payload.delivery_village_code).toBe('32.73.24.1003');
    expect(payload.delivery_postal_code).toBe('40125');
    expect(payload.delivery_detail).toBe('Jl. Cikutra Barat No. 12');

    // Nama wilayah dibaca RPC dari `regions`; mengirimnya dari klien hanya
    // membuka celah nama yang tidak cocok dengan kodenya.
    for (const key of ['delivery', 'delivery_address', 'delivery_province', 'delivery_city']) {
      expect(payload, key).not.toHaveProperty(key);
    }
  });
});
