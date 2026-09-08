// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { LocationOption } from '@/features/schedules/queries';

/**
 * Pemilih lokasi di ringkasan Jadwal & Mitra.
 *
 * ## Kenapa berkas ini ada
 *
 * Mengganti lokasi dulu menuntut membuka "Ubah jadwal" — form yang menampilkan
 * tanggal, jam, dan catatan sekaligus — padahal yang berubah cuma tempatnya.
 * Ketimpangannya juga terbaca di layar: mitra bisa dipindah lewat dropdown
 * langsung di ringkasan, lokasi tidak.
 *
 * Dua hal dijaga di sini:
 *
 *   1. **Tanggal ikut terkirim.** `saveSchedule` menyimpan satu baris utuh
 *      lewat upsert; mengirim `location_id` saja akan mengosongkan tanggalnya —
 *      dan tanggal itu yang dipakai seluruh halaman Jadwal.
 *   2. **Lokasi milik mitra lain tidak ditawarkan.** Server menolaknya
 *      (`'Lokasi ini milik mitra lain.'`), jadi menawarkannya hanya
 *      menghasilkan penolakan sesudah ditekan.
 */
const saveSchedule = vi.fn();
const createLocation = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/server/actions/schedules', () => ({
  saveSchedule: (...a: unknown[]) => saveSchedule(...a),
  createLocation: (...a: unknown[]) => createLocation(...a),
  assignVendor: vi.fn(),
}));

const { ScheduleManager } = await import('@/features/schedules/components/schedule-manager');

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const VENDOR_A = 'c0000000-0000-4000-8000-000000000001';
const VENDOR_B = 'c0000000-0000-4000-8000-000000000002';

const LOCATIONS: LocationOption[] = [
  {
    id: 'loc-a',
    name: 'RPH Milik Mitra A',
    address: null,
    lat: null,
    lng: null,
    vendorId: VENDOR_A,
  },
  {
    id: 'loc-b',
    name: 'RPH Milik Mitra B',
    address: null,
    lat: null,
    lng: null,
    vendorId: VENDOR_B,
  },
  { id: 'loc-umum', name: 'Masjid Al-Ikhlas', address: null, lat: null, lng: null, vendorId: null },
];

let root: Root | null = null;
let container: HTMLElement | null = null;

function mount(opts: { locationId?: string | null; vendorId?: string } = {}) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      <ScheduleManager
        orderId="o1"
        schedule={{
          locationId: opts.locationId ?? null,
          locationName: null,
          locationAddress: null,
          lat: null,
          lng: null,
          scheduledDate: '2026-09-10',
          scheduledTime: '10:00:00',
          notes: 'Lewat gerbang belakang',
        }}
        vendor={opts.vendorId ? { id: opts.vendorId, name: 'Mitra Terpasang', phone: null } : null}
        vendors={[]}
        options={{ locations: LOCATIONS }}
        canEdit
        canAssign={false}
      />,
    );
  });
  return container;
}

/** Nilai `value` tiap opsi di pemilih lokasi ringkasan. */
function locationOptions(el: HTMLElement): string[] {
  const select = el.querySelector('select[aria-label="Pilih lokasi pelaksanaan"]');
  return [...(select?.querySelectorAll('option') ?? [])].map((o) => o.value);
}

beforeEach(() => {
  saveSchedule.mockReset();
  saveSchedule.mockResolvedValue({ ok: true, data: null });
  createLocation.mockReset();
  createLocation.mockResolvedValue({ ok: true, data: { id: 'loc-baru', name: 'Tempat Baru' } });
  refresh.mockReset();
});

/** Tekan tombol yang teksnya memuat `label`. */
function press(el: HTMLElement, label: string) {
  return [...el.querySelectorAll('button')].find((b) => b.textContent?.includes(label));
}

