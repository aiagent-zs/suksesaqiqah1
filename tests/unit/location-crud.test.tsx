// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { createLocationSchema, updateLocationSchema } from '@/features/schedules/schema';
import type { LocationOption } from '@/features/schedules/queries';

/**
 * Kelola lokasi pelaksanaan: tambah, ubah, hapus.
 *
 * ## Kenapa berkas ini ada
 *
 * Tabel `locations` sebelumnya tidak punya satu pun jalan masuk lewat aplikasi
 * — barisnya hanya lahir dari seed, jadi menambah tempat menuntut akses
 * langsung ke database. Padahal lokasi salur berganti hampir tiap order, dan
 * yang tahu alamatnya adalah admin yang sedang menjadwalkan.
 *
 * Yang dijaga di sini terutama satu hal: **alamat wajib**. Kolomnya nullable di
 * database (tiga baris seed lama memang lahir tanpa alamat), jadi tidak ada
 * yang menahannya selain validasi ini. Lokasi tanpa alamat tidak bisa dituju
 * siapa pun — mitra yang berangkat perlu tahu jalannya, dan alamat itu ikut
 * tercetak di laporan peserta.
 */
const createLocation = vi.fn();
const updateLocation = vi.fn();
const deleteLocation = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/server/actions/schedules', () => ({
  createLocation: (...a: unknown[]) => createLocation(...a),
  updateLocation: (...a: unknown[]) => updateLocation(...a),
  deleteLocation: (...a: unknown[]) => deleteLocation(...a),
  saveSchedule: vi.fn(),
  assignVendor: vi.fn(),
}));

const { LocationDialog } = await import('@/features/schedules/components/location-dialog');
const { LocationDeleteDialog } =
  await import('@/features/schedules/components/location-delete-dialog');

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const EXISTING: LocationOption = {
  id: 'loc-1',
  name: 'Masjid Al-Ikhlas',
  address: 'Jl. Margonda No. 10, Beji, Depok',
  lat: null,
  lng: null,
  vendorId: null,
};

let root: Root | null = null;
let container: HTMLElement | null = null;

/** Tombol mana pun di dokumen — dialognya dirender lewat portal. */
function press(label: string) {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(label));
  act(() => btn?.click());
  return btn;
}

function buttonFor(label: string) {
  return [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(label));
}

function fill(selector: string, text: string) {
  const field = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
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

function mount(node: React.ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(node));
}

