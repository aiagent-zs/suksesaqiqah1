/**
 * `create_guest_order` & `confirm_delivery` — dua RPC yang dipanggil pengunjung
 * anonim.
 *
 * Keduanya `security definer`, artinya berjalan dengan hak pemiliknya dan
 * **melewati RLS**. Itu menjadikan keduanya permukaan serang paling terbuka di
 * seluruh skema: satu-satunya yang menjaga harga, kelayakan paket, dan batas
 * tanggal adalah kode di dalam fungsi itu sendiri.
 *
 * `checkout-schema.test.ts` sudah menguji validasi sisi klien. Yang diuji di
 * sini berbeda dan tidak tergantikan: apa yang terjadi ketika klien **dilewati**
 * — payload dikirim langsung ke RPC dengan harga karangan sendiri.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { actAs, actAsOwner, expectFailureInSavepoint, inRollback, isReady } from './helpers/db';
import type postgres from 'postgres';

const SERVICE = {
  aqiqahFavorit: 'a2000000-0000-4000-8000-000000000002',
  aqiqahFavoritPrice: 2_800_000,
  nasiBoxA: 'a2000000-0000-4000-8000-000000000011',
  nasiBoxAPrice: 21_000,
} as const;

const REGION = {
  province: '32',
  city: '32.73',
  district: '32.73.11',
  village: '32.73.11.1001',
} as const;

/**
 * Bentuk payload yang diterima `tx.json()`.
 *
 * `Record<string, unknown>` ditolak `postgres.js` karena `unknown` tidak
 * menyempit ke `JSONValue`-nya. Tipe rekursif ini membuat payload uji tetap
 * bebas bentuk — memang harus, sebab yang diuji termasuk field karangan yang
 * tidak ada di skema checkout — tanpa melepas pemeriksaan tipe seluruhnya.
 */
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type Payload = { [key: string]: Json };

/** Payload checkout yang sah — tes memodifikasinya per kasus. */
function validPayload(over: Payload = {}): Payload {
  return {
    participant: {
      name: 'Pemesan Uji',
      phone: '081200000001',
      email: 'uji@example.test',
      address: 'Jl. Uji No. 1',
    },
    service_id: SERVICE.aqiqahFavorit,
    qty: 1,
    species: 'kambing',
    aqiqah_for: 'laki_laki',
    on_behalf_of: 'Anak Uji',
    child_birth_place: 'Bandung',
    child_birth_date: '2026-07-01',
    distribution_mode: 'salur',
    requested_date: null,
    requested_time: '09:00',
    ...over,
  };
}

/** Tanggal N hari ke depan menurut WIB — acuan yang sama dipakai RPC. */
async function wibDate(tx: postgres.TransactionSql, plusDays: number): Promise<string> {
  // `::int` wajib: tanpanya parameternya untyped dan `date + unknown` ambigu
  // di Postgres (bisa date+int atau date+interval).
  const [row] = await tx<{ d: string }[]>`
    select ((now() at time zone 'Asia/Jakarta')::date + ${plusDays}::int)::text as d
  `;
  return row.d;
}

async function callCreate(
  tx: postgres.TransactionSql,
  payload: Payload,
): Promise<Record<string, unknown>> {
  const [row] = await tx<{ result: Record<string, unknown> }[]>`
    select public.create_guest_order(${tx.json(payload)}::jsonb) as result
  `;
  return row.result;
}

beforeAll(async () => {
  const ready = await isReady();
  if (!ready.ok) throw new Error(ready.reason);
});

