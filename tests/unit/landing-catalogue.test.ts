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

/**
 * Katering di halaman depan.
 *
 * Yang dijaga: katering **tidak lenyap** dari katalog landing, dan tombolnya
 * menuju form yang benar. Keduanya mudah putus tanpa galat apa pun —
 * `getLandingCatalogue` menyaring per jenis, jadi jenis yang terlewat tidak
 * menghasilkan error melainkan daftar kosong yang terbaca seperti "memang belum
 * ada paketnya".
 */
describe('katering di landing', () => {
  const catalogue = readFileSync(join(process.cwd(), 'features/landing/catalogue.ts'), 'utf8');
  const page = readFileSync(join(process.cwd(), 'app/(site)/page.tsx'), 'utf8');

  it('katalog landing menyaring jenis katering', () => {
    expect(catalogue).toContain("perBox('katering')");
  });

  it('halaman depan menerima & merender daftarnya', () => {
    expect(page).toContain('catering');
    // Katering dinormalkan jadi kartu, lalu masuk kisi yang sama dengan aqiqah.
    expect(page).toContain('cateringCards');
    expect(page).toContain('catering.map');
  });

  it('aqiqah & katering memakai SATU bentuk kartu dan SATU kisi', () => {
    // Sampai 22 September aqiqah punya kartu penuh sementara katering hanya
    // baris ringkas di dalam blok berjudul — terbaca sebagai kelas layanan
    // yang lebih rendah, padahal katering justru pesanan berdiri sendiri yang
    // nilainya bisa jauh lebih besar daripada satu ekor aqiqah.
    expect(page).toContain('function PackageCard');
    expect(page).toContain('function PackageGrid');

    // Keduanya dinormalkan ke tipe yang sama sebelum dirender — itulah yang
    // membuat kartunya tidak perlu bercabang per jenis di dalam.
    expect(page).toContain('PackageCardData');
    expect(page).toContain('aqiqahCards');
    expect(page).toContain('cateringCards');

    // Bentuk lama benar-benar hilang, bukan sekadar tidak dipakai.
    expect(page).not.toContain('function AqiqahCard');
    expect(page).not.toContain('function PerBoxCard');
    expect(page).not.toContain('function CateringBlock');
  });

  it('nasi box TETAP ringkas — ia tambahan, bukan pilihan sejajar', () => {
    // Sempat dijadikan kartu sejajar (22 September), lalu dikembalikan.
    // Alasannya bukan selera: `create_guest_order` menolak layanan bertipe
    // `nasi_box` sebagai paket utama, jadi kartu bertombol "Pesan" menawarkan
    // sesuatu yang tidak bisa dipesan — kekeliruan yang tidak menghasilkan
    // galat apa pun, hanya pengunjung yang kecewa di ujung alur.
    expect(page).toContain('function NasiBoxNote');
    expect(page).not.toContain('boxCards');

    // Jalurnya WhatsApp, satu tombol untuk seluruh paket — bukan tombol pesan
    // per paket seperti pada kartu.
    const note = page.slice(page.indexOf('function NasiBoxNote'));
    const body = note.slice(0, note.indexOf('\nfunction '));
    expect(body).toContain('whatsapp.href');
    expect(body).not.toContain('/checkout');

    // Dan ia muncul di kedua tab yang memuat aqiqah: pengunjung yang berhenti
    // di tab bawaan harus tetap tahu tambahan ini ada.
    const noteUses = page.match(/<NasiBoxNote boxes=\{boxes\} \/>/g) ?? [];
    expect(noteUses.length).toBe(2);
  });

  it('kartu per-box membawa foto & tagline dari katalog', () => {
    // Keduanya sudah ada di `services` sejak 3 September tetapi tidak pernah
    // diambil, sebab bentuk lamanya tidak punya tempat untuk itu.
    const catalogue = readFileSync(join(process.cwd(), 'features/landing/catalogue.ts'), 'utf8');
    const perBoxBlock = catalogue.slice(catalogue.indexOf('const perBox'));
    expect(perBoxBlock).toContain('tagline');
    expect(perBoxBlock).toContain('photo_path');
  });

  it('katering muncul di tab bawaan, bukan tersembunyi di balik klik', () => {
    // Keputusan pemasaran: yang ditawarkan lebih dulu adalah katering dan
    // aqiqah terpopuler. Tab `pilihan` karena itu harus jadi bawaannya — kalau
    // bergeser ke `aqiqah`, katering turun satu klik tanpa ada yang menyadari.
    expect(page).toContain('defaultTab="pilihan"');
    expect(page).toContain("id: 'pilihan'");
  });

  it('penyaringnya menyembunyikan, bukan membongkar-pasang kartunya', () => {
    // `SitePhoto` server-only (`node:fs`), jadi kartunya wajib dirakit di
    // server dan dikirim sebagai blok jadi. Itu pula yang membuat halaman
    // depan tetap prerender statis dan seluruh kartu ada di HTML awal —
    // penting untuk mesin pencari.
    const filter = readFileSync(join(process.cwd(), 'components/site/package-filter.tsx'), 'utf8');
    expect(filter).toContain('hidden={');
    expect(filter).toContain('ReactNode');
    // Halaman depan tidak boleh jadi dinamis gara-gara penyaring ini.
    expect(page).not.toContain("export const dynamic = 'force-dynamic'");
  });

  it('tombolnya menuju /checkout/katering, bukan /checkout', () => {
    // Inilah pembeda pokoknya dari nasi box: katering pesanan yang berdiri
    // sendiri, jadi ia punya formnya sendiri. Mengarahkannya ke `/checkout`
    // membawa pembeli ke form aqiqah yang tidak ia cari.
    // Sejak tiap paket katering punya kartunya sendiri (22 September),
    // tautannya membawa slug — pembeli mendarat di form dengan paket yang ia
    // klik sudah terpilih, bukan di paket pertama.
    expect(page).toContain('/checkout/katering?paket=${c.slug}');
    // Dan tidak tertukar: aqiqah ke `/checkout`, katering ke `/checkout/katering`.
    expect(page).toContain('/checkout?paket=${p.slug}');
  });

  it('slug dari tautan itu benar-benar dibaca halaman checkout katering', () => {
    // Tautan yang membawa `?paket=` ke halaman yang mengabaikannya adalah
    // kekeliruan senyap: pembeli mengira memilih Prasmanan dan mendapat paket
    // pertama. Persis kelas bug yang pernah terjadi pada `paket-c-favorit`.
    const checkout = readFileSync(
      join(process.cwd(), 'app/(site)/checkout/katering/page.tsx'),
      'utf8',
    );
    expect(checkout).toContain('searchParams');
    expect(checkout).toContain('packages.find((p) => p.slug === paket)');
    expect(checkout).toContain('initialServiceId');
  });

  it('paket katering ada di migration', () => {
    const packages = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260921020000_catering_packages.sql'),
      'utf8',
    );
    const slugs = [...packages.matchAll(/'(katering-[a-z0-9-]+)'/g)].map((m) => m[1]);
    expect(new Set(slugs).size).toBeGreaterThanOrEqual(3);
  });
});
