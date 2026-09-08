// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CurrencyInput, groupThousands } from '@/components/ui/currency-input';

/**
 * Input nominal rupiah berpemisah ribuan.
 *
 * ## Kenapa berkas ini ada
 *
 * Nominal pembayaran dulu memakai `type="number"`, yang **tidak mengizinkan
 * pemisah ribuan** — nilainya wajib angka yang sah, jadi yang terbaca operator
 * hanya `5600000` polos. Pada nominal jutaan itu sulit dibaca: `5600000` dan
 * `56000000` berbeda satu nol dan terlihat nyaris sama, sementara salah ketiknya
 * berakibat langsung — nominal ikut menentukan gate DP.
 *
 * Dua hal dijaga di sini, dan keduanya perlu:
 *
 *   1. Yang **terlihat** berformat (`5.600.000`).
 *   2. Yang **dikirim** tetap digit polos (`5600000`) — schema Zod dan server
 *      action tidak boleh sampai menerima titik, karena `z.coerce.number()`
 *      membaca "5.600.000" sebagai `NaN` dan penolakannya akan terbaca sebagai
 *      "nominal harus lebih dari 0" yang membingungkan.
 */
declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLElement | null = null;

function mount(value: string, onValueChange = vi.fn()) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(<CurrencyInput value={value} onValueChange={onValueChange} />);
  });
  return {
    input: container.querySelector('input') as HTMLInputElement,
    onValueChange,
  };
}

/** Ketik seperti orang sungguhan — lewat setter asli agar React mendengarnya. */
function type(input: HTMLInputElement, text: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('groupThousands', () => {
  it('menyisipkan titik tiap tiga digit', () => {
    expect(groupThousands('5600000')).toBe('5.600.000');
    expect(groupThousands('21000')).toBe('21.000');
    expect(groupThousands('500')).toBe('500');
  });

  it('kosong tetap kosong, bukan nol', () => {
    // `Number('')` bernilai 0; tanpa penjagaan ini, medan yang baru dikosongkan
    // seketika terisi "0" dan operator harus menghapusnya lagi.
    expect(groupThousands('')).toBe('');
  });
});

describe('yang terlihat berformat', () => {
  it('menampilkan pemisah ribuan', () => {
    expect(mount('5600000').input.value).toBe('5.600.000');
  });

  it('bukan type=number — sebab itu yang melarang pemisah ribuan', () => {
    const { input } = mount('5600000');
    expect(input.type).toBe('text');
    // Papan ketik ponsel tetap harus muncul sebagai angka.
    expect(input.inputMode).toBe('numeric');
  });
});

describe('yang dikirim tetap digit polos', () => {
  it('membuang titik yang diketik sendiri', () => {
    const { input, onValueChange } = mount('');
    type(input, '5.600.000');
    expect(onValueChange).toHaveBeenLastCalledWith('5600000');
  });

  it('membuang "Rp" dan spasi dari angka yang disalin', () => {
    // Menyalin nominal dari WhatsApp membawa serta satuan dan spasinya.
    const { input, onValueChange } = mount('');
    type(input, 'Rp 2.800.000');
    expect(onValueChange).toHaveBeenLastCalledWith('2800000');
  });

  it('menolak huruf tanpa menolak seluruh isian', () => {
    const { input, onValueChange } = mount('');
    type(input, '14abc00');
    expect(onValueChange).toHaveBeenLastCalledWith('1400');
  });

  it('mengosongkan medan mengirim string kosong, bukan "0"', () => {
    // `amount` di schema wajib > 0; mengirim "0" akan memunculkan galat
    // validasi pada medan yang sebenarnya cuma sedang dikosongkan.
    const { input, onValueChange } = mount('5600000');
    type(input, '');
    expect(onValueChange).toHaveBeenLastCalledWith('');
  });
});
