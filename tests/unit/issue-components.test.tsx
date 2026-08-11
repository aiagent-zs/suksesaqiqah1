// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { IssueRow, IssueSummary } from '@/features/issues/queries';

/**
 * Menguji panel riwayat kendala + dialog formnya.
 *
 * Server Action-nya dipalsukan: yang diperiksa perilaku UI (apa yang tampil,
 * apa yang terkirim), sementara aturan servernya — RLS, constraint
 * `resolved_at`, penguncian optimistik — sudah diuji terhadap database
 * sungguhan secara terpisah.
 */
// Tanda tangannya dinyatakan lewat parameter tipe `vi.fn`, bukan lewat argumen
// yang tidak dipakai: tanpa itu TypeScript menganggap action-nya tidak menerima
// apa pun, sehingga `mock.calls[0][0]` tidak bisa diperiksa.
type Action<T> = (input: unknown) => Promise<{ ok: true; data: T }>;

const createIssueAction = vi.fn<Action<{ id: string }>>(async () => ({
  ok: true,
  data: { id: 'new-id' },
}));
const updateIssueAction = vi.fn<Action<null>>(async () => ({ ok: true, data: null }));
const updateIssueStatusAction = vi.fn<Action<null>>(async () => ({ ok: true, data: null }));
const refresh = vi.fn();

vi.mock('@/server/actions/issues', () => ({
  createIssueAction,
  updateIssueAction,
  updateIssueStatusAction,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { IssueListPanel } = await import('@/features/issues/components/issue-list-panel');

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const ORDER_ID = '3f1a9c62-5f4b-4c1e-9a2d-8e7b6c5d4a3f';

const OPEN_ISSUE: IssueRow = {
  id: 'issue-1',
  title: 'Timbangan hewan rusak',
  description: 'Berat diestimasi manual.',
  severity: 'medium',
  status: 'in_progress',
  reporterName: 'Eko Petugas',
  resolverName: null,
  createdAt: '2026-08-07T08:23:39.509Z',
  resolvedAt: null,
};

function summaryOf(rows: IssueRow[]): IssueSummary {
  const open = rows.filter((r) => r.status !== 'resolved');
  return {
    rows,
    openCount: open.length,
    maxOpenSeverity: open[0]?.severity ?? null,
  };
}

let root: Root | null = null;
let container: HTMLElement | null = null;

function mount(rows: IssueRow[], canManage = true) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      <IssueListPanel orderId={ORDER_ID} summary={summaryOf(rows)} canManage={canManage} />,
    );
  });
}

/** Cari tombol berdasarkan teksnya di seluruh dokumen (dialog lewat portal). */
function button(label: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === label);
}

function click(el: Element | undefined) {
  if (!el) throw new Error('Elemen tidak ditemukan');
  act(() => (el as HTMLElement).click());
}

