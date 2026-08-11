// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { HEARTBEAT_INTERVAL_MS, IDLE_TIMEOUT_MS } from '@/lib/auth/idle';

/**
 * Membuktikan bahwa tab yang ditinggal benar-benar keluar sendiri — tanpa
 * seorang pun menekan apa pun.
 *
 * Yang diperiksa keputusan pengawasnya, bukan pencabutan sesinya: `logoutIdle`
 * dipalsukan, dan sisi servernya sudah diuji terpisah di `idle-middleware`.
 */
const logoutIdle = vi.fn();
vi.mock('@/server/actions/auth', () => ({ logoutIdle }));

const { IdleLogout } = await import('@/components/providers/idle-logout');

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLElement | null = null;
const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));

function mount() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(<IdleLogout />);
  });
}

/** Majukan waktu seolah tidak ada yang menyentuh perangkat. */
function idleFor(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** Perbuatan user sungguhan — gulir dianggap "sedang membaca". */
function userActs() {
  act(() => {
    window.dispatchEvent(new Event('scroll'));
  });
}

beforeEach(() => {
  logoutIdle.mockClear();
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  vi.useFakeTimers();
  try {
    window.localStorage.clear();
  } catch {
    // localStorage bisa ditolak; pengawasnya sudah menangani itu sendiri.
  }
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('user meninggalkan aplikasi', () => {
  it('belum dikeluarkan sebelum ambang terlewati', () => {
    mount();
    idleFor(IDLE_TIMEOUT_MS - 30_000);

    expect(logoutIdle).not.toHaveBeenCalled();
  });

  it('keluar sendiri setelah ambang terlewati, tanpa disentuh', () => {
    mount();
    idleFor(IDLE_TIMEOUT_MS + 30_000);

    expect(logoutIdle).toHaveBeenCalledOnce();
  });

  it('hanya keluar sekali walau waktunya terus berjalan', () => {
    // Redirect butuh waktu; pemeriksaan berikutnya tidak boleh memanggil ulang.
    mount();
    idleFor(IDLE_TIMEOUT_MS * 3);

    expect(logoutIdle).toHaveBeenCalledOnce();
  });

  it('tab yang tertidur lama langsung dikeluarkan saat waktunya diperiksa', () => {
    // Perbandingannya cap waktu absolut, bukan hitungan mundur, jadi laptop
    // yang ditidurkan berjam-jam tetap terdeteksi begitu timer jalan lagi.
    mount();
    idleFor(6 * 60 * 60 * 1000);

    expect(logoutIdle).toHaveBeenCalledOnce();
  });
});

describe('user masih memakai aplikasi', () => {
  it('tidak dikeluarkan selama masih ada perbuatan', () => {
    mount();

    // Beraktivitas sedikit sebelum tiap ambang, berulang kali.
    for (let i = 0; i < 4; i += 1) {
      idleFor(IDLE_TIMEOUT_MS - 30_000);
      userActs();
    }

    expect(logoutIdle).not.toHaveBeenCalled();
  });

  it('mengabari server lewat heartbeat supaya sesinya tidak basi', () => {
    // Inilah yang menjaga pengisi form panjang tetap masuk: ia aktif, tapi
    // tidak berpindah halaman, jadi server tidak melihat permintaan apa pun.
    mount();
    // Waktu dijalankan sedikit dulu sebelum user berbuat. Kalau perbuatannya
    // jatuh pada milidetik yang sama persis dengan mount, cap waktunya sama
    // dengan heartbeat terakhir dan tidak terhitung "ada aktivitas sejak itu" —
    // keadaan yang tidak pernah terjadi di pemakaian sungguhan.
    idleFor(5_000);
    userActs();
    idleFor(HEARTBEAT_INTERVAL_MS + 30_000);

    expect(fetchMock).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/api/session/heartbeat');
    expect(init.method).toBe('POST');
  });

  it('tidak mengirim heartbeat kalau tidak ada perbuatan sama sekali', () => {
    // Heartbeat yang jalan sendiri akan membuat sesi hidup selamanya.
    mount();
    idleFor(HEARTBEAT_INTERVAL_MS * 3);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('setelah komponen dilepas', () => {
  it('tidak ada lagi timer yang mengeluarkan user', () => {
    mount();
    act(() => root?.unmount());
    root = null;

    idleFor(IDLE_TIMEOUT_MS * 2);

    expect(logoutIdle).not.toHaveBeenCalled();
  });
});
