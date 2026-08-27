/**
 * Alur penuh satu order, dari checkout sampai konfirmasi terkirim.
 *
 * Inilah butir Definition of Done Phase 1 yang selama ini tidak punya bukti:
 * *"1 pilot jalan end-to-end: order → pembayaran → penugasan mitra → tahapan
 * lapangan → dokumentasi → laporan → konfirmasi terkirim"*.
 *
 * Bedanya dari berkas tes lain di direktori ini: yang lain memeriksa satu
 * trigger dalam keadaan terisolasi. Berkas ini menempuh **seluruh rantai dalam
 * satu transaksi**, dengan berganti-ganti peran sebagaimana orang sungguhan
 * bergantian menyentuh order yang sama — pemesan, admin, vendor, lalu pemesan
 * lagi. Kegagalan yang hanya muncul dari urutan (tahap terbit sebelum hewan
 * ada, gerbang bukti menutup tahap berikutnya, laporan dibuat sebelum semua
 * tervalidasi) hanya terlihat di sini.
 *
 * Keduanya dijalankan: percabangan `kirim` (5 tahap, berujung konfirmasi
 * penerima) dan `salur` (4 tahap, berujung penyaluran ke penerima manfaat).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { actAs, actAsOwner, expectFailureInSavepoint, inRollback, isReady } from './helpers/db';
import { SEED } from './helpers/fixtures';
import type postgres from 'postgres';

const SERVICE_AQIQAH = 'a2000000-0000-4000-8000-000000000002';
const REGION = {
  province: '32',
  city: '32.73',
  district: '32.73.11',
  village: '32.73.11.1001',
} as const;

beforeAll(async () => {
  const ready = await isReady();
  if (!ready.ok) throw new Error(ready.reason);
});

type Stage = { id: string; stage: string; seq: number; status: string; animal_id: string | null };

async function stages(tx: postgres.TransactionSql, orderId: string): Promise<Stage[]> {
  return tx<Stage[]>`
    select id, stage::text as stage, seq, status::text as status, animal_id
    from public.order_stage_events where order_id = ${orderId}
    order by seq, animal_id nulls first
  `;
}

/** Lapor lalu validasi satu tahap, dengan pelapor & validator berbeda orang. */
async function runStage(
  tx: postgres.TransactionSql,
  stageId: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await actAs(tx, SEED.vendorUserA);
  await tx`
    update public.order_stage_events set
      status = 'reported'::public.stage_event_status,
      reported_by = ${SEED.vendorUserA},
      reported_at = now(),
      occurred_at = now(),
      notes = ${(extra.notes as string) ?? null},
      packages_count = ${(extra.packages_count as number) ?? null},
      recipient_name = ${(extra.recipient_name as string) ?? null},
      recipient_area = ${(extra.recipient_area as string) ?? null},
      lat = ${(extra.lat as number) ?? null},
      lng = ${(extra.lng as number) ?? null}
    where id = ${stageId}
  `;
  await actAs(tx, SEED.admin);
  await tx`
    update public.order_stage_events
    set status = 'validated'::public.stage_event_status
    where id = ${stageId}
  `;
}

/** Unggah bukti lalu setujui — pengunggah dan penyetuju wajib berbeda. */
async function attachApprovedDoc(
  tx: postgres.TransactionSql,
  orderId: string,
  stageEventId: string,
  stage: string,
): Promise<void> {
  await actAs(tx, SEED.vendorUserA);
  const [doc] = await tx<{ id: string }[]>`
    insert into public.documentations (
      order_id, stage_event_id, stage, type, storage_path, caption, uploaded_by
    ) values (
      ${orderId}, ${stageEventId}, ${stage}::public.doc_stage,
      'photo'::public.doc_type,
      ${`2026/08/uji/${stage}/bukti.jpg`}, ${`Bukti ${stage}`}, ${SEED.vendorUserA}
    )
    returning id
  `;
  await actAs(tx, SEED.admin);
  await tx`
    update public.documentations set
      status = 'approved'::public.doc_status,
      reviewed_by = ${SEED.admin},
      reviewed_at = now()
    where id = ${doc.id}
  `;
}

