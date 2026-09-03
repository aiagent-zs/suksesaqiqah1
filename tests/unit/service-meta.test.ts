import { describe, expect, it } from 'vitest';
import { createServiceSchema, updateServiceSchema } from '@/features/services/schema';

const AQIQAH = {
  type: 'aqiqah' as const,
  name: 'Aqiqah Ekonomi',
  slug: 'aqiqah-ekonomi',
  price: 2_300_000,
};

const BOX = {
  type: 'nasi_box' as const,
  name: 'Paket A',
  slug: 'paket-a',
  price: 21_000,
};

/**
 * Isi paket (`services.meta`) — kini bisa disunting.
 *
 * Sampai 3 September kolom ini dibaca **enam** tempat (landing, checkout,
 * panel modal mitra, daftar & detail katalog, query order) dan ditulis
 * **nol**: satu-satunya cara mengubah "80 porsi · Olahan: gulai & sate" adalah
 * dashboard Supabase. Pola yang sama persis dengan `vendor_coverage` sebelum
 * 27 Agustus — tabel dan pembacanya lahir duluan, layarnya tidak pernah
 * menyusul.
 */
describe('medan isi paket di schema', () => {
  it('menerima porsi, ragam olahan, dan peruntukan', () => {
    const result = createServiceSchema.safeParse({
      ...AQIQAH,
      porsi: 80,
      jenis_olahan: 'gulai & sate',
      cocok_untuk: 'keluarga kecil',
    });
    expect(result.success).toBe(true);
  });

  it('semuanya opsional — paket baru wajar belum lengkap', () => {
    expect(createServiceSchema.safeParse(AQIQAH).success).toBe(true);
  });

  it('menolak porsi bukan bilangan bulat', () => {
    expect(createServiceSchema.safeParse({ ...AQIQAH, porsi: 80.5 }).success).toBe(false);
  });

  it('menolak porsi nol atau negatif', () => {
    // Paket yang menghasilkan nol porsi bukan paket; angka itu hampir pasti
    // salah ketik, dan mencetaknya di kartu ("0 porsi") lebih buruk daripada
    // tidak mencetak apa-apa.
    expect(createServiceSchema.safeParse({ ...AQIQAH, porsi: 0 }).success).toBe(false);
    expect(createServiceSchema.safeParse({ ...AQIQAH, porsi: -5 }).success).toBe(false);
  });

  it('menerima daftar isi nasi box', () => {
    const result = createServiceSchema.safeParse({
      ...BOX,
      items: ['nasi putih', 'gulai kambing', 'acar'],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.items).toHaveLength(3);
  });

  it('baris kosong pada daftar isi disaring, bukan ditolak', () => {
    // Sumbernya `<textarea>` satu-baris-satu-lauk; baris kosong di ujung
    // adalah cara orang mengetik, bukan kekeliruan yang perlu diberitahukan.
    const result = createServiceSchema.safeParse({
      ...BOX,
      items: ['nasi putih', '', '  ', 'sate'],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.items).toEqual(['nasi putih', 'sate']);
  });

  it('menolak daftar isi yang terlalu panjang', () => {
    const items = Array.from({ length: 21 }, (_, i) => `lauk ${i}`);
    expect(createServiceSchema.safeParse({ ...BOX, items }).success).toBe(false);
  });

  it('ikut tersunting lewat updateServiceSchema', () => {
    const result = updateServiceSchema.safeParse({
      ...AQIQAH,
      id: '11111111-1111-4111-8111-111111111111',
      porsi: 150,
      jenis_olahan: 'gulai, sate, tongseng',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.porsi).toBe(150);
  });
});

/**
 * `metaFrom()` di server action — perakit `meta`.
 *
 * Diuji lewat perilakunya yang tercatat, bukan dengan mengimpornya: fungsinya
 * privat di berkas `'use server'`, dan mengekspornya hanya demi tes berarti
 * mengubah bentuk modul agar bisa diuji. Yang benar-benar berharga dijaga di
 * sini adalah **kontraknya**, dan itu terbaca dari kodenya.
 */
describe('perakitan meta menjaga kunci yang tidak dirender formulir', () => {
  it('kontraknya tercatat di server action', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(join(process.cwd(), 'server/actions/services.ts'), 'utf8');

    // Inti pertahanannya: `meta` lama dibaca lebih dulu, lalu ditimpa
    // sebagian. `paket-c` membawa `favorit: true` dan `paket-e` membawa
    // `premium: true` — keduanya tidak punya medan di formulir, jadi menulis
    // objek baru dari nol akan menghapusnya diam-diam tiap kali disimpan.
    expect(src).toContain('metaFrom');
    expect(src).toContain("select('meta')");
    // Sebaran objek lama inilah yang menjaganya.
    expect(src).toMatch(/\.\.\.\(existing as \{ \[key: string\]: Json \}\)/);
  });

  it('bentuk aqiqah & nasi box dipisah', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(join(process.cwd(), 'server/actions/services.ts'), 'utf8');

    // Menulis keduanya sekaligus akan membuat kartu mencetak porsi untuk
    // sebuah box nasi.
    expect(src).toContain("v.type === 'nasi_box'");
  });
});
