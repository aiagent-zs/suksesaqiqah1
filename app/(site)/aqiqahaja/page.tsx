/**
 * Area Aqiqah Aja (kanal LinkAja). Tiap rute di bawah `/aqiqahaja` memakai
 * halaman yang sama dengan situs utama; merek, tautan internal, dan
 * `orders.channel` mengikuti path lewat `getChannel()` (lihat `lib/brand.ts`).
 * Satu halaman, dua alamat: harga, katalog, dan alur pesan tidak bisa
 * menyimpang antara kedua kanal.
 */
export { default, generateMetadata } from '../page';
