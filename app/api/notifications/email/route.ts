import { NextResponse } from 'next/server';
import { sendQueuedEmails } from '@/features/notifications/send-email';

/**
 * Jaring pengaman pengiriman email: mengirim baris `queued` yang belum
 * terkirim (Resend sempat gagal, atau trigger berjalan di luar aplikasi).
 *
 * Dipanggil penjadwal (cron hosting atau cron eksternal) dengan header
 * `Authorization: Bearer <CRON_SECRET>`. Tanpa rahasia yang cocok, ditolak.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const result = await sendQueuedEmails(50);
  return NextResponse.json({ ok: true, ...result });
}
