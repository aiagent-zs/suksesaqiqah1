/**
 * Row Level Security per role — pemisahan data yang menjaga satu mitra tidak
 * melihat pekerjaan mitra lain.
 *
 * Ini lapisan pertahanan yang **tidak bisa** diuji dari sisi aplikasi. Server
 * Action selalu memanggil `requireAuth()` lebih dulu, jadi tes yang menembus
 * lewat sana hanya membuktikan kode aplikasinya benar — bukan bahwa databasenya
 * menolak. Yang diuji di sini adalah apa yang terjadi ketika seseorang
 * melewati aplikasi sepenuhnya dan menembak PostgREST langsung dengan token
 * miliknya sendiri yang sah.
 *
 * ## Tiga role, bukan lima
 *
 * `superadmin` (segalanya), `admin` (operasional, tanpa hak mengubah role), dan
 * `vendor` (hanya order yang ditugaskan padanya). Pembeda admin↔superadmin yang
 * paling penting: **admin tidak boleh mengubah role**, sebab siapa pun yang
 * bisa mengubah role bisa mengangkat dirinya sendiri.
 *
 * ## Cara membaca tes ini
 *
 * `actAs` menyetel `request.jwt.claims` **dan** `role` Postgres ke
 * `authenticated`, jadi RLS benar-benar berlaku. `actAsOwner` kembali ke
 * `postgres` yang menembus RLS — dipakai hanya untuk menyiapkan data, tidak
 * pernah untuk hal yang sedang diuji.
 *
 * Satu jebakan yang membentuk seluruh berkas ini: **PostgREST sebagai peran
 * yang tidak berhak mengembalikan array kosong, bukan galat.** Karena itu
 * kebocoran baca diuji dengan menghitung baris, bukan menunggu exception —
 * `expect(rows).toHaveLength(0)` adalah bentuk yang benar, dan tes yang
 * menunggu galat justru akan hijau selamanya tanpa menguji apa pun.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { actAs, actAsOwner, expectFailureInSavepoint, inRollback, isReady } from './helpers/db';
import { SEED, makePaidOrder } from './helpers/fixtures';
import type postgres from 'postgres';

beforeAll(async () => {
  const ready = await isReady();
  if (!ready.ok) throw new Error(ready.reason);
});

/**
 * Akun vendor kedua, tertaut ke mitra B.
 *
 * Seed memberi kedua akun vendor mitra yang sama, jadi isolasi antar-mitra
 * tidak bisa diuji tanpa memindahkan salah satunya. Dilakukan di dalam
 * transaksi yang dibatalkan, jadi seed aslinya tidak tersentuh.
 */
