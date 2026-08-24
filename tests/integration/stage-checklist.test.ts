/**
 * `generate_stage_checklist` — daftar tahap terbit otomatis saat mitra ditugaskan.
 *
 * Yang diuji di sini tidak bisa diuji unit: pemicunya adalah transisi status di
 * database, jumlah baris yang terbit bergantung pada `fulfilment_sequence()`,
 * dan tahap `sembelih` menggandakan diri per ekor hewan.
 *
 * Order di `02_demo.sql` **tidak** membuktikan apa pun tentang trigger ini —
 * seed menyisipkan tahapnya dengan tangan karena ordernya sudah `in_progress`
 * sejak awal. Tes ini menempuh transisi `paid -> assigned` yang sungguhan.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { actAs, actAsOwner, inRollback, isReady, sql } from './helpers/db';
import { SEED, assignVendor, makePaidOrder, stagesOf } from './helpers/fixtures';

beforeAll(async () => {
  const ready = await isReady();
  if (!ready.ok) throw new Error(ready.reason);
});

describe('generate_stage_checklist', () => {
  it('menerbitkan 5 tahap untuk mode kirim, terurut sesuai rangkaian', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'kirim' });

      // Sebelum penugasan: belum ada tahap sama sekali.
      expect(await stagesOf(tx, orderId)).toHaveLength(0);

      await assignVendor(tx, orderId);

      const stages = await stagesOf(tx, orderId);
      expect(stages.map((s) => s.stage)).toEqual([
        'persiapan',
        'sembelih',
        'masak',
        'kirim',
        'terkirim',
      ]);
      // `seq` harus 1..5 — gerbang urutan bersandar penuh pada angka ini.
      expect(stages.map((s) => s.seq)).toEqual([1, 2, 3, 4, 5]);
      expect(stages.every((s) => s.status === 'pending')).toBe(true);
    });
  });

  it('menerbitkan 4 tahap untuk mode salur — tanpa kirim & terkirim', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur' });
      await assignVendor(tx, orderId);

      const stages = await stagesOf(tx, orderId);
      expect(stages.map((s) => s.stage)).toEqual(['persiapan', 'sembelih', 'masak', 'salur']);
      expect(stages.map((s) => s.seq)).toEqual([1, 2, 3, 4]);
    });
  });

  it('sembelih terbit satu baris per ekor, dengan seq yang sama', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId, animalIds } = await makePaidOrder(tx, { mode: 'kirim', animals: 3 });
      await assignVendor(tx, orderId);

      const stages = await stagesOf(tx, orderId);
      const sembelih = stages.filter((s) => s.stage === 'sembelih');

      // 3 ekor → 3 baris sembelih, masing-masing tertaut ke hewannya.
      expect(sembelih).toHaveLength(3);
      expect(new Set(sembelih.map((s) => s.animal_id))).toEqual(new Set(animalIds));

      // Semuanya berbagi satu seq — itulah yang membuat antar-ekor bisa paralel
      // tanpa saling memblokir di `enforce_stage_order`.
      expect(new Set(sembelih.map((s) => s.seq))).toEqual(new Set([2]));

      // Total baris = 4 tahap tunggal + 3 sembelih. Inilah pembeda
      // `stages_total` (baris) dari `stages_in_sequence` (tahap) yang pernah
      // tertukar dan mencetak "7/5 tahap".
      expect(stages).toHaveLength(7);

      // Tahap non-sembelih tidak boleh tertaut ke hewan mana pun.
      const others = stages.filter((s) => s.stage !== 'sembelih');
      expect(others.every((s) => s.animal_id === null)).toBe(true);
    });
  });

  it('tidak menerbitkan ulang saat status assigned disetel lagi', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'kirim' });
      await assignVendor(tx, orderId);
      const first = await stagesOf(tx, orderId);

      // Trigger membandingkan old.status — assigned -> assigned harus diam.
      await assignVendor(tx, orderId);

      const second = await stagesOf(tx, orderId);
      expect(second).toHaveLength(first.length);
      expect(second.map((s) => s.id).sort()).toEqual(first.map((s) => s.id).sort());
    });
  });

  it('tidak menyala pada transisi status yang bukan ke assigned', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'kirim' });

      await tx`
        update public.orders set status = 'cancelled'::public.order_status
        where id = ${orderId}
      `;

      expect(await stagesOf(tx, orderId)).toHaveLength(0);
    });
  });

  it('order tanpa hewan tetap menerbitkan tahap non-sembelih', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur', animals: 0 });
      await assignVendor(tx, orderId);

      const stages = await stagesOf(tx, orderId);
      // Tanpa hewan, `sembelih` tidak punya baris untuk diterbitkan — tetapi
      // tahap lain tetap harus ada, bukan gagal seluruhnya.
      expect(stages.map((s) => s.stage)).toEqual(['persiapan', 'masak', 'salur']);
    });
  });

  it('urutan di SQL sama dengan fulfilment_sequence() yang dipanggil langsung', async () => {
    await inRollback(async (tx) => {
      // Menutup celah yang sama seperti `stage-sequence.test.ts`, tapi dari
      // sisi database: kalau kelak trigger menyusun urutannya sendiri dan
      // menyimpang dari fungsi rangkaian, tes ini yang menangkapnya.
      const [kirim] = await tx<{ seq: string[] }[]>`
        select public.fulfilment_sequence('kirim'::public.distribution_mode)::text[] as seq
      `;
      const [salur] = await tx<{ seq: string[] }[]>`
        select public.fulfilment_sequence('salur'::public.distribution_mode)::text[] as seq
      `;

      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'kirim' });
      await assignVendor(tx, orderId);
      const stages = await stagesOf(tx, orderId);

      expect(stages.map((s) => s.stage)).toEqual(kirim.seq);
      expect(salur.seq).toEqual(['persiapan', 'sembelih', 'masak', 'salur']);
    });
  });

  it('menolak menyusun tahap bila cara penyaluran belum ditentukan', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      // `distribution_mode` null hanya mungkin lewat jalur langsung seperti ini;
      // checkout selalu mengisinya. Tetap diuji karena trigger memilih
      // melempar galat bereksplisit, bukan diam-diam melewatkan tahap.
      // `guest_verified_at` wajib diisi: `enforce_guest_order_verification`
      // menolak order tamu yang bergerak melewati `new` tanpa verifikasi, dan
      // galat itu akan menutupi galat yang sedang diuji di sini.
      const [order] = await tx<{ id: string }[]>`
        insert into public.orders (
          participant_id, status, payment_status, total_amount, paid_amount,
          aqiqah_for, requested_date, requested_time,
          guest_verified_at, guest_verified_by
        ) values (
          ${SEED.participant}, 'paid'::public.order_status, 'paid'::public.payment_status,
          2800000, 2800000, 'laki_laki', current_date + 3, '09:00',
          now(), ${SEED.admin}
        )
        returning id
      `;

      await expect(
        tx`update public.orders set status = 'assigned'::public.order_status where id = ${order.id}`,
      ).rejects.toThrow(/Cara penyaluran belum ditentukan/);
    });
  });
});

describe('penyiapan tes ini sendiri', () => {
  it('berjalan di database lokal, bukan cloud', () => {
    // Penjaga yang membuat sisa berkas ini aman: seluruh tes di atas MENULIS
    // baris. Kalau `TEST_DB_URL` kelak salah arah, kegagalannya harus muncul
    // di sini — bukan sebagai data asing di database produksi.
    //
    // Diperiksa host yang **disambungi driver**, bukan `inet_server_addr()`:
    // Postgres di dalam Docker melaporkan IP bridge-nya sendiri (172.18.x),
    // jadi jawaban server tidak bisa membedakan lokal dari jauh. Yang menentukan
    // adalah ke mana kita menyambung.
    const host = sql.options.host[0];
    expect(['127.0.0.1', 'localhost', '::1']).toContain(host);
  });

  it('rollback benar-benar membatalkan tulisan', async () => {
    let created = '';
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'kirim' });
      created = orderId;
    });

    // Tanpa jaminan ini, satu tes bisa menjatuhkan tes lain lewat data sisa.
    const rows = await sql`select 1 from public.orders where id = ${created}`;
    expect(rows).toHaveLength(0);
  });

  it('actAs menyetel auth.uid() yang dibaca trigger', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.admin);
      const [row] = await tx<{ uid: string | null }[]>`select auth.uid()::text as uid`;
      expect(row.uid).toBe(SEED.admin);
    });
  });
});
