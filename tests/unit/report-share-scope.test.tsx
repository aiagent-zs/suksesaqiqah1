// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReportListItem } from '@/features/reporting/queries';

// `ReportManager` Client Component: `useRouter` butuh router sungguhan, dan
// Server Action-nya menarik klien Supabase + `next/headers`. Yang diuji di sini
// bentuk markup-nya, bukan keduanya.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/server/actions/reports', () => ({
  generateReport: vi.fn(),
  markReportSent: vi.fn(),
}));

const { ReportManager } = await import('@/features/reporting/components/report-manager');

/**
 * Tautan publik peserta berhenti di staf.
 *
 * ## Kenapa berkas ini ada
 *
 * `ReportManager` dulu menyembunyikan **tombol** "Buat laporan" lewat
 * `canGenerate`, tapi blok "Tautan publik peserta" di bawahnya dirender untuk
 * semua role begitu ada ≥ 1 laporan — lengkap dengan URL `/r/{token}`, tombol
 * Salin, dan Kirim via WhatsApp.
 *
 * Vendor yang ditugaskan **bisa** sampai ke sana: `reports_select` memakai
 * `can_read_order`, yang bernilai true untuk vendor pemilik order. Token itu
 * membuka identitas dan alamat pemesan tanpa login — dan menghubungi pemesan
 * adalah urusan kami dengan pembeli, bukan pekerjaan vendor.
 *
 * Dua hal dijaga di sini, dan keduanya perlu:
 *
 *   1. Blok berbagi tidak dirender untuk yang tidak berhak.
 *   2. **Tokennya tidak ada di markup sama sekali.** Menyembunyikan tautan
 *      sambil tetap menyerahkan token ke komponen hanya memindahkan kebocoran
 *      dari layar ke HTML — masih terbaca lewat "view source".
 */
const TOKEN = 'rahasia-token-peserta-0001';

function report(): ReportListItem {
  return {
    id: 'r1',
    version: 1,
    generatedAt: '2026-09-07T03:00:00.000Z',
    generatedBy: 'Rani Admin',
    pdfUrl: null,
    sentAt: null,
  } as ReportListItem;
}

function render(opts: { canShare: boolean }) {
  return renderToStaticMarkup(
    createElement(ReportManager, {
      orderId: 'o1',
      // Cerminan halaman: token hanya diserahkan kepada yang berhak.
      publicToken: opts.canShare ? TOKEN : '',
      appUrl: 'https://contoh.test',
      reports: [report()],
      canGenerate: opts.canShare,
      canShare: opts.canShare,
      documentationReady: true,
      missingDocumentation: [],
    }),
  );
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('vendor (tidak berhak membagikan)', () => {
  const markup = () => render({ canShare: false });

  it('tidak melihat blok tautan publik', () => {
    expect(markup()).not.toContain('Tautan publik peserta');
  });

  it('tidak menerima tokennya di markup', () => {
    // Inti kebocorannya: bukan tombolnya, melainkan nilainya.
    expect(markup()).not.toContain(TOKEN);
  });

  it('tidak ditawari Salin tautan maupun Kirim via WhatsApp', () => {
    const m = markup();
    expect(m).not.toContain('Salin tautan');
    expect(m).not.toContain('wa.me');
  });

  it('tetap melihat daftar versi laporan', () => {
    // Yang dicabut hanya penyebarannya. Laporan itu bukti kerjanya sendiri,
    // jadi menyembunyikannya sekalian akan membuat panel ini kosong tanpa
    // alasan yang bisa dibaca.
    expect(markup()).toContain('Versi 1');
  });
});

describe('staf (berhak membagikan)', () => {
  const markup = () => render({ canShare: true });

  it('melihat tautan publik lengkap', () => {
    const m = markup();
    expect(m).toContain('Tautan publik peserta');
    expect(m).toContain(`https://contoh.test/r/${TOKEN}`);
  });

  it('dapat menyalin dan mengirimnya', () => {
    const m = markup();
    expect(m).toContain('Salin tautan');
    expect(m).toContain('wa.me');
  });
});
