import { describe, expect, it } from 'vitest';
import {
  checkScheduleTransition,
  getScheduleStatusOptions,
  isScheduleComplete,
  missingScheduleParts,
} from '@/features/schedules/status-machine';
import { googleMapsUrl } from '@/features/schedules/maps';
import { scheduleFilterSchema, saveScheduleSchema } from '@/features/schedules/schema';

const ORDER_ID = '3f1a9c62-5f4b-4c1e-9a2d-8e7b6c5d4a3f';
const LOCATION_ID = '8a1b2c3d-4e5f-4061-9273-8495a6b7c8d9';
const PIC_ID = 'b2c3d4e5-6f70-4182-a394-b5c6d7e8f901';

/**
 * Aturan ini melepas guard `paid → scheduled` (docs/08 section 2), jadi
 * kelengkapannya harus tepat: satu bagian kosong berarti order tertahan.
 */
describe('isScheduleComplete', () => {
  it('lengkap hanya bila tanggal, lokasi, dan PIC terisi', () => {
    expect(
      isScheduleComplete({
        scheduled_date: '2026-08-20',
        location_id: LOCATION_ID,
        pic_user_id: PIC_ID,
      }),
    ).toBe(true);
  });

  it('menolak jadwal tanpa PIC — kasus paling sering terjadi', () => {
    expect(
      isScheduleComplete({
        scheduled_date: '2026-08-20',
        location_id: LOCATION_ID,
        pic_user_id: null,
      }),
    ).toBe(false);
  });

  it('menganggap jadwal yang belum ada sebagai tidak lengkap', () => {
    expect(isScheduleComplete(null)).toBe(false);
  });

  it('menyebutkan bagian yang kurang untuk ditampilkan ke operator', () => {
    expect(missingScheduleParts(null)).toEqual(['tanggal', 'lokasi', 'PIC']);
    expect(
      missingScheduleParts({
        scheduled_date: '2026-08-20',
        location_id: LOCATION_ID,
        pic_user_id: null,
      }),
    ).toEqual(['PIC']);
    expect(
      missingScheduleParts({
        scheduled_date: '2026-08-20',
        location_id: LOCATION_ID,
        pic_user_id: PIC_ID,
      }),
    ).toEqual([]);
  });
});

describe('checkScheduleTransition', () => {
  it('mengizinkan maju satu tahap bagi role penulis jadwal', () => {
    expect(checkScheduleTransition('planned', 'ongoing', 'admin').ok).toBe(true);
    expect(checkScheduleTransition('ongoing', 'done', 'superadmin').ok).toBe(true);
  });

  it('mengizinkan mundur satu tahap — status jadwal bukan bukti pelaksanaan', () => {
    // Berbeda dari status hewan: tidak ada KPI atau guard order yang dihitung
    // dari schedules.status, jadi koreksi tidak menghapus bukti apa pun.
    expect(checkScheduleTransition('ongoing', 'planned', 'admin').ok).toBe(true);
  });

  it('menolak lompatan dua tahap', () => {
    const result = checkScheduleTransition('planned', 'done', 'admin');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('CONFLICT');
  });

  it('menolak role yang tidak berhak menulis jadwal', () => {
    // Sama dengan kebijakan RLS `schedules_write` — petugas lapangan mencatat
    // pelaksanaan lewat animals/slaughter_records, bukan mengubah jadwal.
    for (const role of ['vendor'] as const) {
      const result = checkScheduleTransition('planned', 'ongoing', role);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('FORBIDDEN');
    }

    const anon = checkScheduleTransition('planned', 'ongoing', undefined);
    expect(anon.ok).toBe(false);
  });

  it('menolak transisi ke status yang sama', () => {
    expect(checkScheduleTransition('planned', 'planned', 'admin').ok).toBe(false);
  });

  it('menandai opsi dropdown sesuai hak role', () => {
    const options = getScheduleStatusOptions('planned', 'admin');
    expect(options.map((o) => o.status)).toEqual(['planned', 'ongoing', 'done']);
    expect(options.find((o) => o.status === 'ongoing')?.allowed).toBe(true);
    expect(options.find((o) => o.status === 'done')?.allowed).toBe(false);

    const readOnly = getScheduleStatusOptions('planned', 'vendor');
    expect(readOnly.filter((o) => o.status !== 'planned').every((o) => !o.allowed)).toBe(true);
  });
});

