'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/server/auth/session';
import { canDo } from '@/server/auth/capabilities';
import {
  conflict,
  forbidden,
  scopedInternalError,
  validationError,
  type ActionResult,
} from './result';

const internalError = scopedInternalError('notifications');

const markSentSchema = z.object({ id: z.string().uuid('ID notifikasi tidak valid') });

/**
 * Tandai satu notifikasi outbox sudah ditangani.
 *
 * **Pengiriman masih manual, penandaannya jangan.** Trigger di
 * `20260824020000` mengisi outbox otomatis, tapi sampai worker pengirim ada,
 * yang benar-benar mengirim pesan adalah admin yang menekan "Kirim WA". Tanpa
 * langkah ini barisnya tetap `queued` selamanya: panel tidak pernah menyusut,
 * yang sudah dikerjakan tidak bisa dibedakan dari yang belum, dan dengan
 * `limit` di `getPendingAlerts` notifikasi lama akan mendorong yang baru keluar
 * dari layar.
 *
 * `error_text` ikut dikosongkan — baris yang pernah gagal lalu ditangani manual
 * tidak boleh menyimpan pesan galat yang sudah tidak berlaku.
 */
export async function markNotificationSent(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_NOTIFICATIONS')) {
    return forbidden('Role Anda tidak berhak menandai notifikasi.');
  }

  const parsed = markSentSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('notifications')
    .update({ status: 'sent', sent_at: new Date().toISOString(), error_text: null })
    .eq('id', parsed.data.id)
    // Status lama ikut jadi syarat: dua admin yang menekan bersamaan tidak boleh
    // sama-sama dianggap berhasil, dan `sent_at` tidak boleh tergeser oleh
    // penekanan kedua atas baris yang sudah selesai.
    .eq('status', 'queued')
    .select('id');

  if (error) return internalError('Gagal menandai notifikasi', error);

  if ((data ?? []).length === 0) {
    return conflict('Notifikasi sudah ditandai pihak lain. Muat ulang halaman.');
  }

  revalidatePath('/dashboard');
  return { ok: true, data: null };
}
