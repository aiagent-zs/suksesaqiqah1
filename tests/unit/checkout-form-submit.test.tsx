// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { CheckoutPackage, NasiBoxPackage, RegionOption } from '@/features/checkout/queries';
import { BOOKING_MIN_DAYS } from '@/features/checkout/schema';
import { addCalendarDays } from '@/lib/format/date-range';
import { formatCurrency } from '@/lib/format';

/**
 * Menjaga agar pesanan hanya terkirim lewat klik yang disengaja, dan agar
 * validasi seluruh isiannya tetap utuh di form satu halaman.
 */
// Tanda tangannya dinyatakan lewat parameter tipe `vi.fn` supaya
// `mock.calls[0][0]` bisa diperiksa.
type Action = (input: unknown) => Promise<{
  ok: true;
  data: {
    order_number: string;
    public_token: string;
    total_amount: number;
    status: 'new';
    payment_status: 'unpaid';
  };
}>;

const createGuestOrderAction = vi.fn<Action>(async () => ({
  ok: true,
  data: {
    order_number: 'IA-202608-9999',
    public_token: 'x'.repeat(32),
    total_amount: 2300000,
    status: 'new',
    payment_status: 'unpaid',
  },
}));

vi.mock('@/server/actions/checkout', () => ({ createGuestOrderAction }));

/**
 * Wilayah di bawah provinsi diambil pemilih alamat langsung dari Supabase.
 * Di sini jalurnya dipotong: yang diuji perilaku formnya, bukan PostgREST —
 * dan tanpa mock ini komponennya menuntut kredensial Supabase yang sungguhan.
 */
const REGION_CHILDREN: Record<string, RegionOption[]> = {
  '32': [{ code: '32.76', name: 'Kota Depok' }],
  '32.76': [{ code: '32.76.01', name: 'Pancoran Mas' }],
  '32.76.01': [{ code: '32.76.01.1007', name: 'Depok Jaya' }],
};

const fetchRegionChildren = vi.fn(async (parentCode: string) => REGION_CHILDREN[parentCode] ?? []);

vi.mock('@/features/checkout/regions', () => ({ fetchRegionChildren }));

const { CheckoutForm } = await import('@/features/checkout/components/checkout-form');

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const PACKAGES: CheckoutPackage[] = [
  {
    id: 'a2000000-0000-4000-8000-000000000001',
    type: 'aqiqah',
    name: 'Aqiqah Ekonomi',
    slug: 'aqiqah-ekonomi',
    description: null,
    price: 2300000,
    features: [],
  },
];
const NASI_BOXES: NasiBoxPackage[] = [
  {
    id: 'a2000000-0000-4000-8000-000000000011',
    name: 'Paket A',
    slug: 'paket-a',
    price: 21000,
    items: [],
  },
];
/**
 * Jendela tanggal datang sebagai prop dari server, jadi di sini cukup nilai
 * tetap — tesnya tidak ikut bergeser tiap hari.
 */
const PROVINCES: RegionOption[] = [{ code: '32', name: 'Jawa Barat' }];

/** Hari pengisian form. Batas atas tanggal lahir anak, bukan batas pemesanan. */
const TODAY = '2026-08-15';
/**
 * Batas bawah pemesanan: `TODAY` + jeda persiapan.
 *
 * Diturunkan dari `BOOKING_MIN_DAYS`, bukan tanggal yang diketik: keduanya
 * pernah dipatok terpisah, dan saat jedanya berubah 4 → 1 yang basi bukan cuma
 * angkanya — komentar di sebelahnya ikut menyesatkan pembaca berikutnya.
 */
const MIN_DATE = addCalendarDays(TODAY, BOOKING_MIN_DAYS);
const MAX_DATE = '2026-09-14';
const PICKED_DATE = '2026-08-21';
const PICKED_TIME = '09:00';
/** Tanggal lahir anak — harus <= `TODAY`, karena batas atasnya hari ini. */
const CHILD_BIRTH_DATE = '2026-01-15';

let root: Root | null = null;
let container: HTMLElement | null = null;

