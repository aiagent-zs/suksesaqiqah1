/**
 * Katalog paket — RLS `services`.
 *
 * Tabel ini punya dua kebijakan yang bekerja **berbarengan**, dan perilaku
 * gabungannya tidak terlihat dari salah satunya saja:
 *
 *   services_select_public  select  to anon, authenticated
 *                                   using (is_active and deleted_at is null)
 *   services_write          all     to authenticated
 *                                   using/with check (is_superadmin())
 *
 * Kebijakan RLS bersifat **OR**. Jadi `for all` pada kebijakan kedua ikut
 * mencakup SELECT, dan itulah satu-satunya sebab superadmin bisa melihat paket
 * yang sudah dinonaktifkan — sesuatu yang `services_select_public` justru
 * sembunyikan dari semua orang.
 *
 * `listServices()` di `features/services/queries.ts` **bersandar penuh** pada
 * perilaku itu: halaman master harus menampilkan paket non-aktif, sebab di
 * sanalah satu-satunya tempat ia bisa diaktifkan kembali. Kalau kebijakan
 * kedua kelak dipersempit jadi `for insert/update/delete` saja, halamannya
 * akan diam-diam kehilangan baris non-aktif tanpa satu pun galat — dan tidak
 * ada tes lain yang akan menangkapnya.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { actAs, actAsOwner, expectFailureInSavepoint, inRollback, isReady } from './helpers/db';
import { SEED } from './helpers/fixtures';

beforeAll(async () => {
  const ready = await isReady();
  if (!ready.ok) throw new Error(ready.reason);
});

/** Paket non-aktif sekali pakai, dibuat sebagai pemilik agar RLS tidak ikut campur. */
async function makeInactiveService(
  tx: Parameters<Parameters<typeof inRollback>[0]>[0],
  slug: string,
): Promise<string> {
  await actAsOwner(tx);
  const [row] = await tx<{ id: string }[]>`
    insert into public.services (type, name, slug, price, is_active)
    values ('aqiqah', ${`Uji ${slug}`}, ${slug}, 1000000, false)
    returning id
  `;
  return row.id;
}

describe('paket non-aktif — hanya superadmin yang melihatnya', () => {
  it('superadmin melihat paket non-aktif (dasar halaman /services)', async () => {
    await inRollback(async (tx) => {
      const id = await makeInactiveService(tx, 'uji-nonaktif-super');

      await actAs(tx, SEED.superadmin);
      const rows = await tx`select id from public.services where id = ${id}`;

      // Kalau ini nol, `listServices()` kehilangan seluruh paket non-aktif dan
      // tidak ada lagi jalan mengaktifkannya kembali lewat aplikasi.
      expect(rows).toHaveLength(1);
    });
  });

  it('admin TIDAK melihat paket non-aktif', async () => {
    await inRollback(async (tx) => {
      const id = await makeInactiveService(tx, 'uji-nonaktif-admin');

      await actAs(tx, SEED.admin);
      const rows = await tx`select id from public.services where id = ${id}`;

      // RLS menyaring baris, bukan menolak permintaan — jadi yang diperiksa
      // jumlahnya nol, bukan ada/tidaknya galat.
      expect(rows).toHaveLength(0);
    });
  });

  it('vendor TIDAK melihat paket non-aktif', async () => {
    await inRollback(async (tx) => {
      const id = await makeInactiveService(tx, 'uji-nonaktif-vendor');

      await actAs(tx, SEED.vendorUserA);
      const rows = await tx`select id from public.services where id = ${id}`;
      expect(rows).toHaveLength(0);
    });
  });

  it('paket aktif tetap terbaca semua role', async () => {
    await inRollback(async (tx) => {
      for (const who of [SEED.superadmin, SEED.admin, SEED.vendorUserA]) {
        await actAs(tx, who);
        const rows = await tx`
          select id from public.services where id = ${SEED.serviceKambing}
        `;
        expect(rows).toHaveLength(1);
      }
    });
  });
});

