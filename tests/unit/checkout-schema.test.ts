import { describe, expect, it } from 'vitest';
import {
  BOOKING_MAX_DAYS,
  BOOKING_TIME_SLOTS,
  bookingMaxDate,
  bookingMinDate,
  guestCheckoutSchema,
  SPECIES_BY_SERVICE_TYPE,
} from '@/features/checkout/schema';
import { addCalendarDays } from '@/lib/format/date-range';

const SERVICE_ID = 'a2000000-0000-4000-8000-000000000001';

const valid = {
  service_id: SERVICE_ID,
  species: 'kambing',
  qty: 2,
  // Tahap 1 & 4 — keduanya wajib sejak alur enam tahap.
  aqiqah_for: 'laki_laki',
  distribution_mode: 'salur',
  // Jendela pemesanan dihitung ulang tiap parse, jadi acuannya ikut dihitung
  // di sini — tanggal yang dibekukan jadi konstanta akan basi besok pagi.
  requested_date: addCalendarDays(bookingMinDate(), 1),
  requested_time: BOOKING_TIME_SLOTS[0],
  child_name: 'Fatih',
  bin_binti: 'bin Ahmad',
  name: 'Budi Santoso',
  phone: '081234567890',
  email: 'budi@example.com',
};

/**
 * Alamat Aqiqah Kirim yang sah — kode Kemendagri sungguhan, sejalur dari
 * provinsi sampai kelurahan: Jawa Barat → Kota Bandung → Cibeunying Kidul.
 */
const KIRIM = {
  distribution_mode: 'kirim',
  delivery_province_code: '32',
  delivery_city_code: '32.73',
  delivery_district_code: '32.73.24',
  delivery_village_code: '32.73.24.1003',
  delivery_postal_code: '40125',
  delivery_detail: 'Jl. Cikutra Barat No. 12, RT 003/RW 007',
};