function mount() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      <CheckoutForm
        packages={PACKAGES}
        nasiBoxes={NASI_BOXES}
        provinces={PROVINCES}
        minDate={MIN_DATE}
        maxDate={MAX_DATE}
        today={TODAY}
      />,
    );
  });
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} tidak ditemukan`);
  return el as T;
}

function type(id: string, value: string) {
  const el = byId<HTMLInputElement | HTMLTextAreaElement>(id);
  const proto = Object.getPrototypeOf(el);
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  act(() => {
    setter?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function pickOption(id: string, value: string) {
  const el = byId<HTMLSelectElement>(id);
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(el, value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

/**
 * Tunggu permintaan wilayah selesai dan React selesai me-render ulang.
 *
 * `act` sinkron tidak cukup: isi tiap tingkat datang dari promise, jadi tanpa
 * ini `<option>`-nya belum terpasang saat hendak dipilih.
 */
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function clickText(label: string) {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(label));
  if (!btn) throw new Error(`tombol "${label}" tidak ditemukan`);
  act(() => btn.click());
}

/**
 * Menekan Enter, lalu melaporkan apakah aksi bawaannya dibatalkan.
 *
 * jsdom tidak mengimplementasikan pengiriman form implisit, jadi "action tidak
 * terpanggil" saja bukan bukti. Yang menentukan `defaultPrevented`.
 */
function pressEnter(id: string): { defaultPrevented: boolean } {
  const el = byId(id);
  const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  act(() => {
    el.dispatchEvent(event);
  });
  return { defaultPrevented: event.defaultPrevented };
}

/**
 * jsdom tidak mengimplementasikan `scrollIntoView` sama sekali — memanggilnya
 * melempar TypeError. Form memakainya untuk membawa perhatian ke medan yang
 * ditolak, jadi tiap tes yang memajukan jam sesudah galat akan menabraknya.
 * Yang diuji di sini perpindahan langkah & fokusnya, bukan pengguliran.
 */
Element.prototype.scrollIntoView = vi.fn();
// Sama halnya `window.scrollTo`: jsdom hanya mencetak "Not implemented".
window.scrollTo = vi.fn() as typeof window.scrollTo;

function advanceClock(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** Isi seluruh form dengan isian sah (Aqiqah Salur, tanpa alamat). */
function fillValid() {
  clickText('Anak Laki-laki');
  type('co-date', PICKED_DATE);
  clickText(PICKED_TIME);
  clickText('Aqiqah Salur');
  type('co-name', 'Budi Santoso');
  type('co-phone', '081234567890');
  type('co-email', 'budi@example.com');
  type('co-child', 'Fatih');
  type('co-birthplace', 'Bandung');
  type('co-birthdate', CHILD_BIRTH_DATE);
}

/**
 * Periksa, lalu kirim bila layar periksa terbuka.
 *
 * Isian yang ditolak tidak pernah membuka layar periksa, jadi tes galat
 * validasi tetap berhenti di klik pertama.
 */
function submit() {
  clickText('Periksa Pesanan');
  const send = [...document.querySelectorAll('button')].find((b) =>
    b.textContent?.includes('Kirim Pesanan'),
  );
  if (send) act(() => send.click());
}

beforeEach(() => {
  createGuestOrderAction.mockClear();
  fetchRegionChildren.mockClear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(1_760_000_000_000);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.useRealTimers();
});

describe('satu halaman', () => {
  it('seluruh bagian tampil sekaligus, tanpa langkah', () => {
    // Wizard empat langkah dicabut 9 November: pemesan menekan "Lanjut" tiga
    // kali hanya untuk melihat apa yang masih diminta.
    mount();
    const text = document.body.textContent ?? '';

    expect(text).toContain('Aqiqah untuk siapa');
    expect(text).toContain('Aqiqah Ekonomi');
    expect(text).toContain('Tambah nasi box');
    expect(text).toContain('Jumlah ekor');
    for (const id of ['co-date', 'co-name', 'co-child', 'co-referral', 'co-notes']) {
      expect(document.getElementById(id), id).not.toBeNull();
    }
    expect(text).not.toContain('Lanjut ke');
    expect(document.querySelector('[aria-current="step"]')).toBeNull();
  });

  it('memilih anak laki-laki menganjurkan 2 ekor, perempuan 1 ekor', () => {
    mount();
    clickText('Anak Laki-laki');
    expect(document.body.textContent).toContain('Anjuran untuk anak laki-laki: 2 ekor');

    clickText('Anak Perempuan');
    expect(document.body.textContent).toContain('Anjuran untuk anak perempuan: 1 ekor');
  });

  it('nasi box opsional: kolom jumlahnya baru muncul setelah paket box dipilih', () => {
    mount();
    expect(document.getElementById('co-boxqty')).toBeNull();
    fillValid();
    submit();
    expect(createGuestOrderAction).toHaveBeenCalledOnce();
  });

  it('memilih paket nasi box menuntut jumlahnya', () => {
    mount();
    fillValid();
    clickText('Paket A');
    expect(document.getElementById('co-boxqty')).not.toBeNull();
    type('co-boxqty', '0');
    submit();

    expect(document.body.textContent).toContain('Isi jumlah box');
    expect(createGuestOrderAction).not.toHaveBeenCalled();
  });

  it('Aqiqah Kirim memunculkan pemilih alamat dan mewajibkannya', () => {
    mount();
    fillValid();
    clickText('Aqiqah Kirim');

    for (const id of ['co-prov', 'co-city', 'co-dist', 'co-vill', 'co-postal', 'co-detail']) {
      expect(document.getElementById(id), id).not.toBeNull();
    }

    submit(); // alamat masih kosong
    const text = document.body.textContent ?? '';
    expect(text).toContain('Pilih provinsi tujuan');
    expect(text).toContain('Kode pos wajib diisi');
    expect(text).toContain('Isi nama jalan dan nomor rumah');
    expect(createGuestOrderAction).not.toHaveBeenCalled();
  });

  it('Aqiqah Salur tidak meminta alamat', () => {
    mount();
    clickText('Aqiqah Salur');
    expect(document.getElementById('co-prov')).toBeNull();
  });

  it('kirim yang ditolak menyebut SEMUA isian yang kurang sekaligus', () => {
    // Bedanya dengan wizard: dulu penolakan datang satu langkah demi satu
    // langkah. Sekarang satu tekan memperlihatkan seluruhnya.
    mount();
    submit();
    const text = document.body.textContent ?? '';

    expect(text).toContain('Pilih salah satu terlebih dahulu');
    expect(text).toContain('Pilih tanggal pelaksanaan');
    expect(text).toContain('Pilih cara penyaluran');
    expect(text).toContain('Nama pemesan wajib diisi');
    expect(text).toContain('Tempat lahir anak wajib diisi');
    expect(createGuestOrderAction).not.toHaveBeenCalled();
  });

  it('menahan pesanan selama data lahir anak belum lengkap', () => {
    mount();
    fillValid();
    type('co-birthplace', '');
    type('co-birthdate', '');
    submit();

    expect(document.body.textContent).toContain('Tempat lahir anak wajib diisi');
    expect(document.body.textContent).toContain('Isi tanggal lahir anak');
    expect(createGuestOrderAction).not.toHaveBeenCalled();
  });

  it('menolak tanggal lahir di masa depan sekalipun diketik langsung', () => {
    mount();
    fillValid();
    // Atribut `max` hanya membantu pemilih tanggal peramban; nilainya tetap
    // bisa diketik, jadi penolakannya harus datang dari validasi.
    type('co-birthdate', '2027-01-01');
    submit();

    expect(document.body.textContent).toContain('Tanggal lahir tidak boleh di masa depan');
    expect(createGuestOrderAction).not.toHaveBeenCalled();
  });
});

describe('jumlah nasi box mengikuti schema server', () => {
  it.each([
    ['2.5', 'Jumlah nasi box harus bilangan bulat'],
    ['99999', 'Untuk pesanan di atas 5000 box, hubungi admin'],
    ['-5', 'Jumlah nasi box tidak boleh negatif'],
  ])('menolak %s box', (value, message) => {
    mount();
    fillValid();
    clickText('Paket A');
    type('co-boxqty', value);
    // Total tidak boleh dihitung dari jumlah yang akan ditolak server: yang
    // terhitung hanya 2 ekor paket aqiqah.
    const total = [...document.querySelectorAll('[aria-live="polite"]')].find((el) =>
      el.textContent?.includes(formatCurrency(2 * PACKAGES[0].price)),
    );
    expect(total, 'total memuat jumlah box yang tidak sah').toBeTruthy();
    submit();
    expect(document.body.textContent).toContain(message);
    expect(createGuestOrderAction).not.toHaveBeenCalled();
  });
});

describe('pengiriman pesanan hanya lewat klik yang disengaja', () => {
  it('mengisi seluruh form tidak mengirim apa pun', () => {
    mount();
    fillValid();
    expect(createGuestOrderAction).not.toHaveBeenCalled();
  });

  it('Enter di kolom isian dibatalkan, jadi tidak mengirim pesanan', () => {
    mount();
    fillValid();
    type('co-referral', 'SA-BUDI');

    expect(pressEnter('co-referral').defaultPrevented).toBe(true);
    expect(pressEnter('co-name').defaultPrevented).toBe(true);
    expect(createGuestOrderAction).not.toHaveBeenCalled();
  });

  it('Enter di catatan tidak dibatalkan — textarea butuh baris baru', () => {
    mount();
    expect(pressEnter('co-notes').defaultPrevented).toBe(false);
  });

  it('mengirim form secara implisit tidak pernah mencatat pesanan', () => {
    mount();
    fillValid();
    const form = document.querySelector('form')!;
    act(() => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(createGuestOrderAction).not.toHaveBeenCalled();
  });

  it('tombol periksa bertipe button, bukan submit', () => {
    mount();
    const btn = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Periksa Pesanan'),
    )!;
    expect(btn.type).toBe('button');
  });

  it('payload memuat seluruh medannya', () => {
    mount();
    fillValid();
    submit();

    const payload = createGuestOrderAction.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(payload.aqiqah_for).toBe('laki_laki');
    expect(payload.distribution_mode).toBe('salur');
    expect(payload.child_name).toBe('Fatih');
    expect(payload.child_birth_place).toBe('Bandung');
    expect(payload.child_birth_date).toBe(CHILD_BIRTH_DATE);
    expect(payload.email).toBe('budi@example.com');
    expect(payload.requested_date).toBe(PICKED_DATE);
    expect(payload.requested_time).toBe(PICKED_TIME);
  });

  it('tidak mengirim cabang — wilayah ditentukan server', () => {
    mount();
    fillValid();
    submit();

    const payload = createGuestOrderAction.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(payload).not.toHaveProperty('branch_id');
  });
});

describe('jadwal pelaksanaan', () => {
  it('menahan pesanan selama tanggal atau jam belum dipilih', () => {
    mount();
    fillValid();
    type('co-date', '');
    // Jam tidak bisa dikosongkan lewat klik, jadi diuji dari form segar.
    submit();
    expect(document.body.textContent).toContain('Pilih tanggal pelaksanaan');

    act(() => root!.unmount());
    container!.remove();
    mount();
    submit();
    expect(document.body.textContent).toContain('Pilih jam pelaksanaan');
  });

  it('membatasi pemilih tanggal pada jendela yang diberikan server', () => {
    mount();
    const input = byId<HTMLInputElement>('co-date');

    expect(input.min).toBe(MIN_DATE);
    expect(input.max).toBe(MAX_DATE);
  });

  it('menolak tanggal di luar jendela sekalipun diketik langsung', () => {
    mount();
    fillValid();
    type('co-date', '2026-10-30');
    submit();

    expect(document.body.textContent).toContain('Maksimal 30 hari ke depan');
  });

  it('menolak tanggal yang belum melewati jeda persiapan', () => {
    // Yang paling mungkin dicoba pemesan: hari ini sendiri. Bukan tanggal yang
    // lewat, jadi pesannya harus soal jeda — bukan "sudah lewat".
    mount();
    fillValid();
    type('co-date', TODAY);
    submit();

    expect(document.body.textContent).toContain(
      `Paling cepat ${BOOKING_MIN_DAYS} hari setelah pemesanan`,
    );
    expect(document.body.textContent).not.toContain('sudah lewat');
  });

  it('tanggal lahir anak diukur terhadap hari ini, bukan batas bawah pemesanan', () => {
    // Keduanya dulu satu prop karena nilainya kebetulan sama. Kalau tertukar
    // lagi, tanggal lahir sampai `MIN_DATE` ikut lolos — padahal hari-hari itu
    // belum terjadi.
    mount();
    expect(byId<HTMLInputElement>('co-date').min).toBe(MIN_DATE);
    expect(byId<HTMLInputElement>('co-birthdate').max).toBe(TODAY);
  });
});

describe('pemilih alamat bertingkat', () => {
  async function openDelivery() {
    mount();
    clickText('Aqiqah Kirim');
    await flush();
  }

  it('mengisi tiap tingkat hanya setelah induknya dipilih', async () => {
    await openDelivery();

    // Selama provinsi belum dipilih, tidak ada permintaan sama sekali dan
    // tingkat di bawahnya dimatikan.
    expect(fetchRegionChildren).not.toHaveBeenCalled();
    expect(byId<HTMLSelectElement>('co-city').disabled).toBe(true);

    pickOption('co-prov', '32');
    await flush();
    expect(fetchRegionChildren).toHaveBeenCalledWith('32');
    expect(byId<HTMLSelectElement>('co-city').disabled).toBe(false);
    expect(document.body.textContent).toContain('Kota Depok');

    pickOption('co-city', '32.76');
    await flush();
    expect(document.body.textContent).toContain('Pancoran Mas');

    pickOption('co-dist', '32.76.01');
    await flush();
    expect(document.body.textContent).toContain('Depok Jaya');
  });

  it('mengganti provinsi mengosongkan tingkat di bawahnya', async () => {
    // Kalau tidak, kelurahan dari provinsi lama tertinggal dan menghasilkan
    // alamat yang tidak sejalur — baru ketahuan saat dikirim.
    await openDelivery();
    pickOption('co-prov', '32');
    await flush();
    pickOption('co-city', '32.76');
    await flush();
    pickOption('co-dist', '32.76.01');
    await flush();
    pickOption('co-vill', '32.76.01.1007');
    await flush();
    expect(byId<HTMLSelectElement>('co-vill').value).toBe('32.76.01.1007');

    pickOption('co-prov', '');
    await flush();
    for (const id of ['co-city', 'co-dist', 'co-vill']) {
      expect(byId<HTMLSelectElement>(id).value, id).toBe('');
    }
  });

  it('kode pos menolak huruf saat diketik', async () => {
    await openDelivery();
    type('co-postal', '4a0b1c2d5e');

    expect(byId<HTMLInputElement>('co-postal').value).toBe('40125');
  });

  it('mengirim kode wilayahnya saja, tanpa nama maupun alamat satu baris', async () => {
    mount();
    fillValid();
    clickText('Aqiqah Kirim');
    await flush();
    pickOption('co-prov', '32');
    await flush();
    pickOption('co-city', '32.76');
    await flush();
    pickOption('co-dist', '32.76.01');
    await flush();
    pickOption('co-vill', '32.76.01.1007');
    await flush();
    type('co-postal', '16431');
    type('co-detail', 'Jl. Cikutra Barat No. 12');
    submit();

    const payload = createGuestOrderAction.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(payload.delivery_province_code).toBe('32');
    expect(payload.delivery_city_code).toBe('32.76');
    expect(payload.delivery_district_code).toBe('32.76.01');
    expect(payload.delivery_village_code).toBe('32.76.01.1007');
    expect(payload.delivery_postal_code).toBe('16431');
    expect(payload.delivery_detail).toBe('Jl. Cikutra Barat No. 12');

    // Nama wilayah dibaca RPC dari `regions`; mengirimnya dari klien hanya
    // membuka celah nama yang tidak cocok dengan kodenya.
    for (const key of ['delivery', 'delivery_address', 'delivery_province', 'delivery_city']) {
      expect(payload, key).not.toHaveProperty(key);
    }
  });
});

/**
 * Umpan balik saat isian ditolak.
 *
 * Yang dijaga di sini bukan tampilannya, melainkan tiga hal yang mudah patah
 * diam-diam: galat harus **terdengar** (bukan cuma terlihat), ringkasannya
 * harus benar-benar **melompat** ke medannya, dan toast harus muncul **lagi**
 * pada kesalahan yang sama berturut-turut.
 */
describe('umpan balik galat', () => {
  const summary = () =>
    [...document.querySelectorAll('[role="alert"]')].find((el) =>
      el.textContent?.includes('perlu diperbaiki'),
    );

  it('menampilkan ringkasan berisi tiap medan yang ditolak, dengan nama yang terbaca', () => {
    mount();
    fillValid();
    type('co-phone', '');
    submit();

    expect(summary(), 'ringkasan galat tidak dirender').toBeTruthy();
    expect(summary()!.textContent).toContain('1 isian perlu diperbaiki');
    expect(summary()!.textContent).toContain('Nomor WhatsApp');
    expect(summary()!.textContent).not.toContain('phone');
  });

  it('menghitung jamak dengan benar', () => {
    mount();
    fillValid();
    type('co-date', '');
    type('co-name', '');
    type('co-email', '');
    submit();
    expect(summary()!.textContent).toContain('3 isian perlu diperbaiki');
  });

  it('galat per medan punya role="alert" dan tertaut ke inputnya', () => {
    mount();
    fillValid();
    type('co-date', '');
    submit();

    const input = byId<HTMLInputElement>('co-date');
    expect(input.getAttribute('aria-invalid')).toBe('true');

    // Tanpa tautan ini pembaca layar hanya mengumumkan "invalid" — pemakainya
    // tahu ada yang salah, tanpa pernah tahu apa.
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy, 'input tidak menunjuk pesan galatnya').toBeTruthy();
    const message = document.getElementById(describedBy!);
    expect(message, 'id yang ditunjuk aria-describedby tidak ada').toBeTruthy();
    expect(message!.getAttribute('role')).toBe('alert');
    expect(message!.textContent).toContain('Pilih tanggal pelaksanaan');
  });

  it('menekan baris ringkasan memfokuskan medannya', () => {
    mount();
    fillValid();
    type('co-phone', '');
    submit();

    const row = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Nomor WhatsApp'),
    );
    expect(row, 'baris ringkasan untuk medan yang ditolak tidak ada').toBeTruthy();
    byId('co-name').focus();
    act(() => row!.click());
    advanceClock(200);
    expect(document.activeElement?.id).toBe('co-phone');
  });

  it('galat pertama yang difokuskan mengikuti urutan bagian di layar', () => {
    mount();
    fillValid();
    type('co-email', ''); // bagian 3
    type('co-date', ''); // bagian 2
    submit();
    advanceClock(200);
    expect(document.activeElement?.id).toBe('co-date');
  });

  it('toast muncul lagi pada kesalahan yang sama berturut-turut', () => {
    mount();
    submit();
    expect(document.querySelector('[role="status"]'), 'toast tidak muncul').toBeTruthy();

    // Tutup, lalu ulangi kesalahan yang sama persis. Kalau kuncinya pesan (dan
    // bukan penghitung), React melihat nilai identik dan tidak memunculkan
    // apa pun — pemesan menekan tombol dan tampak tidak terjadi apa-apa.
    const close = [...document.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label') === 'Tutup pemberitahuan',
    );
    act(() => close!.click());
    expect(document.querySelector('[role="status"]')).toBeNull();

    submit();
    expect(document.querySelector('[role="status"]')).toBeTruthy();
  });

  it('toast hilang sendiri setelah 5 detik', () => {
    mount();
    submit();
    expect(document.querySelector('[role="status"]')).toBeTruthy();

    advanceClock(5000); // memicu animasi keluar
    advanceClock(300); // lalu benar-benar dilepas
    expect(document.querySelector('[role="status"]')).toBeNull();
  });

  it('ringkasan hilang begitu isiannya diperbaiki dan dikirim ulang', () => {
    mount();
    submit();
    expect(document.body.textContent).toContain('perlu diperbaiki');

    fillValid();
    submit();
    expect(summary(), 'ringkasan lama masih tersisa').toBeFalsy();
  });
});

/**
 * Layar sukses — jalur yang dipakai pemesan setelah ordernya tercatat.
 *
 * Sampai worker pengirim ada, percakapan yang dibuka pemesan sendiri adalah
 * satu-satunya jalur yang pasti sampai ke admin. Yang dijaga di sini bukan
 * susunan kata pesannya (itu urusan `order-message.test.ts`), melainkan bahwa
 * tautannya benar-benar terpasang dan membawa ringkasan yang **sedang dipesan**
 * — bukan medan kosong.
 */
describe('layar sukses', () => {
  async function submitOrder() {
    mount();
    fillValid();
    submit();
    await flush();
  }

  it('menampilkan nomor pesanan dari server', async () => {
    await submitOrder();
    expect(document.body.textContent).toContain('IA-202608-9999');
  });

  it('tombol WhatsApp membawa ringkasan pesanan yang sedang dibuat', async () => {
    await submitOrder();

    const link = [...document.querySelectorAll('a')].find((a) =>
      a.getAttribute('href')?.startsWith('https://wa.me/'),
    );
    expect(link, 'tautan WhatsApp tidak ditemukan di layar sukses').toBeTruthy();

    // `?text=` ter-encode; didekode dulu supaya yang diperiksa isinya, bukan
    // hasil `encodeURIComponent`-nya.
    const text = decodeURIComponent(new URL(link!.href).searchParams.get('text') ?? '');

    // Nomor pesanan: satu-satunya keping yang membuat admin bisa menemukan
    // barisnya di `/orders` tanpa bertanya balik.
    expect(text).toContain('IA-202608-9999');
    // Ringkasan diambil dari draft yang masih hidup di state — `clearDraft()`
    // hanya mengosongkan sessionStorage, bukan state komponen. Kalau kelak
    // keduanya tertukar, medan-medan ini yang pertama jadi kosong.
    expect(text).toContain('Aqiqah Ekonomi');
    expect(text).toContain('Budi Santoso');
    expect(text).toContain('Aqiqah Salur');
  });

  it('tidak pernah membocorkan `public_token` ke pesan WhatsApp', async () => {
    await submitOrder();

    const link = [...document.querySelectorAll('a')].find((a) =>
      a.getAttribute('href')?.startsWith('https://wa.me/'),
    );
    const text = decodeURIComponent(new URL(link!.href).searchParams.get('text') ?? '');

    // Token itu kunci baca laporan, dan pesan WhatsApp bisa diteruskan ke siapa
    // pun. Mock-nya memakai 32 huruf 'x' — kalau kelak ia ikut terangkut,
    // tes ini yang menangkapnya.
    expect(text).not.toContain('x'.repeat(32));
  });
});

/**
 * Layar periksa: isian yang sudah lolos validasi ditampilkan sendiri, dan
 * hanya dari sana pesanan dikirim.
 */
describe('layar periksa', () => {
  const sendButton = () =>
    [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Kirim Pesanan'));

  it('isian sah membuka layar periksa tanpa mengirim apa pun', () => {
    mount();
    fillValid();
    clickText('Periksa Pesanan');

    expect(createGuestOrderAction).not.toHaveBeenCalled();
    expect(document.getElementById('co-name')).toBeNull();
    const text = document.body.textContent ?? '';
    expect(text).toContain('Periksa sebelum dikirim');
    expect(text).toContain('Fatih');
    expect(text).toContain('Budi Santoso');
    expect(sendButton()).toBeTruthy();
  });

  it('isian yang ditolak tidak membuka layar periksa', () => {
    mount();
    clickText('Periksa Pesanan');
    expect(sendButton()).toBeUndefined();
    expect(document.getElementById('co-name')).not.toBeNull();
  });

  it('Kembali ke isian memunculkan form lagi dengan isiannya utuh', async () => {
    mount();
    fillValid();
    clickText('Periksa Pesanan');
    clickText('Kembali ke isian');
    advanceClock(50);
    await flush();

    expect((byId('co-name') as HTMLInputElement).value).toBe('Budi Santoso');
    expect(sendButton()).toBeUndefined();
  });

  it('galat server per medan membawa pemesan kembali ke medannya', async () => {
    createGuestOrderAction.mockResolvedValueOnce({
      ok: false,
      error: {
        message: 'Kode referral tidak dikenal',
        fields: { referral_code: 'Kode tidak dikenal' },
      },
    } as never);
    mount();
    fillValid();
    submit();
    await flush();
    advanceClock(200);
    await flush();

    expect(document.getElementById('co-referral')).not.toBeNull();
    expect(document.body.textContent).toContain('Kode tidak dikenal');
  });

  it('galat server tanpa medan tetap di layar periksa, di atas tombol kirim', async () => {
    createGuestOrderAction.mockResolvedValueOnce({
      ok: false,
      error: { message: 'Terlalu banyak percobaan, coba lagi sebentar' },
    } as never);
    mount();
    fillValid();
    submit();
    await flush();

    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      'Terlalu banyak percobaan',
    );
    expect(sendButton()).toBeTruthy();
  });
});