describe('menulis katalog — berhenti di superadmin', () => {
  it('admin tidak dapat mengubah harga', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.admin);

      await tx`
        update public.services set price = 1 where id = ${SEED.serviceKambing}
      `;

      // UPDATE yang tidak cocok kebijakan tidak melempar galat — ia hanya
      // tidak menyentuh baris apa pun. Yang membuktikan penolakan adalah
      // harganya yang tidak bergeser.
      const [after] = await tx<{ n: number }[]>`
        select count(*)::int as n from public.services
        where id = ${SEED.serviceKambing} and price = 1
      `;
      expect(after.n).toBe(0);
    });
  });

  it('admin tidak dapat menambah paket', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.admin);

      // INSERT berbeda dari UPDATE di sini: `with check` menolaknya dengan
      // galat 42501, bukan diam-diam menyaring nol baris. Dibungkus savepoint
      // supaya transaksinya tetap bisa dipakai memeriksa akibatnya.
      const failure = await expectFailureInSavepoint(
        tx,
        (sp) =>
          sp`
          insert into public.services (type, name, slug, price)
          values ('aqiqah', 'Selundupan', 'uji-selundupan-admin', 1)
        `,
      );
      expect(failure.code).toBe('42501');

      const [after] = await tx<{ n: number }[]>`
        select count(*)::int as n from public.services where slug = 'uji-selundupan-admin'
      `;
      expect(after.n).toBe(0);
    });
  });

  it('vendor tidak dapat mengubah harga', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.vendorUserA);

      await tx`update public.services set price = 1 where id = ${SEED.serviceKambing}`;

      const [after] = await tx<{ n: number }[]>`
        select count(*)::int as n from public.services
        where id = ${SEED.serviceKambing} and price = 1
      `;
      expect(after.n).toBe(0);
    });
  });

  it('superadmin dapat mengubah harga', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.superadmin);

      await tx`
        update public.services set price = 4321000 where id = ${SEED.serviceKambing}
      `;

      const [after] = await tx<{ n: number }[]>`
        select count(*)::int as n from public.services
        where id = ${SEED.serviceKambing} and price = 4321000
      `;
      expect(after.n).toBe(1);
    });
  });

  it('superadmin dapat menonaktifkan lalu mengaktifkan kembali', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.superadmin);

      // `show_on_landing` ikut diturunkan — persis yang dilakukan
      // `setServiceActive()`. Tanpa itu constraint menolaknya; tes di bawah
      // menjaga bahwa penolakan itu memang terjadi.
      await tx`
        update public.services set is_active = false, show_on_landing = false
        where id = ${SEED.serviceKambing}
      `;
      const off = await tx`
        select is_active from public.services where id = ${SEED.serviceKambing}
      `;
      // Barisnya masih terbaca meski non-aktif — inilah gabungan kedua
      // kebijakan yang jadi pokok berkas ini.
      expect(off).toHaveLength(1);

      await tx`update public.services set is_active = true where id = ${SEED.serviceKambing}`;
      const [on] = await tx<{ is_active: boolean }[]>`
        select is_active from public.services where id = ${SEED.serviceKambing}
      `;
      expect(on.is_active).toBe(true);
    });
  });
});

/**
 * Paket yang dipasarkan wajib aktif (`services_landing_requires_active`).
 *
 * Dipasarkan tapi non-aktif berarti kartu di halaman depan dengan tombol
 * "Pesan" yang membawa ke checkout tanpa paketnya — pengunjung menempuh
 * seluruh formulir lalu ditolak di ujung.
 *
 * Ditegakkan database, bukan hanya `setServiceActive()`: jalur lain (psql,
 * seed, RPC, dan layar mana pun yang kelak menyentuh kolom ini) tidak
 * melewati server action itu.
 */