describe('googleMapsUrl', () => {
  it('membangun tautan dari koordinat yang sah', () => {
    expect(googleMapsUrl(-6.914744, 107.60981)).toBe(
      'https://www.google.com/maps/search/?api=1&query=-6.914744,107.60981',
    );
  });

  it('tidak menghasilkan tautan bila koordinat kosong', () => {
    expect(googleMapsUrl(null, 107.6)).toBeNull();
    expect(googleMapsUrl(-6.9, null)).toBeNull();
  });

  it('menolak koordinat di luar rentang bumi', () => {
    // Data rusak lebih baik tidak bertautan daripada mengirim petugas ke titik
    // yang salah.
    expect(googleMapsUrl(91, 0)).toBeNull();
    expect(googleMapsUrl(0, 181)).toBeNull();
    expect(googleMapsUrl(Number.NaN, 0)).toBeNull();
  });
});

describe('saveScheduleSchema', () => {
  it('menerima jadwal lengkap', () => {
    const result = saveScheduleSchema.parse({
      order_id: ORDER_ID,
      location_id: LOCATION_ID,
      pic_user_id: PIC_ID,
      scheduled_date: '2026-08-20',
      scheduled_time: '07:30',
    });
    expect(result.scheduled_time).toBe('07:30');
  });

  it('menerima jam berdetik dari Postgres dan memangkasnya', () => {
    // Kolom `time` dibaca kembali sebagai HH:MM:SS; tanpa ini, menyimpan ulang
    // jadwal yang dimuat dari database ditolak validasinya sendiri.
    const result = saveScheduleSchema.parse({
      order_id: ORDER_ID,
      location_id: LOCATION_ID,
      scheduled_date: '2026-08-20',
      scheduled_time: '07:30:00',
    });
    expect(result.scheduled_time).toBe('07:30');
  });

  it('mengizinkan PIC kosong agar jadwal bisa disimpan bertahap', () => {
    const result = saveScheduleSchema.safeParse({
      order_id: ORDER_ID,
      location_id: LOCATION_ID,
      scheduled_date: '2026-08-20',
    });
    expect(result.success).toBe(true);
  });

  it('menolak tanggal & jam berformat salah', () => {
    expect(
      saveScheduleSchema.safeParse({
        order_id: ORDER_ID,
        location_id: LOCATION_ID,
        scheduled_date: '20-08-2026',
      }).success,
    ).toBe(false);

    expect(
      saveScheduleSchema.safeParse({
        order_id: ORDER_ID,
        location_id: LOCATION_ID,
        scheduled_date: '2026-08-20',
        scheduled_time: '25:00',
      }).success,
    ).toBe(false);
  });

  it('mewajibkan lokasi — kolomnya NOT NULL di database', () => {
    expect(
      saveScheduleSchema.safeParse({ order_id: ORDER_ID, scheduled_date: '2026-08-20' }).success,
    ).toBe(false);
  });
});

describe('scheduleFilterSchema', () => {
  it('tidak pernah melempar untuk query string sembarang', () => {
    expect(() =>
      scheduleFilterSchema.parse({
        branch_id: 'bukan-uuid',
        status: 'selesai',
        date_from: 'kemarin',
        active_only: '0',
        page: 'abc',
        page_size: '9999',
      }),
    ).not.toThrow();
  });

  it('membuang nilai yang tidak dikenal dan mengembalikan default', () => {
    const result = scheduleFilterSchema.parse({
      status: 'selesai',
      date_from: 'kemarin',
      page: 'abc',
      page_size: '9999',
    });
    expect(result.status).toBeUndefined();
    expect(result.date_from).toBeUndefined();
    expect(result.page).toBe(1);
    expect(result.page_size).toBe(20);
  });

  it('hanya menyalakan active_only untuk nilai "1"', () => {
    expect(scheduleFilterSchema.parse({ active_only: '1' }).active_only).toBe('1');
    expect(scheduleFilterSchema.parse({ active_only: '0' }).active_only).toBeUndefined();
  });
});
