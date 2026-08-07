'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/server/auth/session';
import { canDo } from '@/server/auth/capabilities';
import { deleteSlaughterSchema, recordSlaughterSchema } from '@/features/slaughter/schema';
import { checkAnimalTransition } from '@/features/orders/animal-state-machine';
import {
  conflict,
  forbidden,
  notFound,
  scopedInternalError,
  validationError,
  type ActionResult,
} from './result';

const internalError = scopedInternalError('slaughter');

/** Toleransi jam antara klien & server sebelum sebuah waktu dianggap masa depan. */
const CLOCK_SKEW_MS = 5 * 60 * 1000;

// =============================================================================
// Catat pemotongan (prd.md FR-SL1)
// =============================================================================

/**
 * Catat pemotongan satu hewan, sekaligus menaikkan statusnya ke `slaughtered`.
 *
 * Keduanya menyatu dengan sengaja. `v_order_progress` menghitung
 * `animals_slaughtered` dari `animals.status`, dan guard
 * `slaughtering → distribution` membaca angka itu — jadi catatan pemotongan
 * yang tidak ikut menggerakkan status hewan tidak akan berpengaruh apa pun
 * pada progres maupun transisi order.
 */
export async function recordSlaughter(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await requireAuth();
  const role = session.profile?.role;

  if (!canDo(role, 'RECORD_FIELD_WORK')) {
    return forbidden('Role Anda tidak berhak mencatat pemotongan.');
  }

  const parsed = recordSlaughterSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { animal_id, performed_at, notes } = parsed.data;

  if (performed_at && Date.parse(performed_at) > Date.now() + CLOCK_SKEW_MS) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Waktu pemotongan tidak boleh di masa depan.',
        fields: { performed_at: 'Waktu di masa depan.' },
      },
    };
  }

  const supabase = await createClient();

  const { data: animal, error: readError } = await supabase
    .from('animals')
    .select('id, order_id, status, tag_code')
    .eq('id', animal_id)
    .maybeSingle();

  if (readError) return internalError('Gagal memuat data hewan', readError);
  if (!animal) return notFound('Data hewan tidak ditemukan atau di luar akses Anda.');

  // Satu hewan satu catatan pemotongan. Tabelnya tidak punya constraint unik,
  // jadi pemeriksaan ini yang mencegah pencatatan ganda saat tombol ditekan
  // dua kali atau dua petugas mencatat hewan yang sama.
  const { count: existing } = await supabase
    .from('slaughter_records')
    .select('id', { count: 'exact', head: true })
    .eq('animal_id', animal_id);

  if ((existing ?? 0) > 0) {
    return conflict('Hewan ini sudah punya catatan pemotongan.');
  }

  // Transisi statusnya divalidasi state machine yang sama dengan AnimalManager,
  // sehingga hewan yang belum `prepared` tidak bisa langsung dipotong.
  const check = checkAnimalTransition(animal.status, 'slaughtered', role);
  if (!check.ok) return { ok: false, error: { code: check.code, message: check.message } };

  const { data: record, error } = await supabase
    .from('slaughter_records')
    .insert({
      animal_id,
      performed_by: session.id,
      ...(performed_at ? { performed_at } : {}),
      notes: notes || null,
    })
    .select('id')
    .maybeSingle();

  if (error) return internalError('Gagal mencatat pemotongan', error);
  if (!record) return forbidden('Pencatatan ditolak untuk order di luar akses Anda.');

  const { data: updated, error: updateError } = await supabase
    .from('animals')
    .update({ status: 'slaughtered' })
    .eq('id', animal_id)
    // Status lama ikut jadi syarat — dua petugas yang mencatat bersamaan tidak
    // boleh saling menimpa.
    .eq('status', animal.status)
    .select('id');

  if (updateError) return internalError('Gagal memperbarui status hewan', updateError);

  if ((updated ?? []).length === 0) {
    // Catatan sudah tersimpan tapi status gagal naik. Catatan itu sengaja
    // dibiarkan sebagai bukti; operator diminta memuat ulang agar tidak
    // menimpa perubahan pihak lain secara membabi buta.
    return conflict(
      'Catatan tersimpan, tetapi status hewan sudah diubah pihak lain. Muat ulang halaman untuk melihat kondisi terkini.',
    );
  }

  revalidatePath(`/orders/${animal.order_id}`);
  revalidatePath('/dashboard');
  return { ok: true, data: { id: record.id } };
}

// =============================================================================
// Hapus catatan (koreksi)
// =============================================================================

/**
 * Hapus catatan pemotongan dan kembalikan hewannya ke `prepared`.
 *
 * Dibatasi Manager Program: menghapus catatan berarti menarik kembali bukti
 * yang sudah dihitung di KPI dan bisa menutup kembali guard transisi order.
 */
export async function deleteSlaughter(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'DELETE_FIELD_RECORD')) {
    return forbidden('Hanya Manager Program yang dapat menghapus catatan pemotongan.');
  }

  const parsed = deleteSlaughterSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { data: record } = await supabase
    .from('slaughter_records')
    .select('id, animal:animals!inner ( id, order_id, status )')
    .eq('id', parsed.data.id)
    .maybeSingle();

  if (!record) return notFound('Catatan pemotongan tidak ditemukan.');

  const animal = (record as unknown as { animal: { id: string; order_id: string; status: string } })
    .animal;

  // Hewan yang sudah didistribusikan berarti dagingnya sudah tersalurkan;
  // menarik catatan pemotongannya akan membuat rangkaian buktinya tidak konsisten.
  if (animal.status === 'distributed') {
    return conflict(
      'Hewan sudah berstatus Terdistribusi. Kembalikan status hewan lebih dulu sebelum menghapus catatan pemotongan.',
    );
  }

  const { data: deleted, error } = await supabase
    .from('slaughter_records')
    .delete()
    .eq('id', parsed.data.id)
    .select('id');

  if (error) return internalError('Gagal menghapus catatan pemotongan', error);
  if ((deleted ?? []).length === 0) {
    return conflict('Catatan sudah dihapus pihak lain atau di luar akses Anda.');
  }

  await supabase
    .from('animals')
    .update({ status: 'prepared' })
    .eq('id', animal.id)
    .eq('status', 'slaughtered');

  revalidatePath(`/orders/${animal.order_id}`);
  revalidatePath('/dashboard');
  return { ok: true, data: null };
}
