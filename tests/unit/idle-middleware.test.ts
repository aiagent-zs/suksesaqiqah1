import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ACTIVITY_COOKIE, IDLE_TIMEOUT_MS, parseActivity } from '@/lib/auth/idle';

/**
 * Menguji penegakan idle di middleware — lapis yang benar-benar menentukan
 * keamanannya, karena berlaku juga saat JavaScript dimatikan.
 *
 * Klien Supabase-nya dipalsukan: yang diuji keputusan middleware (mencabut
 * sesi / mengalihkan / menyegarkan cap waktu), bukan pustaka autentikasinya.
 */
const signOut = vi.fn();
let currentUser: { id: string } | null = { id: 'user-1' };

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: currentUser } }),
      signOut,
    },
  }),
}));

vi.mock('@/lib/supabase/env', () => ({
  supabaseUrl: () => 'http://localhost:54321',
  supabaseAnonKey: () => 'test-key',
}));

const { updateSession } = await import('@/lib/supabase/middleware');

const NOW = 1_760_000_000_000;

function request(
  path: string,
  options: { activity?: number | string; headers?: Record<string, string> } = {},
) {
  const headers = new Headers(options.headers ?? {});
  if (options.activity !== undefined) {
    headers.set('cookie', `${ACTIVITY_COOKIE}=${options.activity}`);
  }
  return new NextRequest(new URL(`http://localhost${path}`), { headers });
}

/** Cap waktu aktivitas yang ditulis response, kalau ada. */
function writtenActivity(response: Response): number | null {
  const value = (
    response as unknown as { cookies: { get(name: string): { value: string } | undefined } }
  ).cookies.get(ACTIVITY_COOKIE)?.value;
  return parseActivity(value);
}

beforeEach(() => {
  signOut.mockClear();
  currentUser = { id: 'user-1' };
  // Hanya `Date` yang dibekukan — timer palsu penuh akan mengganggu penjadwalan
  // promise di dalam middleware. Tanpa ini kasus "tepat di ambang" tidak
  // deterministik: middleware memanggil Date.now() beberapa milidetik setelah
  // test menyusun cap waktunya.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('sesi yang sudah menganggur', () => {
  const stale = NOW - (IDLE_TIMEOUT_MS + 1000);

  it('dicabut lalu dialihkan ke /login dengan pemberitahuan', async () => {
    const response = await updateSession(request('/dashboard', { activity: stale }));

    expect(signOut).toHaveBeenCalledOnce();
    expect(response.status).toBe(307);

    const location = new URL(response.headers.get('location')!);
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('notice')).toBe('idle');
  });

  it('cookie penanda ikut dihapus, bukan dibiarkan basi', async () => {
    const response = await updateSession(request('/orders', { activity: stale }));
    const cookie = response.headers.get('set-cookie') ?? '';

    expect(cookie).toContain(ACTIVITY_COOKIE);
    // Dihapus = ditulis kosong dengan umur nol.
    expect(cookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/);
  });

  it('di halaman publik sesi tetap dicabut tanpa melempar ke /login', async () => {
    const response = await updateSession(request('/', { activity: stale }));

    expect(signOut).toHaveBeenCalledOnce();
    expect(response.status).not.toBe(307);
  });

  it('permintaan pramuat pun tidak lolos dari pencabutan', async () => {
    const response = await updateSession(
      request('/dashboard', { activity: stale, headers: { 'next-router-prefetch': '1' } }),
    );

    expect(signOut).toHaveBeenCalledOnce();
    expect(response.status).toBe(307);
  });
});

describe('sesi yang masih aktif', () => {
  it('diteruskan dan cap waktunya disegarkan', async () => {
    const response = await updateSession(request('/dashboard', { activity: NOW - 1000 }));

    expect(signOut).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(writtenActivity(response)).toBeGreaterThan(NOW - 1000);
  });

  it('tepat di ambang belum dikeluarkan', async () => {
    await updateSession(request('/dashboard', { activity: NOW - IDLE_TIMEOUT_MS }));

    expect(signOut).not.toHaveBeenCalled();
  });

  it('satu milidetik lewat ambang sudah dikeluarkan', async () => {
    await updateSession(request('/dashboard', { activity: NOW - IDLE_TIMEOUT_MS - 1 }));

    expect(signOut).toHaveBeenCalledOnce();
  });

  it('pramuat tautan tidak memperpanjang sesi', async () => {
    // Kalau pramuat ikut menyegarkan, halaman penuh tautan bisa membuat sesi
    // hidup terus tanpa ada yang menyentuh perangkat.
    const response = await updateSession(
      request('/dashboard', { activity: NOW - 1000, headers: { 'next-router-prefetch': '1' } }),
    );

    expect(writtenActivity(response)).toBeNull();
  });

  it('header purpose=prefetch juga diperlakukan sebagai pramuat', async () => {
    const response = await updateSession(
      request('/dashboard', { activity: NOW - 1000, headers: { purpose: 'prefetch' } }),
    );

    expect(writtenActivity(response)).toBeNull();
  });

  it('cookie yang belum ada dianggap awal sesi, bukan sudah menganggur', async () => {
    // Login baru saja menyetelnya; menindak ketiadaan cookie akan mengeluarkan
    // user tepat setelah ia berhasil masuk.
    const response = await updateSession(request('/dashboard'));

    expect(signOut).not.toHaveBeenCalled();
    expect(writtenActivity(response)).not.toBeNull();
  });

  it('cookie rusak tidak dipakai untuk mengeluarkan, tapi ditimpa yang baru', async () => {
    const response = await updateSession(request('/dashboard', { activity: 'kemarin-sore' }));

    expect(signOut).not.toHaveBeenCalled();
    expect(writtenActivity(response)).not.toBeNull();
  });
});

describe('pengunjung anonim', () => {
  beforeEach(() => {
    currentUser = null;
  });

  it('tidak menyentuh cap waktu aktivitas sama sekali', async () => {
    const response = await updateSession(request('/'));

    expect(signOut).not.toHaveBeenCalled();
    expect(writtenActivity(response)).toBeNull();
  });

  it('tetap dialihkan dari route terproteksi ke /login', async () => {
    const response = await updateSession(request('/dashboard'));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location')!).pathname).toBe('/login');
  });
});
