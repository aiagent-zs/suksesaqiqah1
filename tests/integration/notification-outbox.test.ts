/**
 * Outbox notifikasi (Tahap 8) — trigger yang mengisinya.
 *
 * Seluruh perilaku yang diuji di sini hidup **di dalam database**: enam trigger
 * dan satu fungsi penerbit. Tidak satu pun bisa dijalankan Vitest sendiri, dan
 * tidak satu pun bisa dijaga `tsc` — kolom `payload` bertipe `Json`, jadi
 * bentuk isinya melewati pemeriksaan tipe apa pun.
 *
 * Yang paling penting dijaga di sini adalah **idempotensi**. Notifikasi ganda
 * bukan sekadar berisik: ia berarti pemesan menerima dua pesan WhatsApp untuk
 * satu peristiwa yang sama, dan itu terbaca sebagai sistem yang kacau.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { actAsOwner, inRollback, isReady } from './helpers/db';
import {
  SEED,
  makePaidOrder,
  assignVendor,
  stagesOf,
  reportStage,
  validateStage,
} from './helpers/fixtures';
import type postgres from 'postgres';

type Notif = {
  id: string;
  channel: string;
  template: string;
  status: string;
  recipient: string;
  event_key: string | null;
  payload: Record<string, unknown>;
};

/** Seluruh notifikasi milik satu order, terurut sebagaimana terbitnya. */
async function notifsOf(tx: postgres.TransactionSql, orderId: string): Promise<Notif[]> {
  return tx<Notif[]>`
    select id, channel::text, template, status::text, recipient, event_key, payload
    from public.notifications
    where order_id = ${orderId}
    order by created_at, template
  `;
}

beforeAll(async () => {
  const ready = await isReady();
  if (!ready.ok) throw new Error(ready.reason);
});

describe('outbox — bukti dokumentasi', () => {
  it('unggahan bukti menerbitkan satu notifikasi untuk admin', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur' });

      await tx`
        insert into public.documentations (order_id, stage, type, storage_path, status)
        values (${orderId}, 'persiapan', 'photo', 'a/b.webp', 'pending')
      `;

      const rows = await notifsOf(tx, orderId);
      const uploaded = rows.filter((r) => r.template === 'documentation_uploaded');
      expect(uploaded).toHaveLength(1);
      expect(uploaded[0].channel).toBe('dashboard');
      expect(uploaded[0].status).toBe('queued');
      expect(uploaded[0].payload.stage).toBe('persiapan');
      // Nomor order ikut di payload supaya panel tidak perlu join balik.
      expect(String(uploaded[0].payload.order_number)).toMatch(/^IA-/);
    });
  });

  it('penolakan berulang hanya menerbitkan SATU notifikasi', async () => {
    // Inti `event_key`. Tanpa itu, koreksi caption pada bukti yang sudah
    // ditolak menerbitkan pesan kedua ke vendor yang sama.
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur' });

      const [doc] = await tx<{ id: string }[]>`
        insert into public.documentations (order_id, stage, type, storage_path, status)
        values (${orderId}, 'persiapan', 'photo', 'a/b.webp', 'pending')
        returning id
      `;

      await tx`update public.documentations set status='rejected', review_note='buram' where id=${doc.id}`;
      await tx`update public.documentations set caption='koreksi' where id=${doc.id}`;
      await tx`update public.documentations set status='rejected', review_note='masih buram' where id=${doc.id}`;

      const rejected = (await notifsOf(tx, orderId)).filter(
        (r) => r.template === 'documentation_rejected',
      );
      expect(rejected, 'penolakan berulang menerbitkan notifikasi ganda').toHaveLength(1);
      // Alasan yang tercatat adalah yang PERTAMA — notifikasi merekam peristiwa
      // saat ia terjadi, bukan keadaan terkini.
      expect(rejected[0].payload.review_note).toBe('buram');
    });
  });

  it('bukti yang disetujui tidak menerbitkan notifikasi penolakan', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur' });

      const [doc] = await tx<{ id: string }[]>`
        insert into public.documentations (order_id, stage, type, storage_path, status)
        values (${orderId}, 'persiapan', 'photo', 'a/b.webp', 'pending')
        returning id
      `;
      await tx`update public.documentations set status='approved' where id=${doc.id}`;

      const rows = await notifsOf(tx, orderId);
      expect(rows.some((r) => r.template === 'documentation_rejected')).toBe(false);
    });
  });
});

