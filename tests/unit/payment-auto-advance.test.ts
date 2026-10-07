import { describe, expect, it } from 'vitest';
import { checkTransition, type OrderGuardContext } from '@/features/orders/state-machine';

/**
 * Kenaikan otomatis `verified → paid` sesudah pembayaran diverifikasi.
 *
 * ## Kenapa berkas ini ada
 *
 * Memverifikasi pembayaran dan menekan "Terbayar" adalah dua penegasan untuk
 * satu keputusan yang sama: syarat transisi itu **persis** `paymentGatePassed`
 * — sejak 29 September 2026 berarti lunas, tidak ada yang lain. Admin yang baru saja membuktikan uangnya masuk disuruh
 * menegaskannya lagi di panel sebelah, satu detik kemudian.
 *
 * Yang dijaga di sini bukan otomatisasinya — melainkan bahwa otomatisasi itu
 * **tidak membawa aturan sendiri**. `advanceToPaidIfReady` menyerahkan
 * keputusannya ke `checkTransition` yang sama dengan yang dipakai tombol
 * manual, jadi tabel di bawah ini sekaligus daftar keadaan yang boleh dan tidak
 * boleh dinaikkan olehnya. Kalau keduanya menyimpang, kenaikan otomatis akan
 * melompati gerbang yang masih menahan tombolnya — dan itu jauh lebih buruk
 * daripada satu klik tambahan.
 */
function ctx(over: Partial<OrderGuardContext> = {}): OrderGuardContext {
  return {
    paymentStatus: 'unpaid',
    totalAmount: 5_600_000,
    paidAmount: 0,
    isGuestOrder: false,
    guestVerified: false,
    hasVendor: false,
    hasSchedule: false,
    animalsTotal: 0,
    isCateringOrder: false,
    stagesTotal: 0,
    stagesReported: 0,
    stagesValidated: 0,
    stagesRejected: 0,
    missingDocStages: [],
    reportSent: false,
    ...over,
  };
}

/** Persis pemeriksaan yang dijalankan `advanceToPaidIfReady`. */
const canAdvance = (over: Partial<OrderGuardContext>) =>
  checkTransition('verified', 'paid', 'admin', ctx(over)).ok;

describe('naik sendiri begitu tagihannya lunas', () => {
  it('pelunasan penuh menaikkan statusnya', () => {
    expect(canAdvance({ paidAmount: 5_600_000, paymentStatus: 'paid' })).toBe(true);
  });
});

describe('tidak naik selama belum lunas', () => {
  it('separuh terbayar tertahan', () => {
    // Dulu justru inilah yang lolos: ambang DP 50% dari 5.600.000. Dicabut
    // 29 September 2026, dan tesnya dibalik supaya pencabutan itu ikut terkunci.
    expect(canAdvance({ paidAmount: 2_800_000, paymentStatus: 'partial' })).toBe(false);
  });

  it('kurang serupiah pun tertahan', () => {
    expect(canAdvance({ paidAmount: 5_599_999, paymentStatus: 'partial' })).toBe(false);
  });

  it('order tanpa nilai tidak pernah lolos', () => {
    // Tanpa pembayaran terverifikasi, `sync_order_payment` menuliskan `unpaid`
    // — jadi order yang nilainya nol tidak menggerakkan apa pun.
    expect(canAdvance({ totalAmount: 0, paidAmount: 0 })).toBe(false);
  });
});

describe('yang tetap milik admin', () => {
  it('vendor tidak bisa memicu kenaikan ini', () => {
    // `verified → paid` hanya untuk staf. Vendor tidak berhak memverifikasi
    // pembayaran sama sekali, tapi penjagaannya harus ada di dua tempat.
    const asVendor = checkTransition(
      'verified',
      'paid',
      'vendor',
      ctx({ paidAmount: 5_600_000, paymentStatus: 'paid' }),
    );
    expect(asVendor.ok).toBe(false);
  });

  it('hanya verified yang dinaikkan — bukan status lain', () => {
    // `advanceToPaidIfReady` berhenti kalau statusnya bukan `verified`.
    // Transisi berikutnya menuntut pekerjaan yang tidak terjadi di panel
    // pembayaran (mitra ditetapkan, hewan didaftarkan), jadi menaikkannya
    // berantai akan melompati keputusan yang memang milik admin.
    const lunas = ctx({ paidAmount: 5_600_000, paymentStatus: 'paid' });

    // Dari `paid`, syaratnya bertambah — dan tidak satu pun dikerjakan di
    // panel pembayaran.
    const paidToAssigned = checkTransition('paid', 'assigned', 'admin', lunas);
    expect(paidToAssigned.ok).toBe(false);
    if (!paidToAssigned.ok) expect(paidToAssigned.message).toMatch(/[Mm]itra/);
  });

  it('order tamu yang belum diverifikasi tidak ikut terbawa', () => {
    // Tagihan bisa saja sudah lunas pada order tamu, tapi penahannya ada di
    // transisi sebelumnya (`new → verified`). Order seperti ini tidak akan
    // pernah berstatus `verified`, jadi `advanceToPaidIfReady` tidak
    // menyentuhnya — dijaga di sini supaya asumsi itu tetap benar.
    const guest = checkTransition(
      'new',
      'verified',
      'admin',
      ctx({
        isGuestOrder: true,
        guestVerified: false,
        paidAmount: 5_600_000,
        paymentStatus: 'paid',
      }),
    );
    expect(guest.ok).toBe(false);
  });
});
