/**
 * Skema master mitra.
 *
 * Ketiganya baru benar-benar dilewati sejak halaman `/vendors/{id}` ada:
 * `updateVendorSchema` tidak pernah punya pemanggil, dan
 * `saveVendorCoverageSchema` sama sekali belum ada — tabel `vendor_coverage`
 * kosong selamanya karena tidak ada satu pun jalan mengisinya.
 */
import { describe, expect, it } from 'vitest';
import {
  createVendorSchema,
  saveVendorCoverageSchema,
  updateVendorSchema,
  vendorServiceSchema,
} from '@/features/vendors/schema';
import { serviceDetails } from '@/features/vendors/queries';

const VALID = {
  code: 'MITRA1',
  name: 'Dapur Uji',
  phone: '08123456789',
  service_modes: ['salur', 'kirim'] as const,
};

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

describe('createVendorSchema', () => {
  it('menerima data minimum: kode, nama, telepon, dan satu mode', () => {
    const parsed = createVendorSchema.safeParse({ ...VALID, service_modes: ['salur'] });
    expect(parsed.success).toBe(true);
  });

  it('menolak mitra tanpa cara penyaluran', () => {
    // Mitra yang tidak melayani apa pun tidak bisa ditugaskan ke order mana pun,
    // jadi menyimpannya hanya menambah baris yang selamanya dilewati
    // `assignVendor` — kegagalan yang baru terasa jauh dari sini.
    const parsed = createVendorSchema.safeParse({ ...VALID, service_modes: [] });
    expect(parsed.success).toBe(false);
  });

  it('menormalkan kode ke huruf kapital', () => {
    // Constraint `vendors_code_format_check` hanya menerima huruf kapital;
    // tanpa normalisasi di sini, mengetik huruf kecil ditolak database dengan
    // pesan yang tidak berguna bagi operator.
    const parsed = createVendorSchema.parse({ ...VALID, code: 'mitra1' });
    expect(parsed.code).toBe('MITRA1');
  });

  it('menolak kode yang memuat selain huruf & angka', () => {
    const parsed = createVendorSchema.safeParse({ ...VALID, code: 'MITRA-1' });
    expect(parsed.success).toBe(false);
  });

  it('menolak kode pos yang bukan 5 digit', () => {
    expect(createVendorSchema.safeParse({ ...VALID, postal_code: '402' }).success).toBe(false);
    expect(createVendorSchema.safeParse({ ...VALID, postal_code: '40286' }).success).toBe(true);
  });

  it('menerima kode wilayah Kemendagri di keempat tingkat', () => {
    const parsed = createVendorSchema.safeParse({
      ...VALID,
      province_code: '32',
      city_code: '32.73',
      district_code: '32.73.01',
      village_code: '32.73.01.1001',
    });
    expect(parsed.success).toBe(true);
  });

  it('menolak kode wilayah yang bentuknya tidak dikenali', () => {
    expect(createVendorSchema.safeParse({ ...VALID, city_code: '3273' }).success).toBe(false);
  });
});

describe('updateVendorSchema', () => {
  it('menerima `code` — kode kini dapat disunting', () => {
    // Kebalikan dari perilaku sebelumnya, dan itu disengaja: dulu `code`
    // di-`omit` sehingga salah ketik saat pendaftaran hanya bisa dibetulkan
    // lewat dashboard Supabase. Yang membuat perubahan ini aman adalah bentuk
    // skemanya — `code` tidak pernah disalin ke tabel lain, dan path Storage
    // sengaja tidak memakainya.
    const parsed = updateVendorSchema.parse({ ...VALID, id: UUID_A });
    expect(parsed.code).toBe('MITRA1');
  });

  it('menegakkan format kode yang sama dengan pendaftaran', () => {
    // Kode dibaca sekilas untuk membedakan mitra, jadi 'dapur-bdg' dan
    // 'DAPURBDG' tidak boleh hidup bersama. Formatnya ditegakkan constraint
    // `vendors_code_format_check` juga, tapi ditolak di sini supaya pesannya
    // menempel pada kolomnya.
    expect(updateVendorSchema.safeParse({ ...VALID, id: UUID_A, code: 'mitra-1' }).success).toBe(
      false,
    );
    expect(updateVendorSchema.parse({ ...VALID, id: UUID_A, code: 'mitra1' }).code).toBe('MITRA1');
  });

  it('menuntut id yang sah', () => {
    expect(updateVendorSchema.safeParse({ ...VALID, id: 'bukan-uuid' }).success).toBe(false);
  });

  it('tetap menuntut minimal satu cara penyaluran', () => {
    const parsed = updateVendorSchema.safeParse({ ...VALID, id: UUID_A, service_modes: [] });
    expect(parsed.success).toBe(false);
  });
});