describe('create_guest_order — jalur berhasil', () => {
  it('membuat order, item, dan hewan dalam satu panggilan', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, null, 'anon');
      const requested = await wibDate(tx, 5);
      const result = await callCreate(tx, validPayload({ requested_date: requested }));

      expect(result.order_number).toMatch(/^IA-\d{6}-\d{4}$/);
      expect(String(result.public_token)).toHaveLength(32);
      expect(Number(result.total_amount)).toBe(SERVICE.aqiqahFavoritPrice);
      expect(result.status).toBe('new');
      expect(result.payment_status).toBe('unpaid');

      await actAsOwner(tx);
      const [counts] = await tx<{ items: number; animals: number }[]>`
        select
          (select count(*)::int from public.order_items i
             join public.orders o on o.id = i.order_id
            where o.public_token = ${result.public_token as string}) as items,
          (select count(*)::int from public.animals a
             join public.orders o on o.id = a.order_id
            where o.public_token = ${result.public_token as string}) as animals
      `;
      expect(counts.items).toBe(1);
      expect(counts.animals).toBe(1);
    });
  });

  it('qty > 1 menerbitkan satu hewan per ekor dan mengalikan harga', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, null, 'anon');
      const result = await callCreate(
        tx,
        validPayload({ qty: 3, requested_date: await wibDate(tx, 5) }),
      );

      expect(Number(result.total_amount)).toBe(SERVICE.aqiqahFavoritPrice * 3);

      await actAsOwner(tx);
      const [row] = await tx<{ animals: number }[]>`
        select count(*)::int as animals from public.animals a
        join public.orders o on o.id = a.order_id
        where o.public_token = ${result.public_token as string}
      `;
      expect(row.animals).toBe(3);
    });
  });

  it('nasi box menambah item tetapi TIDAK menambah ekor hewan', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, null, 'anon');
      const result = await callCreate(
        tx,
        validPayload({
          requested_date: await wibDate(tx, 5),
          nasi_box_service_id: SERVICE.nasiBoxA,
          nasi_box_qty: 50,
        }),
      );

      expect(Number(result.total_amount)).toBe(
        SERVICE.aqiqahFavoritPrice + SERVICE.nasiBoxAPrice * 50,
      );

      await actAsOwner(tx);
      const [row] = await tx<{ items: number; animals: number }[]>`
        select
          (select count(*)::int from public.order_items i join public.orders o on o.id = i.order_id
            where o.public_token = ${result.public_token as string}) as items,
          (select count(*)::int from public.animals a join public.orders o on o.id = a.order_id
            where o.public_token = ${result.public_token as string}) as animals
      `;
      expect(row.items).toBe(2);
      // Nasi box adalah makanan, bukan ekor yang disembelih.
      expect(row.animals).toBe(1);
    });
  });

  it('mode kirim merakit alamat dari nama wilayah di database', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, null, 'anon');
      const result = await callCreate(
        tx,
        validPayload({
          requested_date: await wibDate(tx, 5),
          distribution_mode: 'kirim',
          delivery_province_code: REGION.province,
          delivery_city_code: REGION.city,
          delivery_district_code: REGION.district,
          delivery_village_code: REGION.village,
          delivery_postal_code: '40252',
          delivery_detail: 'Jl. Uji No. 9',
        }),
      );

      await actAsOwner(tx);
      const [row] = await tx<
        {
          delivery_address: string;
          delivery_city: string;
          delivery_province: string;
        }[]
      >`
        select delivery_address, delivery_city, delivery_province
        from public.orders where public_token = ${result.public_token as string}
      `;

      // Nama diambil dari `regions`, tidak pernah dari klien — yang dibaca kurir
      // adalah namanya, jadi nama yang salah kirim berarti paket salah alamat.
      expect(row.delivery_city).toBe('Kota Bandung');
      expect(row.delivery_province).toBe('Jawa Barat');
      expect(row.delivery_address).toContain('Jl. Uji No. 9');
      expect(row.delivery_address).toContain('Kota Bandung');
    });
  });

  it('mode salur membuang alamat yang sempat terisi', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, null, 'anon');
      const result = await callCreate(
        tx,
        validPayload({
          requested_date: await wibDate(tx, 5),
          distribution_mode: 'salur',
          // Pemesan sempat memilih kirim lalu berpindah ke salur.
          delivery_province_code: REGION.province,
          delivery_city_code: REGION.city,
          delivery_district_code: REGION.district,
          delivery_village_code: REGION.village,
          delivery_detail: 'Jl. Sisa No. 1',
        }),
      );

      await actAsOwner(tx);
      const [row] = await tx<{ addr: string | null; city: string | null }[]>`
        select delivery_address as addr, delivery_city as city
        from public.orders where public_token = ${result.public_token as string}
      `;
      // Disimpan diam-diam berarti alamat yang tidak pernah diminta ikut
      // tersimpan — itu yang dihindari.
      expect(row.addr).toBeNull();
      expect(row.city).toBeNull();
    });
  });
});

