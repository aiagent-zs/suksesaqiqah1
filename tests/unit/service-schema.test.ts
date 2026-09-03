import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  createServiceSchema,
  setServiceActiveSchema,
  updateServiceSchema,
} from '@/features/services/schema';

const VALID = {
  type: 'aqiqah' as const,
  name: 'Aqiqah Ekonomi',
  slug: 'aqiqah-ekonomi',
  description: 'Paket hemat.',
  price: 2_300_000,
  sort_order: 1,
};

describe('createServiceSchema', () => {
  it('menerima paket yang lengkap', () => {
    const result = createServiceSchema.safeParse(VALID);
    expect(result.success).toBe(true);
  });

  it('deskripsi & urutan boleh kosong — keduanya opsional di database', () => {
    const { description, sort_order, ...rest } = VALID;
    void description;
    void sort_order;
    expect(createServiceSchema.safeParse(rest).success).toBe(true);
  });

  it('menolak nama yang terlalu pendek', () => {
    const result = createServiceSchema.safeParse({ ...VALID, name: 'A' });
    expect(result.success).toBe(false);
  });

  it('menolak jenis di luar enum service_type', () => {
    const result = createServiceSchema.safeParse({ ...VALID, type: 'katering' });
    expect(result.success).toBe(false);
  });

  it('menerima keempat jenis yang ada di enum', () => {
    for (const type of ['aqiqah', 'qurban', 'sedekah_daging', 'nasi_box']) {
      expect(createServiceSchema.safeParse({ ...VALID, type }).success).toBe(true);
    }
  });
});

/**
 * Slug adalah medan paling berbahaya di formulir ini — ia dipakai sebagai
 * tautan (`/checkout?paket={slug}`), dan `checkout/page.tsx` sengaja
 * **mengabaikan** slug tak dikenal lalu jatuh ke paket pertama. Jadi slug yang
 * salah bentuk tidak menghasilkan galat apa pun; ia diam-diam mengarahkan
 * pengunjung ke paket yang keliru.
 *
 * Bentuknya wajib sama dengan `services_slug_format_check` di database. Kalau
 * keduanya menyimpang, yang lolos di sini akan ditolak Postgres dengan pesan
 * yang tidak terbaca operator.
 */