describe('gerbang paket yang dipasarkan', () => {
  it('menonaktifkan paket yang sedang dipasarkan ditolak', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.superadmin);

      const failure = await expectFailureInSavepoint(
        tx,
        (sp) => sp`
          update public.services set is_active = false where id = ${SEED.serviceKambing}
        `,
      );
      expect(failure.code).toBe('23514');
      // Nama constraint-nya ikut diperiksa: `services` punya dua check lain
      // (format slug, harga non-negatif), dan tes yang hanya menuntut 23514
      // akan tetap hijau kalau kelak gagalnya karena salah satu dari itu.
      expect(failure.message).toContain('landing_requires_active');
    });
  });

  it('memasarkan paket yang non-aktif ditolak', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.superadmin);

      await tx`
        update public.services set is_active = false, show_on_landing = false
        where id = ${SEED.serviceKambing}
      `;

      const failure = await expectFailureInSavepoint(
        tx,
        (sp) => sp`
          update public.services set show_on_landing = true where id = ${SEED.serviceKambing}
        `,
      );
      expect(failure.code).toBe('23514');
      expect(failure.message).toContain('landing_requires_active');
    });
  });

  it('menurunkan keduanya bersamaan diterima', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.superadmin);

      // Inilah jalan yang ditempuh `setServiceActive()`. Penolakan saja tidak
      // membuktikan apa pun kalau jalan yang benar ikut tertutup.
      await tx`
        update public.services set is_active = false, show_on_landing = false
        where id = ${SEED.serviceKambing}
      `;

      const [row] = await tx<{ is_active: boolean; show_on_landing: boolean }[]>`
        select is_active, show_on_landing from public.services
        where id = ${SEED.serviceKambing}
      `;
      expect(row.is_active).toBe(false);
      expect(row.show_on_landing).toBe(false);
    });
  });
});

/**
 * Penjaga bentuk slug di database.
 *
 * Validasi Zod di `features/services/schema.ts` adalah kembarannya, tapi ia
 * hanya menjaga jalur formulir. Ini yang menjaga sisanya.
 */
describe('constraint katalog', () => {
  it('menolak slug berformat salah', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);

      const failure = await expectFailureInSavepoint(
        tx,
        (sp) =>
          sp`
          insert into public.services (type, name, slug, price)
          values ('aqiqah', 'Salah', 'Slug Salah', 1000)
        `,
      );
      // 23514 = check_violation, dari `services_slug_format_check`.
      expect(failure.code).toBe('23514');
    });
  });

  it('menolak slug ganda', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);

      const failure = await expectFailureInSavepoint(
        tx,
        (sp) =>
          sp`
          insert into public.services (type, name, slug, price)
          values ('aqiqah', 'Kembar', 'aqiqah-favorit', 1000)
        `,
      );
      // 23505 = unique_violation. Inilah kode yang diterjemahkan
      // `slugConflict()` jadi pesan yang menempel pada medan `slug`.
      // Slug unik bukan kerapian: `/checkout?paket={slug}` mencocokkannya, jadi
      // dua paket berslug sama berarti pengunjung tidak bisa memilih salah satu.
      expect(failure.code).toBe('23505');
    });
  });

  it('menolak harga negatif', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);

      const failure = await expectFailureInSavepoint(
        tx,
        (sp) =>
          sp`
          insert into public.services (type, name, slug, price)
          values ('aqiqah', 'Minus', 'uji-minus', -1)
        `,
      );
      expect(failure.code).toBe('23514');
    });
  });

  it('paket yang sudah dipakai order tidak dapat dihapus', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);

      const failure = await expectFailureInSavepoint(
        tx,
        (sp) => sp`delete from public.services where id = ${SEED.serviceKambing}`,
      );

      // 23503 = foreign_key_violation, dari `order_items.service_id` yang
      // di-`on delete restrict`. Inilah sebab `deleteService()` memakai soft
      // delete dan memeriksa pemakaian lebih dulu — dan sebab tombol Hapus
      // tidak ditawarkan untuk paket yang sudah terpakai.
      expect(failure.code).toBe('23503');
    });
  });
});

/**
 * `services.meta` — isi paket.
 *
 * Kolom ini dibaca enam tempat dan sampai 3 September ditulis nol. Sekarang
 * formulir katalog menyuntingnya, dan yang paling rapuh dari perubahan itu
 * bukan penulisannya melainkan **apa yang ikut hilang saat menulis**: `meta`
 * memuat lebih banyak daripada yang dirender formulir.
 */