describe('create_guest_order — harga tidak pernah dari klien', () => {
  it('mengabaikan total_amount, status, dan paid_amount kiriman klien', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, null, 'anon');
      // Inilah serangan yang paling jelas: klien mengarang harga Rp 1.000 dan
      // menyatakan dirinya sudah lunas.
      const result = await callCreate(
        tx,
        validPayload({
          requested_date: await wibDate(tx, 5),
          total_amount: 1000,
          paid_amount: 1000,
          status: 'paid',
          payment_status: 'paid',
        }),
      );

      expect(Number(result.total_amount)).toBe(SERVICE.aqiqahFavoritPrice);
      expect(result.status).toBe('new');
      expect(result.payment_status).toBe('unpaid');

      await actAsOwner(tx);
      const [row] = await tx<{ paid: string }[]>`
        select paid_amount::text as paid from public.orders
        where public_token = ${result.public_token as string}
      `;
      expect(Number(row.paid)).toBe(0);
    });
  });

  it('mengabaikan vendor_id kiriman klien — penugasan itu urusan admin', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, null, 'anon');
      const result = await callCreate(
        tx,
        validPayload({
          requested_date: await wibDate(tx, 5),
          vendor_id: 'c0000000-0000-4000-8000-000000000002',
        }),
      );

      await actAsOwner(tx);
      const [row] = await tx<{ vendor_id: string | null }[]>`
        select vendor_id::text from public.orders
        where public_token = ${result.public_token as string}
      `;
      // Kalau ini kelak lolos, pemesan bisa memilih mitranya sendiri dan
      // seluruh gerbang penugasan jadi tak berarti.
      expect(row.vendor_id).toBeNull();
    });
  });
});

describe('create_guest_order — penolakan', () => {
  const rejects: Array<[string, Payload, RegExp]> = [
    ['nama kosong', { participant: { name: '', phone: '081200000001' } }, /Nama pemesan wajib/],
    [
      'nama sepanjang 151 karakter',
      { participant: { name: 'a'.repeat(151), phone: '081200000001' } },
      /Nama pemesan terlalu panjang/,
    ],
    [
      'telepon terlalu pendek',
      { participant: { name: 'Pemesan Uji', phone: '0812' } },
      /Nomor telepon tidak valid/,
    ],
    [
      'telepon berisi huruf',
      { participant: { name: 'Pemesan Uji', phone: '0812ABCD1234' } },
      /hanya boleh berisi angka/,
    ],
    [
      'paket tidak dikenal',
      { service_id: '00000000-0000-4000-8000-000000000000' },
      /Paket tidak ditemukan/,
    ],
    ['qty 0', { qty: 0 }, /Jumlah pesanan di luar batas/],
    ['qty 21', { qty: 21 }, /Jumlah pesanan di luar batas/],
    ['jenis hewan tak dikenal', { species: 'unicorn' }, /Jenis hewan tidak dikenali/],
    ['aqiqah dengan sapi', { species: 'sapi' }, /Aqiqah hanya melayani kambing/],
    ['aqiqah_for kosong', { aqiqah_for: null }, /Pilih aqiqah untuk anak/],
    [
      'tanggal lahir di masa depan',
      { child_birth_date: '2099-01-01' },
      /tidak boleh di masa depan/,
    ],
    ['cara penyaluran kosong', { distribution_mode: null }, /Pilih cara penyaluran/],
    ['jam di luar jam layanan', { requested_time: '23:00' }, /di luar jam layanan/],
  ];

  for (const [label, override, message] of rejects) {
    it(`menolak ${label}`, async () => {
      await inRollback(async (tx) => {
        await actAs(tx, null, 'anon');
        const base = validPayload({ requested_date: await wibDate(tx, 5) });
        // `participant` diganti utuh bila ada di override, supaya kasus
        // identitas bisa menguji satu field tanpa membawa sisa yang sah.
        const payload = { ...base, ...override };

        const failure = await expectFailureInSavepoint(
          tx,
          (sp) => sp`select public.create_guest_order(${sp.json(payload)}::jsonb)`,
        );
        expect(failure.message).toMatch(message);
      });
    });
  }

  it('menolak tanggal yang sudah lewat', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, null, 'anon');
      const payload = validPayload({ requested_date: await wibDate(tx, -1) });
      const failure = await expectFailureInSavepoint(
        tx,
        (sp) => sp`select public.create_guest_order(${sp.json(payload)}::jsonb)`,
      );
      expect(failure.message).toMatch(/Tanggal pelaksanaan sudah lewat/);
    });
  });

  it('menolak tanggal melampaui batas pemesanan', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, null, 'anon');
      const [{ max }] = await tx<{ max: number }[]>`
        select public.booking_max_days()::int as max
      `;
      const payload = validPayload({ requested_date: await wibDate(tx, max + 5) });
      const failure = await expectFailureInSavepoint(
        tx,
        (sp) => sp`select public.create_guest_order(${sp.json(payload)}::jsonb)`,
      );
      expect(failure.message).toMatch(/hari ke depan/);
    });
  });

  it('menolak wilayah tujuan yang tidak dikenali', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, null, 'anon');
      const payload = validPayload({
        requested_date: await wibDate(tx, 5),
        distribution_mode: 'kirim',
        delivery_province_code: '99',
        delivery_city_code: '99.99',
        delivery_district_code: '99.99.99',
        delivery_village_code: '99.99.99.9999',
        // Kode pos harus sah lebih dulu: RPC memeriksanya sebelum mencari nama
        // wilayah, jadi kode pos ngawur akan menutupi galat yang diuji di sini.
        delivery_postal_code: '40252',
        delivery_detail: 'Jl. Palsu',
      });
      const failure = await expectFailureInSavepoint(
        tx,
        (sp) => sp`select public.create_guest_order(${sp.json(payload)}::jsonb)`,
      );
      expect(failure.message).toMatch(/Wilayah tujuan tidak dikenali/);
    });
  });

  it('menolak mode kirim tanpa alamat lengkap', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, null, 'anon');
      const payload = validPayload({
        requested_date: await wibDate(tx, 5),
        distribution_mode: 'kirim',
      });
      const failure = await expectFailureInSavepoint(
        tx,
        (sp) => sp`select public.create_guest_order(${sp.json(payload)}::jsonb)`,
      );
      expect(failure.message).toMatch(/Lengkapi provinsi/);
    });
  });

  it('mengerem pesanan ke-6 dari nomor yang sama dalam satu jam', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, null, 'anon');
      const requested = await wibDate(tx, 5);

      // Lima pertama lolos; rem baru menutup pada yang keenam.
      for (let i = 0; i < 5; i += 1) {
        await callCreate(tx, validPayload({ requested_date: requested }));
      }

      const payload = validPayload({ requested_date: requested });
      const failure = await expectFailureInSavepoint(
        tx,
        (sp) => sp`select public.create_guest_order(${sp.json(payload)}::jsonb)`,
      );
      expect(failure.message).toMatch(/Terlalu banyak pesanan dari nomor ini/);
    });
  });
});

