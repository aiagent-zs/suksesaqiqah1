import { EMPTY_DELIVERY_ADDRESS, type DeliveryAddressValue } from './components/address-picker';

/**
 * Isian checkout yang dipegang form, beserta penyimpanan sementaranya.
 *
 * Dipisah dari komponennya supaya bentuk `Draft` dan aturan penyimpanannya
 * tinggal berdampingan — kalau medannya bertambah, yang harus ikut disesuaikan
 * (coerce & versi kunci) ada di berkas yang sama.
 */
export type Draft = {
  aqiqah_for: string;
  service_id: string;
  species: string;
  qty: number;
  nasi_box_service_id: string;
  nasi_box_qty: number;
  requested_date: string;
  requested_time: string;
  distribution_mode: string;
  child_name: string;
  bin_binti: string;
  child_birth_place: string;
  child_birth_date: string;
  name: string;
  phone: string;
  email: string;
  /** Alamat pengiriman terstruktur; kosong selama modenya bukan `kirim`. */
  delivery: DeliveryAddressValue;
  recipient_institution: string;
  referral_code: string;
  notes: string;
};

/**
 * Kunci penyimpanan. **Naikkan versinya bila bentuk `Draft` berubah** — draft
 * lama akan diabaikan seluruhnya, bukan dipaksa masuk ke bentuk yang baru.
 */
const DRAFT_KEY = 'sa-checkout-draft-v1';

/**
 * Umur draft. `sessionStorage` sudah hilang sendiri saat tab ditutup; batas ini
 * untuk tab yang dibiarkan terbuka berhari-hari — tanggal pelaksanaan yang
 * dipilih kemarin keburu lewat, dan memulihkannya justru membuat pemesan
 * menghadapi galat tanggal yang tidak ia mengerti asalnya.
 */
const DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/**
 * **`sessionStorage`, bukan `localStorage`** — dan itu keputusan privasi, bukan
 * selera. Isian ini memuat nama anak, tanggal lahir, nomor telepon, email, dan
 * alamat rumah. `localStorage` akan meninggalkan semuanya di perangkat sampai
 * ada yang menghapusnya — termasuk di komputer warnet atau ponsel pinjaman.
 * `sessionStorage` habis bersama tabnya, jadi yang dipulihkan hanya yang memang
 * masih dikerjakan orang yang sama.
 */
type StoredDraft = { savedAt: number; step: number; draft: Draft };

export function emptyDraft(serviceId: string): Draft {
  return {
    aqiqah_for: '',
    service_id: serviceId,
    species: 'kambing',
    qty: 1,
    nasi_box_service_id: '',
    nasi_box_qty: 0,
    // Sengaja kosong, bukan diisi hari ini: tanggal pelaksanaan adalah pilihan
    // yang harus disadari pemesan. Nilai awal yang sudah terisi akan lolos
    // begitu saja dan pesanan masuk untuk tanggal yang tidak pernah ia pilih.
    requested_date: '',
    requested_time: '',
    distribution_mode: '',
    child_name: '',
    bin_binti: '',
    child_birth_place: '',
    child_birth_date: '',
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
 * hilang (mis. `delivery`) membuat komponen menabrak `undefined` saat render —
 * halaman putih, di tengah pengisian, tanpa jejak penyebabnya.
 */
function coerceDraft(raw: unknown, fallback: Draft): Draft {
  if (!raw || typeof raw !== 'object') return fallback;
  const r = raw as Record<string, unknown>;
  const rawDelivery = (r.delivery ?? {}) as Record<string, unknown>;

  return {
    aqiqah_for: str(r.aqiqah_for, fallback.aqiqah_for),
    service_id: str(r.service_id, fallback.service_id),
    species: str(r.species, fallback.species),
    qty: num(r.qty, fallback.qty),
    nasi_box_service_id: str(r.nasi_box_service_id, fallback.nasi_box_service_id),
    nasi_box_qty: num(r.nasi_box_qty, fallback.nasi_box_qty),
    requested_date: str(r.requested_date, fallback.requested_date),
    requested_time: str(r.requested_time, fallback.requested_time),
    distribution_mode: str(r.distribution_mode, fallback.distribution_mode),
    child_name: str(r.child_name, fallback.child_name),
    bin_binti: str(r.bin_binti, fallback.bin_binti),
    child_birth_place: str(r.child_birth_place, fallback.child_birth_place),
    child_birth_date: str(r.child_birth_date, fallback.child_birth_date),
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
 * Membaca draft tersimpan. Mengembalikan `null` bila tidak ada, kedaluwarsa,
 * rusak, atau penyimpanannya tidak bisa diakses.
 *
 * Seluruh akses dibungkus `try/catch`: `sessionStorage` **melempar**, bukan
 * mengembalikan null, ketika penyimpanan situs dimatikan di setelan peramban.
 * Kegagalan memulihkan draft tidak boleh menjatuhkan halaman pemesanan.
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
      draft: coerceDraft(parsed.draft, emptyDraft('')),
      step: Math.max(1, Math.trunc(num(parsed.step, 1))),
    };
  } catch {
    return null;
  }
}

/**
 * Hasil pembacaan, disinggahkan **sekali** untuk seumur halaman.
 *
 * Wajib disinggahkan, bukan sekadar penghematan: `useSyncExternalStore`
 * memanggil `getSnapshot` pada tiap render dan membandingkan hasilnya dengan
 * `Object.is`. Mengurai JSON tiap kali menghasilkan objek baru terus-menerus,
 * yang dibaca React sebagai "nilainya berubah lagi" — render tak berujung.
 *
 * Efek sampingnya justru diinginkan: tawaran pemulihan tetap memperlihatkan
 * isian sebagaimana saat halaman dibuka, tidak ikut berubah ketika pemesan
 * mulai mengetik dan `saveDraft` menimpa isi penyimpanannya.
 */
let snapshot: StoredDraft | null | undefined;

export function getDraftSnapshot(): StoredDraft | null {
  if (snapshot === undefined) snapshot = readDraft();
  return snapshot;
}

/**
 * Di server tidak ada `sessionStorage`, jadi jawabannya selalu "tidak ada".
 *
 * Inilah yang membuat `useSyncExternalStore` tepat di sini: React memakai nilai
 * ini saat render di server dan saat hidrasi, lalu berpindah ke nilai klien
 * tanpa membuat HTML hasil hidrasi berbeda dari yang dikirim server.
 */
export function getDraftServerSnapshot(): StoredDraft | null {
  return null;
}

/**
 * Penyimpanan ini tidak berubah dari luar sepanjang hidup halaman — yang
 * menulisinya hanya halaman ini sendiri, dan singgahan di atas memang sengaja
 * tidak mengikutinya. Jadi tidak ada yang perlu dilanggan.
 */
export function subscribeDraft(): () => void {
  return () => {};
}

export function saveDraft(draft: Draft, step: number): void {
  try {
    const payload: StoredDraft = { savedAt: Date.now(), step, draft };
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // Penyimpanan penuh atau dimatikan. Pemesan tetap bisa menyelesaikan
    // pesanannya — yang hilang cuma jaring pengaman saat halaman dimuat ulang,
    // dan memberitahukannya di tengah pengisian tidak menolong siapa pun.
  }
}

export function clearDraft(): void {
  // Singgahannya ikut dikosongkan, bukan hanya penyimpanannya: tawaran
  // pemulihan membaca dari sini, dan yang sudah ditolak tidak boleh muncul lagi.
  snapshot = null;
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Sama seperti `saveDraft` — tidak ada yang bisa dilakukan pemesan soal ini.
  }
}
