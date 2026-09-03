import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as siteConstants from '@/lib/constants/site';

/**
 * Katalog landing — **kini satu sumber**.
 *
 * ## Apa yang berubah, dan kenapa tes ini ikut berubah
 *
 * Sampai 3 September halaman depan memakai daftar hardcode di
 * `lib/constants/site.ts` (`aqiqahPrograms`, `nasiBoxPackages`), kembaran
 * `services` di database. Berkas tes ini lahir untuk menjaga keduanya tidak
 * menyimpang — pekerjaan yang nyata: `paket-c-favorit` & `paket-e-premium`
 * pernah membawa akhiran yang tidak pernah ada di katalog, dan tidak ada satu
 * pun galat yang muncul karenanya.
 *
 * `20260903010000` memindahkan konten itu ke `services`, dan
 * `features/landing/catalogue.ts` membacanya. **Kembarannya hilang, jadi yang
 * dijaga tes ini ikut berubah**: bukan lagi "dua daftar sama", melainkan
 * "daftar keduanya benar-benar sudah tidak ada".
 *
 * Itu bukan tes yang lemah. Mengembalikan salah satu konstanta adalah cara
 * paling mungkin kekeliruan lama kembali — seseorang menambahkan paket baru di
 * tempat yang dulu benar, halaman depan menampilkannya, dan checkout tidak
 * mengenalnya sama sekali.
 */
describe('katalog tidak lagi hardcode di site.ts', () => {
  it('aqiqahPrograms & nasiBoxPackages sudah tidak diekspor', () => {
    // Diperiksa lewat modulnya sendiri, bukan dengan membaca berkasnya sebagai
    // teks: yang penting bukan ada-tidaknya kata itu di sumber (komentar yang
    // menjelaskan kepindahannya justru menyebutnya), melainkan apakah ia
    // benar-benar bisa diimpor lagi.
    expect(siteConstants).not.toHaveProperty('aqiqahPrograms');
    expect(siteConstants).not.toHaveProperty('nasiBoxPackages');
  });

  it('landingPhotos tetap ada — hero & galeri bukan katalog', () => {
    // Keduanya tidak punya baris di `services` dan memang tidak seharusnya
    // punya: yang dijual paket, bukan foto proses.
    expect(siteConstants.landingPhotos.hero.src).toBeTruthy();
    expect(siteConstants.landingPhotos.gallery).toHaveLength(6);
  });

  it('halaman depan membaca database, bukan konstanta', () => {
    const page = readFileSync(join(process.cwd(), 'app/(site)/page.tsx'), 'utf8');
    expect(page).toContain('getLandingCatalogue');
  });
});

/**
 * Isi katalog di migration.
 *
 * Migration-nya dibaca **langsung**, bukan disalin ke dalam tes — tes yang
 * membandingkan salinan dengan salinan tidak membuktikan apa pun. Pola yang
 * sama dipakai `stage-sequence.test.ts` dan `public-report-payload.test.ts`.
 *
 * Dipilih berkas migration, bukan `supabase/seed/`: yang ini ikut ke **semua**
 * environment lewat `db push`, sementara seed hanya jalan lokal saat
 * `db reset`. Jadi inilah katalog yang benar-benar hidup di produksi.
 */
describe('katalog di migration', () => {
  const reference = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260820001200_reference_data.sql'),
    'utf8',
  );
  const landing = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260903010000_service_landing_content.sql'),
    'utf8',
  );

  type CatalogueRow = { type: string; name: string; slug: string; price: number };

  /**
   * Baris `services` dari migration.
   *
   * Dibaca dengan satu regex atas seluruh berkas alih-alih mengurai SQL:
   * bentuk tiap barisnya seragam dan yang dibutuhkan hanya empat medan
   * pertama. Kalau bentuknya kelak berubah, `expect` jumlah baris di bawah
   * yang akan gagal — bukan diam-diam mengembalikan daftar kosong yang
   * membuat seluruh tes lolos tanpa memeriksa apa pun.
   */
  const rows: CatalogueRow[] = [
    ...reference.matchAll(
      /'[0-9a-f-]{36}',\s*'(\w+)',\s*'([^']+)',\s*'([a-z0-9-]+)',\s*\n?\s*'(?:[^']|'')*',\s*\n?\s*(\d+)/g,
    ),
  ].map((m) => ({ type: m[1], name: m[2], slug: m[3], price: Number(m[4]) }));

  it('regex-nya benar-benar menangkap katalog', () => {
    // Penjaga tes itu sendiri: kalau bentuk SQL-nya berubah dan regex ini
    // berhenti cocok, seluruh tes di bawah akan lolos atas daftar kosong.
    expect(rows.length).toBe(10);
  });

  it('slug seluruhnya berformat sah', () => {
    for (const row of rows) {
      expect(row.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('tidak ada slug ganda', () => {
    const slugs = rows.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('ketiga paket aqiqah dipasarkan', () => {
    for (const slug of ['aqiqah-ekonomi', 'aqiqah-favorit', 'aqiqah-premium']) {
      expect(landing).toContain(`where slug = '${slug}'`);
    }
  });

  it('setiap paket aqiqah yang dipasarkan punya tagline & fitur', () => {
    // Kartu tanpa tagline atau tanpa butir bukan kartu — ia lubang di halaman
    // yang dilihat calon pembeli. Database tidak bisa menuntutnya (keduanya
    // nullable dengan alasan: paket baru wajar belum lengkap), jadi yang
    // menjaga isian awalnya adalah tes ini.
    const blocks = landing.split('update public.services set').slice(1);
    const aqiqahBlocks = blocks.filter((b) => /where slug = 'aqiqah-/.test(b));
    expect(aqiqahBlocks).toHaveLength(3);

    for (const block of aqiqahBlocks) {
      expect(block).toContain('tagline =');
      expect(block).toContain('landing_features = array[');
      expect(block).toContain('photo_path =');
    }
  });

  it('kelima nasi box dipasarkan', () => {
    for (const slug of ['paket-a', 'paket-b', 'paket-c', 'paket-d', 'paket-e']) {
      expect(landing).toContain(`'${slug}'`);
    }
  });

  it('tepat satu paket aqiqah ditandai terpopuler', () => {
    const popular = landing.match(/is_popular = true/g) ?? [];
    expect(popular).toHaveLength(1);
  });

  /**
   * Keputusan 21 Agustus: qurban dicabut dari pemasaran, fokus aqiqah.
   *
   * Checkout hanya melayani aqiqah (`.eq('type','aqiqah')`), jadi memajangnya
   * berarti menawarkan sesuatu yang tidak bisa dipesan. Yang dicabut keputusan
   * pemasarannya, bukan kemampuannya — barisnya tetap ada di katalog.
   */
  it('qurban tidak dipasarkan', () => {
    expect(landing).toMatch(/show_on_landing = false where type = 'qurban'/);
    expect(rows.filter((r) => r.type === 'qurban')).toHaveLength(2);
  });

  it('paket yang dipasarkan wajib aktif — dijaga constraint, bukan hanya kode', () => {
    // Dipasarkan tapi non-aktif berarti tombol "Pesan" yang membawa ke checkout
    // tanpa paketnya. Ditegakkan database supaya jalur lain (psql, seed, RPC)
    // tidak bisa melewatinya.
    expect(landing).toContain('services_landing_requires_active');
  });
});
