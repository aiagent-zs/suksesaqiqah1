import { describe, expect, it } from 'vitest';
import { orderFilterSchema } from '@/features/orders/schema';

/**
 * Isi filter berasal dari query string yang bisa disunting siapa saja lewat
 * tautan. Halaman /orders memanggil `.parse()` langsung, jadi setiap nilai
 * ngawur harus jatuh ke default — bukan melempar dan menjatuhkan halaman.
 */
describe('orderFilterSchema — masukan ngawur', () => {
  it('tidak pernah melempar untuk query string sembarang', () => {
    const garbage = {
      status: 'xyz',
      payment_status: '1 OR 1=1',
      branch_id: 'bukan-uuid',
      location_id: '../../etc/passwd',
      pic_id: '',
      date_from: '06-08-2026',
      date_to: 'kemarin',
      page: 'abc',
      page_size: '-5',
    };

    expect(() => orderFilterSchema.parse(garbage)).not.toThrow();
  });

  it('membuang status di luar enum alih-alih meneruskannya ke Postgres', () => {
    // `.eq('status', 'xyz')` akan ditolak Postgres sebagai enum tak valid dan
    // menjatuhkan seluruh halaman daftar order.
    expect(orderFilterSchema.parse({ status: 'xyz' }).status).toBeUndefined();
    expect(orderFilterSchema.parse({ payment_status: 'lunas' }).payment_status).toBeUndefined();
  });

  it('membuang id yang bukan uuid', () => {
    expect(orderFilterSchema.parse({ branch_id: 'bukan-uuid' }).branch_id).toBeUndefined();
  });

  it('membuang tanggal di luar format YYYY-MM-DD', () => {
    expect(orderFilterSchema.parse({ date_from: '06-08-2026' }).date_from).toBeUndefined();
    expect(orderFilterSchema.parse({ date_to: 'kemarin' }).date_to).toBeUndefined();
  });

  it('mengembalikan paginasi ke default saat nilainya tidak masuk akal', () => {
    expect(orderFilterSchema.parse({ page: 'abc' }).page).toBe(1);
    expect(orderFilterSchema.parse({ page: '0' }).page).toBe(1);
    expect(orderFilterSchema.parse({ page_size: '-5' }).page_size).toBe(20);
    expect(orderFilterSchema.parse({ page_size: '9999' }).page_size).toBe(20);
  });
});

describe('orderFilterSchema — masukan sah', () => {
  it('meneruskan nilai yang valid apa adanya', () => {
    const result = orderFilterSchema.parse({
      status: 'scheduled',
      payment_status: 'partial',
      branch_id: '3f1a9c62-5f4b-4c1e-9a2d-8e7b6c5d4a3f',
      date_from: '2026-08-01',
      date_to: '2026-08-31',
      q: '  ORD-0001  ',
      page: '3',
      page_size: '50',
    });

    expect(result.status).toBe('scheduled');
    expect(result.payment_status).toBe('partial');
    expect(result.branch_id).toBe('3f1a9c62-5f4b-4c1e-9a2d-8e7b6c5d4a3f');
    expect(result.date_from).toBe('2026-08-01');
    expect(result.q).toBe('ORD-0001');
    expect(result.page).toBe(3);
    expect(result.page_size).toBe(50);
  });

  it('memakai default saat filter kosong', () => {
    const result = orderFilterSchema.parse({});

    expect(result.page).toBe(1);
    expect(result.page_size).toBe(20);
    expect(result.status).toBeUndefined();
  });
});
