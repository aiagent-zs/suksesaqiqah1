import { describe, expect, it } from 'vitest';
import {
  cateringCheckoutSchema,
  MAX_ITEM_LINES,
  MAX_TOTAL_BOXES,
} from '@/features/catering/schema';
import { addCalendarDays, todayWib } from '@/lib/format/date-range';
import { BOOKING_MIN_DAYS } from '@/features/checkout/schema';

/**
 * Schema checkout katering.
 *
 * Yang dijaga di sini bukan pesan galatnya, melainkan **batas yang sama dengan
 * `create_catering_order`**. Keduanya sengaja kembar: yang di database mengikat,
 * yang di sini hanya supaya penolakannya menempel pada medan yang tepat di form
 * alih-alih datang sebagai galat Postgres yang tidak dimengerti pemesan.
 *
 * Kalau keduanya menyimpang, gejalanya persis yang sudah pernah terjadi di repo
 * ini pada jendela pemesanan (form 30 hari, RPC 7 hari): pemesan lolos seluruh
 * isian, menekan konfirmasi, lalu ditolak database.
 */

const UUID_A = 'a2000000-0000-4000-8000-000000000031';
const UUID_B = 'a2000000-0000-4000-8000-000000000032';

/** Tanggal yang selalu sah: batas bawah jendela pemesanan. */
const OK_DATE = addCalendarDays(todayWib(), BOOKING_MIN_DAYS);

const VALID = {
  items: [{ service_id: UUID_A, qty: 50 }],
  requested_date: OK_DATE,
  requested_time: '09:00',
  name: 'Budi Santoso',
  phone: '081234567890',
  email: 'budi@example.test',
  delivery_province_code: '32',
  delivery_city_code: '32.73',
  delivery_district_code: '32.73.01',
  delivery_village_code: '32.73.01.1001',
  delivery_postal_code: '40286',
  delivery_detail: 'Jl. Merdeka No. 10',
};