describe('outbox — kendala', () => {
  it('kendala berat menerbitkan notifikasi, kendala ringan tidak', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur' });

      await tx`insert into public.issues (order_id, title, severity) values (${orderId}, 'Berat', 'high')`;
      await tx`insert into public.issues (order_id, title, severity) values (${orderId}, 'Ringan', 'low')`;
      await tx`insert into public.issues (order_id, title, severity) values (${orderId}, 'Sedang', 'medium')`;

      const high = (await notifsOf(tx, orderId)).filter((r) => r.template === 'issue_high');
      expect(high).toHaveLength(1);
      expect(high[0].payload.title).toBe('Berat');
    });
  });
});

describe('outbox — order tamu', () => {
  it('order tamu menerbitkan notifikasi, order staf tidak', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);

      // Order tamu: `created_by` NULL.
      const [guest] = await tx<{ id: string }[]>`
        insert into public.orders (participant_id, created_by, total_amount, distribution_mode, aqiqah_for)
        values (${SEED.participant}, null, 1000, 'salur', 'laki_laki')
        returning id
      `;
      // Order staf: dibuat admin.
      const [staff] = await tx<{ id: string }[]>`
        insert into public.orders (participant_id, created_by, total_amount, distribution_mode, aqiqah_for)
        values (${SEED.participant}, ${SEED.admin}, 1000, 'salur', 'laki_laki')
        returning id
      `;

      expect(await notifsOf(tx, guest.id)).toHaveLength(1);
      expect(
        await notifsOf(tx, staff.id),
        'order yang dibuat staf tidak butuh verifikasi, jadi tidak boleh memberi notifikasi',
      ).toHaveLength(0);
    });
  });
});
describe('outbox — laporan & konfirmasi terkirim', () => {
  it('laporan terbit menerbitkan WA dan email sekaligus', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur' });

      await tx`
        insert into public.reports (order_id, version, pdf_path, generated_by)
        values (${orderId}, 1, 'r/1.pdf', ${SEED.admin})
      `;

      const rows = await notifsOf(tx, orderId);
      const ready = rows.filter((r) => r.template === 'report_ready');
      // Peserta seed punya email, jadi kedua kanal terbit. Worker nanti yang
      // memilih mana yang benar-benar dikirim.
      expect(ready.map((r) => r.channel).sort()).toEqual(['email', 'whatsapp']);
      // Token ikut di payload supaya pesan WA bisa dirakit tanpa membaca ulang
      // tabel orders — dan tanpa membocorkan kolom lain dari sana.
      expect(String(ready[0].payload.public_token)).toHaveLength(32);
    });
  });

  it('generate ulang menerbitkan notifikasi lagi karena isinya berubah', async () => {
    // Berbeda dari penolakan bukti: versi baru memang layak diberitahukan,
    // jadi `event_key` sengaja memuat nomor versinya.
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur' });

      await tx`insert into public.reports (order_id, version, pdf_path, generated_by)
               values (${orderId}, 1, 'r/1.pdf', ${SEED.admin})`;
      await tx`insert into public.reports (order_id, version, pdf_path, generated_by)
               values (${orderId}, 2, 'r/2.pdf', ${SEED.admin})`;

      const wa = (await notifsOf(tx, orderId)).filter(
        (r) => r.template === 'report_ready' && r.channel === 'whatsapp',
      );
      expect(wa).toHaveLength(2);
      expect(wa.map((r) => r.payload.report_version).sort()).toEqual([1, 2]);
    });
  });

  it('tahap kirim tervalidasi memberi tahu pemesan untuk mengonfirmasi', async () => {
    // Celah yang tercatat terbuka di TASKS.md: `confirm_delivery()` sudah ada
    // sejak 20 Agustus, tapi tidak ada yang memberi tahu pemesan bahwa ia perlu
    // menekannya.
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'kirim' });
      await assignVendor(tx, orderId);

      // Tempuh rangkaiannya sampai `kirim` — gerbang urutan menolak lompatan,
      // jadi tiap tahap sebelumnya harus benar-benar dilalui.
      for (const stage of await stagesOf(tx, orderId)) {
        if (stage.stage === 'terkirim') break;
        await reportStage(tx, stage.id);
        await validateStage(tx, stage.id);

        if (stage.stage === 'kirim') {
          const pending = (await notifsOf(tx, orderId)).filter(
            (r) => r.template === 'delivery_pending',
          );
          expect(pending, 'pemesan tidak diberi tahu setelah tahap kirim divalidasi').toHaveLength(
            1,
          );
          expect(pending[0].channel).toBe('whatsapp');
        }
      }
    });
  });

  it('mode salur tidak pernah meminta konfirmasi penerimaan', async () => {
    // Tidak ada yang diantar, jadi tidak ada yang perlu dikonfirmasi —
    // `confirm_delivery` sendiri menolak order non-kirim.
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur' });
      await assignVendor(tx, orderId);

      for (const stage of await stagesOf(tx, orderId)) {
        await reportStage(tx, stage.id);
        await validateStage(tx, stage.id);
      }

      const rows = await notifsOf(tx, orderId);
      expect(rows.some((r) => r.template === 'delivery_pending')).toBe(false);
    });
  });
});
/**
 * Penandaan "sudah ditangani" — sisi tulis outbox.
 *
 * Pengiriman masih manual sampai worker Tahap 8 ada, jadi yang memindahkan
 * baris keluar dari antrian adalah admin yang menekan tombolnya. Yang diuji di
 * sini bukan tombolnya (itu di `tests/unit/alert-panel.test.tsx`), melainkan
 * penguncian optimistik `.eq('status','queued')` yang dipakai server action —
 * satu-satunya hal yang mencegah penekanan kedua menggeser `sent_at`.
 */
