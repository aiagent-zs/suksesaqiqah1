// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Penyimpanan sementara isian checkout.
 *
 * Yang dijaga di sini bukan "apakah datanya tersimpan" — itu bagian yang mudah
 * dan yang paling cepat ketahuan kalau rusak. Yang dijaga: bahwa draft yang
 * **rusak, kedaluwarsa, atau berasal dari versi form sebelumnya** tidak pernah
 * sampai ke komponen dalam bentuk yang bisa menjatuhkannya saat render.
 *
 * Modulnya menyinggahkan hasil bacaan seumur halaman (lihat `getDraftSnapshot`),
 * jadi tiap kasus uji mengimpornya ulang lewat `resetModules` — kalau tidak,
 * kasus kedua hanya akan membaca singgahan milik kasus pertama.
 */
const DRAFT_KEY = 'sa-checkout-draft-v1';

async function freshModule() {
  vi.resetModules();
  return import('@/features/checkout/draft');
}

function seed(value: unknown) {
  window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(value));
}

beforeEach(() => {
  window.sessionStorage.clear();
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('emptyDraft', () => {
  it('tidak mengisi tanggal pelaksanaan', async () => {
    const { emptyDraft } = await freshModule();
    // Nilai awal yang sudah terisi akan lolos begitu saja dan pesanan masuk
    // untuk tanggal yang tidak pernah dipilih pemesan.
    expect(emptyDraft('svc-1').requested_date).toBe('');
    expect(emptyDraft('svc-1').requested_time).toBe('');
  });

  it('memakai paket yang diteruskan sebagai pilihan awal', async () => {
    const { emptyDraft } = await freshModule();
    expect(emptyDraft('svc-1').service_id).toBe('svc-1');
  });
});

describe('membaca draft tersimpan', () => {
  it('mengembalikan null ketika tidak ada yang tersimpan', async () => {
    const { getDraftSnapshot } = await freshModule();
    expect(getDraftSnapshot()).toBeNull();
  });

  it('memulihkan isian beserta langkahnya', async () => {
    const { emptyDraft, getDraftSnapshot } = await freshModule();
    seed({
      savedAt: Date.now(),
      step: 3,
      draft: { ...emptyDraft('svc-1'), name: 'Budi', child_name: 'Fatih' },
    });

    const found = getDraftSnapshot();
    expect(found?.step).toBe(3);
    expect(found?.draft.name).toBe('Budi');
    expect(found?.draft.child_name).toBe('Fatih');
  });

  it('membuang draft yang lebih tua dari 12 jam', async () => {
    const { emptyDraft, getDraftSnapshot } = await freshModule();
    const thirteenHoursAgo = Date.now() - 13 * 60 * 60 * 1000;
    seed({ savedAt: thirteenHoursAgo, step: 3, draft: emptyDraft('svc-1') });

    // Tanggal pelaksanaan yang dipilih kemarin keburu lewat; memulihkannya
    // hanya membuat pemesan menghadapi galat yang tidak ia mengerti asalnya.
    expect(getDraftSnapshot()).toBeNull();
    expect(window.sessionStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('menolak draft tanpa penanda waktu', async () => {
    const { emptyDraft, getDraftSnapshot } = await freshModule();
    seed({ step: 3, draft: emptyDraft('svc-1') });
    expect(getDraftSnapshot()).toBeNull();
  });

  it('mengembalikan null ketika isinya bukan JSON yang sah', async () => {
    const { getDraftSnapshot } = await freshModule();
    window.sessionStorage.setItem(DRAFT_KEY, '{bukan json');
    expect(getDraftSnapshot()).toBeNull();
  });
});

describe('menyaring draft yang bentuknya menyimpang', () => {
  /**
   * Ini alasan `coerceDraft` ada. Draft bisa berasal dari versi form sebelum
   * deploy terakhir, atau disunting tangan lewat devtools. Satu medan yang
   * hilang membuat komponen menabrak `undefined` saat render — halaman putih,
   * di tengah pengisian, tanpa jejak penyebabnya.
   */
  it('mengisi medan yang hilang, termasuk seluruh bagian alamat', async () => {
    const { getDraftSnapshot } = await freshModule();
    seed({ savedAt: Date.now(), step: 2, draft: { name: 'Budi' } });

    const d = getDraftSnapshot()?.draft;
    expect(d?.name).toBe('Budi');
    expect(d?.delivery).toEqual({
      province_code: '',
      province_name: '',
      city_code: '',
      city_name: '',
      district_code: '',
      district_name: '',
      village_code: '',
      village_name: '',
      postal_code: '',
      detail: '',
    });
  });

  it('membuang nilai yang tipenya salah alih-alih meneruskannya', async () => {
    const { getDraftSnapshot } = await freshModule();
    seed({
      savedAt: Date.now(),
      step: 2,
      // `qty` sebagai teks akan membuat aritmetika total menghasilkan NaN,
      // dan `name` sebagai objek akan dirender React sebagai galat.
      draft: { qty: '3', name: { evil: true }, delivery: 'bukan objek' },
    });

    const d = getDraftSnapshot()?.draft;
    expect(d?.qty).toBe(1);
    expect(d?.name).toBe('');
    expect(d?.delivery.province_code).toBe('');
  });

  it('menolak qty yang bukan angka terhingga', async () => {
    const { emptyDraft, getDraftSnapshot } = await freshModule();
    seed({
      savedAt: Date.now(),
      step: 2,
      draft: { ...emptyDraft('svc-1'), qty: Number.NaN, nasi_box_qty: Number.POSITIVE_INFINITY },
    });

    const d = getDraftSnapshot()?.draft;
    // `NaN` tidak selamat dari perjalanan JSON — ia jadi `null` — dan `Infinity`
    // jadi `null` pula. Keduanya harus jatuh ke nilai awal, bukan diteruskan.
    expect(d?.qty).toBe(1);
    expect(d?.nasi_box_qty).toBe(0);
  });

  it('membetulkan langkah yang di luar akal', async () => {
    const { emptyDraft, getDraftSnapshot } = await freshModule();
    seed({ savedAt: Date.now(), step: -5, draft: emptyDraft('svc-1') });
    expect(getDraftSnapshot()?.step).toBe(1);
  });
});

describe('menghapus draft', () => {
  it('mengosongkan penyimpanan sekaligus singgahannya', async () => {
    const { clearDraft, emptyDraft, getDraftSnapshot } = await freshModule();
    seed({ savedAt: Date.now(), step: 3, draft: emptyDraft('svc-1') });
    expect(getDraftSnapshot()).not.toBeNull();

    clearDraft();

    // Singgahan wajib ikut kosong: tawaran pemulihan membacanya, dan yang sudah
    // ditolak — atau yang pesanannya sudah terkirim — tidak boleh muncul lagi.
    expect(window.sessionStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(getDraftSnapshot()).toBeNull();
  });
});

describe('menulis draft', () => {
  it('menyimpan isian beserta langkah dan penanda waktunya', async () => {
    const { emptyDraft, saveDraft } = await freshModule();
    saveDraft({ ...emptyDraft('svc-1'), name: 'Budi' }, 2);

    const raw = JSON.parse(window.sessionStorage.getItem(DRAFT_KEY) ?? '{}');
    expect(raw.draft.name).toBe('Budi');
    expect(raw.step).toBe(2);
    expect(typeof raw.savedAt).toBe('number');
  });

  it('tidak melempar ketika penyimpanan ditolak peramban', async () => {
    const { emptyDraft, saveDraft } = await freshModule();
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    // Penyimpanan penuh atau dimatikan di setelan. Pemesan tetap harus bisa
    // menyelesaikan pesanannya — yang hilang cuma jaring pengamannya.
    expect(() => saveDraft(emptyDraft('svc-1'), 1)).not.toThrow();
    setItem.mockRestore();
  });
});

describe('snapshot untuk render di server', () => {
  it('selalu null, supaya hidrasi tidak berbeda dari HTML server', async () => {
    const { getDraftServerSnapshot } = await freshModule();
    expect(getDraftServerSnapshot()).toBeNull();
  });

  it('mengembalikan objek yang sama persis pada pembacaan berulang', async () => {
    const { emptyDraft, getDraftSnapshot } = await freshModule();
    seed({ savedAt: Date.now(), step: 3, draft: emptyDraft('svc-1') });

    // Wajib identik menurut `Object.is` — `useSyncExternalStore` memanggil
    // `getSnapshot` tiap render dan membandingkannya begitu. Objek baru tiap
    // panggilan terbaca sebagai "berubah lagi": render tak berujung.
    expect(getDraftSnapshot()).toBe(getDraftSnapshot());
  });
});