describe('cateringCheckoutSchema', () => {
  it('menerima pesanan yang lengkap', () => {
    expect(cateringCheckoutSchema.safeParse(VALID).success).toBe(true);
  });

  it('menerima beberapa paket sekaligus', () => {
    // K3: satu order boleh memuat lebih dari satu jenis paket.
    const result = cateringCheckoutSchema.safeParse({
      ...VALID,
      items: [
        { service_id: UUID_A, qty: 50 },
        { service_id: UUID_B, qty: 30 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('menolak paket yang sama dua kali', () => {
    // Bukan pesanan sungguhan melainkan kekeliruan pengisian — dan kalau lolos,
    // ia menghasilkan dua baris `order_items` untuk paket yang sama.
    const result = cateringCheckoutSchema.safeParse({
      ...VALID,
      items: [
        { service_id: UUID_A, qty: 50 },
        { service_id: UUID_A, qty: 30 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('menolak pesanan tanpa satu pun paket', () => {
    expect(cateringCheckoutSchema.safeParse({ ...VALID, items: [] }).success).toBe(false);
  });

  it(`menolak lebih dari ${MAX_ITEM_LINES} jenis paket`, () => {
    const items = Array.from({ length: MAX_ITEM_LINES + 1 }, (_, i) => ({
      // UUID berbeda tiap baris, supaya yang ditolak benar-benar jumlahnya —
      // bukan aturan duplikat di atas.
      service_id: `a2000000-0000-4000-8000-0000000000${String(40 + i).padStart(2, '0')}`,
      qty: 1,
    }));
    expect(cateringCheckoutSchema.safeParse({ ...VALID, items }).success).toBe(false);
  });

  it('menolak total box di atas batas', () => {
    const result = cateringCheckoutSchema.safeParse({
      ...VALID,
      items: [
        { service_id: UUID_A, qty: 5000 },
        { service_id: UUID_B, qty: 5001 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('menolak jumlah box nol atau negatif', () => {
    for (const qty of [0, -1]) {
      const result = cateringCheckoutSchema.safeParse({
        ...VALID,
        items: [{ service_id: UUID_A, qty }],
      });
      expect(result.success).toBe(false);
    }
  });

  describe('alamat — wajib tanpa syarat', () => {
    // Berbeda dari checkout aqiqah yang mewajibkannya hanya saat mode `kirim`:
    // katering selalu diantar, jadi tidak ada cabang yang mengosongkannya.
    for (const field of [
      'delivery_province_code',
      'delivery_city_code',
      'delivery_district_code',
      'delivery_village_code',
      'delivery_postal_code',
      'delivery_detail',
    ]) {
      it(`menolak tanpa ${field}`, () => {
        const result = cateringCheckoutSchema.safeParse({ ...VALID, [field]: '' });
        expect(result.success).toBe(false);
      });
    }

    it('menolak wilayah yang tidak sejalur', () => {
      // Empat kode yang masing-masing sah bentuknya, tapi merakit alamat yang
      // tidak pernah ada: kelurahan dari kecamatan lain.
      const result = cateringCheckoutSchema.safeParse({
        ...VALID,
        delivery_village_code: '32.04.01.1001',
      });
      expect(result.success).toBe(false);
    });

    it('menolak kode pos bukan 5 digit', () => {
      for (const postal of ['402', '4028a', '402861']) {
        const result = cateringCheckoutSchema.safeParse({
          ...VALID,
          delivery_postal_code: postal,
        });
        expect(result.success).toBe(false);
      }
    });
  });

  describe('jendela pemesanan — sama dengan checkout aqiqah', () => {
    it('menolak tanggal yang sudah lewat', () => {
      const result = cateringCheckoutSchema.safeParse({
        ...VALID,
        requested_date: addCalendarDays(todayWib(), -1),
      });
      expect(result.success).toBe(false);
    });

    it('menolak tanggal di dalam jeda persiapan', () => {
      // Hari pengisian form sendiri: sah bentuknya, ditolak aturannya.
      const result = cateringCheckoutSchema.safeParse({
        ...VALID,
        requested_date: todayWib(),
      });
      expect(result.success).toBe(false);
    });

    it('menolak tanggal di luar jendela atas', () => {
      const result = cateringCheckoutSchema.safeParse({
        ...VALID,
        requested_date: addCalendarDays(todayWib(), 400),
      });
      expect(result.success).toBe(false);
    });

    it('menolak jam di luar slot yang ditawarkan', () => {
      const result = cateringCheckoutSchema.safeParse({ ...VALID, requested_time: '03:00' });
      expect(result.success).toBe(false);
    });
  });

  describe('identitas pemesan', () => {
    it('menolak nama terlalu pendek', () => {
      expect(cateringCheckoutSchema.safeParse({ ...VALID, name: 'A' }).success).toBe(false);
    });

    it('menolak nomor telepon berisi huruf', () => {
      const result = cateringCheckoutSchema.safeParse({ ...VALID, phone: '0812abcd5678' });
      expect(result.success).toBe(false);
    });

    it('mewajibkan email', () => {
      // Dipakai mengirim salinan pesanan dan tautan laporan pelaksanaan.
      expect(cateringCheckoutSchema.safeParse({ ...VALID, email: '' }).success).toBe(false);
      expect(cateringCheckoutSchema.safeParse({ ...VALID, email: 'bukan-email' }).success).toBe(
        false,
      );
    });
  });

  it('tidak menyediakan tempat untuk harga maupun mode penyaluran', () => {
    // Pertahanan inti checkout: harga dibaca RPC dari `services`. Dan katering
    // selalu `kirim` — modenya ditetapkan RPC, bukan dipilih pemesan.
    const parsed = cateringCheckoutSchema.safeParse({
      ...VALID,
      total_amount: 1,
      distribution_mode: 'salur',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty('total_amount');
      expect(parsed.data).not.toHaveProperty('distribution_mode');
    }
  });

  it('batasnya sama dengan yang ditulis di RPC', async () => {
    // Kembaran yang paling gampang menyimpang: angka di sini dan di SQL.
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const sql = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260921030000_create_catering_order.sql'),
      'utf8',
    );

    expect(sql).toContain(`v_item_count > ${MAX_ITEM_LINES}`);
    expect(sql).toContain(`v_total_boxes > ${MAX_TOTAL_BOXES}`);
  });
});