describe('outbox — penandaan sudah ditangani', () => {
  it('penandaan kedua tidak menggeser sent_at', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur' });

      await tx`
        insert into public.documentations (order_id, stage, type, storage_path, status)
        values (${orderId}, 'persiapan', 'photo', 'a/b.webp', 'pending')
      `;
      const [notif] = await notifsOf(tx, orderId);
      expect(notif.status).toBe('queued');

      // Persis kondisi yang dipakai `markNotificationSent`.
      const first = await tx`
        update public.notifications
        set status = 'sent', sent_at = now(), error_text = null
        where id = ${notif.id} and status = 'queued'
        returning sent_at
      `;
      expect(first).toHaveLength(1);

      // Penekanan kedua: tidak boleh ada baris yang tersentuh, sebab statusnya
      // bukan lagi `queued`. Tanpa syarat itu, `sent_at` akan bergeser ke waktu
      // sekarang dan jejak kapan notifikasi benar-benar ditangani hilang.
      const second = await tx`
        update public.notifications
        set status = 'sent', sent_at = now(), error_text = null
        where id = ${notif.id} and status = 'queued'
        returning sent_at
      `;
      expect(second, 'penandaan kedua ikut menulis — sent_at bisa bergeser').toHaveLength(0);

      const [after] = await tx<{ sent_at: Date | null }[]>`
        select sent_at from public.notifications where id = ${notif.id}
      `;
      expect(after.sent_at?.toISOString()).toBe(
        (first[0] as { sent_at: Date }).sent_at.toISOString(),
      );
    });
  });

  it('baris yang ditandai hilang dari antrian panel', async () => {
    // `getPendingAlerts` menyaring `status = 'queued'`. Kalau penandaan tidak
    // benar-benar memindahkan statusnya, panel tidak akan pernah menyusut.
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur' });

      await tx`
        insert into public.documentations (order_id, stage, type, storage_path, status)
        values (${orderId}, 'persiapan', 'photo', 'a/b.webp', 'pending')
      `;
      const [notif] = await notifsOf(tx, orderId);

      await tx`
        update public.notifications
        set status = 'sent', sent_at = now()
        where id = ${notif.id} and status = 'queued'
      `;

      const queued = (await notifsOf(tx, orderId)).filter((r) => r.status === 'queued');
      expect(queued.some((r) => r.id === notif.id)).toBe(false);
    });
  });
});
