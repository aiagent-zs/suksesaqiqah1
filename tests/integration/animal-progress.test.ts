/**
 * `animals_slaughtered` & `animals_distributed` diturunkan dari tahap yang
 * tervalidasi — bukan dari kolom status yang diklik seseorang.
 *
 * Sampai `20260827010000`, keduanya dihitung dari `animals.status`, sebuah kolom
 * yang **tidak tersambung ke apa pun**: satu-satunya penulisnya adalah dropdown
 * di panel Hewan. Tidak ada trigger dan tidak ada RPC yang menggesernya ketika
 * tahap benar-benar dilaporkan dan divalidasi.
 *
 * Kedua angka itu tercetak di `/r/{token}` dan di PDF laporan — halaman yang
 * dikirim kepada pemesan. Jadi kekeliruannya sampai ke luar, dalam dua arah
 * sekaligus: order yang dikerjakan sempurna mencetak "0/3 ekor dipotong", atau
 * order yang belum disentuh mencetak "3/3 ekor tersalurkan" karena admin
 * memilih `distributed` di dropdown pada hari order masuk.
 *
 * Tes ini tidak bisa ditulis sebagai unit test: yang diperiksa adalah nilai
 * yang **dihitung view** setelah trigger tahap berjalan sungguhan. Sebelum
 * perbaikan, seluruh berkas ini merah — `animals_slaughtered` bertahan 0
 * sepanjang alur.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { actAsOwner, expectFailureInSavepoint, inRollback, isReady } from './helpers/db';
import {
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

type Progress = { total: number; slaughtered: number; distributed: number };

async function progressOf(
  tx: Parameters<Parameters<typeof inRollback>[0]>[0],
  orderId: string,
): Promise<Progress> {
  const [row] = await tx<Progress[]>`
    select
      animals_total::int       as total,
      animals_slaughtered::int as slaughtered,
      animals_distributed::int as distributed
    from public.v_order_progress where order_id = ${orderId}
  `;
  return row;
}

/**
 * Tempuh tahap sampai `lastStage` — dilapor lalu divalidasi, berurutan.
 *
 * Yang sudah `validated` dilewati: memanggil helper ini dua kali (sekali sampai
 * `masak`, lalu sampai `salur`) tidak boleh melapor ulang tahap yang sama —
 * `stage_events_validated_consistency_check` menolaknya, dan yang gagal jadi
 * tesnya, bukan kodenya.
 */
async function walkStagesUpTo(
  tx: Parameters<Parameters<typeof inRollback>[0]>[0],
  orderId: string,
  lastStage: string,
): Promise<void> {
  const stages = await stagesOf(tx, orderId);
  const stopAt = stages.findLast((s) => s.stage === lastStage)!.seq;

  for (const stage of stages.filter((s) => s.seq <= stopAt && s.status !== 'validated')) {
    await reportStage(tx, stage.id);
    await validateStage(tx, stage.id);
  }
}

describe('animals_slaughtered dihitung dari tahap sembelih yang tervalidasi', () => {
  it('nol sebelum ada tahap yang dikerjakan, meski hewannya sudah terdaftar', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'kirim', animals: 3 });
      await assignVendor(tx, orderId);

      // Inilah arah kekeliruan yang kedua: dulu angka ini bisa dibuat 3 di
      // detik ini juga, lewat dropdown, tanpa satu pun bukti diunggah.
      expect(await progressOf(tx, orderId)).toEqual({
        total: 3,
        slaughtered: 0,
        distributed: 0,
      });
    });
  });

  it('naik per ekor mengikuti baris sembelih yang divalidasi', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'kirim', animals: 3 });
      await assignVendor(tx, orderId);

      const stages = await stagesOf(tx, orderId);
      const persiapan = stages.find((s) => s.stage === 'persiapan')!;
      const sembelih = stages.filter((s) => s.stage === 'sembelih');

      // 3 ekor → 3 baris sembelih, masing-masing terikat satu `animal_id`.
      expect(sembelih).toHaveLength(3);
      expect(new Set(sembelih.map((s) => s.animal_id)).size).toBe(3);

      await reportStage(tx, persiapan.id);
      await validateStage(tx, persiapan.id);

      // Dilaporkan saja belum cukup: gerbangnya `validated`, sama seperti
      // `enforce_stage_order`. Yang dilapor vendor belum tentu benar sampai
      // admin memeriksanya, dan angka ke pemesan tidak boleh mendahului itu.
      await reportStage(tx, sembelih[0].id);
      expect((await progressOf(tx, orderId)).slaughtered).toBe(0);

      await validateStage(tx, sembelih[0].id);
      expect((await progressOf(tx, orderId)).slaughtered).toBe(1);

      for (const row of sembelih.slice(1)) {
        await reportStage(tx, row.id);
        await validateStage(tx, row.id);
      }
      expect((await progressOf(tx, orderId)).slaughtered).toBe(3);
    });
  });

  it('tidak pernah melampaui animals_total', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'kirim', animals: 2 });
      await assignVendor(tx, orderId);
      await walkStagesUpTo(tx, orderId, 'terkirim');

      // Pembilang melebihi penyebut adalah cara paling kentara angka ini bisa
      // salah di mata pemesan — "3/2 ekor dipotong".
      const p = await progressOf(tx, orderId);
      expect(p.slaughtered).toBeLessThanOrEqual(p.total);
      expect(p.distributed).toBeLessThanOrEqual(p.total);
    });
  });
});

