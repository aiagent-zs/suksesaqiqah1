import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { aqiqahPrograms, nasiBoxPackages } from '@/lib/constants/site';

/**
 * Katalog di landing vs katalog yang sungguh ditagih.
 *
 * Halaman publik tidak membaca database sama sekali — seluruh paket & harganya
 * hardcode di `lib/constants/site.ts`. Itu keputusan yang wajar (halaman statis,
 * nol query), tapi konsekuensinya dua daftar harus dijaga sinkron oleh tangan,
 * dan tidak ada satu pun jalur yang berteriak saat keduanya menyimpang:
 *
 *   - **Harga** yang berbeda berarti pengunjung membaca satu angka lalu ditagih
 *     angka lain. Checkout membacanya dari `services`, tidak pernah dari klien
 *     (`create_guest_order` sengaja mengabaikan harga kiriman), jadi yang
 *     menang selalu database — dan yang salah selalu terlihat di landing.
 *   - **Slug** yang berbeda lebih senyap lagi. `?paket=` dicocokkan sebagai
 *     slug, dan `checkout/page.tsx` sengaja **mengabaikan** slug tak dikenal
 *     lalu jatuh ke paket pertama — perilaku yang benar untuk tautan usang,
 *     tapi berarti tombol "Pesan" yang salah arah tidak menghasilkan galat apa
 *     pun. Pengunjung mengira memesan Premium dan mendapat Ekonomi.
 *
 * Kekeliruan itu nyata, bukan dugaan: `paket-c-favorit` dan `paket-e-premium`
 * di landing tidak pernah ada di katalog (aslinya `paket-c` dan `paket-e`).
 *
 * Berkas migration-nya dibaca langsung, bukan disalin ke dalam tes — tes yang
 * membandingkan salinan dengan salinan tidak membuktikan apa pun. Pola yang
 * sama dipakai `stage-sequence.test.ts` dan `public-report-payload.test.ts`.
 *
 * Dipilih `20260820001200_reference_data.sql`, bukan `supabase/seed/`: berkas
 * itu ikut ke **semua** environment lewat `db push`, sementara seed hanya jalan
 * lokal saat `db reset`. Jadi inilah katalog yang benar-benar hidup di produksi.
 */
describe('katalog landing sama dengan services di database', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260820001200_reference_data.sql'),
    'utf8',
  );

  type CatalogueRow = { type: string; name: string; slug: string; price: number };

  /**
   * Baris `services` dari migration.
   *
   * Dibaca dengan satu regex atas seluruh berkas alih-alih mengurai SQL:
   * bentuk tiap barisnya seragam (`'uuid', 'type', 'Nama', 'slug', 'deskripsi',
   * harga, urutan`) dan yang dibutuhkan hanya empat medan pertama. Kalau
   * bentuknya kelak berubah, `expect` jumlah baris di bawah yang akan gagal —
   * bukan diam-diam mengembalikan daftar kosong yang membuat seluruh tes ini
   * lolos tanpa memeriksa apa pun.
   */
  const catalogue: CatalogueRow[] = [
    ...sql.matchAll(
      /'[0-9a-f-]{36}',\s*'(aqiqah|nasi_box|qurban)',\s*'([^']+)',\s*'([^']+)',\s*'(?:[^']|'')*',\s*(\d+)/g,
    ),
  ].map((m) => ({ type: m[1], name: m[2], slug: m[3], price: Number(m[4]) }));

  const bySlug = new Map(catalogue.map((r) => [r.slug, r]));

  it('regex katalog benar-benar menemukan seluruh baris services', () => {
    // Penjaga bagi tes ini sendiri: tanpa ini, regex yang tidak lagi cocok
    // membuat `bySlug` kosong dan setiap pemeriksaan di bawah gagal dengan
    // pesan yang menyesatkan — atau lebih buruk, lolos karena tidak ada yang
    // dibandingkan. 3 aqiqah + 5 nasi box + 2 qurban.
    expect(catalogue).toHaveLength(10);
    expect(catalogue.filter((r) => r.type === 'aqiqah')).toHaveLength(3);
    expect(catalogue.filter((r) => r.type === 'nasi_box')).toHaveLength(5);
  });

  describe('program aqiqah', () => {
    it.each(aqiqahPrograms.map((p) => [p.slug, p] as const))(
      '%s ada di katalog dengan harga yang sama',
      (slug, program) => {
        const row = bySlug.get(slug);

        // Slug inilah yang dikirim tombol "Pesan" sebagai `?paket=`. Kalau ia
        // tidak dikenal, checkout diam-diam jatuh ke paket pertama.
        expect(row, `slug "${slug}" tidak ada di katalog database`).toBeDefined();
        expect(row!.type).toBe('aqiqah');
        expect(row!.price).toBe(program.price);
      },
    );

    it('memasarkan seluruh paket aqiqah yang aktif di katalog', () => {
      // Arah sebaliknya: paket yang ada di database tapi hilang dari landing
      // tidak akan pernah bisa ditemukan pengunjung. Aqiqah dipisahkan dari
      // nasi_box & qurban karena hanya inilah yang punya kartu sendiri.
      const inDb = catalogue.filter((r) => r.type === 'aqiqah').map((r) => r.slug);
      expect([...aqiqahPrograms.map((p) => p.slug)].sort()).toEqual(inDb.sort());
    });
  });

  describe('nasi box', () => {
    it.each(nasiBoxPackages.map((b) => [b.slug, b] as const))(
      '%s ada di katalog dengan harga yang sama',
      (slug, box) => {
        const row = bySlug.get(slug);
        expect(row, `slug "${slug}" tidak ada di katalog database`).toBeDefined();
        expect(row!.type).toBe('nasi_box');
        expect(row!.price).toBe(box.price);
      },
    );

    it('memasarkan seluruh paket nasi box yang ada di katalog', () => {
      const inDb = catalogue.filter((r) => r.type === 'nasi_box').map((r) => r.slug);
      expect([...nasiBoxPackages.map((b) => b.slug)].sort()).toEqual(inDb.sort());
    });
  });

  it('tidak memasarkan qurban', () => {
    // Keputusan 21 Agustus 2026 (`site.ts`): checkout hanya melayani aqiqah,
    // jadi memasarkan qurban berarti mengarahkan pengunjung ke tawaran yang
    // tidak bisa dipesan. Barisnya sengaja tetap hidup di database — yang
    // dicabut adalah pemasarannya, bukan kemampuannya. Tes ini yang menahan
    // agar ia tidak kembali tanpa keputusan.
    const qurban = catalogue.filter((r) => r.type === 'qurban').map((r) => r.slug);
    expect(qurban.length).toBeGreaterThan(0);

    const marketed = [...aqiqahPrograms.map((p) => p.slug), ...nasiBoxPackages.map((b) => b.slug)];
    for (const slug of qurban) {
      expect(marketed).not.toContain(slug);
    }
  });

  it('tidak ada slug yang dipasarkan dua kali', () => {
    // Slug ganda antar dua daftar akan membuat `?paket=` ambigu, dan kartu yang
    // kedua tidak akan pernah bisa dipesan sebagaimana yang tertulis padanya.
    const all = [...aqiqahPrograms.map((p) => p.slug), ...nasiBoxPackages.map((b) => b.slug)];
    expect(new Set(all).size).toBe(all.length);
  });
});
