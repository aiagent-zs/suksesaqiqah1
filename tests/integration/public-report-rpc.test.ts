/**
 * `get_public_report` — RPC yang menyusun halaman laporan bertoken.
 *
 * **Inilah tempat kedua bug 21 Agustus bersembunyi**, dan alasan utama berkas
 * ini ditulis:
 *
 * 1. Blok `progress` hilang dari payload saat RPC disusun ulang. Pembacanya di
 *    `public-report.ts` memakai `p.progress?.x ?? 0`, jadi tiga kartu "Status
 *    Pelaksanaan" dan blok progres di PDF **mencetak 0/0 tanpa satu pun galat**.
 * 2. `branch_name` → `vendor_name`. RPC sudah mengirim nama baru, pembacanya
 *    masih mendeklarasikan nama lama, jadi nama mitra **tidak pernah sampai**.
 *
 * Keduanya lolos `tsc` **dan** 364 unit test. Sebabnya struktural: RPC-nya
 * bertipe `Returns: Json` di `types/database.ts`, jadi `as unknown as RpcPayload`
 * melewati pemeriksaan apa pun. `public-report-payload.test.ts` menutup
 * sebagian celah dengan membaca berkas migration, tapi berkas SQL bukan
 * database — ia tidak membuktikan apa yang sungguh dikembalikan RPC saat
 * dijalankan.
 *
 * Yang diuji di sini adalah **nilai sungguhan dari database**, termasuk
 * pembedaan `stages_total` (baris) dari `stages_in_sequence` (tahap) yang
 * pernah tertukar dan mencetak "7/5 tahap".
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { actAs, actAsOwner, inRollback, isReady } from './helpers/db';
import {
  SEED,
  assignVendor,
  makePaidOrder,
  reportStage,
  stagesOf,
  validateStage,
} from './helpers/fixtures';
import type postgres from 'postgres';

beforeAll(async () => {
  const ready = await isReady();
  if (!ready.ok) throw new Error(ready.reason);
});

/** Buat laporan versi 1 — tanpa ini RPC sengaja mengembalikan null. */
async function makeReport(tx: postgres.TransactionSql, orderId: string): Promise<void> {
  await tx`
    insert into public.reports (order_id, version, pdf_path, generated_by)
    values (${orderId}, 1, ${'2026/08/uji/laporan.pdf'}, ${SEED.admin})
  `;
}

async function tokenOf(tx: postgres.TransactionSql, orderId: string): Promise<string> {
  const [row] = await tx<{ token: string }[]>`
    select public_token as token from public.orders where id = ${orderId}
  `;
  return row.token;
}

async function fetchReport(
  tx: postgres.TransactionSql,
  token: string,
): Promise<Record<string, unknown> | null> {
  const [row] = await tx<{ payload: Record<string, unknown> | null }[]>`
    select public.get_public_report(${token}) as payload
  `;
  return row.payload;
}

