import { EMPTY_DELIVERY_ADDRESS, type DeliveryAddressValue } from '@/features/checkout/address';

/** Satu baris pesanan dalam draft. */
export type DraftItem = {
  service_id: string;
  /** String, bukan number: ini isi `<input>`, dan "" berbeda dari 0. */
  qty: string;
};

export type CateringDraft = {
  items: DraftItem[];
  requested_date: string;
  requested_time: string;
  name: string;
  phone: string;
  email: string;
  delivery: DeliveryAddressValue;
  recipient_institution: string;
  referral_code: string;
  notes: string;
};

/**
 * Kunci penyimpanan — **sengaja berbeda nama, bukan sekadar versi dinaikkan.**
 *
 * `features/checkout/draft.ts` memakai `sa-checkout-draft-v1` beserta singgahan
 * tingkat-modul. Kunci yang sama akan memulihkan isian aqiqah ke dalam form
 * katering: bentuk `Draft`-nya berbeda, jadi `coerceDraft` akan menjatuhkan
 * sebagian medan ke nilai awal dan menyisakan sisanya — pemesan melihat form
 * setengah terisi dengan data yang tidak pernah ia ketik di halaman ini.
 */
const DRAFT_KEY = 'sa-catering-draft-v1';

/** Umur draft; alasannya sama dengan checkout aqiqah — tanggal keburu lewat. */
const DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/**
 * `sessionStorage`, bukan `localStorage` — keputusan privasi, sama seperti
 * checkout aqiqah. Isian ini memuat nama, nomor telepon, email, dan alamat
 * lengkap tujuan pengiriman. `localStorage` meninggalkan semuanya di perangkat
 * sampai ada yang menghapusnya, termasuk di komputer bersama.
 */
type StoredDraft = { savedAt: number; step: number; draft: CateringDraft };

export function emptyDraft(serviceId = ''): CateringDraft {
  return {
    // Satu baris kosong sejak awal: form dengan nol baris menampilkan daftar
    // kosong yang tidak jelas harus diapakan, sementara satu baris sudah
    // menunjukkan bentuk isiannya.
    items: [{ service_id: serviceId, qty: '' }],
    // Sengaja kosong, bukan hari ini: tanggal pengiriman harus pilihan yang
    // disadari pemesan. Nilai awal yang sudah terisi akan lolos begitu saja.
    requested_date: '',
    requested_time: '',
    name: '',
    phone: '',
    email: '',
    delivery: EMPTY_DELIVERY_ADDRESS,
    recipient_institution: '',
    referral_code: '',
    notes: '',
  };
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Menyusun ulang draft dari data yang **tidak dipercaya**.
 *
 * Isi `sessionStorage` bisa berasal dari versi form sebelum deploy terakhir,
 * atau disunting tangan lewat devtools. Tanpa penyaringan ini, satu medan yang
 * hilang membuat komponen menabrak `undefined` saat render — halaman putih di
 * tengah pengisian, tanpa jejak penyebabnya.
 *
 * `items` butuh perhatian lebih daripada medan lain: ia array, dan array yang
 * isinya bukan objek (atau bukan array sama sekali) akan meledak saat di-`map`.
 */
export function coerceDraft(raw: unknown, fallback: CateringDraft): CateringDraft {
  if (!raw || typeof raw !== 'object') return fallback;
  const r = raw as Record<string, unknown>;
  const rawDelivery = (r.delivery ?? {}) as Record<string, unknown>;

  const items = Array.isArray(r.items)
    ? r.items
        .filter((i): i is Record<string, unknown> => Boolean(i) && typeof i === 'object')
        .map((i) => ({ service_id: str(i.service_id, ''), qty: str(i.qty, '') }))
    : [];

  return {
    // Draft tanpa satu pun baris yang bisa dipulihkan tetap harus punya satu
    // baris kosong, supaya formnya tidak dirender tanpa isian sama sekali.
    items: items.length > 0 ? items : fallback.items,
    requested_date: str(r.requested_date, fallback.requested_date),
    requested_time: str(r.requested_time, fallback.requested_time),
    name: str(r.name, fallback.name),
    phone: str(r.phone, fallback.phone),
    email: str(r.email, fallback.email),
    delivery: {
      province_code: str(rawDelivery.province_code, ''),
      province_name: str(rawDelivery.province_name, ''),
      city_code: str(rawDelivery.city_code, ''),
      city_name: str(rawDelivery.city_name, ''),
      district_code: str(rawDelivery.district_code, ''),
      district_name: str(rawDelivery.district_name, ''),
      village_code: str(rawDelivery.village_code, ''),
      village_name: str(rawDelivery.village_name, ''),
      postal_code: str(rawDelivery.postal_code, ''),
      detail: str(rawDelivery.detail, ''),
    },
    recipient_institution: str(r.recipient_institution, fallback.recipient_institution),
    referral_code: str(r.referral_code, fallback.referral_code),
    notes: str(r.notes, fallback.notes),
  };
}

/**
 * Membaca draft tersimpan. `null` bila tidak ada, kedaluwarsa, rusak, atau
 * penyimpanannya tidak bisa diakses.
 *
 * Seluruh akses dibungkus `try/catch`: `sessionStorage` **melempar**, bukan
 * mengembalikan null, ketika penyimpanan situs dimatikan di setelan peramban.
 */
function readDraft(): StoredDraft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredDraft>;
    const savedAt = num(parsed.savedAt, 0);
    if (!savedAt || Date.now() - savedAt > DRAFT_MAX_AGE_MS) {
      clearDraft();
      return null;
    }

    return {
      savedAt,
      draft: coerceDraft(parsed.draft, emptyDraft()),
      step: Math.max(1, Math.trunc(num(parsed.step, 1))),
    };
  } catch {
    return null;
  }
}

/**
 * Hasil pembacaan, disinggahkan **sekali** untuk seumur halaman.
 *
 * Wajib disinggahkan: `useSyncExternalStore` memanggil `getSnapshot` pada tiap
 * render dan membandingkan hasilnya dengan `Object.is`. Mengurai JSON tiap kali
 * menghasilkan objek baru terus-menerus — render tak berujung.
 */
let snapshot: StoredDraft | null | undefined;

export function getDraftSnapshot(): StoredDraft | null {
  if (snapshot === undefined) snapshot = readDraft();
  return snapshot;
}

/** Di server tidak ada `sessionStorage`, jadi jawabannya selalu "tidak ada". */
export function getDraftServerSnapshot(): StoredDraft | null {
  return null;
}

/** Penyimpanan ini hanya ditulisi halaman ini sendiri; tidak ada yang perlu dilanggan. */
export function subscribeDraft(): () => void {
  return () => {};
}

export function saveDraft(draft: CateringDraft, step: number): void {
  try {
    const payload: StoredDraft = { savedAt: Date.now(), step, draft };
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // Penyimpanan penuh atau dimatikan. Pemesan tetap bisa menyelesaikan
    // pesanannya — yang hilang cuma jaring pengaman saat halaman dimuat ulang.
  }
}

export function clearDraft(): void {
  // Singgahannya ikut dikosongkan: tawaran pemulihan membaca dari sini, dan
  // yang sudah ditolak tidak boleh muncul lagi.
  snapshot = null;
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Sama seperti `saveDraft` — tidak ada yang bisa dilakukan pemesan soal ini.
  }
}
