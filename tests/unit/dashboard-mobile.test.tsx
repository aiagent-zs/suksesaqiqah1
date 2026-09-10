// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { OpenOrdersCardList } from '@/features/dashboard/components/open-orders-table';
import type { OpenOrderRow } from '@/features/dashboard/queries';

/**
 * Dashboard di layar ponsel — terutama bagi mitra.
 *
 * ## Kenapa berkas ini ada
 *
 * Mitra bekerja dari lapangan, jadi ponsel adalah layar utamanya, bukan layar
 * cadangan. Dua hal membuat dashboard di sana lebih buruk daripada seharusnya:
 *
 *   1. **Baris nama peserta selalu berbunyi "-".** `participants_select`
 *      menuntut staf, jadi `participant_name` memang null bagi mitra — dan
 *      kartunya tetap merender ikon beserta satu baris kosong untuknya. Ruang
 *      terpakai tanpa menyampaikan apa pun, pada layar yang paling sempit.
 *   2. **Panel filter lebih tinggi daripada datanya.** Di 360px ketiga
 *      medannya menumpuk jadi ~200px, mendorong daftar order yang justru
 *      dicari orang ke bawah lipatan.
 *
 * Nama lokasi sungguhan di produksi — "Rumah Tahfidz Sukses Subulunnajjah ·
 * Ummi Aqiqah" — melampaui lebar 360px, jadi pembungkusan teksnya ikut dijaga.
 */
declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLElement | null = null;

function row(over: Partial<OpenOrderRow> = {}): OpenOrderRow {
  return {
    orderId: 'o1',
    orderNumber: 'IA-202609-0003',
    status: 'assigned',
    participantName: '-',
    vendorName: 'Ummi Aqiqah',
    locationName: 'Rumah Tahfidz Sukses Subulunnajjah',
    scheduledDate: '2026-09-10',
    ageDays: 2,
    animalsTotal: 1,
    animalsSlaughtered: 0,
    pctDocumentation: 0,
    openIssues: 0,
    maxSeverity: null,
    latestIssueTitle: null,
    ...over,
  } as OpenOrderRow;
}

function mount(rows: OpenOrderRow[]) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<OpenOrdersCardList rows={rows} />));
  return container;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('baris kosong tidak memakan ruang', () => {
  it('tidak merender baris peserta saat namanya "-"', () => {
    // Bentuk yang dilihat mitra: RLS menutup nama peserta, query memetakannya
    // jadi "-", dan kartunya dulu tetap menyediakan satu baris untuknya.
    const el = mount([row({ participantName: '-' })]);
    expect(el.textContent).not.toContain('- ');
    expect(el.querySelectorAll('.lucide-user')).toHaveLength(0);
  });

  it('tidak merender baris peserta saat namanya kosong', () => {
    const el = mount([row({ participantName: '' })]);
    expect(el.querySelectorAll('.lucide-user')).toHaveLength(0);
  });

  it('tetap menampilkannya untuk staf yang memang bisa melihatnya', () => {
    // Perbaikannya tidak boleh menyembunyikan nama yang sungguhan ada.
    const el = mount([row({ participantName: 'Udin Udin' })]);
    expect(el.textContent).toContain('Udin Udin');
    expect(el.querySelectorAll('.lucide-user')).toHaveLength(1);
  });
});

describe('teks panjang tidak keluar kartu', () => {
  it('nama lokasi panjang dibungkus, bukan dipotong', () => {
    // `truncate` akan memotong nama lokasi jadi "Rumah Tahfidz Sukses Sub…" —
    // mitra perlu tahu ke mana ia berangkat, jadi teksnya dibungkus.
    const el = mount([row()]);
    const wrapper = [...el.querySelectorAll('span')].find((s) =>
      s.textContent?.includes('Rumah Tahfidz'),
    );
    expect(wrapper?.className).toContain('break-words');
    expect(wrapper?.className).toContain('min-w-0');
  });

  it('ikonnya tidak ikut menyusut saat teksnya membungkus', () => {
    // Tanpa `shrink-0`, ikon 14px gepeng jadi garis begitu teks di sebelahnya
    // memenuhi baris.
    const el = mount([row()]);
    const icon = el.querySelector('.lucide-map-pin');
    expect(icon?.getAttribute('class')).toContain('shrink-0');
  });
});

describe('filter terlipat di ponsel', () => {
  const SRC = readFileSync('features/dashboard/components/dashboard-filters.tsx', 'utf8');
  const CSS = readFileSync('app/globals.css', 'utf8');

  it('memakai <details> bawaan, bukan state React', () => {
    // Tetap bisa dibuka meski JavaScript belum sempat termuat — dan form ini
    // memang GET native supaya bekerja tanpanya.
    expect(SRC).toContain('<details');
    expect(SRC).toContain('<summary');
  });

  it('membuka sendiri saat ada filter aktif', () => {
    // Panel tertutup yang diam-diam menyaring data adalah cara termudah
    // membuat orang mengira datanya hilang.
    expect(SRC).toMatch(/open=\{hasActiveFilter\}/);
  });

  it('ringkasannya hanya muncul di bawah lg', () => {
    expect(SRC).toMatch(/<summary[\s\S]{0,200}lg:hidden/);
  });

  it('isinya tetap terbuka di desktop meski ringkasannya disembunyikan', () => {
    // Inti jebakannya: `<details>` tertutup menyembunyikan isinya, dan di `lg`
    // ringkasannya tidak ada — tanpa aturan ini filternya mustahil dibuka di
    // desktop.
    expect(SRC).toContain('filter-collapsible');
    expect(CSS).toContain('details.filter-collapsible > :not(summary)');
    expect(CSS).toContain('::details-content');
  });
});
