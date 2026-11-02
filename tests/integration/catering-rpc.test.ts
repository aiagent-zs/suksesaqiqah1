/**
 * `create_catering_order` — RPC checkout katering.
 *
 * `security definer`, jadi ia berjalan dengan hak pemiliknya dan **melewati
 * RLS**. Sama seperti `create_guest_order`, satu-satunya yang menjaga harga dan
 * kelayakan paket adalah kode di dalam fungsi itu sendiri.
 *
 * `catering-schema.test.ts` sudah menguji validasi sisi klien. Yang diuji di
 * sini berbeda dan tidak tergantikan: apa yang terjadi ketika klien
 * **dilewati** — payload dikirim langsung ke RPC dengan harga karangan sendiri,
 * paket yang bukan katering, atau jumlah di luar batas.
 *
 * Satu hal lagi yang hanya bisa dibuktikan di database: **nol baris `animals`**,
 * dan akibatnya pada daftar tahap yang terbit otomatis.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { actAsOwner, expectFailureInSavepoint, inRollback, isReady } from './helpers/db';
import type postgres from 'postgres';

/**
 * Dari `20261007020000_catering_variants_packages.sql`. Paket `katering` lama
 * (…031–033) dinonaktifkan `20261007030000`, jadi RPC menolaknya.
 */
const CATERING = {
  sederhana: 'a2000000-0000-4000-8000-000000000041',
  sederhanaPrice: 28_000,
  lengkap: 'a2000000-0000-4000-8000-000000000042',
  lengkapPrice: 38_000,
} as const;

/** Paket aqiqah — dipakai membuktikan RPC menolak yang bukan katering. */
const AQIQAH_FAVORIT = 'a2000000-0000-4000-8000-000000000002';

const REGION = {
  province: '32',
  city: '32.75',
  district: '32.75.01',
  village: '32.75.01.1001',
} as const;

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type Payload = { [key: string]: Json };

function validPayload(over: Payload = {}): Payload {
  return {
    participant: {
      name: 'Panitia Uji',
      phone: '081200000021',
      email: 'panitia@example.test',
      address: 'Jl. Uji No. 2',
    },
    items: [{ service_id: CATERING.sederhana, qty: 50 }],
    requested_date: null,
    requested_time: '09:00',
    delivery_province_code: REGION.province,
    delivery_city_code: REGION.city,
    delivery_district_code: REGION.district,
    delivery_village_code: REGION.village,
    delivery_postal_code: '40286',
    delivery_detail: 'Aula RT 05',
    recipient_institution: 'Pengajian RT 05',
    ...over,
  };
}

/** Tanggal N hari ke depan menurut WIB — acuan yang sama dipakai RPC. */
async function wibDate(tx: postgres.TransactionSql, plusDays: number): Promise<string> {
  const [row] = await tx<{ d: string }[]>`
    select ((now() at time zone 'Asia/Jakarta')::date + ${plusDays}::int)::text as d
  `;
  return row.d;
}

/**
 * Bawa order katering sampai `assigned`, menempuh verifikasi lebih dulu.
 *
 * **Verifikasinya tidak bisa dilewati, dan itu memang benar.** Order dari
 * `create_catering_order` adalah order tamu (`created_by IS NULL`), jadi
 * `enforce_guest_order_verification` menahannya sampai admin memeriksa —
 * aturan yang sama persis dengan order aqiqah dari checkout publik, dan tidak
 * ada alasan katering dikecualikan.
 *
 * Transisinya ditempuh sungguhan sampai `assigned` karena **itulah yang memicu**
 * `generate_stage_checklist`. Menyisipkan baris tahap secara manual tidak
 * membuktikan trigger-nya bekerja.
 */
async function assignAfterVerification(tx: postgres.TransactionSql, orderNumber: string) {
  await tx`
    update public.orders set
      guest_verified_at = now(),
      guest_verified_by = 'd0000000-0000-4000-8000-000000000002',
      status = 'verified'
    where order_number = ${orderNumber}
  `;
  await tx`
    update public.orders set
      status = 'assigned',
      vendor_id = 'c0000000-0000-4000-8000-000000000001',
      payment_status = 'paid',
      paid_amount = total_amount
    where order_number = ${orderNumber}
  `;
}

/** Panggil RPC dengan tanggal yang sah, kecuali tes menimpanya sendiri. */
async function callCreate(tx: postgres.TransactionSql, over: Payload = {}) {
  const payload = validPayload(over);
  if (payload.requested_date === null) payload.requested_date = await wibDate(tx, 3);

  const [row] = await tx<{ result: Record<string, unknown> }[]>`
    select public.create_catering_order(${tx.json(payload)}::jsonb) as result
  `;
  return row.result;
}