describe('meta paket', () => {
  it('nasi box membawa kunci yang tidak punya medan di formulir', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.superadmin);

      const [c] = await tx<{ meta: Record<string, unknown> }[]>`
        select meta from public.services where slug = 'paket-c'
      `;
      const [e] = await tx<{ meta: Record<string, unknown> }[]>`
        select meta from public.services where slug = 'paket-e'
      `;

      // Inilah yang akan hilang diam-diam kalau `metaFrom()` menulis objek
      // baru dari nol alih-alih menimpa sebagian. Tidak ada galat yang akan
      // muncul; penandanya cuma lenyap dari katalog.
      expect(c.meta.favorit).toBe(true);
      expect(e.meta.premium).toBe(true);
    });
  });

  it('menimpa sebagian mempertahankan kunci lain', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.superadmin);

      // Persis yang dilakukan `metaFrom()`: baca lama, timpa `items` saja.
      await tx`
        update public.services
        set meta = meta || ${tx.json({ items: ['nasi putih', 'sate'] })}
        where slug = 'paket-c'
      `;

      const [after] = await tx<{ meta: Record<string, unknown> }[]>`
        select meta from public.services where slug = 'paket-c'
      `;
      expect(after.meta.items as string[]).toHaveLength(2);
      expect(after.meta.favorit).toBe(true);
    });
  });

  it('aqiqah memakai bentuk hasil/porsi, bukan items', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.superadmin);

      const [row] = await tx<{ meta: Record<string, unknown> }[]>`
        select meta from public.services where slug = 'aqiqah-ekonomi'
      `;
      const hasil = row.meta.hasil as { porsi?: number; jenis?: string };

      // Dua bentuk yang sengaja berbeda: "80 porsi, olahan gulai & sate"
      // menjawab pertanyaan lain daripada daftar lauk satu box.
      expect(hasil.porsi).toBe(80);
      expect(hasil.jenis).toBe('gulai & sate');
      expect(row.meta.items).toBeUndefined();
    });
  });

  it('superadmin dapat menyunting meta, admin tidak', async () => {
    await inRollback(async (tx) => {
      await actAs(tx, SEED.admin);
      await tx`
        update public.services set meta = ${tx.json({ hasil: { porsi: 1 } })}
        where slug = 'aqiqah-ekonomi'
      `;

      const [afterAdmin] = await tx<{ meta: Record<string, unknown> }[]>`
        select meta from public.services where slug = 'aqiqah-ekonomi'
      `;
      // RLS menyaring baris, bukan menolak permintaan — yang membuktikan
      // penolakan adalah nilainya yang tidak bergeser.
      expect((afterAdmin.meta.hasil as { porsi?: number }).porsi).toBe(80);

      await actAs(tx, SEED.superadmin);
      await tx`
        update public.services
        set meta = meta || ${tx.json({ cocok_untuk: 'acara kantor' })}
        where slug = 'aqiqah-ekonomi'
      `;

      const [afterSuper] = await tx<{ meta: Record<string, unknown> }[]>`
        select meta from public.services where slug = 'aqiqah-ekonomi'
      `;
      expect(afterSuper.meta.cocok_untuk).toBe('acara kantor');
    });
  });
});

/**
 * Empat bug yang ditemukan 3 September saat menyisir alur katalog.
 *
 * Keempatnya lolos `tsc`, lint, dan 650 tes — semuanya bug **logika** yang
 * hanya muncul pada urutan tindakan tertentu, dan tidak satu pun menghasilkan
 * galat yang terbaca operator.
 */
