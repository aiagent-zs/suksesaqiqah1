// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OrderCardList, OrderTable } from '@/features/orders/components/order-table';
import type { OrderListRow } from '@/features/orders/queries';

/**
 * Angka uang & kontak peserta pada daftar order.
 *
 * ## Kenapa berkas ini ada
 *
 * `orders_select` memakai `can_read_order`, jadi mitra **memang membaca** baris
 * ordernya termasuk `total_amount` — kebijakan baris tidak bisa menahan satu
 * kolom. Selama ini daftar order dirender tanpa membedakan role sama sekali,
 * sehingga nilai order tampil di layar mitra padahal `payments` dan
 * `vendor_services` justru ditutup `is_staff()` untuk menyembunyikan margin.
 *
 * Yang dijaga: angkanya **tidak ada di markup**, bukan sekadar tak terlihat.
 * Menyembunyikannya lewat CSS menyisakan nilainya di HTML dan tetap terbaca
 * lewat "view source" — kekeliruan yang pernah terjadi pada token laporan dan
 * dijaga `report-share-scope.test.tsx`.
 */
function row(over: Partial<OrderListRow> = {}): OrderListRow {
  return {
    id: 'o1',
    order_number: 'IA-202609-0001',
    status: 'assigned',
    payment_status: 'paid',
    total_amount: 5_600_000,
    paid_amount: 5_600_000,
    created_at: '2026-09-01T03:00:00.000Z',
    participantName: 'Budi Santoso',
    participantPhone: '081234567890',
    locationName: 'Masjid Al-Ikhlas',
    picName: null,
    scheduledDate: null,
    animalsCount: 2,
    isGuest: false,
    guestVerifiedAt: null,
    ...over,
  } as OrderListRow;
}

const NOMINAL = '5.600.000';

describe('mitra tidak menerima angka uang', () => {
  const markup = () =>
    renderToStaticMarkup(createElement(OrderTable, { rows: [row()], canSeeFinance: false }));

  it('nominal tidak ada di markup sama sekali', () => {
    expect(markup()).not.toContain(NOMINAL);
  });

  it('kolom Nilai & Pembayaran tidak dirender', () => {
    const m = markup();
    expect(m).not.toContain('Nilai');
    expect(m).not.toContain('Pembayaran');
  });

  it('nama peserta ikut tertahan', () => {
    // Sudah null lewat RLS `participants_select`, tapi kolomnya dulu tetap
    // tampil berisi "-" di setiap baris — kolom kosong yang tidak menerangkan
    // apa pun.
    expect(markup()).not.toContain('Budi Santoso');
  });

  it('yang tersisa tetap berguna', () => {
    const m = markup();
    expect(m).toContain('IA-202609-0001');
    expect(m).toContain('Masjid Al-Ikhlas');
  });
});

describe('staf melihat semuanya', () => {
  it('nominal, peserta, dan kolomnya lengkap', () => {
    const m = renderToStaticMarkup(
      createElement(OrderTable, { rows: [row()], canSeeFinance: true }),
    );
    expect(m).toContain(NOMINAL);
    expect(m).toContain('Budi Santoso');
    expect(m).toContain('Nilai');
  });
});

describe('kartu mobile menahan hal yang sama', () => {
  it('batasnya identik di kedua breakpoint', () => {
    // Mitra membaca daftar ini dari lapangan lewat ponsel; batas yang berbeda
    // antar breakpoint berarti kebocoran yang hanya muncul di layar kecil.
    const m = renderToStaticMarkup(
      createElement(OrderCardList, { rows: [row()], canSeeFinance: false }),
    );
    expect(m).not.toContain(NOMINAL);
    expect(m).not.toContain('Budi Santoso');
    expect(m).toContain('IA-202609-0001');
  });
});
