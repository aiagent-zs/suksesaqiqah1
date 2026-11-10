import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { appUrl } from '@/lib/constants/site';
import { orderEmail } from './email';

/** Sesudah ini baris berhenti dicoba dan ditandai `failed`. */
const MAX_ATTEMPTS = 5;

type Result = { sent: number; failed: number; skipped: boolean };

/**
 * Kirim email pemesan yang masih `queued` di outbox `notifications` lewat Resend.
 *
 * Dipanggil dua jalan: langsung sesudah pelunasan/perubahan status (`after()`),
 * dan dari cron `/api/notifications/email` sebagai jaring pengaman untuk
 * baris yang gagal atau terlewat. Keduanya aman berjalan bersamaan: baris
 * diklaim dengan menaikkan `attempts` bersyarat, jadi satu baris tidak terkirim
 * dua kali oleh dua pemanggil.
 *
 * Tanpa `RESEND_API_KEY` fungsi ini tidak melakukan apa-apa: barisnya tetap
 * `queued` dan bisa dikirim begitu kuncinya diisi.
 */
export async function sendQueuedEmails(limit = 20): Promise<Result> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { sent: 0, failed: 0, skipped: true };

  const db = createAdminClient();
  const { data: rows, error } = await db
    .from('notifications')
    .select('id, template, recipient, payload, attempts')
    .eq('channel', 'email')
    .eq('status', 'queued')
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`Gagal membaca antrean email: ${error.message}`);

  let sent = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    // Klaim: hanya pemanggil yang berhasil menaikkan `attempts` dari nilai yang
    // ia baca yang boleh mengirim.
    const { data: claimed } = await db
      .from('notifications')
      .update({ attempts: row.attempts + 1 })
      .eq('id', row.id)
      .eq('status', 'queued')
      .eq('attempts', row.attempts)
      .select('id');
    if (!claimed?.length) continue;

    const mail = orderEmail(
      row.template ?? '',
      (row.payload ?? {}) as Record<string, unknown>,
      appUrl(),
    );
    if (!mail) {
      await db
        .from('notifications')
        .update({ status: 'failed', error_text: `Template email tidak dikenal: ${row.template}` })
        .eq('id', row.id);
      failed++;
      continue;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        // Resend menolak kiriman kedua dengan kunci yang sama dalam 24 jam:
        // pengaman bila klaim di atas pun lolos dua kali.
        'Idempotency-Key': `notif-${row.id}`,
      },
      body: JSON.stringify({
        from,
        to: [row.recipient],
        reply_to: process.env.EMAIL_REPLY_TO || undefined,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      }),
    }).catch((e: Error) => e);

    if (res instanceof Response && res.ok) {
      await db
        .from('notifications')
        .update({ status: 'sent', sent_at: new Date().toISOString(), error_text: null })
        .eq('id', row.id);
      sent++;
      continue;
    }

    const reason =
      res instanceof Response ? `Resend ${res.status}: ${await res.text()}` : res.message;
    // 4xx selain 429 = alamat atau isi ditolak; mengulang tidak akan mengubahnya.
    const permanent =
      res instanceof Response && res.status >= 400 && res.status < 500 && res.status !== 429;
    await db
      .from('notifications')
      .update({
        error_text: reason.slice(0, 500),
        ...(permanent || row.attempts + 1 >= MAX_ATTEMPTS ? { status: 'failed' as const } : {}),
      })
      .eq('id', row.id);
    failed++;
  }

  return { sent, failed, skipped: false };
}
