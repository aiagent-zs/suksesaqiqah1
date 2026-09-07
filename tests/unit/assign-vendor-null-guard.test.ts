/**
 * Penguncian optimistik `assignVendor` pada order yang **belum punya mitra**.
 *
 * ## Kenapa berkas ini ada
 *
 * `assignVendor` memakai `vendor_id` lama sebagai syarat UPDATE supaya dua admin
 * yang menugaskan bersamaan tidak sama-sama berhasil. Selama berbulan-bulan
 * syarat itu ditulis `.eq('vendor_id', order.vendor_id as string)` — dan `as
 * string` menutupi bahwa kolomnya nullable.
 *
 * Order yang belum punya mitra **selalu** `vendor_id = null`, jadi yang rusak
 * justru jalur yang paling sering dipakai: **penugasan pertama, selalu**.
 * PostgREST menerjemahkan `.eq(col, null)` menjadi `vendor_id=eq.null`, Postgres
 * mencoba membaca string `"null"` sebagai uuid, dan menolak dengan `22P02`
 * (`invalid input syntax for type uuid: "null"`). Di layar hasilnya cuma
 * "Gagal menetapkan mitra. Coba lagi atau hubungi administrator." — pesan yang
 * mengajak mencoba lagi, padahal percobaan keberapa pun akan gagal sama.
 *
 * Tidak ada satu pun tes yang menangkapnya: tes integrasi bekerja lewat SQL
 * langsung, sementara kekeliruannya ada di lapisan PostgREST — di penerjemahan
 * `.eq()` menjadi query string, bukan di SQL-nya.
 *
 * Yang dijaga di sini: **cabang NULL memakai `.is()`, bukan `.eq()`** — dan
 * sebaliknya, penugasan ulang (vendor_id sudah terisi) tetap memakai `.eq()`
 * supaya penguncian optimistiknya tidak ikut hilang.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORDER_ID = '8f44fba0-08b2-4802-a2dd-6dab6dcc32f3';
const VENDOR_A = 'c0000000-0000-4000-8000-000000000001';
const VENDOR_B = 'c0000000-0000-4000-8000-000000000002';

/** Filter yang dipasang pada UPDATE — inilah yang diperiksa tiap tes. */
type Filter = { op: 'eq' | 'is'; column: string; value: unknown };

let updateFilters: Filter[] = [];

/**
 * Klien Supabase tiruan.
 *
 * Sengaja hanya meniru rantai yang dipakai `assignVendor`, dan **mencatat**
 * filter UPDATE-nya alih-alih menjalankan apa pun — yang diuji adalah filter
 * mana yang tersusun, bukan hasil querynya.
 */
function fakeClient(orderVendorId: string | null) {
  const orderRow = {
    id: ORDER_ID,
    status: 'new',
    distribution_mode: 'salur',
    vendor_id: orderVendorId,
  };

  const vendorRow = {
    id: VENDOR_A,
    name: 'Cerdas Aqiqah',
    is_active: true,
    service_modes: ['salur', 'kirim'],
  };

  return {
    from(table: string) {
      if (table === 'vendors') {
        const chain = {
          select: () => chain,
          eq: () => chain,
          is: () => chain,
          maybeSingle: async () => ({ data: vendorRow, error: null }),
        };
        return chain;
      }

      // `orders` dipakai dua kali: SELECT keadaan sekarang, lalu UPDATE.
      // Dibedakan lewat method mana yang dipanggil lebih dulu.
      const readChain = {
        select: () => readChain,
        eq: () => readChain,
        maybeSingle: async () => ({ data: orderRow, error: null }),
      };

      const writeChain = {
        eq(column: string, value: unknown) {
          updateFilters.push({ op: 'eq', column, value });
          return writeChain;
        },
        is(column: string, value: unknown) {
          updateFilters.push({ op: 'is', column, value });
          return writeChain;
        },
        select: async () => ({ data: [{ id: ORDER_ID }], error: null }),
      };

      return {
        select: readChain.select,
        update: () => writeChain,
      };
    },
  };
}

let clientVendorId: string | null = null;

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => fakeClient(clientVendorId),
}));
vi.mock('@/server/auth/session', () => ({
  requireAuth: async () => ({
    id: 'd0000000-0000-4000-8000-000000000002',
    email: 'admin@contoh.test',
    profile: { role: 'admin' },
  }),
}));

const { assignVendor } = await import('@/server/actions/schedules');

beforeEach(() => {
  updateFilters = [];
});

/** Filter yang menyaring kolom `vendor_id` pada UPDATE. */
function vendorGuard(): Filter | undefined {
  return updateFilters.find((f) => f.column === 'vendor_id');
}

describe('order yang belum punya mitra', () => {
  beforeEach(() => {
    clientVendorId = null;
  });

  it('berhasil ditugaskan — bukan "Gagal menetapkan mitra"', async () => {
    const result = await assignVendor({ order_id: ORDER_ID, vendor_id: VENDOR_A });
    expect(result.ok).toBe(true);
  });

  it('menjaga NULL dengan .is(), tidak pernah .eq()', async () => {
    await assignVendor({ order_id: ORDER_ID, vendor_id: VENDOR_A });

    const guard = vendorGuard();
    expect(guard).toBeDefined();
    // `.eq('vendor_id', null)` menjadi `vendor_id=eq.null` di URL, dan Postgres
    // menolaknya dengan 22P02 sebelum satu baris pun tersentuh.
    expect(guard?.op).toBe('is');
    expect(guard?.value).toBeNull();
  });

  it('tidak pernah mengirim string "null" sebagai nilai uuid', async () => {
    await assignVendor({ order_id: ORDER_ID, vendor_id: VENDOR_A });
    for (const f of updateFilters) {
      expect(f.value).not.toBe('null');
      expect(f.value).not.toBe('undefined');
    }
  });
});

describe('order yang sudah punya mitra', () => {
  beforeEach(() => {
    clientVendorId = VENDOR_A;
  });

  it('tetap mengunci pada mitra lama dengan .eq()', async () => {
    // Penguncian optimistiknya tidak boleh ikut hilang saat memperbaiki cabang
    // NULL: tanpa syarat ini, admin kedua menimpa penugasan admin pertama tanpa
    // ada yang tahu.
    const result = await assignVendor({ order_id: ORDER_ID, vendor_id: VENDOR_B });
    expect(result.ok).toBe(true);

    const guard = vendorGuard();
    expect(guard?.op).toBe('eq');
    expect(guard?.value).toBe(VENDOR_A);
  });
});