describe('guestCheckoutSchema', () => {
  it('menerima pesanan minimum yang lengkap', () => {
    const result = guestCheckoutSchema.parse(valid);
    expect(result.qty).toBe(2);
    expect(result.name).toBe('Budi Santoso');
  });

  it('tidak menyediakan tempat bagi harga maupun status', () => {
    // Inti pengamanan checkout tamu: harga dan status ditentukan RPC dari tabel
    // `services`. Kalau schema ini meneruskannya, pemesan bisa menentukan
    // sendiri berapa yang ia bayar.
    const result = guestCheckoutSchema.parse({
      ...valid,
      price: 1,
      unit_price: 1,
      total_amount: 1,
      status: 'completed',
      payment_status: 'paid',
      paid_amount: 999,
    });

    for (const key of [
      'price',
      'unit_price',
      'total_amount',
      'status',
      'payment_status',
      'paid_amount',
    ]) {
      expect(result, key).not.toHaveProperty(key);
    }
  });

  it('mengubah qty berbentuk teks dari input number menjadi angka', () => {
    expect(guestCheckoutSchema.parse({ ...valid, qty: '3' }).qty).toBe(3);
  });

  it('menolak qty di luar batas', () => {
    expect(guestCheckoutSchema.safeParse({ ...valid, qty: 0 }).success).toBe(false);
    expect(guestCheckoutSchema.safeParse({ ...valid, qty: 21 }).success).toBe(false);
    expect(guestCheckoutSchema.safeParse({ ...valid, qty: 1.5 }).success).toBe(false);
  });

  it('menolak jenis hewan di luar enum database', () => {
    expect(guestCheckoutSchema.safeParse({ ...valid, species: 'naga' }).success).toBe(false);
  });

  it('menolak domba, sekalipun ada di enum database', () => {
    // Dicabut dari checkout publik 19 Agustus 2026. `animal_species` tetap
    // punya `domba` karena order yang dibuat staf masih boleh memakainya —
    // penolakan yang sama juga ada di `create_guest_order`.
    expect(guestCheckoutSchema.safeParse({ ...valid, species: 'domba' }).success).toBe(false);
  });

  it('mewajibkan nama anak', () => {
    expect(guestCheckoutSchema.safeParse({ ...valid, child_name: '' }).success).toBe(false);
    expect(guestCheckoutSchema.safeParse({ ...valid, child_name: ' A ' }).success).toBe(false);
  });

  it('mewajibkan pilihan tahap 1 dan tahap 4', () => {
    expect(guestCheckoutSchema.safeParse({ ...valid, aqiqah_for: undefined }).success).toBe(false);
    expect(guestCheckoutSchema.safeParse({ ...valid, distribution_mode: undefined }).success).toBe(
      false,
    );
    expect(guestCheckoutSchema.safeParse({ ...valid, aqiqah_for: 'lelaki' }).success).toBe(false);
  });

  it('Aqiqah Kirim menuntut alamat pengiriman yang lengkap', () => {
    // Aturan silang-medan: dikirim tanpa alamat berarti tidak bisa diantar.
    expect(guestCheckoutSchema.safeParse({ ...valid, distribution_mode: 'kirim' }).success).toBe(
      false,
    );
    expect(guestCheckoutSchema.safeParse({ ...valid, ...KIRIM }).success).toBe(true);
  });

  it('memilih nasi box tanpa jumlah ditolak', () => {
    expect(
      guestCheckoutSchema.safeParse({ ...valid, nasi_box_service_id: SERVICE_ID }).success,
    ).toBe(false);
    expect(
      guestCheckoutSchema.safeParse({
        ...valid,
        nasi_box_service_id: SERVICE_ID,
        nasi_box_qty: 25,
      }).success,
    ).toBe(true);
  });

  it('menerima format nomor telepon yang lazim ditulis orang', () => {
    for (const phone of ['081234567890', '+62 812-3456-7890', '(021) 555 1234']) {
      expect(guestCheckoutSchema.safeParse({ ...valid, phone }).success, phone).toBe(true);
    }
  });

  it('menolak telepon yang bukan nomor', () => {
    // Nomor ini satu-satunya cara menghubungi pemesan tamu; kalau ngawur,
    // pesanan masuk tanpa ada yang bisa dikonfirmasi.
    for (const phone of ['hubungi saya', '0812<script>', '']) {
      expect(guestCheckoutSchema.safeParse({ ...valid, phone }).success, phone).toBe(false);
    }
  });

  it('mewajibkan email dan menolak yang salah bentuk', () => {
    // Mengikuti alur referensi: email dipakai mengirim salinan pesanan.
    expect(guestCheckoutSchema.safeParse({ ...valid, email: '' }).success).toBe(false);
    expect(guestCheckoutSchema.safeParse({ ...valid, email: 'bukan-email' }).success).toBe(false);
  });

  it('menolak id yang bukan uuid', () => {
    expect(guestCheckoutSchema.safeParse({ ...valid, service_id: 'aqiqah-ekonomi' }).success).toBe(
      false,
    );
  });

  it('tidak menyediakan tempat bagi cabang', () => {
    // Pemilih wilayah dicabut dari form; cabangnya ditentukan
    // `create_guest_order` dari `branches.is_default`. Kalau schema ini
    // meneruskannya, pengunjung anonim bisa menyetir order ke cabang mana pun.
    const result = guestCheckoutSchema.parse({
      ...valid,
      branch_id: 'a0000000-0000-4000-8000-000000000001',
    });
    expect(result).not.toHaveProperty('branch_id');
  });

  it('memangkas spasi pada medan teks', () => {
    const result = guestCheckoutSchema.parse({
      ...valid,
      name: '  Budi Santoso  ',
      referral_code: '  sa-budi  ',
    });
    expect(result.name).toBe('Budi Santoso');
    expect(result.referral_code).toBe('sa-budi');
  });

  it('membatasi panjang medan bebas', () => {
    expect(guestCheckoutSchema.safeParse({ ...valid, name: 'x'.repeat(151) }).success).toBe(false);
    expect(guestCheckoutSchema.safeParse({ ...valid, referral_code: 'x'.repeat(41) }).success).toBe(
      false,
    );
    expect(
      guestCheckoutSchema.safeParse({ ...valid, ...KIRIM, delivery_detail: 'x'.repeat(501) })
        .success,
    ).toBe(false);
  });

  it('tidak menyediakan tempat bagi alamat satu baris maupun nama wilayah', () => {
    // `delivery_address` dirakit `create_guest_order` dari kode wilayah yang ia
    // baca sendiri di `regions`. Kalau schema ini meneruskan teks atau nama dari
    // klien, alamat yang tercatat bisa berbeda dari wilayah yang dipilih —
    // dan yang dibaca kurir adalah teksnya.
    const result = guestCheckoutSchema.parse({
      ...valid,
      ...KIRIM,
      delivery_address: 'Jl. Palsu No. 1, Antah Berantah',
      delivery_province: 'Papua',
      delivery_city: 'Kota Jayapura',
    });

    for (const key of ['delivery_address', 'delivery_province', 'delivery_city']) {
      expect(result, key).not.toHaveProperty(key);
    }
  });
});