/** Isi sebuah medan lewat setter asli agar React mendengarnya. */
function fill(el: HTMLElement, selector: string, text: string) {
  const field = el.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
  const proto =
    field.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  act(() => {
    setter?.call(field, text);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('memindahkan lokasi dari ringkasan', () => {
  it('membawa serta tanggal, jam, dan catatan yang sudah ada', async () => {
    const el = mount({ locationId: null, vendorId: VENDOR_A });

    const select = el.querySelector(
      'select[aria-label="Pilih lokasi pelaksanaan"]',
    ) as HTMLSelectElement;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      'value',
    )?.set;
    act(() => {
      setter?.call(select, 'loc-a');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const button = [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Pindahkan ke lokasi ini'),
    );
    await act(async () => button?.click());

    // Inti penjagaannya: upsert menulis baris utuh, jadi mengirim lokasi saja
    // akan mengosongkan tanggal yang dipakai seluruh halaman Jadwal.
    expect(saveSchedule).toHaveBeenCalledWith({
      order_id: 'o1',
      location_id: 'loc-a',
      scheduled_date: '2026-09-10',
      scheduled_time: '10:00',
      notes: 'Lewat gerbang belakang',
    });
  });
});

describe('lokasi yang ditawarkan', () => {
  it('menyembunyikan lokasi milik mitra lain', () => {
    const el = mount({ vendorId: VENDOR_A });
    const values = locationOptions(el);

    expect(values).toContain('loc-a');
    // Server menolaknya; menawarkannya hanya menghasilkan penolakan.
    expect(values).not.toContain('loc-b');
  });

  it('lokasi tanpa pemilik selalu ditawarkan', () => {
    // Masjid, panti, dan tempat salur lain memang tidak dimiliki mitra mana pun.
    expect(locationOptions(mount({ vendorId: VENDOR_A }))).toContain('loc-umum');
    expect(locationOptions(mount({ vendorId: VENDOR_B }))).toContain('loc-umum');
  });

  it('yang sedang terpasang tetap muncul meski milik mitra lain', () => {
    // Order bisa dipindah ke mitra lain setelah lokasinya ditetapkan. Tanpa
    // ini, lokasinya lenyap dari daftar dan `Select` jatuh ke "Belum
    // ditentukan" — terbaca seolah lokasinya sudah dihapus.
    const el = mount({ locationId: 'loc-b', vendorId: VENDOR_A });
    expect(locationOptions(el)).toContain('loc-b');
  });

  it('tanpa mitra, seluruh lokasi terbuka', () => {
    // Lokasi sering ditetapkan sebelum mitranya dipilih.
    const values = locationOptions(mount({ vendorId: undefined }));
    expect(values).toContain('loc-a');
    expect(values).toContain('loc-b');
  });
});

/**
 * Mendaftarkan tempat baru dari panel jadwal.
 *
 * Tabel `locations` sebelumnya tidak punya satu pun jalan masuk lewat aplikasi
 * — barisnya hanya lahir dari seed, jadi menambah tempat menuntut akses
 * langsung ke database. Padahal lokasi salur berganti hampir tiap order, dan
 * yang tahu alamatnya adalah admin yang sedang menjadwalkan.
 */
describe('mendaftarkan tempat baru', () => {
  it('mengirim nama, alamat, dan order yang sedang dijadwalkan', async () => {
    const el = mount({ vendorId: VENDOR_A });
    act(() => press(el, 'Tempat baru')?.click());

    fill(el, '#loc-name', 'Masjid Al-Ikhlas Depok');
    fill(el, '#loc-address', 'Jl. Margonda No. 10, Depok');

    await act(async () => press(el, 'Simpan tempat')?.click());

    expect(createLocation).toHaveBeenCalledWith({
      name: 'Masjid Al-Ikhlas Depok',
      address: 'Jl. Margonda No. 10, Depok',
      order_id: 'o1',
      // Tanpa dicentang: tempat umum, bukan milik mitra.
      owned_by_vendor: false,
    });
  });

  it('langsung memasangnya sebagai pilihan sesudah tersimpan', async () => {
    // Yang baru mendaftarkan tempat hampir pasti ingin memakainya sekarang,
    // bukan mencarinya lagi di daftar.
    const el = mount({ vendorId: VENDOR_A });
    act(() => press(el, 'Tempat baru')?.click());
    fill(el, '#loc-name', 'Panti Asuhan Harapan');

    await act(async () => press(el, 'Simpan tempat')?.click());

    const select = el.querySelector(
      'select[aria-label="Pilih lokasi pelaksanaan"]',
    ) as HTMLSelectElement;
    expect(select.value).toBe('loc-baru');
    // Formnya menutup sendiri — kalau tetap terbuka, tempat yang sama gampang
    // didaftarkan dua kali.
    expect(el.querySelector('#loc-name')).toBeNull();
  });

  it('menolak nama yang terlalu pendek sebelum menyentuh server', async () => {
    const el = mount({ vendorId: VENDOR_A });
    act(() => press(el, 'Tempat baru')?.click());
    fill(el, '#loc-name', 'ab');

    expect(press(el, 'Simpan tempat')?.disabled).toBe(true);
    expect(createLocation).not.toHaveBeenCalled();
  });

  it('menawarkan penandaan milik mitra hanya bila mitranya ada', () => {
    // Server menolak `owned_by_vendor` pada order tanpa mitra, jadi pilihan
    // yang pasti ditolak lebih baik tidak ditawarkan.
    const dengan = mount({ vendorId: VENDOR_A });
    act(() => press(dengan, 'Tempat baru')?.click());
    expect(dengan.querySelector('input[type="checkbox"]')).not.toBeNull();

    act(() => root?.unmount());
    container?.remove();

    const tanpa = mount({ vendorId: undefined });
    act(() => press(tanpa, 'Tempat baru')?.click());
    expect(tanpa.querySelector('input[type="checkbox"]')).toBeNull();
  });
});
