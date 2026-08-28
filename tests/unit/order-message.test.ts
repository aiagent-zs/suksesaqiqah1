import { describe, expect, it } from 'vitest';
import { orderWhatsAppMessage } from '@/features/checkout/order-message';

/**
 * Pesan yang dibawa pemesan ke WhatsApp admin dari layar sukses checkout.
 *
 * Yang dijaga di sini bukan susunan katanya, melainkan dua hal yang punya
 * akibat nyata: nomor pesanan **harus** ada (tanpa itu admin tidak bisa
 * menemukan barisnya di `/orders` dan percakapan dimulai dengan bertanya
 * balik), dan medan kosong **tidak boleh** jadi baris kosong atau `undefined`
 * yang terbaca orang.
 */
const BASE = { orderNumber: 'IA-202608-0042', totalAmount: 2800000 };

describe('orderWhatsAppMessage', () => {
  it('selalu memuat nomor pesanan dan total', () => {
    const msg = orderWhatsAppMessage(BASE);
    expect(msg).toContain('IA-202608-0042');
    // Dicocokkan lewat digitnya saja: `formatCurrency` menyisipkan spasi
    // non-breaking setelah "Rp", dan tes yang mengeja spasi biasa akan merah
    // karena alasan yang tidak ada hubungannya dengan isi pesan.
    expect(msg).toMatch(/Rp\s?2\.800\.000/);
  });

  it('merangkum paket, nasi box, penyaluran, dan jadwal', () => {
    const msg = orderWhatsAppMessage({
      ...BASE,
      packageName: 'Aqiqah Favorit',
      qty: 2,
      boxName: 'Paket C',
      boxQty: 50,
      requestedDate: '2026-09-10',
      requestedTime: '07:30:00',
      distributionMode: 'kirim',
      customerName: 'Hendra',
    });

    expect(msg).toContain('Aqiqah Favorit (2 ekor)');
    expect(msg).toContain('Paket C (50 box)');
    expect(msg).toContain('Aqiqah Kirim');
    expect(msg).toContain('10 Sep 2026, 07:30');
    expect(msg).toContain('Hendra');
  });

  it('melewati medan yang kosong alih-alih menulis baris kosong', () => {
    const msg = orderWhatsAppMessage({
      ...BASE,
      packageName: null,
      boxName: null,
      boxQty: 0,
      requestedDate: '',
      distributionMode: '',
      customerName: '',
    });

    expect(msg).not.toContain('undefined');
    expect(msg).not.toContain('null');
    expect(msg).not.toContain('Nasi box');
    expect(msg).not.toContain('Penyaluran');
    expect(msg).not.toContain('Jadwal diminta');
  });

  it('tidak menuliskan mode penyaluran yang tidak dikenal', () => {
    // Menuliskan kode mentah ke pesan yang dibaca orang lebih buruk daripada
    // diam — dan `distribution_mode` datang dari draft, bukan dari enum.
    const msg = orderWhatsAppMessage({ ...BASE, distributionMode: 'entah' });
    expect(msg).not.toContain('entah');
    expect(msg).not.toContain('Penyaluran');
  });

  it('tidak pernah membawa `public_token`', () => {
    // Token itu kunci baca laporan. Pesan WhatsApp bisa diteruskan ke siapa pun,
    // jadi bentuk pemanggilannya sengaja tidak menyediakan tempat untuknya.
    const msg = orderWhatsAppMessage({ ...BASE, customerName: 'Hendra' });
    expect(msg).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i);
  });

  it('nasi box tanpa jumlah tidak ikut disebut', () => {
    const msg = orderWhatsAppMessage({ ...BASE, boxName: 'Paket C', boxQty: 0 });
    expect(msg).not.toContain('Paket C');
  });
});