describe('alamat pengiriman terstruktur', () => {
  it('menuntut keempat tingkat wilayah', () => {
    for (const missing of [
      'delivery_province_code',
      'delivery_city_code',
      'delivery_district_code',
      'delivery_village_code',
    ] as const) {
      const payload = { ...valid, ...KIRIM, [missing]: '' };
      expect(guestCheckoutSchema.safeParse(payload).success, missing).toBe(false);
    }
  });

  it('menolak kode yang salah tingkat', () => {
    // Kode kabupaten yang mendarat di kolom kelurahan: bentuknya sah sebagai
    // kode, tapi bukan kode kelurahan.
    expect(
      guestCheckoutSchema.safeParse({ ...valid, ...KIRIM, delivery_village_code: '32.73' }).success,
    ).toBe(false);
    expect(
      guestCheckoutSchema.safeParse({ ...valid, ...KIRIM, delivery_province_code: '32.73' })
        .success,
    ).toBe(false);
  });

  it('menolak wilayah yang tidak sejalur', () => {
    // Keempatnya kode yang sah, tapi kelurahannya milik provinsi lain —
    // gabungan seperti ini tidak pernah ada di dunia nyata.
    expect(
      guestCheckoutSchema.safeParse({
        ...valid,
        ...KIRIM,
        delivery_village_code: '11.01.01.2001',
      }).success,
    ).toBe(false);
  });

  it('menuntut kode pos 5 digit dan detail jalan', () => {
    expect(
      guestCheckoutSchema.safeParse({ ...valid, ...KIRIM, delivery_postal_code: '' }).success,
    ).toBe(false);
    expect(
      guestCheckoutSchema.safeParse({ ...valid, ...KIRIM, delivery_postal_code: '401' }).success,
    ).toBe(false);
    expect(
      guestCheckoutSchema.safeParse({ ...valid, ...KIRIM, delivery_postal_code: '4012a' }).success,
    ).toBe(false);
    expect(
      guestCheckoutSchema.safeParse({ ...valid, ...KIRIM, delivery_detail: '  ' }).success,
    ).toBe(false);
  });

  it('Aqiqah Salur tidak menuntut apa pun soal alamat', () => {
    // Alamat yang sempat terisi sebelum pemesan berpindah pilihan tidak boleh
    // menahan pesanan yang memang tidak diantar ke mana-mana.
    expect(guestCheckoutSchema.safeParse({ ...valid, distribution_mode: 'salur' }).success).toBe(
      true,
    );
  });
});

describe('jendela tanggal pemesanan', () => {
  it('menerima hari ini dan hari ke-7', () => {
    for (const date of [bookingMinDate(), bookingMaxDate()]) {
      expect(guestCheckoutSchema.safeParse({ ...valid, requested_date: date }).success, date).toBe(
        true,
      );
    }
  });

  it('menolak tanggal kemarin', () => {
    const yesterday = addCalendarDays(bookingMinDate(), -1);
    expect(guestCheckoutSchema.safeParse({ ...valid, requested_date: yesterday }).success).toBe(
      false,
    );
  });

  it('menolak tanggal di luar 7 hari', () => {
    const tooFar = addCalendarDays(bookingMinDate(), BOOKING_MAX_DAYS + 1);
    expect(guestCheckoutSchema.safeParse({ ...valid, requested_date: tooFar }).success).toBe(false);
  });

  it('batas atas persis 7 hari setelah batas bawah', () => {
    expect(bookingMaxDate()).toBe(addCalendarDays(bookingMinDate(), BOOKING_MAX_DAYS));
  });

  it('mewajibkan tanggal dan jam', () => {
    expect(guestCheckoutSchema.safeParse({ ...valid, requested_date: '' }).success).toBe(false);
    expect(guestCheckoutSchema.safeParse({ ...valid, requested_time: '' }).success).toBe(false);
    expect(guestCheckoutSchema.safeParse({ ...valid, requested_date: '20 Agustus' }).success).toBe(
      false,
    );
  });

  it('hanya menerima jam yang memang ditawarkan form', () => {
    // Jam di luar daftar tidak punya petugas yang siap; batas luarnya
    // (06:00–20:00) ditegakkan lagi di `create_guest_order`.
    expect(guestCheckoutSchema.safeParse({ ...valid, requested_time: '03:00' }).success).toBe(
      false,
    );
    for (const slot of BOOKING_TIME_SLOTS) {
      expect(guestCheckoutSchema.safeParse({ ...valid, requested_time: slot }).success, slot).toBe(
        true,
      );
    }
  });
});

describe('SPECIES_BY_SERVICE_TYPE', () => {
  it('aqiqah hanya menawarkan kambing', () => {
    // Aturan yang sama ditegakkan di dalam RPC; kalau daftar ini menyimpang,
    // form menawarkan pilihan yang pasti ditolak database.
    expect(SPECIES_BY_SERVICE_TYPE.aqiqah).toEqual(['kambing']);
  });

  it('tidak satu pun jenis layanan menawarkan domba', () => {
    for (const [type, list] of Object.entries(SPECIES_BY_SERVICE_TYPE)) {
      expect(list as string[], type).not.toContain('domba');
    }
  });

  it('qurban menawarkan sapi', () => {
    expect(SPECIES_BY_SERVICE_TYPE.qurban).toContain('sapi');
  });

  it('setiap pilihan yang ditawarkan diterima schema', () => {
    for (const [, list] of Object.entries(SPECIES_BY_SERVICE_TYPE)) {
      for (const species of list) {
        expect(guestCheckoutSchema.safeParse({ ...valid, species }).success, species).toBe(true);
      }
    }
  });
});