beforeEach(() => {
  createLocation.mockReset();
  createLocation.mockResolvedValue({ ok: true, data: { id: 'loc-baru', name: 'Tempat Baru' } });
  updateLocation.mockReset();
  updateLocation.mockResolvedValue({ ok: true, data: null });
  deleteLocation.mockReset();
  deleteLocation.mockResolvedValue({ ok: true, data: null });
  refresh.mockReset();
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('alamat wajib — schema', () => {
  it('menolak lokasi tanpa alamat', () => {
    // Kolomnya nullable di database, jadi tidak ada yang menahannya selain ini.
    const r = createLocationSchema.safeParse({ name: 'Masjid Al-Ikhlas', address: '' });
    expect(r.success).toBe(false);
  });

  it('menolak alamat yang cuma sepotong', () => {
    // "Depok" saja tidak bisa dituju siapa pun.
    expect(createLocationSchema.safeParse({ name: 'Masjid X', address: 'Depok' }).success).toBe(
      false,
    );
  });

  it('menerima nama & alamat yang lengkap', () => {
    const r = createLocationSchema.safeParse({
      name: 'Masjid Al-Ikhlas',
      address: 'Jl. Margonda Raya No. 10, Beji, Depok',
    });
    expect(r.success).toBe(true);
  });

  it('tidak menerima vendor_id dari klien', () => {
    // Kepemilikan mitra hanya ada pada baris seed lama; menerimanya dari klien
    // membuka jalan menembus pemeriksaan "lokasi ini milik mitra lain".
    const r = createLocationSchema.parse({
      name: 'Masjid Al-Ikhlas',
      address: 'Jl. Margonda Raya No. 10, Beji, Depok',
      vendor_id: 'c0000000-0000-4000-8000-000000000001',
    });
    expect(r).not.toHaveProperty('vendor_id');
  });

  it('menyunting menuntut id, dengan aturan medan yang sama', () => {
    const fields = { name: 'Masjid Baru', address: 'Jl. Baru No. 1, Beji, Depok' };
    expect(updateLocationSchema.safeParse(fields).success).toBe(false);
    expect(
      updateLocationSchema.safeParse({ ...fields, id: '11111111-1111-4111-8111-111111111111' })
        .success,
    ).toBe(true);
  });
});

describe('menambah lokasi', () => {
  it('mengirim nama dan alamat', async () => {
    mount(
      createElement(LocationDialog, {
        trigger: createElement('button', { type: 'button' }, 'Tambah lokasi'),
      }),
    );

    press('Tambah lokasi');
    fill('#loc-new-name', 'Panti Asuhan Harapan');
    fill('#loc-new-address', 'Jl. Kemuning No. 5, Sukmajaya, Depok');

    await act(async () => buttonFor('Simpan lokasi')?.click());

    expect(createLocation).toHaveBeenCalledWith({
      name: 'Panti Asuhan Harapan',
      address: 'Jl. Kemuning No. 5, Sukmajaya, Depok',
    });
  });

  it('menahan tombol simpan sampai alamatnya terisi', () => {
    mount(
      createElement(LocationDialog, {
        trigger: createElement('button', { type: 'button' }, 'Tambah lokasi'),
      }),
    );

    press('Tambah lokasi');
    fill('#loc-new-name', 'Panti Asuhan Harapan');

    // Nama saja tidak cukup — inilah yang membedakannya dari versi sebelumnya.
    expect(buttonFor('Simpan lokasi')?.disabled).toBe(true);

    fill('#loc-new-address', 'Jl. Kemuning No. 5, Sukmajaya, Depok');
    expect(buttonFor('Simpan lokasi')?.disabled).toBe(false);
  });

  it('memberitahukan hasilnya lewat onSaved', async () => {
    // Dipakai pemanggil untuk langsung memasang tempat baru sebagai pilihan.
    const onSaved = vi.fn();
    mount(
      createElement(LocationDialog, {
        onSaved,
        trigger: createElement('button', { type: 'button' }, 'Tambah lokasi'),
      }),
    );

    press('Tambah lokasi');
    fill('#loc-new-name', 'Panti Asuhan Harapan');
    fill('#loc-new-address', 'Jl. Kemuning No. 5, Sukmajaya, Depok');
    await act(async () => buttonFor('Simpan lokasi')?.click());

    expect(onSaved).toHaveBeenCalledWith({
      id: 'loc-baru',
      name: 'Panti Asuhan Harapan',
      address: 'Jl. Kemuning No. 5, Sukmajaya, Depok',
    });
  });
});

describe('mengubah lokasi', () => {
  it('membuka form dengan isi yang sudah tersimpan', () => {
    mount(
      createElement(LocationDialog, {
        location: EXISTING,
        trigger: createElement('button', { type: 'button' }, 'Ubah lokasi'),
      }),
    );

    press('Ubah lokasi');
    expect((document.querySelector('#loc-loc-1-name') as HTMLInputElement).value).toBe(
      EXISTING.name,
    );
    expect((document.querySelector('#loc-loc-1-address') as HTMLTextAreaElement).value).toBe(
      EXISTING.address,
    );
  });

  it('mengirim id beserta medan yang disunting', async () => {
    mount(
      createElement(LocationDialog, {
        location: EXISTING,
        trigger: createElement('button', { type: 'button' }, 'Ubah lokasi'),
      }),
    );

    press('Ubah lokasi');
    fill('#loc-loc-1-name', 'Masjid Al-Ikhlas Beji');
    await act(async () => buttonFor('Simpan perubahan')?.click());

    expect(updateLocation).toHaveBeenCalledWith({
      id: 'loc-1',
      name: 'Masjid Al-Ikhlas Beji',
      address: EXISTING.address,
    });
  });
});

describe('menghapus lokasi', () => {
  it('meminta penegasan lebih dulu', async () => {
    mount(
      createElement(LocationDeleteDialog, {
        location: EXISTING,
        trigger: createElement('button', { type: 'button' }, 'Hapus'),
      }),
    );

    press('Hapus');
    // Belum terhapus hanya karena dialognya terbuka.
    expect(deleteLocation).not.toHaveBeenCalled();

    await act(async () => buttonFor('Ya, hapus lokasi')?.click());
    expect(deleteLocation).toHaveBeenCalledWith({ id: 'loc-1' });
  });

  it('menampilkan penolakan server, bukan menutup diam-diam', async () => {
    // Lokasi yang masih dipakai order berjalan ditahan server; alasannya harus
    // sampai ke layar, kalau tidak tombolnya terlihat tidak berfungsi.
    deleteLocation.mockResolvedValue({
      ok: false,
      error: { code: 'CONFLICT', message: 'Lokasi ini masih dipakai 2 order berjalan.' },
    });

    mount(
      createElement(LocationDeleteDialog, {
        location: EXISTING,
        trigger: createElement('button', { type: 'button' }, 'Hapus'),
      }),
    );

    press('Hapus');
    await act(async () => buttonFor('Ya, hapus lokasi')?.click());

    expect(document.body.textContent).toContain('masih dipakai 2 order berjalan');
    expect(refresh).not.toHaveBeenCalled();
  });
});
