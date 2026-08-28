/**
 * Master mitra — RLS `vendors`, `vendor_services`, `vendor_coverage`.
 *
 * Sampai halaman `/vendors/{id}` dibuat, tiga server action (`updateVendor`,
 * `saveVendorService`, `deleteVendorService`) tidak punya satu pun pemanggil,
 * dan `vendor_coverage` **nol referensi** di seluruh kode — tabelnya kosong
 * selamanya. Kebijakan aksesnya karena itu tidak pernah benar-benar dilewati
 * siapa pun; tes ini yang pertama menempuhnya.
 *
 * Yang dijaga di sini adalah batas yang hanya hidup di database: modal mitra
 * (`vendor_price`) menentukan margin tiap order, jadi siapa yang boleh
 * membacanya dan siapa yang boleh mengubahnya bukan soal kerapian UI.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { actAs, actAsOwner, expectFailureInSavepoint, inRollback, isReady } from './helpers/db';
import { SEED } from './helpers/fixtures';

beforeAll(async () => {
  const ready = await isReady();
  if (!ready.ok) throw new Error(ready.reason);
});

describe('vendor_services — angka margin, staf saja', () => {
  it('vendor tidak dapat melihat modalnya sendiri', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.vendorUserA);

      const rows = await tx`
        select id from public.vendor_services where vendor_id = ${SEED.vendorA}
      `;

      // RLS menyaring baris, bukan menolak permintaan — jadi yang diperiksa
      // jumlahnya nol, bukan ada/tidaknya galat. Bahkan mitra tidak perlu tahu
      // bagaimana marginnya dihitung.
      expect(rows).toHaveLength(0);
    });
  });

  it('admin boleh membaca, tetapi tidak boleh mengubah', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.admin);

      const rows = await tx`
        select id from public.vendor_services where vendor_id = ${SEED.vendorA}
      `;
      expect(rows.length).toBeGreaterThan(0);

      // Menaikkan modal berarti menurunkan margin yang dilaporkan. Kewenangannya
      // berhenti di superadmin, sejalan `MANAGE_VENDORS` di lapisan aplikasi.
      await tx`
        update public.vendor_services set vendor_price = 1
        where vendor_id = ${SEED.vendorA}
      `;

      const [after] = await tx<{ n: number }[]>`
        select count(*)::int as n from public.vendor_services
        where vendor_id = ${SEED.vendorA} and vendor_price = 1
      `;
      expect(after.n).toBe(0);
    });
  });

  it('superadmin boleh mengubah', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.superadmin);

      await tx`
        update public.vendor_services set vendor_price = 999
        where vendor_id = ${SEED.vendorA} and service_id = ${SEED.serviceKambing}
      `;

      const [row] = await tx<{ vendor_price: string }[]>`
        select vendor_price from public.vendor_services
        where vendor_id = ${SEED.vendorA} and service_id = ${SEED.serviceKambing}
      `;
      expect(Number(row.vendor_price)).toBe(999);
    });
  });

  it('satu mitra hanya punya satu harga per paket', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);

      // `saveVendorService` bersandar penuh pada constraint ini lewat
      // `onConflict: 'vendor_id,service_id'`; kalau ia lepas, menyunting modal
      // akan diam-diam menambah baris kedua dan margin dihitung dari yang mana
      // saja yang kebetulan terbaca duluan.
      const rejection = await expectFailureInSavepoint(
        tx,
        (sp) => sp`
          insert into public.vendor_services (vendor_id, service_id, vendor_price)
          values (${SEED.vendorA}, ${SEED.serviceKambing}, 100)
        `,
      );
      expect(rejection.code).toBe('23505');
    });
  });
});

describe('vendor_coverage — wilayah layanan', () => {
  it('mitra boleh melihat cakupannya sendiri, tetapi bukan milik mitra lain', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.vendorUserA);

      const rows = await tx<{ vendor_id: string }[]>`
        select vendor_id from public.vendor_coverage
      `;

      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.vendor_id === SEED.vendorA)).toBe(true);
    });
  });

  it('admin tidak dapat mengubah cakupan', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.admin);

      await tx`delete from public.vendor_coverage where vendor_id = ${SEED.vendorA}`;

      const [after] = await tx<{ n: number }[]>`
        select count(*)::int as n from public.vendor_coverage where vendor_id = ${SEED.vendorA}
      `;
      expect(after.n).toBeGreaterThan(0);
    });
  });

  it('hapus-lalu-sisipkan sebagai superadmin menyisakan tepat wilayah yang dikirim', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.superadmin);

      // Bentuk yang sama dengan `saveVendorCoverage`: daftar utuh, bukan selisih
      // per baris. Yang dibuktikan di sini adalah keduanya berjalan sebagai satu
      // keadaan — wilayah lama benar-benar hilang, bukan menumpuk.
      await tx`delete from public.vendor_coverage where vendor_id = ${SEED.vendorA}`;
      await tx`
        insert into public.vendor_coverage (vendor_id, region_code, region_name, level)
        values (${SEED.vendorA}, '32.73', 'KOTA BANDUNG', 2)
      `;

      const rows = await tx<{ region_code: string }[]>`
        select region_code from public.vendor_coverage where vendor_id = ${SEED.vendorA}
      `;
      expect(rows.map((r) => r.region_code)).toEqual(['32.73']);
    });
  });

  it('wilayah yang sama tidak dapat terdaftar dua kali pada satu mitra', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);

      const rejection = await expectFailureInSavepoint(
        tx,
        (sp) => sp`
          insert into public.vendor_coverage (vendor_id, region_code, region_name, level)
          values (${SEED.vendorA}, '32.73', 'KOTA BANDUNG', 2)
        `,
      );
      expect(rejection.code).toBe('23505');
    });
  });

  it('tingkat wilayah dibatasi 1..4', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);

      // `saveVendorCoverage` membaca `level` dari `regions`, jadi angka ngawur
      // tidak bisa datang dari layar — tetapi tabelnya tanpa FK, dan penjaga ini
      // yang menahan baris tak masuk akal dari jalur mana pun.
      const rejection = await expectFailureInSavepoint(
        tx,
        (sp) => sp`
          insert into public.vendor_coverage (vendor_id, region_code, region_name, level)
          values (${SEED.vendorA}, '99.99', 'ENTAH', 7)
        `,
      );
      expect(rejection.code).toBe('23514');
    });
  });

  it('cakupan ikut terhapus saat mitranya dihapus', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);

      // Tiga tabel menahan penghapusan mitra dengan `on delete restrict` —
      // `orders`, `locations`, dan `profiles` — dan itu memang dikehendaki:
      // ketiganya adalah jejak yang harus tetap menunjuk siapa pelakunya.
      // `vendor_coverage` sebaliknya `cascade`: cakupan tidak punya arti tanpa
      // mitranya. Itu sebabnya `setVendorActive` ada — menonaktifkan, bukan
      // menghapus, adalah jalur yang sesungguhnya dipakai operasi.
      await tx`delete from public.orders where vendor_id = ${SEED.vendorB}`;
      await tx`delete from public.locations where vendor_id = ${SEED.vendorB}`;
      await tx`delete from public.profiles where vendor_id = ${SEED.vendorB}`;
      await tx`delete from public.vendors where id = ${SEED.vendorB}`;

      const [after] = await tx<{ n: number }[]>`
        select count(*)::int as n from public.vendor_coverage where vendor_id = ${SEED.vendorB}
      `;
      expect(after.n).toBe(0);
    });
  });

  it('mitra yang masih memegang order tidak dapat dihapus', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);

      // Inilah alasan `setVendorActive` menolak menonaktifkan mitra yang masih
      // punya order berjalan: menghapusnya bukan pilihan, jadi non-aktif adalah
      // satu-satunya jalan keluar dan ia harus dijaga agar tidak memutus akses
      // di tengah pekerjaan.
      const rejection = await expectFailureInSavepoint(
        tx,
        (sp) => sp`delete from public.vendors where id = ${SEED.vendorA}`,
      );
      expect(rejection.code).toBe('23503');
    });
  });
});

describe('vendors — master mitra', () => {
  it('admin dapat membaca mitra tetapi tidak menyuntingnya', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.admin);

      const rows = await tx`select id from public.vendors where id = ${SEED.vendorA}`;
      expect(rows).toHaveLength(1);

      // Admin tetap menugaskan mitra ke order dari halaman detail order; yang
      // ditutup di sini adalah menyunting master-nya.
      await tx`update public.vendors set name = 'Diubah Admin' where id = ${SEED.vendorA}`;

      const [after] = await tx<{ name: string }[]>`
        select name from public.vendors where id = ${SEED.vendorA}
      `;
      expect(after.name).not.toBe('Diubah Admin');
    });
  });

  it('kode mitra unik dan berformat tetap', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);

      const duplicate = await expectFailureInSavepoint(
        tx,
        (sp) => sp`
          insert into public.vendors (code, name, phone)
          values ('DAPURBDG', 'Kembar', '0811')
        `,
      );
      expect(duplicate.code).toBe('23505');

      // Huruf kecil & tanda hubung ditolak: kode dibaca sekilas di daftar dan
      // dipakai membedakan mitra, jadi 'dapurbdg' dan 'DAPURBDG' tidak boleh
      // hidup bersama. Inilah pula sebabnya `updateVendorSchema` tidak menerima
      // `code` sama sekali — ia melekat sejak pendaftaran.
      const badFormat = await expectFailureInSavepoint(
        tx,
        (sp) => sp`
          insert into public.vendors (code, name, phone)
          values ('mitra-baru', 'Format Salah', '0811')
        `,
      );
      expect(badFormat.code).toBe('23514');
    });
  });

  it('penghapusan lunak menyembunyikan mitra tanpa memutus order lamanya', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.superadmin);

      // Inilah yang dilakukan `deleteVendor`, dan alasan ia tidak memakai
      // `delete`: tes di atas sudah membuktikan `delete` ditolak `23503` selama
      // mitra pernah menyentuh satu order pun. `deleted_at` melewati itu tanpa
      // memutus jejak siapa pelaksananya.
      await tx`
        update public.vendors set deleted_at = now(), is_active = false
        where id = ${SEED.vendorA}
      `;

      // Setiap pembacaan mitra menyaring `deleted_at is null`; yang diperiksa
      // di sini adalah baris itu benar-benar lenyap dari bentuk pembacaan yang
      // dipakai `listVendors` dan `getVendorOptions`.
      const [visible] = await tx<{ n: number }[]>`
        select count(*)::int as n from public.vendors
        where id = ${SEED.vendorA} and deleted_at is null
      `;
      expect(visible.n).toBe(0);

      const [orders] = await tx<{ n: number }[]>`
        select count(*)::int as n from public.orders where vendor_id = ${SEED.vendorA}
      `;
      expect(orders.n).toBeGreaterThan(0);
    });
  });

  it('periode perjanjian tidak boleh berakhir sebelum dimulai', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);

      // Dua medan tanggal yang kini bisa diisi dari formulir sunting — sebelum
      // halaman detail ada, keduanya tidak pernah bisa terisi dari mana pun.
      const rejection = await expectFailureInSavepoint(
        tx,
        (sp) => sp`
          update public.vendors
          set agreement_start = '2026-06-01', agreement_end = '2026-01-01'
          where id = ${SEED.vendorA}
        `,
      );
      expect(rejection.code).toBe('23514');
    });
  });
});
