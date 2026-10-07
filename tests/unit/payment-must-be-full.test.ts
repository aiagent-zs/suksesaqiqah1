/**
 * `recordPayment` hanya menerima **pelunasan penuh**.
 *
 * ## Kenapa berkas ini ada
 *
 * Sampai 29 September 2026 order berjalan begitu pembayaran terverifikasi
 * mencapai setengah nilainya (`app_settings.min_dp_ratio`), jadi nominal berapa
 * pun di bawah sisa tagihan sah dicatat. Keputusan pemilik mencabut DP parsial:
 * order tidak bergerak sampai lunas.
 *
 * Mencabut gerbangnya saja tidak cukup. Kalau pencatatan tetap menerima
 * nominal sebagian, hasilnya justru lebih buruk daripada sebelumnya — uang
 * masuk, tercatat, terverifikasi, dan **tidak menggerakkan apa pun**, tanpa
 * satu pun pesan yang menjelaskan kenapa. Penolakannya harus terjadi di muka,
 * saat operator masih menatap formnya.
 *
 * Yang dijaga di sini: nominal wajib **persis** sisa tagihan, dan kalimat
 * penolakannya membedakan kurang dari lebih. Keduanya kalimat yang dibaca
 * operator, bukan sekadar boolean.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORDER_ID = '8f44fba0-08b2-4802-a2dd-6dab6dcc32f3';

/** Nilai order & yang sudah terverifikasi — ditimpa tiap tes. */
let orderTotal = 2_800_000;
let orderPaid = 0;

/** Baris yang benar-benar sampai ke tabel `payments`, atau null bila ditolak. */
let inserted: Record<string, unknown> | null = null;

/**
 * Klien Supabase tiruan.
 *
 * Meniru hanya rantai yang dipakai `recordPayment`: SELECT konteks order, lalu
 * INSERT pembayaran. INSERT-nya **dicatat**, bukan dijalankan — yang diuji
 * adalah apakah ia sampai ke sana sama sekali.
 */
function fakeClient() {
  return {
    from(table: string) {
      if (table === 'orders') {
        const chain = {
          select: () => chain,
          eq: () => chain,
          maybeSingle: async () => ({
            data: {
              id: ORDER_ID,
              order_number: 'IA-202609-0001',
              total_amount: orderTotal,
              paid_amount: orderPaid,
              vendor: null,
            },
            error: null,
          }),
        };
        return chain;
      }

      const insertChain = {
        select: () => insertChain,
        maybeSingle: async () => ({ data: { id: 'p1' }, error: null }),
      };

      return {
        insert(row: Record<string, unknown>) {
          inserted = row;
          return insertChain;
        },
      };
    },
  };
}

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => fakeClient() }));
vi.mock('@/server/auth/session', () => ({
  requireAuth: async () => ({
    id: 'd0000000-0000-4000-8000-000000000002',
    email: 'admin@contoh.test',
    profile: { role: 'admin' },
  }),
}));

const { recordPayment } = await import('@/server/actions/payments');

const record = (amount: number) =>
  recordPayment({ order_id: ORDER_ID, amount, method: 'transfer_bank' });

beforeEach(() => {
  orderTotal = 2_800_000;
  orderPaid = 0;
  inserted = null;
});

describe('nominal wajib persis sisa tagihan', () => {
  it('pelunasan penuh diterima', async () => {
    const result = await record(2_800_000);
    expect(result.ok).toBe(true);
    expect(inserted?.amount).toBe(2_800_000);
  });

  it('separuh ditolak, dan tidak ada baris yang tersimpan', async () => {
    // Nominal yang dulu justru lolos: 50% dari 2.800.000.
    const result = await record(1_400_000);
    expect(result.ok).toBe(false);
    // Yang paling penting: penolakannya terjadi sebelum INSERT, jadi tidak ada
    // uang yang tercatat lalu menggantung tanpa menggerakkan status.
    expect(inserted).toBeNull();
  });

  it('kurang serupiah pun ditolak', async () => {
    const result = await record(2_799_999);
    expect(result.ok).toBe(false);
    expect(inserted).toBeNull();
  });

  it('kelebihan bayar tetap ditolak seperti sebelumnya', async () => {
    const result = await record(2_800_001);
    expect(result.ok).toBe(false);
    expect(inserted).toBeNull();
  });
});

describe('kalimat penolakannya membedakan kurang dan lebih', () => {
  it('nominal kurang menyebut keharusan lunas', async () => {
    // "Melebihi sisa tagihan" pada nominal yang justru kurang akan menyuruh
    // operator menurunkan angka yang sudah terlalu rendah.
    const result = await record(1_400_000);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/lunas/i);
      expect(result.error.fields?.amount).toMatch(/pas/i);
    }
  });

  it('nominal lebih menyebut kelebihan', async () => {
    const result = await record(3_000_000);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/[Mm]elebihi/);
  });
});

describe('sisa tagihan dihitung dari yang sudah terverifikasi', () => {
  it('order yang sudah sebagian terbayar menuntut sisanya, bukan nilai penuh', async () => {
    // Keadaan warisan: order yang terlanjur menerima DP sebelum aturan ini.
    // Ia harus tetap bisa dilunasi — yang diminta sisanya, bukan nilai penuh.
    orderPaid = 1_400_000;

    const kurang = await record(1_000_000);
    expect(kurang.ok).toBe(false);

    const pas = await record(1_400_000);
    expect(pas.ok).toBe(true);
    expect(inserted?.amount).toBe(1_400_000);
  });
});

describe('order tanpa nilai', () => {
  it('tidak ikut tertahan aturan pelunasan', async () => {
    // `total_amount = 0` berarti nilainya belum diisi, bukan gratis. Aturan
    // "harus pas" tidak berlaku di sini; yang menahannya adalah gerbang status
    // yang membaca `payment_status`, dan itu tetap `unpaid`.
    orderTotal = 0;
    const result = await record(500_000);
    expect(result.ok).toBe(true);
  });
});
