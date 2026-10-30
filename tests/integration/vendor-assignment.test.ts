/**
 * `enforce_vendor_assignment` — dua hal yang tidak boleh datang dari vendor:
 * penugasan mitra, dan nilai tagihan.
 *
 * Trigger ini bersandar pada `is_staff()`, yang membaca role dari `profiles`
 * lewat `auth.uid()`. Itu berarti perilakunya **tidak bisa** diuji tanpa sesi
 * sungguhan — dan itulah alasan berkas ini ada.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { actAs, actAsOwner, expectFailureInSavepoint, inRollback, isReady } from './helpers/db';
import { SEED, makePaidOrder } from './helpers/fixtures';

beforeAll(async () => {
  const ready = await isReady();
  if (!ready.ok) throw new Error(ready.reason);
});

describe('is_staff / auth_role — dasar yang dipakai trigger', () => {
  it('mengenali admin & superadmin sebagai staf, vendor bukan', async () => {
    await inRollback(async (tx) => {
      const roleOf = async (userId: string) => {
        await actAs(tx, userId);
        const [row] = await tx<{ staff: boolean; role: string | null }[]>`
          select public.is_staff() as staff, public.auth_role()::text as role
        `;
        return row;
      };

      expect(await roleOf(SEED.superadmin)).toEqual({ staff: true, role: 'superadmin' });
      expect(await roleOf(SEED.admin)).toEqual({ staff: true, role: 'admin' });
      expect(await roleOf(SEED.vendorUserA)).toEqual({ staff: false, role: 'vendor' });
    });
  });

  it('auth_vendor_id mengembalikan mitra milik akun vendor', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.vendorUserA);
      const [row] = await tx<{ vendor_id: string | null }[]>`
        select public.auth_vendor_id()::text as vendor_id
      `;
      // Ini yang memisahkan data antar mitra di seluruh kebijakan RLS.
      expect(row.vendor_id).toBe(SEED.vendorA);
    });
  });
});

describe('enforce_vendor_assignment', () => {
  it('menolak vendor memindahkan order ke mitra lain', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur' });

      await actAs(tx, SEED.vendorUserA);
      const failure = await expectFailureInSavepoint(
        tx,
        (sp) => sp`
          update public.orders set vendor_id = ${SEED.vendorB} where id = ${orderId}
        `,
      );
      expect(failure.message).toMatch(/Penugasan mitra|row-level security/);
      expect(failure.code).toBe('42501');
    });
  });

  it('mengizinkan admin memindahkan penugasan', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur' });

      await actAs(tx, SEED.admin);
      await tx`update public.orders set vendor_id = ${SEED.vendorB} where id = ${orderId}`;

      const [row] = await tx<{ vendor_id: string }[]>`
        select vendor_id::text from public.orders where id = ${orderId}
      `;
      expect(row.vendor_id).toBe(SEED.vendorB);
    });
  });

  it('menolak vendor mengubah nilai tagihan', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur' });
      // `create_order` boleh menulis total di transaksi yang sama dengan
      // insert-nya; order uji dibuat di transaksi ini, jadi dimundurkan.
      await tx`update public.orders set created_at = now() - interval '1 day' where id = ${orderId}`;
      await actAs(tx, SEED.vendorUserA);

      // Ketiga kolom diuji terpisah: trigger memeriksanya dalam satu kondisi
      // `or`, jadi kalau satu cabang hilang, dua tes lain tetap hijau dan
      // celahnya lolos.
      for (const column of ['total_amount', 'paid_amount'] as const) {
        const failure = await expectFailureInSavepoint(
          tx,
          (sp) => sp`
            update public.orders set ${sp(column)} = 999 where id = ${orderId}
          `,
        );
        expect(failure.message).toMatch(/Nilai tagihan|Status pembayaran/);
      }

      const failure = await expectFailureInSavepoint(
        tx,
        (sp) => sp`
          update public.orders
          set payment_status = 'unpaid'::public.payment_status
          where id = ${orderId}
        `,
      );
      expect(failure.message).toMatch(/Status pembayaran hanya berubah/);
    });
  });

  it('vendor tetap boleh menjalankan transisi lapangan', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur' });
      await tx`update public.orders set status = 'assigned'::public.order_status where id = ${orderId}`;

      // Kalau trigger ini terlalu ketat, vendor tidak bisa mengerjakan apa pun.
      await actAs(tx, SEED.vendorUserA);
      await tx`
        update public.orders set status = 'in_progress'::public.order_status
        where id = ${orderId}
      `;

      const [row] = await tx<{ status: string }[]>`
        select status::text from public.orders where id = ${orderId}
      `;
      expect(row.status).toBe('in_progress');
    });
  });

  it('menolak vendor melompati alur status (paid -> completed)', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur' });

      await actAs(tx, SEED.vendorUserA);
      for (const to of ['completed', 'in_progress', 'cancelled'] as const) {
        const failure = await expectFailureInSavepoint(
          tx,
          (sp) => sp`
            update public.orders set status = ${to}::public.order_status where id = ${orderId}
          `,
        );
        expect(failure.code).toBe('42501');
      }
    });
  });

  it('menolak admin melompati alur status dan menulis status pembayaran', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur' });

      await actAs(tx, SEED.admin);
      const skip = await expectFailureInSavepoint(
        tx,
        (sp) => sp`
          update public.orders set status = 'completed'::public.order_status where id = ${orderId}
        `,
      );
      expect(skip.code).toBe('42501');

      const paid = await expectFailureInSavepoint(
        tx,
        (sp) => sp`
          update public.orders set payment_status = 'unpaid'::public.payment_status where id = ${orderId}
        `,
      );
      expect(paid.message).toMatch(/Status pembayaran hanya berubah/);
    });
  });

  it('menolak vendor memalsukan konfirmasi terima dan mengganti token laporan', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur' });

      await actAs(tx, SEED.vendorUserA);
      const confirm = await expectFailureInSavepoint(
        tx,
        (sp) => sp`update public.orders set delivery_confirmed_at = now() where id = ${orderId}`,
      );
      expect(confirm.code).toBe('42501');

      const token = await expectFailureInSavepoint(
        tx,
        (sp) => sp`update public.orders set public_token = repeat('a', 32) where id = ${orderId}`,
      );
      expect(token.code).toBe('42501');
    });
  });
});