describe('get_public_report — kontrak payload', () => {
  it('mengembalikan SEMUA key yang dideklarasikan RpcPayload', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'kirim' });
      await assignVendor(tx, orderId);
      await makeReport(tx, orderId);

      const payload = await fetchReport(tx, await tokenOf(tx, orderId));
      expect(payload).not.toBeNull();

      // Daftar ini adalah cerminan `type RpcPayload` di
      // `server/services/public-report.ts`. Kalau RPC berhenti mengirim salah
      // satunya — persis seperti `progress` pada 20 Agustus — tes ini merah,
      // bukan halamannya yang diam-diam mencetak nol.
      const required = [
        'order_number',
        'status',
        'created_at',
        'distribution_mode',
        'participant_name',
        'vendor_name',
        'child_birth_place',
        'child_birth_date',
        'delivery_confirmed_at',
        'services',
        'animals',
        'progress',
        'stages',
        'schedule',
        'documentations',
        'report',
      ];
      for (const key of required) {
        expect(Object.keys(payload!)).toContain(key);
      }
    });
  });

  it('mengirim vendor_name (bukan branch_name) dan nilainya sampai', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'kirim' });
      await assignVendor(tx, orderId);
      await makeReport(tx, orderId);

      const payload = await fetchReport(tx, await tokenOf(tx, orderId));

      // Bug 21 Agustus #2: nama field menyimpang, nilai tidak pernah sampai.
      expect(payload).not.toHaveProperty('branch_name');
      expect(payload!.vendor_name).toBeTruthy();
      expect(typeof payload!.vendor_name).toBe('string');
    });
  });

  it('blok progress ada DAN berisi lima angka yang dibaca pembacanya', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'kirim' });
      await assignVendor(tx, orderId);
      await makeReport(tx, orderId);

      const payload = await fetchReport(tx, await tokenOf(tx, orderId));
      const progress = payload!.progress as Record<string, number> | null;

      // Bug 21 Agustus #1: blok ini hilang seluruhnya dan `?? 0` menelan
      // buktinya. Diuji sebagai objek non-null berisi lima key — bukan hanya
      // "ada key progress".
      expect(progress).not.toBeNull();
      for (const key of [
        'animals_total',
        'animals_slaughtered',
        'animals_distributed',
        'stages_total',
        'stages_validated',
      ]) {
        expect(progress).toHaveProperty(key);
        expect(typeof progress![key]).toBe('number');
      }
    });
  });

  it('stages_total menghitung BARIS, bukan tahap dalam rangkaian', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      // 3 ekor bermode kirim: 5 tahap, tapi 7 baris (sembelih satu per ekor).
      const { orderId } = await makePaidOrder(tx, { mode: 'kirim', animals: 3 });
      await assignVendor(tx, orderId);
      await makeReport(tx, orderId);

      const payload = await fetchReport(tx, await tokenOf(tx, orderId));
      const progress = payload!.progress as Record<string, number>;

      // Inilah kekeliruan yang dicegah: memakai `stages_in_sequence` (5)
      // sebagai penyebut sementara `stages_validated` menghitung baris akan
      // mencetak "7/5 tahap" kepada pemesan.
      expect(progress.stages_total).toBe(7);
      expect(progress.animals_total).toBe(3);

      const [view] = await tx<{ in_sequence: number; total: number }[]>`
        select stages_in_sequence::int as in_sequence, stages_total::int as total
        from public.v_order_stages where order_id = ${orderId}
      `;
      expect(view.in_sequence).toBe(5);
      expect(view.total).toBe(7);
      // Keduanya sengaja berbeda — kalau kelak jadi sama, salah satu view
      // berubah arti dan penyebut progres perlu ditinjau ulang.
      expect(view.in_sequence).not.toBe(view.total);
    });
  });

  it('stages_validated naik mengikuti tahap yang benar-benar divalidasi', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur' });
      await assignVendor(tx, orderId);
      await makeReport(tx, orderId);
      const token = await tokenOf(tx, orderId);

      const before = (await fetchReport(tx, token))!.progress as Record<string, number>;
      expect(before.stages_validated).toBe(0);

      const stages = await stagesOf(tx, orderId);
      const persiapan = stages.find((s) => s.stage === 'persiapan')!;
      await actAs(tx, SEED.vendorUserA);
      await reportStage(tx, persiapan.id);
      await actAs(tx, SEED.admin);
      await validateStage(tx, persiapan.id);

      await actAsOwner(tx);
      const after = (await fetchReport(tx, token))!.progress as Record<string, number>;
      expect(after.stages_validated).toBe(1);
      expect(after.stages_total).toBe(4);
    });
  });

  it('hanya tahap tervalidasi yang muncul di daftar stages', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'salur' });
      await assignVendor(tx, orderId);
      await makeReport(tx, orderId);
      const token = await tokenOf(tx, orderId);

      const stages = await stagesOf(tx, orderId);
      const persiapan = stages.find((s) => s.stage === 'persiapan')!;

      // Baru dilaporkan, belum divalidasi — belum boleh tampil ke pemesan.
      await actAs(tx, SEED.vendorUserA);
      await reportStage(tx, persiapan.id);
      await actAsOwner(tx);
      expect((await fetchReport(tx, token))!.stages).toEqual([]);

      await actAs(tx, SEED.admin);
      await validateStage(tx, persiapan.id);
      await actAsOwner(tx);

      const listed = (await fetchReport(tx, token))!.stages as Array<{ stage: string }>;
      expect(listed).toHaveLength(1);
      expect(listed[0].stage).toBe('persiapan');
    });
  });
});

describe('get_public_report — penjagaan akses', () => {
  it('mengembalikan null sebelum laporan pertama dibuat', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'kirim' });
      await assignVendor(tx, orderId);

      // Tanpa syarat ini, token yang bocor lebih awal sudah memperlihatkan
      // order yang sedang berjalan.
      expect(await fetchReport(tx, await tokenOf(tx, orderId))).toBeNull();
    });
  });

  it('menolak token yang panjangnya bukan 32 karakter', async () => {
    await inRollback(async (tx) => {
      for (const bad of ['', 'pendek', 'a'.repeat(31), 'a'.repeat(33)]) {
        expect(await fetchReport(tx, bad)).toBeNull();
      }
    });
  });

  it('mengembalikan null untuk token yang tidak dikenal', async () => {
    await inRollback(async (tx) => {
      expect(await fetchReport(tx, 'f'.repeat(32))).toBeNull();
    });
  });

  it('dapat dipanggil anon — halaman laporan memang publik', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'kirim' });
      await assignVendor(tx, orderId);
      await makeReport(tx, orderId);
      const token = await tokenOf(tx, orderId);

      // Halaman `/r/{token}` dibuka tanpa login. Kalau grant-nya kelak hilang,
      // seluruh halaman laporan mati — dan itu tidak akan terlihat di unit test.
      await actAs(tx, null, 'anon');
      const payload = await fetchReport(tx, token);
      expect(payload).not.toBeNull();
      expect(payload!.order_number).toBeTruthy();
    });
  });

  it('tidak pernah membocorkan telepon, email, atau alamat peserta', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);
      const { orderId } = await makePaidOrder(tx, { mode: 'kirim' });
      await assignVendor(tx, orderId);
      await makeReport(tx, orderId);
      // Token diambil selagi masih berhak: `anon` sengaja tidak bisa membaca
      // `orders` sama sekali — pengunjung hanya membawa token dari URL-nya.
      const token = await tokenOf(tx, orderId);

      await actAs(tx, null, 'anon');
      const payload = await fetchReport(tx, token);

      // Payload-nya JSON bebas bentuk, jadi kebocoran tidak akan tertangkap
      // typecheck. Diperiksa sebagai teks utuh supaya key baru yang kelak
      // ditambahkan pun ikut terjaring.
      const asText = JSON.stringify(payload);
      expect(asText).not.toMatch(/participant_phone|participant_email|participant_address/);
      expect(asText).not.toContain('081234567890');
      expect(asText).not.toContain('budi@example.test');
    });
  });
});
