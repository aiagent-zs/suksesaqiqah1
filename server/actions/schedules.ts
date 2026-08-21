'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/server/auth/session';
import { canDo } from '@/server/auth/capabilities';
import { assignVendorSchema, saveScheduleSchema } from '@/features/schedules/schema';

import {
  conflict,
  forbidden,
  notFound,
  scopedInternalError,
  validationError,
  type ActionResult,
} from './result';

const internalError = scopedInternalError('schedules');

// =============================================================================
// Tetapkan tanggal & lokasi
// =============================================================================

/**
 * Simpan (buat atau perbarui) jadwal sebuah order.
 *
 * `schedules.order_id` unik — satu order satu jadwal — jadi operasinya upsert
 * dengan `onConflict: 'order_id'`, bukan insert yang akan gagal pada
 * penyuntingan kedua.
 *
 * Yang **hilang** dari versi sebelumnya: pemeriksaan `pic.branch_id !==
 * order.branch_id`. Cek itu menolak setiap vendor yang baru dibuat, karena
 * akun vendor lahir tanpa cabang sementara order selalu punya — jadi sistemnya
 * macet total di titik penugasan. Cabang sudah tidak ada, dan penugasan mitra
 * kini punya action-nya sendiri di bawah.
 */
export async function saveSchedule(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_SCHEDULE')) {
    return forbidden('Role Anda tidak berhak mengatur jadwal.');
  }

  const parsed = saveScheduleSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { order_id, location_id, scheduled_date, scheduled_time, notes } = parsed.data;

  const supabase = await createClient();

  const { data: order } = await supabase
    .from('orders')
    .select('id, status, vendor_id')
    .eq('id', order_id)
    .maybeSingle();

  if (!order) return notFound('Order tidak ditemukan atau di luar akses Anda.');

  if (order.status === 'completed' || order.status === 'cancelled') {
    return conflict('Order yang sudah selesai atau dibatalkan tidak dapat dijadwalkan ulang.');
  }

  // Lokasi milik mitra lain tidak masuk akal untuk order ini. Pemeriksaan ini
  // baru punya arti sejak lokasi dimiliki mitra — sebelumnya ia membandingkan
  // cabang, yang sudah lama tidak membatasi apa pun.
  if (location_id) {
    const { data: location } = await supabase
      .from('locations')
      .select('id, vendor_id')
      .eq('id', location_id)
      .maybeSingle();

    if (!location) return notFound('Lokasi tidak ditemukan.');

    if (location.vendor_id && order.vendor_id && location.vendor_id !== order.vendor_id) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Lokasi ini milik mitra lain.',
          fields: { location_id: 'Bukan lokasi mitra yang ditugaskan.' },
        },
      };
    }
  }

  const { data, error } = await supabase
    .from('schedules')
    .upsert(
      {
        order_id,
        location_id: location_id || null,
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
    return forbidden('Penyimpanan ditolak untuk order di luar akses Anda.');
  }

  revalidatePath(`/orders/${order_id}`);
  revalidatePath('/schedule');
  return { ok: true, data: null };
}

// =============================================================================
// Tetapkan mitra pelaksana
// =============================================================================

/**
 * Tugaskan sebuah order kepada mitra.
 *
 * Dipisah dari penyimpanan jadwal dengan sengaja: inilah satu-satunya hal yang
 * membuat vendor bisa melihat order sama sekali — `can_read_order`
 * membandingkan `orders.vendor_id` dengan `profiles.vendor_id`. Aksi sepenting
 * itu pantas berdiri sendiri, terlihat jelas di layar dan di audit.
 *
 * Begitu status order naik ke `assigned`, trigger `generate_stage_checklist`
 * menerbitkan daftar tahap sesuai cara penyaluran — vendor langsung punya
 * daftar kerja, bukan formulir kosong.
 */
export async function assignVendor(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'ASSIGN_VENDOR')) {
    return forbidden('Penugasan mitra dilakukan admin.');
  }

  const parsed = assignVendorSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { order_id, vendor_id } = parsed.data;

  const supabase = await createClient();

  const { data: order } = await supabase
    .from('orders')
    .select('id, status, distribution_mode, vendor_id')
    .eq('id', order_id)
    .maybeSingle();

  if (!order) return notFound('Order tidak ditemukan atau di luar akses Anda.');

  if (order.status === 'completed' || order.status === 'cancelled') {
    return conflict('Order yang sudah selesai atau dibatalkan tidak dapat ditugaskan ulang.');
  }

  // Cara penyaluran menentukan rangkaian tahap yang akan terbit. Tanpa itu
  // trigger tidak tahu daftar apa yang harus dibuat — dan memang menolak.
  if (!order.distribution_mode) {
    return conflict('Cara penyaluran belum ditentukan, jadi tahapannya belum bisa disusun.');
  }

  const { data: vendor } = await supabase
    .from('vendors')
    .select('id, name, is_active, service_modes')
    .eq('id', vendor_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!vendor) return notFound('Mitra tidak ditemukan.');

  if (!vendor.is_active) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Mitra ini sedang tidak aktif.',
        fields: { vendor_id: 'Mitra non-aktif.' },
      },
    };
  }

  // Mitra yang tidak melayani "kirim" tidak boleh dapat order Aqiqah Kirim:
  // tahap pengantaran akan terbit dan tidak akan pernah bisa ia penuhi.
  if (!vendor.service_modes.includes(order.distribution_mode)) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `Mitra ${vendor.name} tidak melayani cara penyaluran ini.`,
        fields: { vendor_id: 'Mode tidak dilayani mitra ini.' },
      },
    };
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ vendor_id })
    .eq('id', order_id)
    // Penguncian optimistik: dua admin yang menugaskan bersamaan tidak bisa
    // sama-sama berhasil.
    .eq('vendor_id', order.vendor_id as string)
    .select('id');

  if (error) return internalError('Gagal menetapkan mitra', error);

  if ((data ?? []).length === 0) {
    return conflict('Penugasan tidak tersimpan: mitra sudah diubah orang lain lebih dulu.');
  }

  revalidatePath(`/orders/${order_id}`);
  revalidatePath('/schedule');
  return { ok: true, data: null };
}