describe('saveVendorCoverageSchema', () => {
  it('membuang kode wilayah ganda', () => {
    // Primary key `(vendor_id, region_code)` akan menolaknya, tapi galat
    // database untuk sesuatu yang maksudnya sudah jelas bukan jawaban.
    const parsed = saveVendorCoverageSchema.parse({
      vendor_id: UUID_A,
      region_codes: ['32.73', '32.04', '32.73'],
    });
    expect(parsed.region_codes).toEqual(['32.73', '32.04']);
  });

  it('menerima daftar kosong — mitra boleh tanpa wilayah layanan', () => {
    const parsed = saveVendorCoverageSchema.safeParse({ vendor_id: UUID_A, region_codes: [] });
    expect(parsed.success).toBe(true);
  });

  it('menolak kode wilayah yang bentuknya tidak dikenali', () => {
    const parsed = saveVendorCoverageSchema.safeParse({
      vendor_id: UUID_A,
      region_codes: ['32.73', 'JAWA BARAT'],
    });
    expect(parsed.success).toBe(false);
  });
});

describe('vendorServiceSchema', () => {
  it('menolak harga modal negatif', () => {
    const parsed = vendorServiceSchema.safeParse({
      vendor_id: UUID_A,
      service_id: UUID_B,
      vendor_price: -1,
    });
    expect(parsed.success).toBe(false);
  });

  it('menerima modal nol — paket yang tidak menambah biaya ke mitra', () => {
    const parsed = vendorServiceSchema.safeParse({
      vendor_id: UUID_A,
      service_id: UUID_B,
      vendor_price: 0,
    });
    expect(parsed.success).toBe(true);
  });

  it('menawarkan paket secara bawaan', () => {
    const parsed = vendorServiceSchema.parse({
      vendor_id: UUID_A,
      service_id: UUID_B,
      vendor_price: 100,
    });
    expect(parsed.is_offered).toBe(true);
  });
});

/**
 * Isi paket yang dibaca dari `services.meta`.
 *
 * Kolomnya bertipe `Json` bebas dan bentuknya **berbeda per jenis paket** —
 * aqiqah memakai `hasil` + `cocok_untuk`, nasi box memakai `items`, qurban
 * kosong sama sekali. Itu sebabnya perakitannya duduk di satu tempat: kalau
 * layar yang membongkarnya, setiap layar yang menampilkan paket harus tahu
 * ketiga bentuk itu.
 */
describe('serviceDetails', () => {
  it('merakit paket aqiqah dari `hasil` dan `cocok_untuk`', () => {
    expect(
      serviceDetails({
        hasil: { porsi: 110, jenis: 'gulai, sate, tongseng' },
        cocok_untuk: 'syukuran keluarga',
      }),
    ).toEqual(['110 porsi', 'Olahan: gulai, sate, tongseng', 'Cocok untuk syukuran keluarga']);
  });

  it('merakit nasi box dari `items`', () => {
    expect(serviceDetails({ items: ['nasi putih', 'sate'] })).toEqual(['nasi putih', 'sate']);
  });

  it('mengembalikan daftar kosong untuk meta kosong atau bukan objek', () => {
    // Qurban memang `{}` di katalog, dan `meta` kolom bebas — kunci baru bisa
    // muncul tanpa memberi tahu siapa pun. Bentuk tak dikenal harus jadi daftar
    // kosong, bukan galat yang menjatuhkan seluruh halaman mitra.
    for (const input of [{}, null, undefined, 'bukan objek', 42]) {
      expect(serviceDetails(input)).toEqual([]);
    }
  });

  it('mengabaikan `items` yang bukan larik string', () => {
    expect(serviceDetails({ items: ['sate', 7, null, { a: 1 }] })).toEqual(['sate']);
  });
});
