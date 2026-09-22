/**
 * Modal mitra pada order — `order_items.vendor_unit_price`.
 *
 * ## Kenapa berkas ini ada
 *
 * Kolomnya lahir bersama tabelnya (`20260820000300`) dengan komentar yang
 * jelas: *"Modal yang disepakati saat mitra ditugaskan."* Tetapi **tidak ada
 * satu pun kode yang pernah menulisinya** sampai 22 September — hanya
 * `v_vendor_kpi` yang membacanya.
 *
 * Akibatnya `vendor_cost` selalu nol dan `margin_total = revenue_total`:
 * dashboard melaporkan margin **100%** untuk setiap mitra. Angka yang salah
 * dengan cara yang tidak mencurigakan.
 *
 * Yang membuatnya bertahan selama sebulan: `makePaidOrder` di
 * `helpers/fixtures.ts` **mengisi kolomnya sendiri**. Jadi seluruh tes yang
 * menyentuh `v_vendor_kpi` melihat angka yang benar, sementara order sungguhan
 * — yang lahir dari checkout lalu ditugaskan lewat `assignVendor` — tidak.
 * Fixture yang terlalu membantu menyembunyikan bug yang dijaganya.
 *
 * Karena itu berkas ini **tidak** memakai fixture untuk bagian yang diuji: ia
 * menyusun ordernya sendiri tanpa `vendor_unit_price`, persis seperti
 * `create_guest_order` melakukannya.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { actAsOwner, inRollback, isReady } from './helpers/db';
import { SEED } from './helpers/fixtures';
import type postgres from 'postgres';

/** Dari `supabase/seed/01_master.sql` — modal vendor A untuk Aqiqah Favorit. */
const VENDOR_A_FAVORIT_COST = 2_325_000;
const FAVORIT_PRICE = 2_800_000;

/**
 * Aqiqah Premium: vendor A punya modalnya, vendor B **tidak**.
 *
 * Dipakai menguji jalur "paket tanpa modal mitra". Favorit tidak bisa dipakai
 * untuk itu — kedua mitra di seed punya modal untuknya, dan versi pertama tes
 * ini keliru mengira sebaliknya.
 */
const SERVICE_PREMIUM = 'a2000000-0000-4000-8000-000000000003';

/**
 * Order berbayar **tanpa** `vendor_unit_price`, persis seperti yang lahir dari
 * `create_guest_order`: RPC itu hanya menulis `unit_price`, sebab saat checkout
 * mitranya belum ditetapkan dan modalnya belum diketahui.
 */
async function orderWithoutCost(
  tx: postgres.TransactionSql,
  opts: { qty?: number; serviceId?: string } = {},
): Promise<{ orderId: string }> {
  const { qty = 1, serviceId = SEED.serviceKambing } = opts;

  const [order] = await tx<{ id: string }[]>`
    insert into public.orders (
      participant_id, status, payment_status, total_amount, paid_amount,
      distribution_mode, aqiqah_for, requested_date, requested_time,
      guest_verified_at, guest_verified_by
    ) values (
      ${SEED.participant}, 'paid'::public.order_status, 'paid'::public.payment_status,
      ${FAVORIT_PRICE * qty}, ${FAVORIT_PRICE * qty},
      'salur'::public.distribution_mode, 'laki_laki', current_date + 3, '09:00',
      now(), ${SEED.admin}
    ) returning id
  `;

  await tx`
    insert into public.order_items (order_id, service_id, qty, unit_price)
    values (${order.id}, ${serviceId}, ${qty}, ${FAVORIT_PRICE})
  `;

  return { orderId: order.id };
}

/** Cerminan `snapshotVendorCost` di `server/actions/schedules.ts`. */
async function snapshotCost(tx: postgres.TransactionSql, orderId: string, vendorId: string) {
  await tx`
    update public.order_items oi
    set vendor_unit_price = vs.vendor_price
    from public.vendor_services vs
    where oi.order_id = ${orderId}
      and vs.vendor_id = ${vendorId}
      and vs.service_id = oi.service_id
  `;
}

async function kpiOf(tx: postgres.TransactionSql, vendorId: string) {
  const [row] = await tx<{ revenue: string; cost: string; margin: string }[]>`
    select revenue_total::text as revenue, vendor_cost_total::text as cost,
           margin_total::text as margin
    from public.v_vendor_kpi where vendor_id = ${vendorId}
  `;
  return {
    revenue: Number(row.revenue),
    cost: Number(row.cost),
    margin: Number(row.margin),
  };
}

beforeAll(async () => {
  const ready = await isReady();
  if (!ready.ok) throw new Error(ready.reason);
});