describe('regresi katalog — bug 3 September', () => {
  /**
   * BUG: slug bekas paket terhapus terkunci selamanya.
   *
   * `deleteService()` memakai soft delete, tetapi `services_slug_key` unik
   * tanpa memandang `deleted_at`. Mendaftarkan ulang paket dengan slug yang
   * sama ditolak — dan pesannya berbunyi "sudah dipakai paket lain" untuk
   * paket yang **tidak tampil di layar mana pun**.
   */
  it('slug dilepaskan setelah paket dihapus', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);

      await tx`
        insert into public.services (type, name, slug, price)
        values ('aqiqah', 'Uji', 'uji-slug-lepas', 1000)
      `;
      await tx`
        update public.services set deleted_at = now(), is_active = false, show_on_landing = false
        where slug = 'uji-slug-lepas'
      `;

      // Inilah yang dulu ditolak 23505.
      await tx`
        insert into public.services (type, name, slug, price)
        values ('aqiqah', 'Uji Baru', 'uji-slug-lepas', 2000)
      `;

      const [row] = await tx<{ n: number }[]>`
        select count(*)::int as n from public.services
        where slug = 'uji-slug-lepas' and deleted_at is null
      `;
      expect(row.n).toBe(1);
    });
  });

  it('dua paket HIDUP berslug sama tetap ditolak', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);

      // Perbaikan di atas tidak boleh melonggarkan yang ini: `?paket={slug}`
      // mencocokkan slug, jadi dua paket hidup berslug sama membuat pengunjung
      // tidak bisa memilih salah satu.
      const failure = await expectFailureInSavepoint(
        tx,
        (sp) => sp`
          insert into public.services (type, name, slug, price)
          values ('aqiqah', 'Kembar', 'aqiqah-favorit', 1000)
        `,
      );
      expect(failure.code).toBe('23505');
    });
  });

  /**
   * BUG: menghapus paket yang dipasarkan selalu gagal.
   *
   * `deleteService()` menulis `is_active = false` tanpa menurunkan
   * `show_on_landing`, sehingga menabrak `services_landing_requires_active`.
   * Galat 23514-nya jatuh ke `internalError` yang berbunyi "coba lagi" —
   * menyuruh operator mengulang sesuatu yang tidak akan pernah berhasil.
   */
  it('paket yang dipasarkan tidak bisa dihapus tanpa menurunkan show_on_landing', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);

      const failure = await expectFailureInSavepoint(
        tx,
        (sp) => sp`
          update public.services set deleted_at = now(), is_active = false
          where id = ${SEED.serviceKambing}
        `,
      );
      expect(failure.code).toBe('23514');
      expect(failure.message).toContain('landing_requires_active');
    });
  });

  it('menurunkan show_on_landing bersamaan membuat penghapusan berhasil', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);

      // Jalan yang ditempuh `deleteService()` sesudah diperbaiki. Penolakan di
      // atas tidak membuktikan apa pun kalau jalan yang benar ikut tertutup.
      await tx`
        update public.services
        set deleted_at = now(), is_active = false, show_on_landing = false
        where id = ${SEED.serviceKambing}
      `;

      const [row] = await tx<{ n: number }[]>`
        select count(*)::int as n from public.services
        where id = ${SEED.serviceKambing} and deleted_at is not null
      `;
      expect(row.n).toBe(1);
    });
  });

  /**
   * BUG: paket terhapus tetap tampil di panel modal mitra.
   *
   * `on delete restrict` hanya menjaga DELETE sungguhan; penghapusan di sini
   * soft delete, jadi `vendor_services` tetap menunjuk barisnya. Tanpa
   * saringan, panel memajang baris bernama "-" berharga Rp 0.
   */
  it('modal mitra menyaring paket yang sudah dihapus', async () => {
    await inRollback(async (tx) => {
      await actAsOwner(tx);

      const before = await tx`
        select vs.id from public.vendor_services vs
        join public.services s on s.id = vs.service_id and s.deleted_at is null
        where vs.vendor_id = ${SEED.vendorA} and vs.service_id = ${SEED.serviceKambing}
      `;
      expect(before).toHaveLength(1);

      await tx`
        update public.services
        set deleted_at = now(), is_active = false, show_on_landing = false
        where id = ${SEED.serviceKambing}
      `;

      const after = await tx`
        select vs.id from public.vendor_services vs
        join public.services s on s.id = vs.service_id and s.deleted_at is null
        where vs.vendor_id = ${SEED.vendorA} and vs.service_id = ${SEED.serviceKambing}
      `;
      expect(after).toHaveLength(0);
    });
  });
});