async function progressOf(
  tx: postgres.TransactionSql,
  orderId: string,
): Promise<{ missing: string[]; validated: number; total: number }> {
  const [row] = await tx<{ missing: string[]; validated: number; total: number }[]>`
    select missing_doc_stages as missing,
           stages_validated::int as validated,
           stages_total::int as total
    from public.v_order_progress where order_id = ${orderId}
  `;
  return row;
}

describe('alur penuh — mode kirim (5 tahap, berujung konfirmasi penerima)', () => {
  it('menempuh checkout → bayar → tugaskan → 5 tahap → bukti → laporan → konfirmasi', async () => {
    await inRollback(async (tx) => {
      // ---------------------------------------------------------------- 1
      // Pemesan anonim menyelesaikan checkout di halaman publik.
      await actAs(tx, null, 'anon');
      const [{ d: requested }] = await tx<{ d: string }[]>`
        select ((now() at time zone 'Asia/Jakarta')::date + 5::int)::text as d
      `;
      const [created] = await tx<{ result: Record<string, unknown> }[]>`
        select public.create_guest_order(${tx.json({
          participant: { name: 'Pemesan Alur', phone: '081277700001' },
          service_id: SERVICE_AQIQAH,
          qty: 2,
          species: 'kambing',
          aqiqah_for: 'laki_laki',
          on_behalf_of: 'Anak Alur',
          child_birth_place: 'Bandung',
          child_birth_date: '2026-07-01',
          distribution_mode: 'kirim',
          requested_date: requested,
          requested_time: '09:00',
          delivery_province_code: REGION.province,
          delivery_city_code: REGION.city,
          delivery_district_code: REGION.district,
          delivery_village_code: REGION.village,
          delivery_postal_code: '40252',
          delivery_detail: 'Jl. Alur No. 7',
        })}::jsonb) as result
      `;
      const token = created.result.public_token as string;
      const total = Number(created.result.total_amount);
      expect(created.result.status).toBe('new');
      expect(total).toBe(2_800_000 * 2);

      await actAsOwner(tx);
      const [order] = await tx<{ id: string }[]>`
        select id from public.orders where public_token = ${token}
      `;
      const orderId = order.id;

      // Belum ada tahap: daftar kerja belum terbit karena mitra belum ditugaskan.
      expect(await stages(tx, orderId)).toHaveLength(0);

      // ---------------------------------------------------------------- 2
      // Admin memverifikasi order tamu, lalu mencatat & memverifikasi pembayaran.
      await actAs(tx, SEED.admin);
      await tx`
        update public.orders set
          guest_verified_at = now(), guest_verified_by = ${SEED.admin},
          status = 'verified'::public.order_status
        where id = ${orderId}
      `;

      const [payment] = await tx<{ id: string }[]>`
        insert into public.payments (order_id, amount, method, status, recorded_by)
        values (${orderId}, ${total}, 'transfer', 'pending'::public.payment_verification_status, ${SEED.admin})
        returning id
      `;
      await actAs(tx, SEED.superadmin);
      await tx`
        update public.payments set
          status = 'verified'::public.payment_verification_status,
          verified_by = ${SEED.superadmin}, verified_at = now()
        where id = ${payment.id}
      `;

      // `sync_order_payment` harus menaikkan paid_amount & payment_status sendiri.
      await actAsOwner(tx);
      const [paid] = await tx<{ paid: string; status: string }[]>`
        select paid_amount::text as paid, payment_status::text as status
        from public.orders where id = ${orderId}
      `;
      expect(Number(paid.paid)).toBe(total);
      expect(paid.status).toBe('paid');

      // ---------------------------------------------------------------- 3
      // Admin menugaskan mitra — di sinilah daftar tahap terbit.
      await actAs(tx, SEED.admin);
      await tx`
        update public.orders set
          vendor_id = ${SEED.vendorA},
          status = 'assigned'::public.order_status
        where id = ${orderId}
      `;

      await actAsOwner(tx);
      const checklist = await stages(tx, orderId);
      // 2 ekor bermode kirim: 4 tahap tunggal + 2 baris sembelih = 6 baris.
      expect(checklist).toHaveLength(6);
      expect([...new Set(checklist.map((s) => s.stage))]).toEqual([
        'persiapan',
        'sembelih',
        'masak',
        'kirim',
        'terkirim',
      ]);

      // ---------------------------------------------------------------- 4
      // Vendor mencoba melompat langsung ke masak — harus ditolak database.
      await actAs(tx, SEED.vendorUserA);
      const skip = await expectFailureInSavepoint(
        tx,
        (sp) => sp`
          update public.order_stage_events set
            status = 'reported'::public.stage_event_status,
            reported_by = ${SEED.vendorUserA}, reported_at = now()
          where id = ${checklist.find((s) => s.stage === 'masak')!.id}
        `,
      );
      expect(skip.message).toMatch(/Tahap sebelumnya belum tervalidasi/);

      // ---------------------------------------------------------------- 5
      // Tahapan lapangan dijalankan berurutan, dengan bukti pada tahap yang
      // mewajibkannya (`stage_requirements.min_docs > 0`).
      await runStage(tx, checklist.find((s) => s.stage === 'persiapan')!.id, {
        notes: 'Hewan diperiksa sehat',
      });

      for (const row of checklist.filter((s) => s.stage === 'sembelih')) {
        await runStage(tx, row.id, { notes: 'Disembelih sesuai syariat' });
        await attachApprovedDoc(tx, orderId, row.id, 'sembelih');
      }

      const masak = checklist.find((s) => s.stage === 'masak')!;
      await runStage(tx, masak.id, { notes: 'Diolah di dapur mitra' });
      await attachApprovedDoc(tx, orderId, masak.id, 'masak');

      await runStage(tx, checklist.find((s) => s.stage === 'kirim')!.id, {
        notes: 'Diantar ke alamat pemesan',
      });

      const terkirim = checklist.find((s) => s.stage === 'terkirim')!;
      await runStage(tx, terkirim.id, { notes: 'Diterima di alamat' });
      await attachApprovedDoc(tx, orderId, terkirim.id, 'terkirim');

      // ---------------------------------------------------------------- 6
      // Gerbang bukti: tidak ada tahap yang buktinya masih kurang.
      await actAsOwner(tx);
      const progress = await progressOf(tx, orderId);
      expect(progress.missing).toEqual([]);
      expect(progress.validated).toBe(6);
      expect(progress.total).toBe(6);

      // ---------------------------------------------------------------- 7
      // Laporan dibuat; halaman publik baru terbuka sesudah ini.
      await actAs(tx, SEED.admin);
      await tx`
        update public.orders set status = 'reporting'::public.order_status where id = ${orderId}
      `;
      await tx`
        insert into public.reports (order_id, version, pdf_path, generated_by)
        values (${orderId}, 1, ${'2026/08/uji/laporan-v1.pdf'}, ${SEED.admin})
      `;

      // ---------------------------------------------------------------- 8
      // Pemesan membuka halaman bertoken sebagai anonim.
      await actAs(tx, null, 'anon');
      const [report] = await tx<{ payload: Record<string, unknown> }[]>`
        select public.get_public_report(${token}) as payload
      `;
      const payload = report.payload;
      expect(payload).not.toBeNull();

      const prog = payload.progress as Record<string, number>;
      // Angka yang dilihat pemesan — inilah yang pernah mencetak 0/0.
      expect(prog.stages_validated).toBe(6);
      expect(prog.stages_total).toBe(6);
      expect(prog.animals_total).toBe(2);
      expect(payload.vendor_name).toBeTruthy();
      // 5 tahap tervalidasi tampil sebagai 6 baris (sembelih dua ekor).
      expect(payload.stages as unknown[]).toHaveLength(6);
      expect((payload.documentations as unknown[]).length).toBeGreaterThan(0);

      // ---------------------------------------------------------------- 9
      // Pemesan menekan "pesanan sudah saya terima".
      const [confirmed] = await tx<{ result: Record<string, unknown> }[]>`
        select public.confirm_delivery(${token}, ${'203.0.113.9'}) as result
      `;
      expect(confirmed.result.ok).toBe(true);

      // --------------------------------------------------------------- 10
      // Order ditutup.
      await actAs(tx, SEED.admin);
      await tx`
        update public.orders set status = 'completed'::public.order_status where id = ${orderId}
      `;

      await actAsOwner(tx);
      const [final] = await tx<{ status: string; confirmed_at: string | null }[]>`
        select status::text, delivery_confirmed_at::text as confirmed_at
        from public.orders where id = ${orderId}
      `;
      expect(final.status).toBe('completed');
      expect(final.confirmed_at).not.toBeNull();

      // Litmus test: order yang selesai tidak lagi muncul di daftar terbuka.
      const open = await tx`
        select 1 from public.v_open_orders where order_id = ${orderId}
      `;
      expect(open).toHaveLength(0);
    });
  });
});

