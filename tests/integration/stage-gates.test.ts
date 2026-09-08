/**
 * Dua gerbang yang hanya hidup di database:
 *
 * - `enforce_stage_order` — tahap ke-N tertutup sampai tahap sebelumnya
 *   **dilaporkan**. Dilonggarkan 8 September dari `validated`: admin tidak lagi
 *   menghambat pekerjaan lapangan di tiap tahap, tetapi urutannya masih
 *   dijaga — yang belum disentuh (`pending`) dan yang **ditolak** (`rejected`)
 *   tetap menahan.
 * - `enforce_stage_review` — yang melapor tidak boleh menyatakan laporannya
 *   sendiri benar, dan `validated_by` diturunkan dari sesi.
 *
 * UI punya cerminan aturan ini (`canReportStage` mematikan tombolnya), tapi UI
 * bisa dilewati. Yang diuji di sini adalah penegakan yang tidak bisa dilewati.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  actAs,
  actAsOwner,
  expectFailure,
  expectFailureInSavepoint,
  inRollback,
  isReady,
} from './helpers/db';
import {
  SEED,
  assignVendor,
  makePaidOrder,
  reportStage,
  stagesOf,
  validateStage,
} from './helpers/fixtures';

beforeAll(async () => {
  const ready = await isReady();
  if (!ready.ok) throw new Error(ready.reason);
});

describe('enforce_stage_order', () => {
  it('menolak melapor tahap 2 sebelum tahap 1 disentuh sama sekali', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'kirim' });
      await assignVendor(tx, orderId);
      const stages = await stagesOf(tx, orderId);

      const sembelih = stages.find((s) => s.stage === 'sembelih')!;
      const failure = await expectFailure(() => reportStage(tx, sembelih.id));

      expect(failure.message).toMatch(/Tahap sebelumnya belum dilaporkan/);
      // Kode galat diuji eksplisit: kalau kelak gagalnya karena sebab lain
      // (kolom hilang, tipe salah), tes yang hanya menuntut "melempar" akan
      // tetap hijau dan menyembunyikan hilangnya gerbang ini.
      expect(failure.code).toBe('23514'); // check_violation
    });
  });

  it('MENGIZINKAN tahap 2 ketika tahap 1 baru dilaporkan, belum divalidasi', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'kirim' });
      await assignVendor(tx, orderId);
      const stages = await stagesOf(tx, orderId);

      // Pelonggaran 8 September, persis yang diramalkan komentar migration
      // aslinya: gerbangnya pindah dari `validated` ke
      // `in ('reported','validated')`. Alasannya operasional — admin jadi
      // penghambat di tiap tahap, dan mitra berhenti di lapangan menunggu
      // orang yang sedang tidak di depan layar.
      await actAs(tx, SEED.vendorUserA);
      await reportStage(tx, stages.find((s) => s.stage === 'persiapan')!.id);
      await reportStage(tx, stages.find((s) => s.stage === 'sembelih')!.id);

      const after = await stagesOf(tx, orderId);
      expect(after.find((s) => s.stage === 'sembelih')!.status).toBe('reported');
      // Persiapan tetap menunggu keputusan admin — pekerjaan lapangan jalan
      // terus, penilaiannya menyusul.
      expect(after.find((s) => s.stage === 'persiapan')!.status).toBe('reported');
    });
  });

  it('tahap yang DITOLAK tetap menahan tahap sesudahnya', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'kirim' });
      await assignVendor(tx, orderId);
      const stages = await stagesOf(tx, orderId);

      const persiapan = stages.find((s) => s.stage === 'persiapan')!;
      await actAs(tx, SEED.vendorUserA);
      await reportStage(tx, persiapan.id);

      // Admin menolak: tahapnya sudah dinilai dan dinyatakan kurang.
      await actAs(tx, SEED.admin);
      await tx`
        update public.order_stage_events
        set status = 'rejected'::public.stage_event_status, review_note = 'foto buram'
        where id = ${persiapan.id}
      `;

      // Melanjutkan di atasnya berarti menumpuk pekerjaan di atas dasar yang
      // sudah dinyatakan salah — inilah yang sengaja TIDAK ikut dilonggarkan.
      await actAs(tx, SEED.vendorUserA);
      const failure = await expectFailure(() =>
        reportStage(tx, stages.find((s) => s.stage === 'sembelih')!.id),
      );
      expect(failure.message).toMatch(/persiapan/);
      expect(failure.code).toBe('23514');
    });
  });

  it('mengizinkan tahap 2 setelah tahap 1 tervalidasi', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'kirim' });
      await assignVendor(tx, orderId);
      const stages = await stagesOf(tx, orderId);

      const persiapan = stages.find((s) => s.stage === 'persiapan')!;
      await actAs(tx, SEED.vendorUserA);
      await reportStage(tx, persiapan.id);
      await actAs(tx, SEED.admin);
      await validateStage(tx, persiapan.id);

      await actAs(tx, SEED.vendorUserA);
      await reportStage(tx, stages.find((s) => s.stage === 'sembelih')!.id);

      const after = await stagesOf(tx, orderId);
      expect(after.find((s) => s.stage === 'sembelih')!.status).toBe('reported');
    });
  });

  it('antar-ekor sembelih tidak saling memblokir (seq sama)', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'kirim', animals: 3 });
      await assignVendor(tx, orderId);
      const stages = await stagesOf(tx, orderId);

      const persiapan = stages.find((s) => s.stage === 'persiapan')!;
      await actAs(tx, SEED.vendorUserA);
      await reportStage(tx, persiapan.id);
      await actAs(tx, SEED.admin);
      await validateStage(tx, persiapan.id);

      // Ketiga ekor berbagi seq=2. Gerbang membandingkan `seq <` jadi baris
      // sesama seq tidak boleh saling menutup — kalau ia memakai `<=`, ekor
      // kedua akan tertolak dan lapangan macet.
      await actAs(tx, SEED.vendorUserA);
      const sembelih = stages.filter((s) => s.stage === 'sembelih');
      for (const row of sembelih) {
        await reportStage(tx, row.id);
      }

      const after = await stagesOf(tx, orderId);
      expect(after.filter((s) => s.stage === 'sembelih' && s.status === 'reported')).toHaveLength(
        3,
      );
    });
  });

  it('masak tertutup sampai SEMUA ekor sembelih dilaporkan', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'kirim', animals: 2 });
      await assignVendor(tx, orderId);
      const stages = await stagesOf(tx, orderId);

      const persiapan = stages.find((s) => s.stage === 'persiapan')!;
      await actAs(tx, SEED.vendorUserA);
      await reportStage(tx, persiapan.id);
      await actAs(tx, SEED.admin);
      await validateStage(tx, persiapan.id);

      const sembelih = stages.filter((s) => s.stage === 'sembelih');
      // Hanya ekor pertama diselesaikan; ekor kedua dibiarkan pending.
      await actAs(tx, SEED.vendorUserA);
      await reportStage(tx, sembelih[0].id);
      await actAs(tx, SEED.admin);
      await validateStage(tx, sembelih[0].id);

      await actAs(tx, SEED.vendorUserA);
      const failure = await expectFailure(() =>
        reportStage(tx, stages.find((s) => s.stage === 'masak')!.id),
      );
      expect(failure.message).toMatch(/sembelih/);
    });
  });

  it('melewati gerbang saat status tidak berubah', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur' });
      await assignVendor(tx, orderId);
      const stages = await stagesOf(tx, orderId);

      // Menyunting catatan pada tahap yang masih pending tidak boleh terhalang
      // gerbang urutan — kalau terhalang, koreksi ketikan jadi mustahil.
      const masak = stages.find((s) => s.stage === 'masak')!;
      await tx`
        update public.order_stage_events set notes = 'koreksi catatan'
        where id = ${masak.id}
      `;

      const [row] = await tx<{ notes: string }[]>`
        select notes from public.order_stage_events where id = ${masak.id}
      `;
      expect(row.notes).toBe('koreksi catatan');
    });
  });
});

describe('enforce_stage_review', () => {
  it('menolak pelapor memvalidasi laporannya sendiri', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur' });
      await assignVendor(tx, orderId);
      const stages = await stagesOf(tx, orderId);
      const persiapan = stages.find((s) => s.stage === 'persiapan')!;

      await actAs(tx, SEED.vendorUserA);
      await reportStage(tx, persiapan.id, SEED.vendorUserA);

      // Masih sebagai pelapor yang sama.
      const failure = await expectFailure(() => validateStage(tx, persiapan.id));
      expect(failure.message).toMatch(/tidak boleh memvalidasi laporannya sendiri/i);
      expect(failure.code).toBe('42501'); // insufficient_privilege
    });
  });

  it('berlaku juga bagi admin yang kebetulan ikut melapor', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur' });
      await assignVendor(tx, orderId);
      const stages = await stagesOf(tx, orderId);
      const persiapan = stages.find((s) => s.stage === 'persiapan')!;

      // Pemisahan tugas tidak boleh bergantung pada role — kalau admin yang
      // melapor, admin itu juga tidak boleh menjadi validatornya.
      await actAs(tx, SEED.admin);
      await reportStage(tx, persiapan.id, SEED.admin);

      const failure = await expectFailure(() => validateStage(tx, persiapan.id));
      expect(failure.code).toBe('42501');
    });
  });

  it('menurunkan validated_by dari sesi, bukan dari kiriman klien', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur' });
      await assignVendor(tx, orderId);
      const stages = await stagesOf(tx, orderId);
      const persiapan = stages.find((s) => s.stage === 'persiapan')!;

      await actAs(tx, SEED.vendorUserA);
      await reportStage(tx, persiapan.id);

      // Klien mencoba menyebut orang lain sebagai validator. Trigger harus
      // menimpanya dengan `auth.uid()` — inilah yang membuat jejak audit
      // tidak bisa dipalsukan dari sisi klien.
      await actAs(tx, SEED.admin);
      await tx`
        update public.order_stage_events set
          status = 'validated'::public.stage_event_status,
          validated_by = ${SEED.superadmin}
        where id = ${persiapan.id}
      `;

      const [row] = await tx<{ validated_by: string; validated_at: string | null }[]>`
        select validated_by::text, validated_at::text
        from public.order_stage_events where id = ${persiapan.id}
      `;
      expect(row.validated_by).toBe(SEED.admin);
      expect(row.validated_at).not.toBeNull();
    });
  });

  it('penolakan mengosongkan validated_at dan menuntut alasan', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur' });
      await assignVendor(tx, orderId);
      const stages = await stagesOf(tx, orderId);
      const persiapan = stages.find((s) => s.stage === 'persiapan')!;

      await actAs(tx, SEED.vendorUserA);
      await reportStage(tx, persiapan.id);
      await actAs(tx, SEED.admin);

      // Tanpa alasan → ditolak constraint. Dijalankan dalam savepoint supaya
      // transaksinya selamat dan jalur berhasil di bawah masih bisa diuji.
      const failure = await expectFailureInSavepoint(
        tx,
        (sp) => sp`
          update public.order_stage_events
          set status = 'rejected'::public.stage_event_status
          where id = ${persiapan.id}
        `,
      );
      expect(failure.message).toMatch(/stage_events_reject_reason_check/);

      // Dengan alasan → diterima, dan `validated_at` tetap kosong karena
      // penolakan bukan pengesahan.
      await tx`
        update public.order_stage_events set
          status = 'rejected'::public.stage_event_status,
          review_note = 'Foto tidak memperlihatkan nomor tag'
        where id = ${persiapan.id}
      `;

      const [row] = await tx<
        { status: string; validated_at: string | null; validated_by: string }[]
      >`
        select status::text, validated_at::text, validated_by::text
        from public.order_stage_events where id = ${persiapan.id}
      `;
      expect(row.status).toBe('rejected');
      expect(row.validated_at).toBeNull();
      expect(row.validated_by).toBe(SEED.admin);
    });
  });

  it('tahap yang ditolak menutup tahap berikutnya', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur' });
      await assignVendor(tx, orderId);
      const stages = await stagesOf(tx, orderId);
      const persiapan = stages.find((s) => s.stage === 'persiapan')!;

      await actAs(tx, SEED.vendorUserA);
      await reportStage(tx, persiapan.id);
      await actAs(tx, SEED.admin);
      await tx`
        update public.order_stage_events set
          status = 'rejected'::public.stage_event_status,
          review_note = 'Bukti kurang jelas'
        where id = ${persiapan.id}
      `;

      // `rejected` bukan `validated`, jadi gerbang harus tetap tertutup —
      // bukti yang ditolak tidak boleh meloloskan tahap berikutnya.
      await actAs(tx, SEED.vendorUserA);
      const failure = await expectFailure(() =>
        reportStage(tx, stages.find((s) => s.stage === 'sembelih')!.id),
      );
      expect(failure.message).toMatch(/persiapan/);
    });
  });
});
