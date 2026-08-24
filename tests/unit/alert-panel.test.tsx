// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AlertPanel } from '@/features/notifications/components/alert-panel';
import type { AlertItem } from '@/features/notifications/queries';

/**
 * Panel "Perlu Tindakan" di dashboard.
 *
 * Yang dijaga di sini bukan tampilannya, melainkan tiga hal yang diam-diam
 * berbahaya kalau patah: tombol WhatsApp harus **tidak** muncul untuk
 * notifikasi tanpa tautan sah (kalau tidak, admin menekan tombol yang membuka
 * WhatsApp ke nomor kosong), keadaan kosong harus tetap menjelaskan dirinya,
 * dan tiap baris harus membawa ke tempat tindakannya benar-benar bisa
 * dilakukan.
 */

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLElement | null = null;

function mount(alerts: AlertItem[]) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(<AlertPanel alerts={alerts} />);
  });
}

function alert(over: Partial<AlertItem> = {}): AlertItem {
  return {
    id: 'n1',
    orderId: 'o1',
    orderNumber: 'IA-202608-0001',
    channel: 'dashboard',
    status: 'queued',
    template: 'documentation_uploaded',
    title: 'Bukti baru menunggu validasi',
    detail: null,
    href: '/validation',
    recipient: '-',
    createdAt: '2026-08-24T03:00:00.000Z',
    waHref: null,
    ...over,
  };
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('AlertPanel', () => {
  it('menjelaskan dirinya saat kosong, bukan sekadar hilang', () => {
    // Panel yang menghilang saat kosong membuat admin bertanya-tanya apakah
    // fiturnya rusak atau memang tidak ada yang menunggu.
    mount([]);
    expect(document.body.textContent).toContain('Perlu Tindakan');
    expect(document.body.textContent).toContain('Tidak ada yang menunggu');
  });

  it('menyebut jumlahnya dan membawa ke tempat tindakannya', () => {
    mount([alert(), alert({ id: 'n2', template: 'issue_high', title: 'Kendala berat dilaporkan', href: '/orders/o1' })]);

    expect(document.body.textContent).toContain('Perlu Tindakan');
    const links = [...document.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toContain('/validation');
    expect(links).toContain('/orders/o1');
  });

  it('TIDAK merender tombol WA bila tautannya tidak ada', () => {
    // `waHref` bernilai null ketika nomornya tidak bisa dinormalkan. Tombol
    // yang tetap dirender akan membuka WhatsApp ke nomor kosong — dan admin
    // baru tahu setelah aplikasinya terbuka.
    mount([alert({ channel: 'whatsapp', template: 'report_ready', waHref: null })]);
    expect(document.body.textContent).not.toContain('Kirim WA');
  });

  it('merender tombol WA dengan tautan wa.me saat tersedia', () => {
    mount([
      alert({
        channel: 'whatsapp',
        template: 'report_ready',
        title: 'Laporan siap dikirim ke pemesan',
        waHref: 'https://wa.me/6281234567890?text=halo',
      }),
    ]);

    const wa = [...document.querySelectorAll('a')].find((a) =>
      a.getAttribute('href')?.startsWith('https://wa.me/'),
    );
    expect(wa, 'tombol WA tidak dirender').toBeTruthy();
    // Tautan keluar wajib punya `rel` — tanpa `noopener`, halaman tujuan bisa
    // menyentuh `window.opener`.
    expect(wa!.getAttribute('rel')).toContain('noopener');
    expect(wa!.getAttribute('target')).toBe('_blank');
  });

  it('menampilkan alasan penolakan supaya vendor tahu apa yang harus diperbaiki', () => {
    mount([
      alert({
        template: 'documentation_rejected',
        title: 'Bukti ditolak, vendor perlu mengunggah ulang',
        detail: 'Alasan: foto buram',
      }),
    ]);
    expect(document.body.textContent).toContain('Alasan: foto buram');
  });
});