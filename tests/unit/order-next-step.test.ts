import { describe, expect, it } from 'vitest';
import { deriveNextStep, isPanelRelevant, PANEL_LABEL } from '@/features/orders/next-step';
import type { OrderGuardContext } from '@/features/orders/state-machine';
import { ORDER_STATUS_FLOW, type OrderStatus } from '@/lib/constants/order';

/**
 * "Apa yang harus dikerjakan sekarang" pada satu order.
 *
 * ## Kenapa berkas ini ada
 *
 * Halaman detail order merender sembilan panel sekaligus, semuanya terbuka
 * penuh, apa pun statusnya — jadi pada order yang baru masuk, panel Dokumentasi
 * dan Laporan ikut memenuhi layar padahal keduanya baru berguna berminggu-minggu
 * kemudian. Jawaban "sekarang giliran apa" harus dirakit sendiri oleh admin dari
 * tiga tempat berjauhan: stepper di header, daftar alasan di sidebar, dan panel
 * mana yang ternyata berisi formnya.
 *
 * Yang dijaga di sini bukan kalimatnya, melainkan **kaitannya dengan state
 * machine**: penghalang yang ditampilkan wajib sama dengan yang ditegakkan
 * server action. Kalau keduanya menyimpang, layar akan menyatakan sesuatu sudah
 * beres sementara tombolnya menolak — atau sebaliknya, dan itu justru lebih
 * membingungkan daripada tidak ada petunjuk sama sekali.
 */
function ctx(over: Partial<OrderGuardContext> = {}): OrderGuardContext {
  return {
    paymentStatus: 'unpaid',
    totalAmount: 2_800_000,
    paidAmount: 0,
    minDpRatio: 0.5,
    isGuestOrder: false,
    guestVerified: false,
    hasVendor: false,
    hasSchedule: false,
    animalsTotal: 0,
    stagesTotal: 0,
    stagesReported: 0,
    stagesValidated: 0,
    stagesRejected: 0,
    missingDocStages: [],
    reportSent: false,
    ...over,
  };
}

describe('panel yang terbuka mengikuti fase', () => {
  it('order baru hanya membuka panel verifikasi', () => {
    expect(isPanelRelevant('new', 'verifikasi')).toBe(true);
    // Inti keluhannya: panel yang belum ada gunanya memenuhi layar sejak hari
    // pertama.
    expect(isPanelRelevant('new', 'tahap')).toBe(false);
    expect(isPanelRelevant('new', 'laporan')).toBe(false);
  });

  it('fase terbayar membuka jadwal dan hewan sekaligus', () => {
    // Keduanya syarat naik ke `assigned`, dan justru sering terlewat karena
    // berada di dua panel yang berbeda.
    expect(isPanelRelevant('paid', 'jadwal')).toBe(true);
    expect(isPanelRelevant('paid', 'hewan')).toBe(true);
  });

  it('fase validasi mengarah ke panel tahap — bukti sudah ada di dalamnya', () => {
    // Panel Dokumentasi yang berdiri sendiri dihapus 8 September; buktinya
    // menempel pada baris tahapnya. Kalau ini kembali menunjuk dua panel,
    // berarti pemisahannya diam-diam hidup lagi.
    expect(isPanelRelevant('validation', 'tahap')).toBe(true);
  });

  it('tiap status dalam rangkaian punya panel yang dituju', () => {
    for (const status of ORDER_STATUS_FLOW) {
      const step = deriveNextStep(status, 'admin', ctx());
      expect(step.panel, status).not.toBeNull();
      // Panel yang ditunjuk harus punya label — kalau tidak, tautannya
      // menampilkan "Buka undefined".
      expect(PANEL_LABEL[step.panel as keyof typeof PANEL_LABEL], status).toBeTruthy();
    }
  });
});

describe('penghalang datang dari state machine, bukan disalin', () => {
  it('order tamu yang belum diverifikasi menahan status baru', () => {
    const step = deriveNextStep('new', 'admin', ctx({ isGuestOrder: true, guestVerified: false }));
    expect(step.blockers.join(' ')).toMatch(/diverifikasi/i);
    expect(step.readyFor).toBeNull();
  });

  it('order tamu yang sudah diverifikasi siap naik', () => {
    const step = deriveNextStep('new', 'admin', ctx({ isGuestOrder: true, guestVerified: true }));
    expect(step.blockers).toEqual([]);
    expect(step.readyFor).toBe('verified');
  });

  it('gate DP menahan verified → paid sampai separuh terbayar', () => {
    const belum = deriveNextStep('verified', 'admin', ctx({ paidAmount: 1_000_000 }));
    expect(belum.readyFor).toBeNull();
    expect(belum.blockers.join(' ')).toMatch(/DP minimal 50%/);

    // Tepat di ambang: 50% dari 2.800.000.
    const cukup = deriveNextStep('verified', 'admin', ctx({ paidAmount: 1_400_000 }));
    expect(cukup.readyFor).toBe('paid');
  });

  it('menyebut kedua syarat yang kurang di fase terbayar', () => {
    // Mitra dan hewan diperiksa satu `guard` yang sama, jadi yang terbaca
    // adalah yang lebih dulu gagal — bukan keduanya sekaligus.
    const step = deriveNextStep(
      'paid',
      'admin',
      ctx({ paidAmount: 2_800_000, paymentStatus: 'paid', hasVendor: false, animalsTotal: 0 }),
    );
    expect(step.blockers.join(' ')).toMatch(/[Mm]itra/);
    expect(step.readyFor).toBeNull();
  });
});

describe('jalan keluar bukan langkah berikutnya', () => {
  it('menahan & membatalkan tidak pernah jadi readyFor', () => {
    // `on_hold` dan `cancelled` selalu diizinkan tanpa syarat dari hampir
    // setiap status. Kalau ikut dihitung, membatalkan order akan tampil
    // sebagai "siap dilanjutkan" — persis kebalikan artinya.
    for (const status of ORDER_STATUS_FLOW) {
      const step = deriveNextStep(status, 'admin', ctx());
      expect(step.readyFor, status).not.toBe('on_hold');
      expect(step.readyFor, status).not.toBe('cancelled');
    }
  });
});

describe('order yang sudah berhenti', () => {
  it('ditandai selesai, tanpa penghalang', () => {
    for (const status of ['completed', 'cancelled'] as OrderStatus[]) {
      const step = deriveNextStep(status, 'admin', ctx());
      expect(step.done, status).toBe(true);
      expect(step.blockers, status).toEqual([]);
      expect(step.readyFor, status).toBeNull();
    }
  });
});

describe('cakupan role', () => {
  it('vendor tidak ditawari transisi milik admin', () => {
    // `new → verified` hanya untuk staf. Vendor yang membuka order di status
    // ini tidak boleh melihatnya sebagai pekerjaannya.
    const vendor = deriveNextStep(
      'new',
      'vendor',
      ctx({ isGuestOrder: true, guestVerified: true }),
    );
    expect(vendor.readyFor).toBeNull();

    const admin = deriveNextStep('new', 'admin', ctx({ isGuestOrder: true, guestVerified: true }));
    expect(admin.readyFor).toBe('verified');
  });

  it('tanpa role, tidak ada langkah yang ditawarkan', () => {
    const step = deriveNextStep('new', undefined, ctx());
    expect(step.readyFor).toBeNull();
    expect(step.blockers).toEqual([]);
  });
});