describe('alur penuh — mode salur (4 tahap, tanpa konfirmasi penerima)', () => {
  it('menempuh rantai salur dan menutup gerbang bukti pada tahap salur', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, null, 'anon');
      const [{ d: requested }] = await tx<{ d: string }[]>`
        select ((now() at time zone 'Asia/Jakarta')::date + 4::int)::text as d
      `;
      const [created] = await tx<{ result: Record<string, unknown> }[]>`
        select public.create_guest_order(${tx.json({
          participant: { name: 'Pemesan Salur', phone: '081277700002' },
          service_id: SERVICE_AQIQAH,
          qty: 1,
          species: 'kambing',
          aqiqah_for: 'perempuan',
          child_birth_place: 'Bandung',
          child_birth_date: '2026-06-15',
          distribution_mode: 'salur',
          requested_date: requested,
          requested_time: '10:00',
        })}::jsonb) as result
      `;
      const token = created.result.public_token as string;

      await actAsOwner(tx);
      const [order] = await tx<{ id: string }[]>`
        select id from public.orders where public_token = ${token}
      `;
      const orderId = order.id;

      await actAs(tx, SEED.admin);
      await tx`
        update public.orders set
          guest_verified_at = now(), guest_verified_by = ${SEED.admin},
          paid_amount = total_amount,
          payment_status = 'paid'::public.payment_status,
          vendor_id = ${SEED.vendorA},
          status = 'assigned'::public.order_status
        where id = ${orderId}
      `;

      await actAsOwner(tx);
      const checklist = await stages(tx, orderId);
      expect(checklist.map((s) => s.stage)).toEqual(['persiapan', 'sembelih', 'masak', 'salur']);

      await runStage(tx, checklist[0].id, { notes: 'Persiapan' });
      await runStage(tx, checklist[1].id, { notes: 'Sembelih' });
      await attachApprovedDoc(tx, orderId, checklist[1].id, 'sembelih');
      await runStage(tx, checklist[2].id, { notes: 'Masak' });
      await attachApprovedDoc(tx, orderId, checklist[2].id, 'masak');

      // Tahap salur menuntut titik koordinat (`requires_geo`), berbeda dari
      // kirim yang alamatnya sudah diketahui dari order.
      await runStage(tx, checklist[3].id, {
        notes: 'Disalurkan ke penerima manfaat',
        packages_count: 40,
        recipient_area: 'Panti Asuhan Uji, Bandung',
        lat: -6.9175,
        lng: 107.6191,
      });

      // Sebelum bukti salur disetujui, gerbang masih menyebut tahap itu kurang.
      const before = await progressOf(tx, orderId);
      expect(before.missing).toContain('salur');

      await attachApprovedDoc(tx, orderId, checklist[3].id, 'salur');

      await actAsOwner(tx);
      const after = await progressOf(tx, orderId);
      expect(after.missing).toEqual([]);
      expect(after.validated).toBe(4);

      // Mode salur tidak punya tahap terkirim, jadi konfirmasi penerima tidak
      // berlaku — kalau ini kelak menerima, order salur akan minta konfirmasi
      // yang tidak pernah bisa diberikan siapa pun.
      await actAs(tx, null, 'anon');
      const [attempt] = await tx<{ result: Record<string, unknown> }[]>`
        select public.confirm_delivery(${token}) as result
      `;
      expect(attempt.result.ok).toBe(false);
      expect(attempt.result.reason).toBe('bukan_order_kirim');
    });
  });
});