describe('slug', () => {
  const ok = ['aqiqah-ekonomi', 'paket-a', 'paket-c', 'a1', 'nasi-box-premium-2'];
  const bad = [
    ['aqiqah_ekonomi', 'garis bawah'],
    ['aqiqah--ekonomi', 'tanda hubung ganda'],
    ['-aqiqah', 'diawali tanda hubung'],
    ['aqiqah-', 'diakhiri tanda hubung'],
    ['aqiqah ekonomi', 'spasi'],
    ['aqiqah.ekonomi', 'titik'],
  ] as const;

  it.each(ok)('menerima %s', (slug) => {
    expect(createServiceSchema.safeParse({ ...VALID, slug }).success).toBe(true);
  });

  it.each(bad)('menolak %s (%s)', (slug) => {
    expect(createServiceSchema.safeParse({ ...VALID, slug }).success).toBe(false);
  });

  it('huruf kapital diturunkan sendiri sebelum divalidasi', () => {
    // `.toLowerCase()` berjalan sebelum regex, jadi "AQIQAH-EKONOMI" lolos —
    // tapi yang tersimpan wajib versi kecilnya, bukan apa yang diketik.
    const result = createServiceSchema.safeParse({ ...VALID, slug: 'AQIQAH-EKONOMI' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.slug).toBe('aqiqah-ekonomi');
  });

  it('spasi di tepi dibuang, bukan ditolak', () => {
    const result = createServiceSchema.safeParse({ ...VALID, slug: '  paket-a  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.slug).toBe('paket-a');
  });
});

/**
 * Harga adalah angka yang benar-benar ditagih: `create_guest_order` membacanya
 * dari `services` dan mengabaikan harga kiriman klien.
 */
describe('harga', () => {
  it('menolak harga negatif', () => {
    expect(createServiceSchema.safeParse({ ...VALID, price: -1 }).success).toBe(false);
  });

  it('menerima harga nol — paket gratis/promo bukan hal mustahil', () => {
    expect(createServiceSchema.safeParse({ ...VALID, price: 0 }).success).toBe(true);
  });

  it('menolak harga yang melebihi numeric(14,2)', () => {
    // 12 digit di depan koma; di atas itu Postgres menolak dengan galat yang
    // tidak berarti apa-apa bagi operator, jadi dicegat lebih dulu di sini.
    expect(createServiceSchema.safeParse({ ...VALID, price: 1_000_000_000_000 }).success).toBe(
      false,
    );
  });

  it('menolak harga bukan angka', () => {
    expect(createServiceSchema.safeParse({ ...VALID, price: Number.NaN }).success).toBe(false);
    expect(createServiceSchema.safeParse({ ...VALID, price: '2300000' }).success).toBe(false);
  });
});

describe('updateServiceSchema', () => {
  it('menuntut id berbentuk uuid', () => {
    expect(updateServiceSchema.safeParse({ ...VALID, id: 'bukan-uuid' }).success).toBe(false);
    expect(
      updateServiceSchema.safeParse({ ...VALID, id: '11111111-1111-4111-8111-111111111111' })
        .success,
    ).toBe(true);
  });

  it('tanpa id ditolak — tanpanya UPDATE tidak tahu baris mana', () => {
    expect(updateServiceSchema.safeParse(VALID).success).toBe(false);
  });

  /**
   * Berbeda dengan `updateVendorSchema` yang sempat meng-`omit` `code`: di sini
   * `slug` sengaja ikut tersunting. Yang menahannya bukan skema melainkan
   * peringatan di layar, sebab slug dipakai sebagai tautan.
   */
  it('slug ikut tersunting', () => {
    const result = updateServiceSchema.safeParse({
      ...VALID,
      slug: 'aqiqah-ekonomi-baru',
      id: '11111111-1111-4111-8111-111111111111',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.slug).toBe('aqiqah-ekonomi-baru');
  });
});

describe('setServiceActiveSchema', () => {
  const id = '11111111-1111-4111-8111-111111111111';

  it('menuntut boolean, bukan string', () => {
    expect(setServiceActiveSchema.safeParse({ id, is_active: true }).success).toBe(true);
    expect(setServiceActiveSchema.safeParse({ id, is_active: 'true' }).success).toBe(false);
  });

  it('.pick({id}) dipakai deleteService — hanya butuh id', () => {
    expect(setServiceActiveSchema.pick({ id: true }).safeParse({ id }).success).toBe(true);
  });
});

/**
 * Aturan slug di TypeScript vs di database.
 *
 * Migration-nya dibaca **langsung**, bukan disalin ke dalam tes — tes yang
 * membandingkan salinan dengan salinan tidak membuktikan apa pun. Pola yang
 * sama dipakai `stage-sequence.test.ts` dan `landing-catalogue.test.ts`.
 *
 * Yang dijaga: constraint-nya benar-benar masih ada. Kalau ia dihapus dari
 * database, validasi di TypeScript jadi satu-satunya penjaga — dan jalur lain
 * (RPC, seed, psql) akan bisa menulis slug yang merusak tautan checkout.
 */
describe('constraint slug di database', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260820000200_master_tables.sql'),
    'utf8',
  );

  it('services_slug_format_check masih terpasang', () => {
    expect(sql).toContain('services_slug_format_check');
  });

  it('polanya sama dengan yang ditegakkan schema', () => {
    // Pola di SQL: '^[a-z0-9]+(-[a-z0-9]+)*$' — identik dengan regex di
    // `serviceSchema.slug`. Dicocokkan sebagai teks karena keduanya memang
    // ditulis terpisah; yang dijaga adalah keduanya tidak menyimpang.
    expect(sql).toContain("'^[a-z0-9]+(-[a-z0-9]+)*$'");
  });

  it('slug unik — dua paket tidak boleh berbagi tautan checkout', () => {
    expect(sql).toMatch(/slug\s+text not null unique/);
  });

  it('harga tidak boleh negatif di database juga', () => {
    expect(sql).toContain('services_price_nonnegative_check');
  });
});