beforeAll(async () => {
  const ready = await isReady();
  if (!ready.ok) throw new Error(ready.reason);
});

describe('create_catering_order — jalur yang berhasil', () => {
  it('membuat order beserta nomor & tokennya', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const result = await callCreate(tx);

      expect(result.order_number).toMatch(/^IA-\d{6}-\d{4}$/);
      expect(String(result.public_token)).toHaveLength(32);
      expect(Number(result.total_amount)).toBe(CATERING.sederhanaPrice * 50);
      expect(result.status).toBe('new');
      expect(result.payment_status).toBe('unpaid');
    });
  });

  it('menerima beberapa paket sekaligus dan menjumlahkan harganya', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const result = await callCreate(tx, {
        items: [
          { service_id: CATERING.sederhana, qty: 50 },
          { service_id: CATERING.lengkap, qty: 30 },
        ],
      });

      expect(Number(result.total_amount)).toBe(
        CATERING.sederhanaPrice * 50 + CATERING.lengkapPrice * 30,
      );

      const [{ count }] = await tx<{ count: number }[]>`
        select count(*)::int as count from public.order_items oi
        join public.orders o on o.id = oi.order_id
        where o.order_number = ${String(result.order_number)}
      `;
      expect(count).toBe(2);
    });
  });

  it('modenya selalu kirim, tanpa ditanyakan', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      // Payload sengaja menyertakan `salur`; RPC harus mengabaikannya.
      const result = await callCreate(tx, { distribution_mode: 'salur' });

      const [order] = await tx<{ distribution_mode: string }[]>`
        select distribution_mode from public.orders
        where order_number = ${String(result.order_number)}
      `;
      expect(order.distribution_mode).toBe('kirim');
    });
  });

  it('merakit alamat dari nama wilayah di database', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const result = await callCreate(tx);

      const [order] = await tx<{ delivery_address: string; delivery_city: string }[]>`
        select delivery_address, delivery_city from public.orders
        where order_number = ${String(result.order_number)}
      `;
      // Namanya dibaca RPC dari `regions`, bukan dari klien — payload di atas
      // tidak pernah mengirimkan satu pun nama wilayah.
      expect(order.delivery_city).toBeTruthy();
      expect(order.delivery_address).toContain(order.delivery_city);
    });
  });
});

describe('create_catering_order — harga tidak pernah dari klien', () => {
  it('mengabaikan harga karangan di payload', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const result = await callCreate(tx, {
        total_amount: 1,
        paid_amount: 999_999,
        payment_status: 'paid',
        status: 'completed',
        items: [{ service_id: CATERING.sederhana, qty: 10, unit_price: 1 }],
      });

      // Harga dibaca dari `services`, bukan dari payload.
      expect(Number(result.total_amount)).toBe(CATERING.sederhanaPrice * 10);
      expect(result.status).toBe('new');
      expect(result.payment_status).toBe('unpaid');

      const [order] = await tx<{ paid_amount: string }[]>`
        select paid_amount from public.orders
        where order_number = ${String(result.order_number)}
      `;
      expect(Number(order.paid_amount)).toBe(0);
    });
  });

  it('menyimpan unit_price dari katalog, bukan dari klien', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const result = await callCreate(tx, {
        items: [{ service_id: CATERING.lengkap, qty: 5, unit_price: 1 }],
      });

      const [item] = await tx<{ unit_price: string }[]>`
        select oi.unit_price from public.order_items oi
        join public.orders o on o.id = oi.order_id
        where o.order_number = ${String(result.order_number)}
      `;
      expect(Number(item.unit_price)).toBe(CATERING.lengkapPrice);
    });
  });
});

