import { formatCurrency, formatDate, formatTime } from '@/lib/format';
import { DISTRIBUTION_MODE_LABEL } from '@/features/stages/sequence';

/**
 * Ringkasan pesanan yang dibawa pemesan ke WhatsApp admin.
 *
 * **Kenapa pemesan yang membuka percakapan, bukan admin.** Order tamu mendarat
 * sebagai `new` dan menunggu verifikasi manual; notifikasi `guest_order_new`
 * memang terbit ke dashboard, tapi pengirimannya belum otomatis — sampai worker
 * pengirim ada, satu-satunya jalan yang pasti sampai adalah pemesan sendiri yang
 * menyapa. Tanpa tombol ini ia hanya diberi tahu "tim akan menghubungi Anda"
 * lalu tidak punya apa pun untuk ditindaklanjuti.
 *
 * **Nomor pesanan ditaruh di baris pertama.** Itu satu-satunya keping yang
 * membuat admin bisa menemukan barisnya di `/orders` tanpa bertanya balik;
 * sisanya konteks agar percakapannya tidak dimulai dari nol.
 *
 * Isinya sengaja hanya yang **sudah dilihat pemesan sendiri** di layar
 * ringkasan. Pesan WhatsApp melewati server WhatsApp dan tersimpan di dua
 * perangkat, jadi menambahkan yang belum pernah ia lihat — nama anak, tanggal
 * lahir, alamat rumah — berarti menyebarkan data pribadi lewat jalan yang tidak
 * ia sadari. `public_token` juga tidak ikut: ia kunci baca laporan, dan
 * tempatnya bukan di pesan yang bisa diteruskan.
 */
export function orderWhatsAppMessage(input: {
  orderNumber: string;
  totalAmount: number;
  packageName?: string | null;
  qty?: number;
  boxName?: string | null;
  boxQty?: number;
  requestedDate?: string | null;
  requestedTime?: string | null;
  distributionMode?: string | null;
  customerName?: string | null;
}): string {
  const lines = [
    `Halo Admin Sukses Aqiqah, saya baru saja memesan lewat website.`,
    ``,
    `No. Pesanan: ${input.orderNumber}`,
  ];

  if (input.customerName) lines.push(`Nama: ${input.customerName}`);
  if (input.packageName) {
    lines.push(`Paket: ${input.packageName}${input.qty ? ` (${input.qty} ekor)` : ''}`);
  }
  if (input.boxName && (input.boxQty ?? 0) > 0) {
    lines.push(`Nasi box: ${input.boxName} (${input.boxQty} box)`);
  }

  const mode = input.distributionMode;
  // Mode di luar kedua yang dikenal tidak dituliskan sama sekali: menuliskan
  // kode mentahnya ke pesan yang dibaca orang lebih buruk daripada diam.
  if (mode === 'salur' || mode === 'kirim') {
    lines.push(`Penyaluran: ${DISTRIBUTION_MODE_LABEL[mode]}`);
  }

  if (input.requestedDate) {
    const time = input.requestedTime ? `, ${formatTime(input.requestedTime)}` : '';
    lines.push(`Jadwal diminta: ${formatDate(input.requestedDate)}${time}`);
  }

  lines.push(`Total: ${formatCurrency(input.totalAmount)}`);
  lines.push(``, `Mohon informasi langkah pembayarannya. Terima kasih.`);

  return lines.join('\n');
}
