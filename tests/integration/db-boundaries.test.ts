/**
 * Batas yang ditegakkan `20261030010000_harden_db_boundaries.sql`: hal-hal
 * yang bisa dicapai langsung lewat anon key + PostgREST tanpa server action.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { actAs, actAsOwner, inRollback, isReady, sql } from './helpers/db';
import { SEED, assignVendor, makePaidOrder, stagesOf } from './helpers/fixtures';

beforeAll(async () => {
  const ready = await isReady();
  if (!ready.ok) throw new Error(ready.reason);
});

/** Satu-satunya fungsi yang boleh dijalankan pengunjung anonim. */
const ANON_RPC = [
  'booking_max_days',
  'booking_min_days',
  'confirm_delivery',
  'create_catering_order',
  'create_guest_order',
  'get_public_report',
];

describe('EXECUTE fungsi public', () => {
  it('anon hanya bisa menjalankan RPC publik', async () => {
    const rows = await sql<{ proname: string }[]>`
      select p.proname from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and has_function_privilege('anon', p.oid, 'EXECUTE')
      order by 1
    `;
    expect(rows.map((r) => r.proname)).toEqual(ANON_RPC);
  });

  it('helper internal tertutup untuk pengguna login', async () => {
    for (const fn of [
      'next_order_number()',
      'enqueue_notification(uuid,public.notif_channel,text,text,text,jsonb)',
      'close_dashboard_notification(uuid,text)',
      'get_order_tracking(text,text)',
    ]) {
      const [row] = await sql<{ ok: boolean }[]>`
        select has_function_privilege('authenticated', ${fn}, 'EXECUTE') as ok
      `;
      expect(row.ok, fn).toBe(false);
    }
  });
});

describe('next_order_number', () => {
  it('tidak memotong urutan di atas 9999', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const [{ period }] = await tx<{ period: string }[]>`
        select to_char(now() at time zone 'Asia/Jakarta', 'YYYYMM') as period
      `;
      await tx`
        insert into public.order_counters (period, last_value) values (${period}, 9999)
        on conflict (period) do update set last_value = 9999
      `;
      const [{ n }] = await tx<{ n: string }[]>`select public.next_order_number() as n`;
      expect(n).toBe(`IA-${period}-10000`);
    });
  });
});

describe('documentations — unggahan non-staf', () => {
  it('selalu masuk pending, atas nama pengunggahnya', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur', vendorId: SEED.vendorA });
      await assignVendor(tx, orderId);
      const persiapan = (await stagesOf(tx, orderId)).find((s) => s.stage === 'persiapan')!;

      await actAs(tx, SEED.vendorUserA);
      const [doc] = await tx<{ status: string; uploaded_by: string; reviewed_at: string | null }[]>`
        insert into public.documentations (
          order_id, stage_event_id, stage, type, storage_path, status,
          uploaded_by, reviewed_by, reviewed_at
        ) values (
          ${orderId}, ${persiapan.id}, 'persiapan', 'photo', 'a/b.webp', 'approved',
          null, ${SEED.admin}, now()
        )
        returning status::text, uploaded_by::text, reviewed_at
      `;
      expect(doc.status).toBe('pending');
      expect(doc.uploaded_by).toBe(SEED.vendorUserA);
      expect(doc.reviewed_at).toBeNull();
    });
  });
});

describe('get_order_tracking — rem tebakan per nomor', () => {
  it('berhenti menjawab sesudah 10 tebakan salah dalam sejam', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const [order] = await tx<{ order_number: string; phone: string }[]>`
        select o.order_number, regexp_replace(p.phone, '[^0-9]', '', 'g') as phone
        from public.orders o join public.participants p on p.id = o.participant_id
        where p.phone is not null limit 1
      `;
      const right4 = order.phone.slice(-4);
      const wrong4 = right4 === '0000' ? '1111' : '0000';

      const call = (last4: string) => tx<{ r: unknown }[]>`
        select public.get_order_tracking(${order.order_number}, ${last4}) as r
      `;
      expect((await call(right4))[0].r).not.toBeNull();

      for (let i = 0; i < 10; i++) await call(wrong4);
      // Pasangan yang benar pun ditolak selama rem aktif.
      expect((await call(right4))[0].r).toBeNull();
    });
  });
});
