import { describe, expect, it } from 'vitest';
import { orderEmail } from '@/features/notifications/email';

/**
 * Email ke pemesan dirakit dari payload `notify_order_email`. Payload bertipe
 * `Json`, jadi `tsc` tidak menjaga bentuknya; yang dijaga di sini adalah isi
 * yang sampai ke kotak masuk pemesan.
 */
const APP = 'https://suksesaqiqah.test';
const TOKEN = 'x'.repeat(32);

const verified = {
  order_number: 'IA-202610-0001',
  public_token: TOKEN,
  participant_name: 'Budi',
  total_amount: 2800000,
  requested_date: '2026-10-25',
  requested_time: '09:00:00',
  is_catering: false,
  items: [{ name: 'Aqiqah Favorit', qty: 1 }],
};

describe('orderEmail', () => {
  it('konfirmasi memuat nomor, paket, jadwal, total, dan tautan pantau', () => {
    const mail = orderEmail('order_verified', verified, APP)!;
    expect(mail.subject).toBe('Pesanan IA-202610-0001 sudah kami terima');
    for (const part of [
      'Aqiqah Favorit (1)',
      '25 Okt 2026, 09:00 WIB',
      'Rp',
      `${APP}/r/${TOKEN}`,
    ]) {
      expect(mail.text).toContain(part);
      expect(mail.html).toContain(part.replace(/'/g, '&#39;'));
    }
  });

  it('email selesai membedakan aqiqah dan katering', () => {
    const aqiqah = orderEmail('order_completed', verified, APP)!;
    const katering = orderEmail('order_completed', { ...verified, is_catering: true }, APP)!;
    expect(aqiqah.text).toContain('ibadah aqiqah');
    expect(katering.text).toContain('pesanan katering');
    expect(katering.text).not.toContain('aqiqah Anda');
  });

  it('nama pemesan di-escape di HTML', () => {
    const mail = orderEmail(
      'order_verified',
      { ...verified, participant_name: '<b>Budi</b>' },
      APP,
    )!;
    expect(mail.html).not.toContain('<b>Budi</b>');
    expect(mail.html).toContain('&lt;b&gt;Budi&lt;/b&gt;');
  });

  it('payload tanpa nomor/token atau template asing -> null, bukan email rusak', () => {
    expect(orderEmail('order_verified', { ...verified, public_token: '' }, APP)).toBeNull();
    expect(orderEmail('order_verified', { ...verified, order_number: null }, APP)).toBeNull();
    expect(orderEmail('report_ready', verified, APP)).toBeNull();
  });

  it('medan kosong tidak bocor sebagai "undefined" atau "null"', () => {
    const mail = orderEmail('order_verified', { order_number: 'X-1', public_token: TOKEN }, APP)!;
    expect(mail.text).toContain('Bapak/Ibu');
    expect(mail.text).not.toMatch(/undefined|null|NaN/);
  });
});
