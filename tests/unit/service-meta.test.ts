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

/**
 * Porsi vs kapasitas — dua angka yang mudah tertukar.
 *
 * Keduanya bilangan bulat tentang "berapa banyak", tinggal di layar yang
 * berdekatan, dan pernah benar-benar tertukar: label kapasitas mitra sempat
 * ditulis "maks 100 **box**" untuk paket **aqiqah** yang dipesan per ekor.
 *
 *   services.meta.hasil.porsi   hasil satu ekor, keterangan untuk pembeli
 *                               TIDAK membatasi apa pun
 *   vendor_services.max_qty     berapa yang sanggup dikerjakan mitra per hari
 *                               satuannya ikut jenis paket: ekor / box
 *
 * Nasi box adalah **paket tersendiri** dengan harga sendiri, bukan turunan
 * paket aqiqah — checkout memesannya lewat `nasi_box_service_id` +
 * `nasi_box_qty` yang terpisah dari `qty` ekor.
 */
describe('porsi adalah keterangan hasil, bukan batas pesanan', () => {
  it('porsi tinggal di services, kapasitas di vendor_services', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');

    const svc = readFileSync(join(process.cwd(), 'features/services/schema.ts'), 'utf8');
    const vnd = readFileSync(join(process.cwd(), 'features/vendors/schema.ts'), 'utf8');

    expect(svc).toContain('porsi:');
    // Katalog tidak boleh punya batas kuantitas: paket yang sama dikerjakan
    // banyak mitra dengan kapasitas berbeda-beda.
    expect(svc).not.toContain('max_qty');

    expect(vnd).toContain('max_qty');
    // Sebaliknya, kapasitas mitra bukan tempat menerangkan hasil paket.
    // Dicocokkan sebagai deklarasi medan (`porsi:`), bukan sebagai kata:
    // komentar di berkas itu memang menyebut "porsi" — justru untuk
    // menerangkan bahwa ia milik katalog, dan tes yang melarang katanya akan
    // menghukum dokumentasi yang benar.
    expect(vnd).not.toMatch(/^\s*porsi:/m);
  });

  it('label porsi menyebut "per ekor" dan menegaskan bukan batas', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const form = readFileSync(
      join(process.cwd(), 'features/services/components/service-form.tsx'),
      'utf8',
    );

    expect(form).toContain('Perkiraan porsi per ekor');
    expect(form).toContain('bukan batas pesanan');
  });

  it('satuan kapasitas mitra mengikuti jenis paket', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const panel = readFileSync(
      join(process.cwd(), 'features/vendors/components/vendor-service-panel.tsx'),
      'utf8',
    );

    // Inilah yang salah sebelumnya: satu satuan dipakai untuk kedua jenis.
    expect(panel).toContain('unitOf');
    expect(panel).toMatch(/nasi_box' \? 'box' : 'ekor'/);
  });

  it('checkout memesan nasi box terpisah dari ekor aqiqah', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const checkout = readFileSync(join(process.cwd(), 'features/checkout/schema.ts'), 'utf8');

    // Dua medan berbeda, bukan satu jumlah yang dibagi: nasi box punya baris
    // katalog sendiri dengan harganya sendiri.
    expect(checkout).toContain('nasi_box_service_id');
    expect(checkout).toContain('nasi_box_qty');
  });
});

/**
 * BUG 3 September: bentuk `meta` lawan ikut terbawa saat jenis paket diubah.
 *
 * `metaFrom()` menimpa-sebagian supaya kunci tak dikenal (`favorit`,
 * `premium`) tidak lenyap — itu benar. Tetapi ia juga membiarkan bentuk
 * **jenis yang lain**: mengubah paket aqiqah jadi nasi box meninggalkan
 * `hasil` & `cocok_untuk` di baris yang sama.
 *
 * Akibatnya tidak menghasilkan galat apa pun. `serviceDetails()` membaca
 * seluruh kunci tanpa memandang jenis, jadi kartunya mencetak
 * "80 porsi · Olahan: gulai & sate · nasi putih · sate" sekaligus — dan
 * formulir tidak lagi menampilkan medan aqiqah, sehingga tidak ada cara
 * membersihkannya lewat aplikasi.
 */
describe('meta dibersihkan saat jenis paket diubah', () => {
  const read = async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    return readFileSync(join(process.cwd(), 'server/actions/services.ts'), 'utf8');
  };

  it('cabang nasi_box membuang bentuk aqiqah', async () => {
    const src = await read();
    // Potongannya dibatasi sampai `return base;` milik cabang itu sendiri.
    // Versi pertama tes ini mengambil dari `if (...)` sampai akhir berkas, dan
    // `delete base.hasil` milik cabang **aqiqah** di bawahnya ikut tertangkap
    // — tesnya tetap hijau meski perbaikannya dicabut. Ketahuan saat bug-nya
    // sengaja dikembalikan untuk menguji tes ini.
    const start = src.indexOf("if (v.type === 'nasi_box')");
    const box = src.slice(start, src.indexOf('return base;', start));

    expect(box).toContain('delete base.hasil');
    expect(box).toContain('delete base.cocok_untuk');
  });

  it('cabang aqiqah membuang daftar isi nasi box', async () => {
    const src = await read();
    // Diperiksa sesudah `return base` milik cabang nasi_box, supaya yang
    // tertangkap benar-benar cabang aqiqah.
    const afterBox = src.slice(src.indexOf("if (v.type === 'nasi_box')"));
    const aqiqah = afterBox.slice(afterBox.indexOf('return base;'));

    expect(aqiqah).toContain('delete base.items');
  });

  it('penghapusan kunci tak dikenal TIDAK ikut dibuang', async () => {
    const src = await read();
    // Perbaikan ini tidak boleh membatalkan yang sebelumnya: `favorit` &
    // `premium` harus tetap bertahan, sebab keduanya bukan bentuk jenis lain
    // melainkan penanda yang tidak punya medan di formulir.
    expect(src).not.toContain('delete base.favorit');
    expect(src).not.toContain('delete base.premium');
    expect(src).toMatch(/\.\.\.\(existing as \{ \[key: string\]: Json \}\)/);
  });
});

/**
 * BUG 3 September: menghapus paket yang dipasarkan selalu gagal.
 */
describe('deleteService menurunkan show_on_landing', () => {
  it('ketiganya ditulis bersamaan', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(join(process.cwd(), 'server/actions/services.ts'), 'utf8');

    const del = src.slice(src.indexOf('export async function deleteService'));
    // Tanpa `show_on_landing: false`, UPDATE-nya menabrak
    // `services_landing_requires_active` dan galat 23514-nya jatuh ke
    // `internalError` yang berbunyi "coba lagi" — untuk sesuatu yang tidak
    // akan pernah berhasil.
    expect(del).toContain('deleted_at:');
    expect(del).toContain('is_active: false');
    expect(del).toContain('show_on_landing: false');
  });
});