function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  // React memasang setter-nya sendiri di prototype; menulis lewat itu supaya
  // onChange benar-benar terpanggil.
  const proto = Object.getPrototypeOf(el);
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  act(() => {
    setter?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(() => {
  createIssueAction.mockClear();
  updateIssueAction.mockClear();
  updateIssueStatusAction.mockClear();
  refresh.mockClear();
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('IssueListPanel — riwayat', () => {
  it('menampilkan keadaan kosong saat belum ada kendala', () => {
    mount([]);

    expect(document.body.textContent).toContain('Belum ada kendala tercatat');
  });

  it('meringkas jumlah kendala terbuka beserta keparahan terberatnya', () => {
    mount([OPEN_ISSUE]);

    expect(document.body.textContent).toContain('1 kendala terbuka');
    expect(document.body.textContent).toContain('terberat sedang');
  });

  it('menampilkan isi kendala dan siapa pelapornya', () => {
    mount([OPEN_ISSUE]);

    const text = document.body.textContent ?? '';
    expect(text).toContain('Timbangan hewan rusak');
    expect(text).toContain('Berat diestimasi manual.');
    expect(text).toContain('Eko Petugas');
  });

  it('hanya menawarkan status selain yang sedang berlaku', () => {
    // Menulis ulang status yang sama ditolak server; menawarkannya di UI hanya
    // menghasilkan tombol yang pasti gagal.
    mount([OPEN_ISSUE]);

    expect(button('Tandai selesai')).toBeDefined();
    expect(button('Buka kembali')).toBeDefined();
    expect(button('Tandai ditangani')).toBeUndefined();
  });

  it('mengirim perpindahan status ke action', () => {
    mount([OPEN_ISSUE]);
    click(button('Tandai selesai'));

    expect(updateIssueStatusAction).toHaveBeenCalledWith({
      id: 'issue-1',
      status: 'resolved',
    });
  });

  it('tidak menawarkan aksi apa pun bagi role tanpa hak', () => {
    mount([OPEN_ISSUE], false);

    expect(button('Laporkan kendala')).toBeUndefined();
    expect(button('Tandai selesai')).toBeUndefined();
    expect(button('Ubah')).toBeUndefined();
  });

  it('tidak menyediakan jalur hapus — tabelnya tanpa kebijakan RLS delete', () => {
    mount([OPEN_ISSUE]);

    expect(document.body.textContent).not.toContain('Hapus');
  });
});

describe('IssueDialog — laporkan kendala', () => {
  it('dialog tertutup sampai pemicunya ditekan', () => {
    mount([]);

    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('membuka form dengan medan yang diperlukan', () => {
    mount([]);
    click(button('Laporkan kendala'));

    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Judul kendala');
    expect(document.body.textContent).toContain('Tingkat keparahan');
  });

  it('tombol simpan mati sampai judulnya cukup panjang', () => {
    // Schema menolak judul di bawah 3 karakter; tombol mati mencegah
    // perjalanan ke server yang sudah pasti ditolak.
    mount([]);
    click(button('Laporkan kendala'));

    expect(button('Simpan kendala')?.disabled).toBe(true);

    const title = document.querySelector<HTMLInputElement>('#issue-new-title')!;
    setValue(title, 'Ab');
    expect(button('Simpan kendala')?.disabled).toBe(true);

    setValue(title, 'Air mati di lokasi');
    expect(button('Simpan kendala')?.disabled).toBe(false);
  });

  it('mengirim kendala baru beserta order_id-nya', () => {
    mount([]);
    click(button('Laporkan kendala'));

    setValue(document.querySelector<HTMLInputElement>('#issue-new-title')!, 'Air mati di lokasi');
    setValue(
      document.querySelector<HTMLTextAreaElement>('#issue-new-description')!,
      'Sudah koordinasi dengan RT.',
    );
    click(button('Simpan kendala'));

    expect(createIssueAction).toHaveBeenCalledWith({
      order_id: ORDER_ID,
      title: 'Air mati di lokasi',
      description: 'Sudah koordinasi dengan RT.',
      severity: 'medium',
    });
  });

  it('tidak mengirim status — kendala baru selalu lahir Terbuka', () => {
    mount([]);
    click(button('Laporkan kendala'));
    setValue(document.querySelector<HTMLInputElement>('#issue-new-title')!, 'Air mati di lokasi');
    click(button('Simpan kendala'));

    expect(createIssueAction.mock.calls[0][0]).not.toHaveProperty('status');
  });
});

describe('IssueDialog — ubah kendala', () => {
  it('terisi lebih dulu dengan data yang tersimpan', () => {
    mount([OPEN_ISSUE]);
    click(button('Ubah'));

    const title = document.querySelector<HTMLInputElement>('#issue-issue-1-title');
    expect(title?.value).toBe('Timbangan hewan rusak');
  });

  it('mengirim perubahan lewat action ubah, bukan action buat', () => {
    mount([OPEN_ISSUE]);
    click(button('Ubah'));

    setValue(
      document.querySelector<HTMLInputElement>('#issue-issue-1-title')!,
      'Timbangan sudah diganti',
    );
    click(button('Simpan perubahan'));

    expect(createIssueAction).not.toHaveBeenCalled();
    expect(updateIssueAction).toHaveBeenCalledWith({
      id: 'issue-1',
      title: 'Timbangan sudah diganti',
      description: 'Berat diestimasi manual.',
      severity: 'medium',
    });
  });

  it('tidak menyertakan status — penyelesaian adalah keputusan terpisah', () => {
    // Hanya jalur status yang boleh menulis resolved_by / resolved_at.
    mount([OPEN_ISSUE]);
    click(button('Ubah'));
    setValue(document.querySelector<HTMLInputElement>('#issue-issue-1-title')!, 'Judul terkoreksi');
    click(button('Simpan perubahan'));

    expect(updateIssueAction.mock.calls[0][0]).not.toHaveProperty('status');
  });
});