describe('gerbang bukti dokumentasi', () => {
  it('menolak bukti yang dilampirkan ke tahap yang salah', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const [order] = await tx<{ id: string }[]>`
        insert into public.orders (
          participant_id, vendor_id, status, payment_status, total_amount, paid_amount,
          distribution_mode, aqiqah_for, requested_date, requested_time,
          guest_verified_at, guest_verified_by
        ) values (
          ${SEED.participant}, ${SEED.vendorA}, 'paid'::public.order_status,
          'paid'::public.payment_status, 2800000, 2800000,
          'salur'::public.distribution_mode, 'laki_laki', current_date + 3, '09:00',
          now(), ${SEED.admin}
        ) returning id
      `;
      await tx`
        insert into public.animals (order_id, species, tag_code, on_behalf_of)
        values (${order.id}, 'kambing'::public.animal_species, 'UJI-X', 'Anak Uji')
      `;
      await tx`update public.orders set status = 'assigned'::public.order_status where id = ${order.id}`;

      const list = await stages(tx, order.id);
      const sembelih = list.find((s) => s.stage === 'sembelih')!;

      // Bukti bertahap `masak` dilampirkan ke laporan tahap `sembelih`.
      // Tanpa gerbang ini, satu foto bisa dipakai memenuhi tahap mana pun.
      await actAs(tx, SEED.vendorUserA);
      const mismatch = await expectFailureInSavepoint(
        tx,
        (sp) => sp`
          insert into public.documentations (
            order_id, stage_event_id, stage, type, storage_path, uploaded_by
          ) values (
            ${order.id}, ${sembelih.id}, 'masak'::public.doc_stage,
            'photo'::public.doc_type, ${'2026/08/uji/salah.jpg'}, ${SEED.vendorUserA}
          )
        `,
      );
      expect(mismatch.message).toMatch(/tidak cocok dengan tahap laporan/);
    });
  });

  it('menolak pengunggah menyetujui buktinya sendiri', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const [order] = await tx<{ id: string }[]>`
        insert into public.orders (
          participant_id, vendor_id, status, payment_status, total_amount, paid_amount,
          distribution_mode, aqiqah_for, requested_date, requested_time,
          guest_verified_at, guest_verified_by
        ) values (
          ${SEED.participant}, ${SEED.vendorA}, 'paid'::public.order_status,
          'paid'::public.payment_status, 2800000, 2800000,
          'salur'::public.distribution_mode, 'laki_laki', current_date + 3, '09:00',
          now(), ${SEED.admin}
        ) returning id
      `;

      await actAs(tx, SEED.vendorUserA);
      const [doc] = await tx<{ id: string }[]>`
        insert into public.documentations (
          order_id, stage, type, storage_path, uploaded_by
        ) values (
          ${order.id}, 'umum'::public.doc_stage, 'photo'::public.doc_type,
          ${'2026/08/uji/umum.jpg'}, ${SEED.vendorUserA}
        ) returning id
      `;

      const selfApprove = await expectFailureInSavepoint(
        tx,
        (sp) => sp`
          update public.documentations set
            status = 'approved'::public.doc_status,
            reviewed_by = ${SEED.vendorUserA}, reviewed_at = now()
          where id = ${doc.id}
        `,
      );
      expect(selfApprove.message).toMatch(/sendiri|pengunggah|validasi/i);
    });
  });
});
