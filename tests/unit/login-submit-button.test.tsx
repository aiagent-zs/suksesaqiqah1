// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

/**
 * Tombol kirim halaman login.
 *
 * Yang dijaga di sini satu hal, dan ia satu-satunya alasan berkas ini ada:
 * **selama form berjalan, tombolnya harus mengatakannya dan menolak klik
 * kedua.** Tanpa itu tidak ada bedanya antara "sedang diproses" dan "kliknya
 * tidak masuk", jadi orang menekannya lagi — mengirim permintaan login kedua
 * yang justru memperlambat, persis keluhan yang memicu perubahan ini.
 *
 * `useFormStatus` dipalsukan karena ia hanya punya nilai sungguhan di dalam
 * `<form action={...}>` sungguhan dengan Server Action di ujungnya. Yang diuji
 * di sini cabang tampilannya; bahwa hook-nya terpasang di komponen anak (bukan
 * di komponen yang merender `<form>`, di mana ia selalu `false`) terbaca dari
 * struktur berkasnya.
 */
const formStatus = { pending: false };

vi.mock('react-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-dom')>()),
  useFormStatus: () => formStatus,
}));

const { LoginSubmitButton } = await import('@/app/(auth)/login/submit-button');

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLElement | null = null;

function mount() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(<LoginSubmitButton />);
  });
  return container.querySelector('button') as HTMLButtonElement;
}

beforeEach(() => {
  formStatus.pending = false;
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('sebelum dikirim', () => {
  it('mengundang ditekan dan bisa ditekan', () => {
    const btn = mount();
    expect(btn.textContent).toBe('Masuk ke System');
    expect(btn.disabled).toBe(false);
  });

  it('bertipe submit supaya form tetap terkirim tanpa JavaScript', () => {
    // Halamannya Server Component; kalau tombol ini berhenti jadi `submit`,
    // form-nya diam-diam mati bagi siapa pun tanpa JS.
    expect(mount().type).toBe('submit');
  });
});

describe('selama dikirim', () => {
  it('mengatakan sedang memverifikasi', () => {
    formStatus.pending = true;
    expect(mount().textContent).toContain('Memverifikasi');
  });

  it('menolak klik kedua', () => {
    // Inti perubahannya: klik kedua selama permintaan pertama berjalan
    // menghasilkan permintaan login kedua, bukan mempercepat apa pun.
    formStatus.pending = true;
    expect(mount().disabled).toBe(true);
  });
});