async function makeVendorBUser(tx: postgres.TransactionSql): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    select id::text from public.profiles where role = 'vendor' order by id offset 1 limit 1
  `;
  await tx`
    update public.profiles set vendor_id = ${SEED.vendorB}, is_active = true
    where id = ${row.id}
  `;
  return row.id;
}

describe('isolasi antar mitra — inti dari seluruh RLS', () => {
  it('vendor tidak melihat order mitra lain', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const vendorBUser = await makeVendorBUser(tx);
      const { orderId: milikA } = await makePaidOrder(tx, {
        mode: 'kirim',
        vendorId: SEED.vendorA,
      });
      const { orderId: milikB } = await makePaidOrder(tx, {
        mode: 'salur',
        vendorId: SEED.vendorB,
      });

      await actAs(tx, SEED.vendorUserA);
      const seenByA = await tx`select id from public.orders where id in (${milikA}, ${milikB})`;
      expect(seenByA.map((r) => r.id)).toEqual([milikA]);

      await actAs(tx, vendorBUser);
      const seenByB = await tx`select id from public.orders where id in (${milikA}, ${milikB})`;
      expect(seenByB.map((r) => r.id)).toEqual([milikB]);
    });
  });

  it('vendor tidak melihat order yang belum ditugaskan kepada siapa pun', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur', vendorId: null });

      // `vendor_id is not null` di policy penting: tanpa itu, order tanpa mitra
      // akan terbaca oleh vendor mana pun yang `auth_vendor_id()`-nya juga null.
      await actAs(tx, SEED.vendorUserA);
      const rows = await tx`select id from public.orders where id = ${orderId}`;
      expect(rows).toHaveLength(0);
    });
  });

  it('isolasi menurun ke seluruh tabel anak order', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const vendorBUser = await makeVendorBUser(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'kirim', vendorId: SEED.vendorA });
      await tx`update public.orders set status = 'assigned'::public.order_status where id = ${orderId}`;
      await tx`
        insert into public.schedules (order_id, location_id, scheduled_date, scheduled_time)
        values (${orderId}, ${'a1000000-0000-4000-8000-000000000001'}, current_date + 3, '09:00')
      `;
      await tx`
        insert into public.issues (order_id, title, description, severity, status, reported_by)
        values (${orderId}, 'Uji', 'Uji isolasi', 'low'::public.issue_severity,
                'open'::public.issue_status, ${SEED.admin})
      `;
      await tx`
        insert into public.reports (order_id, version, generated_by)
        values (${orderId}, 1, ${SEED.admin})
      `;

      // Semua tabel ini memakai `can_read_order(order_id)`. Diuji bersama
      // karena satu policy yang lupa dipasang akan membocorkan seluruh riwayat
      // order lewat pintu samping.
      await actAs(tx, vendorBUser);
      for (const table of [
        'order_items',
        'animals',
        'order_stage_events',
        'schedules',
        'issues',
        'reports',
        'documentations',
      ] as const) {
        const rows = await tx`select 1 from ${tx(table)} where order_id = ${orderId}`;
        expect(rows, `${table} bocor ke vendor lain`).toHaveLength(0);
      }
    });
  });

  it('vendor tidak dapat menulis pada order mitra lain', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const vendorBUser = await makeVendorBUser(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'kirim', vendorId: SEED.vendorA });
      await tx`update public.orders set status = 'assigned'::public.order_status where id = ${orderId}`;
      const [stage] = await tx<{ id: string }[]>`
        select id from public.order_stage_events where order_id = ${orderId} and stage = 'persiapan'
      `;

      await actAs(tx, vendorBUser);
      // UPDATE yang tidak lolos policy tidak melempar — ia hanya tidak
      // mengenai baris apa pun. Itulah sebabnya `count` yang diperiksa.
      const affected = await tx`
        update public.order_stage_events
        set notes = 'disentuh mitra lain'
        where id = ${stage.id}
      `;
      expect(affected.count).toBe(0);

      await actAsOwner(tx);
      const [after] = await tx<{ notes: string | null }[]>`
        select notes from public.order_stage_events where id = ${stage.id}
      `;
      expect(after.notes).toBeNull();
    });
  });
});

describe('pembayaran & notifikasi — staf saja', () => {
  it('vendor tidak melihat pembayaran meski order itu miliknya', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'kirim', vendorId: SEED.vendorA });
      await tx`
        insert into public.payments (
          order_id, amount, method, status, recorded_by, verified_by, verified_at
        ) values (
          ${orderId}, 2800000, 'transfer',
          'verified'::public.payment_verification_status, ${SEED.admin},
          ${SEED.superadmin}, now()
        )
      `;

      // Nilai yang dibayar pemesan bukan urusan mitra: mitra dibayar menurut
      // `vendor_unit_price`, bukan harga jual.
      await actAs(tx, SEED.vendorUserA);
      const rows = await tx`select 1 from public.payments where order_id = ${orderId}`;
      expect(rows).toHaveLength(0);
    });
  });

  it('vendor tidak dapat mencatat pembayaran', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'kirim', vendorId: SEED.vendorA });

      await actAs(tx, SEED.vendorUserA);
      const failure = await expectFailureInSavepoint(
        tx,
        (sp) => sp`
          insert into public.payments (order_id, amount, method, status, recorded_by)
          values (${orderId}, 1000, 'cash', 'verified'::public.payment_verification_status, ${SEED.vendorUserA})
        `,
      );
      // INSERT yang gagal `with check` memang melempar — beda dari UPDATE yang
      // diam-diam tidak mengenai baris.
      expect(failure.code).toBe('42501');
    });
  });

  it('vendor tidak melihat notifikasi maupun audit log', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.vendorUserA);
      expect(await tx`select 1 from public.notifications limit 5`).toHaveLength(0);
      expect(await tx`select 1 from public.audit_logs limit 5`).toHaveLength(0);
    });
  });

  it('admin melihat keduanya', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'kirim', vendorId: SEED.vendorA });
      await tx`
        insert into public.payments (order_id, amount, method, status, recorded_by)
        values (${orderId}, 2800000, 'transfer', 'pending'::public.payment_verification_status, ${SEED.admin})
      `;

      // Sisi lain dari tes-tes di atas: kalau policy terlalu ketat, staf tidak
      // bisa bekerja dan tidak ada tes yang memberi tahu.
      await actAs(tx, SEED.admin);
      expect(await tx`select 1 from public.payments where order_id = ${orderId}`).toHaveLength(1);
      expect(
        await tx`select 1 from public.audit_logs where record_id = ${orderId} limit 1`,
      ).toHaveLength(1);
    });
  });
});

describe('profil & role — admin tidak boleh mengangkat dirinya', () => {
  it('vendor hanya melihat profilnya sendiri', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.vendorUserA);
      const rows = await tx<{ id: string }[]>`select id::text from public.profiles`;
      expect(rows.map((r) => r.id)).toEqual([SEED.vendorUserA]);
    });
  });

  it('staf melihat seluruh profil', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.admin);
      const rows = await tx`select 1 from public.profiles`;
      expect(rows.length).toBeGreaterThanOrEqual(4);
    });
  });

  it('admin TIDAK dapat mengubah role siapa pun', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.admin);
      // Inti pembeda admin↔superadmin. `profiles_manage` hanya mengizinkan
      // superadmin, jadi UPDATE dari admin tidak mengenai baris apa pun.
      const affected = await tx`
        update public.profiles set role = 'superadmin'::public.user_role
        where id = ${SEED.admin}
      `;
      expect(affected.count).toBe(0);

      await actAsOwner(tx);
      const [row] = await tx<{ role: string }[]>`
        select role::text from public.profiles where id = ${SEED.admin}
      `;
      expect(row.role).toBe('admin');
    });
  });

  it('vendor tidak dapat menaikkan dirinya sendiri', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.vendorUserA);
      const affected = await tx`
        update public.profiles set role = 'admin'::public.user_role
        where id = ${SEED.vendorUserA}
      `;
      expect(affected.count).toBe(0);
    });
  });

  it('vendor tidak dapat memindahkan dirinya ke mitra lain', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.vendorUserA);
      // Kalau ini lolos, seluruh isolasi antar-mitra di atas runtuh: vendor
      // cukup menulis `vendor_id` mitra lain ke profilnya sendiri.
      const affected = await tx`
        update public.profiles set vendor_id = ${SEED.vendorB}
        where id = ${SEED.vendorUserA}
      `;
      expect(affected.count).toBe(0);

      await actAsOwner(tx);
      const [row] = await tx<{ vendor_id: string }[]>`
        select vendor_id::text from public.profiles where id = ${SEED.vendorUserA}
      `;
      expect(row.vendor_id).toBe(SEED.vendorA);
    });
  });

  it('superadmin dapat mengubah role', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.superadmin);
      // `vendor_id` ikut dikosongkan: `profiles_staff_no_vendor_check` menuntut
      // hanya role `vendor` yang boleh tertaut ke mitra. Constraint itu masuk
      // akal — akun staf yang masih memegang `vendor_id` akan membuat
      // `auth_vendor_id()` mengembalikan nilai bagi orang yang bukan mitra.
      const affected = await tx`
        update public.profiles
        set role = 'admin'::public.user_role, vendor_id = null
        where id = ${SEED.vendorUserA}
      `;
      expect(affected.count).toBe(1);
    });
  });
});

describe('penghapusan berhenti di superadmin', () => {
  it('admin tidak dapat menghapus order; superadmin bisa', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur', vendorId: SEED.vendorA });

      await actAs(tx, SEED.admin);
      expect((await tx`delete from public.orders where id = ${orderId}`).count).toBe(0);

      await actAs(tx, SEED.superadmin);
      expect((await tx`delete from public.orders where id = ${orderId}`).count).toBe(1);
    });
  });

  it('bukti tervalidasi tidak dapat dihapus siapa pun', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur', vendorId: SEED.vendorA });
      const [doc] = await tx<{ id: string }[]>`
        insert into public.documentations (
          order_id, stage, type, storage_path, uploaded_by, status, reviewed_by, reviewed_at
        ) values (
          ${orderId}, 'umum'::public.doc_stage, 'photo'::public.doc_type,
          ${'2026/08/uji/tetap.jpg'}, ${SEED.vendorUserA},
          'approved'::public.doc_status, ${SEED.admin}, now()
        ) returning id
      `;

      // `status <> 'approved'` di policy: bukti yang sudah dipakai laporan
      // peserta tidak boleh lenyap, bahkan oleh superadmin.
      await actAs(tx, SEED.superadmin);
      expect((await tx`delete from public.documentations where id = ${doc.id}`).count).toBe(0);
    });
  });

  it('kendala tidak dapat dihapus siapa pun — dikoreksi, bukan dihilangkan', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur', vendorId: SEED.vendorA });
      const [issue] = await tx<{ id: string }[]>`
        insert into public.issues (order_id, title, description, severity, status, reported_by)
        values (${orderId}, 'Uji', 'Uji hapus', 'low'::public.issue_severity,
                'open'::public.issue_status, ${SEED.admin})
        returning id
      `;

      // Tabel ini sengaja tanpa policy delete sama sekali.
      await actAs(tx, SEED.superadmin);
      expect((await tx`delete from public.issues where id = ${issue.id}`).count).toBe(0);
    });
  });
});

describe('data publik & internal', () => {
  it('anon membaca services & regions, tetapi bukan orders atau profiles', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, null, 'anon');
      // Katalog paket & daftar wilayah dipakai halaman checkout sebelum login.
      expect((await tx`select 1 from public.services limit 3`).length).toBeGreaterThan(0);
      expect((await tx`select 1 from public.regions limit 3`).length).toBeGreaterThan(0);

      // Sisanya harus tertutup. `orders` bahkan menolak dengan galat izin,
      // bukan array kosong, karena `anon` tidak diberi grant sama sekali.
      for (const table of ['orders', 'profiles', 'payments', 'participants'] as const) {
        const failure = await expectFailureInSavepoint(
          tx,
          (sp) => sp`select 1 from ${sp(table)} limit 1`,
        );
        expect(failure.code).toBe('42501');
      }
    });
  });

  it('order_counters tertutup dari vendor — generator internal', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.vendorUserA);
      expect(await tx`select 1 from public.order_counters`).toHaveLength(0);
    });
  });

  it('vendor melihat master mitra & layanan, tetapi tidak dapat mengubahnya', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.vendorUserA);
      // Vendor perlu membaca daftar layanan untuk mengetahui apa yang ia layani.
      expect((await tx`select 1 from public.services limit 1`).length).toBeGreaterThan(0);

      const failure = await expectFailureInSavepoint(
        tx,
        (sp) => sp`
          insert into public.services (type, name, slug, price)
          values ('aqiqah'::public.service_type, 'Paket Karangan', 'paket-karangan', 1)
        `,
      );
      expect(failure.code).toBe('42501');
    });
  });
});

describe('view KPI menghormati RLS pemanggilnya', () => {
  it('v_open_orders dan v_order_progress tersaring per mitra', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const vendorBUser = await makeVendorBUser(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'kirim', vendorId: SEED.vendorA });
      await tx`update public.orders set status = 'assigned'::public.order_status where id = ${orderId}`;

      // Seluruh view memakai `security_invoker = on`. Tanpa itu view berjalan
      // dengan hak pemiliknya, dan vendor bisa melihat order mitra lain lewat
      // pintu belakang — kebocoran yang tidak akan terlihat dari tabelnya.
      await actAs(tx, vendorBUser);
      expect(await tx`select 1 from public.v_open_orders where order_id = ${orderId}`).toHaveLength(
        0,
      );
      expect(
        await tx`select 1 from public.v_order_progress where order_id = ${orderId}`,
      ).toHaveLength(0);

      await actAs(tx, SEED.vendorUserA);
      expect(
        await tx`select 1 from public.v_order_progress where order_id = ${orderId}`,
      ).toHaveLength(1);
    });
  });
});