describe('animals_distributed mengikuti tahap penutup, dan penutupnya beda per mode', () => {
  it('mode salur: penuh begitu tahap salur tervalidasi', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur', animals: 2 });
      await assignVendor(tx, orderId);

      await walkStagesUpTo(tx, orderId, 'masak');
      expect((await progressOf(tx, orderId)).distributed).toBe(0);

      await walkStagesUpTo(tx, orderId, 'salur');
      // Penyaluran tidak per ekor: daging satu order disalurkan bersama, jadi
      // begitu tahapnya tervalidasi seluruh ekor terhitung sekaligus.
      expect((await progressOf(tx, orderId)).distributed).toBe(2);
    });
  });

  it('mode kirim: `kirim` belum cukup — baru `terkirim` yang menutup', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'kirim', animals: 2 });
      await assignVendor(tx, orderId);

      await walkStagesUpTo(tx, orderId, 'kirim');
      // Inilah sebabnya tahap penutup tidak boleh diseragamkan: `kirim` hanya
      // berarti paketnya berangkat. Menghitungnya di sini akan mencetak
      // "tersalurkan" kepada pemesan yang paketnya masih di jalan.
      expect((await progressOf(tx, orderId)).distributed).toBe(0);

      await walkStagesUpTo(tx, orderId, 'terkirim');
      expect((await progressOf(tx, orderId)).distributed).toBe(2);
    });
  });
});

describe('enforce_animal_delete', () => {
  it('membiarkan hewan dihapus selama tahapnya belum dilaporkan', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId, animalIds } = await makePaidOrder(tx, { mode: 'salur', animals: 2 });
      await assignVendor(tx, orderId);

      // Salah daftar sebelum ada yang mengerjakannya — masih boleh dibetulkan.
      await tx`delete from public.animals where id = ${animalIds[0]}`;
      expect((await progressOf(tx, orderId)).total).toBe(1);
    });
  });

  it('menolak hapus begitu tahapnya dilaporkan — baris tahap ikut cascade', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId, animalIds } = await makePaidOrder(tx, { mode: 'salur', animals: 2 });
      await assignVendor(tx, orderId);

      // `persiapan` dilalui lebih dulu: `enforce_stage_order` menolak laporan
      // tahap ke-2 selama tahap ke-1 belum tervalidasi.
      await walkStagesUpTo(tx, orderId, 'persiapan');

      const sembelih = (await stagesOf(tx, orderId)).filter((s) => s.stage === 'sembelih');
      const target = sembelih.find((s) => s.animal_id === animalIds[0])!;
      await reportStage(tx, target.id);

      // `order_stage_events.animal_id` ber-`on delete cascade`: tanpa penjaga
      // ini, menghapus satu ekor ikut menghapus baris tahapnya, `stages_total`
      // menyusut, dan order lolos gerbang `in_progress -> validation` karena
      // tahap yang belum dikerjakan sudah lenyap bersama hewannya.
      const rejection = await expectFailureInSavepoint(tx, (sp) =>
        sp`delete from public.animals where id = ${animalIds[0]}`,
      );
      expect(rejection.code).toBe('23514');

      // Barisnya utuh — baik hewannya maupun tahapnya.
      expect((await progressOf(tx, orderId)).total).toBe(2);
      expect(await stagesOf(tx, orderId)).toHaveLength(sembelih.length + 3);
    });
  });
});