describe('confirm_delivery', () => {
  async function guestKirimOrder(tx: postgres.TransactionSql): Promise<string> {
    await actAs(tx, null, 'anon');
    const result = await callCreate(
      tx,
      validPayload({
        requested_date: await wibDate(tx, 5),
        distribution_mode: 'kirim',
        delivery_province_code: REGION.province,
        delivery_city_code: REGION.city,
        delivery_district_code: REGION.district,
        delivery_village_code: REGION.village,
        delivery_postal_code: '40252',
        delivery_detail: 'Jl. Uji No. 9',
      }),
    );
    return result.public_token as string;
  }

  async function confirm(
    tx: postgres.TransactionSql,
    token: string,
    ip: string | null = null,
  ): Promise<Record<string, unknown>> {
    const [row] = await tx<{ result: Record<string, unknown> }[]>`
      select public.confirm_delivery(${token}, ${ip}) as result
    `;
    return row.result;
  }

  it('mencatat konfirmasi penerimaan pada order mode kirim', async () => {
    await inRollback(async (tx) => {
      const token = await guestKirimOrder(tx);
      const result = await confirm(tx, token, '203.0.113.7');

      expect(result.ok).toBe(true);
      expect(result.confirmed_at).toBeTruthy();

      await actAsOwner(tx);
      const [row] = await tx<{ at: string | null; ip: string | null }[]>`
        select delivery_confirmed_at::text as at, delivery_confirmed_ip as ip
        from public.orders where public_token = ${token}
      `;
      expect(row.at).not.toBeNull();
      expect(row.ip).toBe('203.0.113.7');
    });
  });

  it('idempoten — tekan dua kali tidak menggeser waktu tercatat', async () => {
    await inRollback(async (tx) => {
      const token = await guestKirimOrder(tx);
      const first = await confirm(tx, token);
      const second = await confirm(tx, token);

      expect(second.ok).toBe(true);
      // Tombol yang tertekan dua kali di ponsel tidak boleh memperbarui waktu:
      // yang dicatat adalah kapan penerima menyatakan terima, sekali.
      expect(second.confirmed_at).toBe(first.confirmed_at);
    });
  });

  it('menolak order mode salur — tidak ada yang diantar', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, null, 'anon');
      const result = await callCreate(
        tx,
        validPayload({ requested_date: await wibDate(tx, 5), distribution_mode: 'salur' }),
      );

      const outcome = await confirm(tx, result.public_token as string);
      expect(outcome.ok).toBe(false);
      expect(outcome.reason).toBe('bukan_order_kirim');
    });
  });

  it('menolak token yang tidak sah tanpa membocorkan apa pun', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, null, 'anon');
      for (const bad of ['', 'pendek', 'a'.repeat(31), 'f'.repeat(32)]) {
        const outcome = await confirm(tx, bad);
        expect(outcome.ok).toBe(false);
        // Pesan yang sama untuk token salah bentuk maupun token tak dikenal:
        // membedakannya akan memberi petunjuk kepada penebak.
        expect(outcome.reason).toBe('token_invalid');
      }
    });
  });
});