describe('v_vendor_kpi membaca modal dari order_items', () => {
  it('modal nol membuat margin terbaca sebesar seluruh tagihan — inilah bug-nya', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);

      const before = await kpiOf(tx, SEED.vendorA);
      const { orderId } = await orderWithoutCost(tx);
      await tx`update public.orders set vendor_id = ${SEED.vendorA} where id = ${orderId}`;

      const after = await kpiOf(tx, SEED.vendorA);

      // Tagihan naik sebesar harga jualnya…
      expect(after.revenue - before.revenue).toBe(FAVORIT_PRICE);
      // …tetapi modalnya tidak naik sama sekali, dan marginnya ikut penuh.
      expect(after.cost - before.cost).toBe(0);
      expect(after.margin - before.margin).toBe(FAVORIT_PRICE);
    });
  });

  it('sesudah modal disalin, margin terbaca sebagai selisih yang benar', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);

      const before = await kpiOf(tx, SEED.vendorA);
      const { orderId } = await orderWithoutCost(tx);
      await tx`update public.orders set vendor_id = ${SEED.vendorA} where id = ${orderId}`;

      await snapshotCost(tx, orderId, SEED.vendorA);

      const after = await kpiOf(tx, SEED.vendorA);
      expect(after.cost - before.cost).toBe(VENDOR_A_FAVORIT_COST);
      expect(after.margin - before.margin).toBe(FAVORIT_PRICE - VENDOR_A_FAVORIT_COST);
    });
  });

  it('modal dikalikan jumlah pesanan, bukan dihitung sekali', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);

      const before = await kpiOf(tx, SEED.vendorA);
      const { orderId } = await orderWithoutCost(tx, { qty: 3 });
      await tx`update public.orders set vendor_id = ${SEED.vendorA} where id = ${orderId}`;
      await snapshotCost(tx, orderId, SEED.vendorA);

      const after = await kpiOf(tx, SEED.vendorA);
      // `vendor_cost` di view dihitung `qty * vendor_unit_price` — kolomnya
      // menyimpan modal PER satuan, bukan total baris.
      expect(after.cost - before.cost).toBe(VENDOR_A_FAVORIT_COST * 3);
    });
  });
});

describe('modal dibekukan saat penugasan, bukan dibaca lewat join', () => {
  it('revisi daftar harga mitra tidak menggeser margin order yang sudah berjalan', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);

      const { orderId } = await orderWithoutCost(tx);
      await tx`update public.orders set vendor_id = ${SEED.vendorA} where id = ${orderId}`;
      await snapshotCost(tx, orderId, SEED.vendorA);

      const afterAssign = await kpiOf(tx, SEED.vendorA);

      // Kesepakatan direvisi sesudah order berjalan — modalnya naik 200 ribu.
      await tx`
        update public.vendor_services set vendor_price = ${VENDOR_A_FAVORIT_COST + 200_000}
        where vendor_id = ${SEED.vendorA} and service_id = ${SEED.serviceKambing}
      `;

      const afterRevision = await kpiOf(tx, SEED.vendorA);

      // Inilah alasan nilainya disalin alih-alih dibaca lewat join: laporan
      // bulan lalu harus tetap berbunyi sama bulan depan.
      expect(afterRevision.cost).toBe(afterAssign.cost);
      expect(afterRevision.margin).toBe(afterAssign.margin);
    });
  });

  it('paket tanpa modal mitra tetap NULL, tidak ditulis nol', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);

      // Vendor B tidak punya modal untuk Aqiqah **Premium** — dipastikan dari
      // seed, bukan diasumsikan: untuk Favorit kedua mitra justru punya.
      const { orderId } = await orderWithoutCost(tx, { serviceId: SERVICE_PREMIUM });
      await tx`update public.orders set vendor_id = ${SEED.vendorB} where id = ${orderId}`;
      await snapshotCost(tx, orderId, SEED.vendorB);

      const [item] = await tx<{ vendor_unit_price: string | null }[]>`
        select vendor_unit_price from public.order_items where order_id = ${orderId}
      `;

      // NULL jujur mengatakan "belum tercatat". Nol akan berarti "modalnya
      // memang nol" — dan margin terbaca penuh, persis kekeliruan yang sedang
      // diperbaiki.
      expect(item.vendor_unit_price).toBeNull();
    });
  });
});

describe('cerminan di server action', () => {
  it('assignVendor benar-benar menyalin modal', async () => {
    // Logikanya di TypeScript, jadi yang bisa dijaga di sini adalah
    // keberadaannya — bahwa langkah penyalinan tidak hilang diam-diam saat
    // `assignVendor` disunting berikutnya.
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(join(process.cwd(), 'server/actions/schedules.ts'), 'utf8');

    expect(src).toContain('snapshotVendorCost');
    expect(src).toContain('vendor_unit_price');
    // Dipanggil sesudah penugasan tersimpan: kegagalan menyalin modal tidak
    // boleh membatalkan penugasan yang sudah sah.
    const assignBody = src.slice(src.indexOf('export async function assignVendor'));
    expect(assignBody.indexOf('snapshotVendorCost')).toBeGreaterThan(
      assignBody.indexOf('Penugasan tidak tersimpan'),
    );
  });
});
