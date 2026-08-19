'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/server/auth/session';
import { canDo } from '@/server/auth/capabilities';
import { saveScheduleSchema, updateScheduleStatusSchema } from '@/features/schedules/schema';
import { checkScheduleTransition } from '@/features/schedules/status-machine';

import { scopedInternalError, validationError, type ActionResult } from './result';

const internalError = scopedInternalError('schedules');

// =============================================================================
// Tetapkan tanggal, lokasi, dan PIC (prd.md FR-S1)
// =============================================================================

/**
 * Simpan (buat atau perbarui) jadwal sebuah order.
 *
 * `schedules.order_id` unik — satu order satu jadwal aktif — jadi operasinya
 * upsert dengan `onConflict: 'order_id'`, bukan insert yang bisa gagal pada
 * penyuntingan kedua.
 */
export async function saveSchedule(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_SCHEDULE')) {
    return {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Role Anda tidak berhak mengatur jadwal.' },
    };
  }

  const parsed = saveScheduleSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { order_id, location_id, pic_user_id, scheduled_date, scheduled_time, notes } = parsed.data;

  const supabase = await createClient();

  const { data: order } = await supabase
    .from('orders')
    .select('id, branch_id, status')
    .eq('id', order_id)
    .maybeSingle();

  if (!order) {
    return {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Order tidak ditemukan atau di luar akses Anda.' },
    };
  }

  if (order.status === 'completed' || order.status === 'cancelled') {
    return {
      ok: false,
      error: {
        code: 'CONFLICT',
        message: 'Order yang sudah selesai atau dibatalkan tidak dapat dijadwalkan ulang.',
      },
    };
  }

  // Lokasi wajib milik cabang order. `locations` dapat dibaca lintas cabang
  // (kebijakan `locations_select` memakai `true`), jadi tanpa pemeriksaan ini
  // pemotongan bisa dijadwalkan di lokasi cabang lain tanpa penolakan apa pun.
  const { data: location } = await supabase
    .from('locations')
    .select('id, branch_id')
    .eq('id', location_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!location || location.branch_id !== order.branch_id) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Lokasi tidak tersedia untuk cabang order ini.',
        fields: { location_id: 'Lokasi bukan milik cabang order.' },
      },
    };
  }

  // PIC wajib vendor yang aktif. Kolomnya hanya ber-foreign key ke `profiles`,
  // sehingga tanpa cek ini seorang admin pun bisa tercatat sebagai pelaksana —
  // dan lebih jauh, menugaskan dirinya sendiri ke order mana pun.
  if (pic_user_id) {
    const { data: pic } = await supabase
      .from('profiles')
      .select('id, role, branch_id, is_active')
      .eq('id', pic_user_id)
      .maybeSingle();

    if (!pic || pic.role !== 'vendor' || !pic.is_active) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Pelaksana harus vendor yang aktif.',
          fields: { pic_user_id: 'Bukan vendor aktif.' },
        },
      };
    }

    if (pic.branch_id !== order.branch_id) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'PIC harus berasal dari cabang yang sama dengan order.',
          fields: { pic_user_id: 'Petugas dari cabang lain.' },
        },
      };
    }
  }

  const { data, error } = await supabase
    .from('schedules')
    .upsert(
      {
        order_id,
        location_id,
        pic_user_id: pic_user_id || null,
        scheduled_date,
        scheduled_time: scheduled_time || null,
        notes: notes || null,
      },
      { onConflict: 'order_id' },
    )
    .select('order_id');

  if (error) return internalError('Gagal menyimpan jadwal', error);

  // PostgREST tidak menganggap upsert yang mengenai 0 baris sebagai error —
  // tanpa cek ini, penolakan RLS terlihat sebagai sukses di layar.
  if ((data ?? []).length === 0) {
    return {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Penyimpanan ditolak untuk order di luar akses Anda.' },
    };
  }

  revalidatePath(`/orders/${order_id}`);
  revalidatePath('/schedule');
  revalidatePath('/dashboard');
  return { ok: true, data: null };
}

// =============================================================================
// Status pelaksanaan jadwal
// =============================================================================

export async function updateScheduleStatus(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();
  const role = session.profile?.role;

  if (!canDo(role, 'MANAGE_SCHEDULE')) {
    return {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Role Anda tidak berhak mengubah status jadwal.' },
    };
  }

  const parsed = updateScheduleStatusSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { order_id, status } = parsed.data;

  const supabase = await createClient();
  const { data: current } = await supabase
    .from('schedules')
    .select('order_id, status')
    .eq('order_id', order_id)
    .maybeSingle();

  if (!current) {
    return {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Jadwal tidak ditemukan atau di luar akses Anda.' },
    };
  }

  const check = checkScheduleTransition(current.status, status, role);
  if (!check.ok) return { ok: false, error: { code: check.code, message: check.message } };

  const { data, error } = await supabase
    .from('schedules')
    .update({ status })
    .eq('order_id', order_id)
    // Status lama ikut jadi syarat: dua operator yang mengubah bersamaan tidak
    // boleh sama-sama dianggap berhasil.
    .eq('status', current.status)
    .select('order_id');

  if (error) return internalError('Gagal memperbarui status jadwal', error);

  if ((data ?? []).length === 0) {
    return {
      ok: false,
      error: {
        code: 'CONFLICT',
        message:
          'Status jadwal sudah diubah pihak lain. Muat ulang halaman untuk melihat kondisi terkini.',
      },
    };
  }

  revalidatePath(`/orders/${order_id}`);
  revalidatePath('/schedule');
  return { ok: true, data: null };
}