describe('create_catering_order — penolakan', () => {
  it('menolak paket yang bukan katering', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      await expectFailureInSavepoint(tx, () =>
        callCreate(tx, { items: [{ service_id: AQIQAH_FAVORIT, qty: 10 }] }),
      );
    });
  });

  it('menolak pesanan tanpa satu pun paket', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      await expectFailureInSavepoint(tx, () => callCreate(tx, { items: [] }));
    });
  });

  it('menolak paket yang sama dua kali', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      await expectFailureInSavepoint(tx, () =>
        callCreate(tx, {
          items: [
            { service_id: CATERING.sederhana, qty: 10 },
            { service_id: CATERING.sederhana, qty: 20 },
          ],
        }),
      );
    });
  });

  it('menolak jumlah box di luar batas', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      await expectFailureInSavepoint(tx, () =>
        callCreate(tx, { items: [{ service_id: CATERING.sederhana, qty: 0 }] }),
      );
    });
  });

  it('menolak total box di atas batas keseluruhan', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      // Dua baris yang masing-masing sah, tetapi jumlahnya melebihi 10.000.
      await expectFailureInSavepoint(tx, () =>
        callCreate(tx, {
          items: [
            { service_id: CATERING.sederhana, qty: 5000 },
            { service_id: CATERING.lengkap, qty: 5001 },
          ],
        }),
      );
    });
  });

  it('menolak alamat yang tidak lengkap', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      // Katering selalu diantar, jadi alamat wajib tanpa syarat.
      await expectFailureInSavepoint(tx, () => callCreate(tx, { delivery_detail: '' }));
    });
  });

  it('menolak wilayah yang tidak sejalur', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      await expectFailureInSavepoint(tx, () =>
        callCreate(tx, { delivery_village_code: '32.04.01.1001' }),
      );
    });
  });

  it('menolak tanggal di dalam jeda persiapan', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const today = await wibDate(tx, 0);
      await expectFailureInSavepoint(tx, () => callCreate(tx, { requested_date: today }));
    });
  });
});

/**
 * Inilah yang membuat katering bekerja tanpa mengubah `fulfilment_sequence()`.
 *
 * Cabang `sembelih` di `generate_stage_checklist` mengambil barisnya dari tabel
 * hewan, jadi order tanpa hewan menghasilkan nol baris sembelih dengan
 * sendirinya — dan tahapnya menjadi persiapan → masak → kirim → terkirim.
 */
describe('katering tidak melahirkan hewan, dan tahapnya menyesuaikan', () => {
  it('nol baris animals', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const result = await callCreate(tx);

      const [{ count }] = await tx<{ count: number }[]>`
        select count(*)::int as count from public.animals a
        join public.orders o on o.id = a.order_id
        where o.order_number = ${String(result.order_number)}
      `;
      expect(count).toBe(0);
    });
  });

  it('tahapnya persis empat, tanpa sembelih', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const result = await callCreate(tx);

      // Tempuh transisinya sungguhan sampai `assigned` — itulah yang memicu
      // `generate_stage_checklist`. Menyisipkan tahap secara manual tidak
      // membuktikan trigger-nya bekerja.
      await assignAfterVerification(tx, String(result.order_number));

      const stages = await tx<{ stage: string; seq: number }[]>`
        select e.stage::text as stage, e.seq from public.order_stage_events e
        join public.orders o on o.id = e.order_id
        where o.order_number = ${String(result.order_number)}
        order by e.seq
      `;

      expect(stages.map((s) => s.stage)).toEqual(['persiapan', 'masak', 'kirim', 'terkirim']);
    });
  });
});

/**
 * K2 — vendor katering tidak dituntut bukti masak.
 *
 * Ditegakkan di `missing_doc_stages` (view), bukan dengan menurunkan
 * `stage_requirements.min_docs`: tabel itu berlaku global per tahap, jadi
 * menurunkannya akan ikut melepas gerbang bukti masak untuk **seluruh order
 * aqiqah** yang sudah berjalan.
 */
describe('gerbang bukti masak dibebaskan untuk katering', () => {
  it('stage_requirements tetap menuntut bukti masak', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const [row] = await tx<{ min_docs: number }[]>`
        select min_docs from public.stage_requirements where stage = 'masak'
      `;
      // Aturan aqiqah tidak tersentuh — inilah yang dijaga.
      expect(row.min_docs).toBe(1);
    });
  });

  it('masak tidak muncul di missing_doc_stages order katering', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const result = await callCreate(tx);

      await assignAfterVerification(tx, String(result.order_number));

      const [progress] = await tx<{ missing_doc_stages: string[] }[]>`
        select pr.missing_doc_stages from public.v_order_progress pr
        join public.orders o on o.id = pr.order_id
        where o.order_number = ${String(result.order_number)}
      `;

      expect(progress.missing_doc_stages).not.toContain('masak');
    });
  });

  it('is_catering_order mengenali ordernya dari jenis item', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const result = await callCreate(tx);

      const [row] = await tx<{ is_catering: boolean }[]>`
        select public.is_catering_order(o.id) as is_catering
        from public.orders o where o.order_number = ${String(result.order_number)}
      `;
      expect(row.is_catering).toBe(true);
    });
  });
});
