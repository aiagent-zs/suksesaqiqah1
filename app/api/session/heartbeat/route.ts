import { NextResponse } from 'next/server';

/**
 * Penanda "user masih di sini".
 *
 * Badannya sengaja kosong — yang bekerja adalah middleware yang dilewati
 * permintaan ini, yang memperbarui cookie cap waktu aktivitas. Endpoint-nya
 * hanya perlu ada supaya klien punya sesuatu untuk ditembak saat user aktif
 * tetapi tidak berpindah halaman (mis. sedang mengisi form panjang).
 *
 * `POST`, bukan `GET`: permintaan ini tidak boleh ikut ter-cache atau terpanggil
 * oleh pramuat tautan.
 */
export async function POST() {
  return new NextResponse(null, { status: 204 });
}
