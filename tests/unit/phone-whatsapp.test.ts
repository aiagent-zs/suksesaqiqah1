import { describe, expect, it } from 'vitest';
import { toWhatsAppNumber, whatsAppHref } from '@/lib/format/phone';

/**
 * Nomor pemesan datang dari form checkout publik, yang hanya menuntut
 * `^[0-9+()\-\s]{8,20}$`. Bentuknya karena itu beragam, dan tautan wa.me hanya
 * menerima digit berkode negara tanpa `+`.
 */
describe('toWhatsAppNumber', () => {
  it('menormalkan awalan 0 menjadi 62', () => {
    expect(toWhatsAppNumber('081234567890')).toBe('6281234567890');
  });

  it('membuang pemisah yang biasa diketik pemesan', () => {
    expect(toWhatsAppNumber('0812-3456-7890')).toBe('6281234567890');
    expect(toWhatsAppNumber('+62 812 3456 7890')).toBe('6281234567890');
    expect(toWhatsAppNumber('(0812) 3456 7890')).toBe('6281234567890');
  });

  it('menerima nomor yang sudah berkode negara', () => {
    expect(toWhatsAppNumber('6281234567890')).toBe('6281234567890');
  });

  it('menambahkan kode negara pada nomor yang diawali 8', () => {
    expect(toWhatsAppNumber('81234567890')).toBe('6281234567890');
  });

  it('menolak yang tidak bisa dinormalkan alih-alih menebak', () => {
    // Tautan yang salah lebih buruk daripada tidak ada tautan: admin mengira
    // sudah menghubungi pemesan padahal chatnya tidak pernah terbuka.
    expect(toWhatsAppNumber('0812')).toBeNull();
    expect(toWhatsAppNumber('081234567890123456')).toBeNull();
    expect(toWhatsAppNumber('12345678')).toBeNull();
    expect(toWhatsAppNumber('')).toBeNull();
    expect(toWhatsAppNumber(null)).toBeNull();
    expect(toWhatsAppNumber('   ')).toBeNull();
  });
});

describe('whatsAppHref', () => {
  it('membangun tautan wa.me tanpa pesan', () => {
    expect(whatsAppHref('081234567890')).toBe('https://wa.me/6281234567890');
  });

  it('meng-encode pesan agar spasi & tanda baca tidak merusak URL', () => {
    const href = whatsAppHref('081234567890', 'Order IA-202608-0001 & jadwal');

    expect(href).toContain('https://wa.me/6281234567890?text=');
    expect(href).toContain('IA-202608-0001');
    expect(href).not.toContain(' ');
    expect(href).not.toContain('&j');
  });

  it('mengembalikan null bila nomornya tidak bisa dipakai', () => {
    expect(whatsAppHref(null)).toBeNull();
    expect(whatsAppHref('0812')).toBeNull();
  });
});
