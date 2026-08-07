'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/server/auth/session';
import { canDo } from '@/server/auth/capabilities';
import { deleteDistributionSchema, recordDistributionSchema } from '@/features/distribution/schema';
import {
  conflict,
  forbidden,
  notFound,
  scopedInternalError,
  validationError,
  type ActionResult,
} from './result';

const internalError = scopedInternalError('distribution');

const CLOCK_SKEW_MS = 5 * 60 * 1000;

// =============================================================================
// Catat distribusi (prd.md FR-SL2)
// =============================================================================

/**
 * Catat satu penyaluran daging pada sebuah order.
 *
 * `animal_ids` opsional menaikkan status hewan terpilih ke `distributed`.
 * Tanpa itu baris distribusi memang tercatat — dan guard
 * `distribution → documentation` terbuka karena hanya menghitung banyaknya
 * baris — tetapi `pct_distribution` di dashboard tetap nol, sebab angkanya
 * dihitung dari `animals.status`.
 */
export async function recordDistribution(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await requireAuth();
  const role = session.profile?.role;

  if (!canDo(role, 'RECORD_FIELD_WORK')) {
    return forbidden('Role Anda tidak berhak mencatat distribusi.');
  }

  const parsed = recordDistributionSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const {
    order_id,
    recipient_name,
    recipient_area,
    packages_count,
    distributed_at,
    lat,
    lng,
    animal_ids,
  } = parsed.data;

  if (distributed_at && Date.parse(distributed_at) > Date.now() + CLOCK_SKEW_MS) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Waktu distribusi tidak boleh di masa depan.',
        fields: { distributed_at: 'Waktu di masa depan.' },
      },
    };
  }

  // Koordinat hanya bermakna berpasangan; separuh koordinat menghasilkan titik
  // yang tidak bisa dipetakan.
  if ((lat === undefined) !== (lng === undefined)) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Lintang dan bujur harus diisi berpasangan.',
        fields: { lat: 'Isi keduanya atau kosongkan keduanya.' },
      },
    };
  }

  const supabase = await createClient();

  const { data: order } = await supabase
    .from('orders')
    .select('id, status')
    .eq('id', order_id)
    .maybeSingle();

  if (!order) return notFound('Order tidak ditemukan atau di luar akses Anda.');

  // Distribusi mengikuti pemotongan (docs/06 section 5). Tanpa syarat ini,
  // penyaluran bisa tercatat pada order yang belum satu ekor pun dipotong.
  const { count: slaughtered } = await supabase
    .from('animals')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', order_id)
    .in('status', ['slaughtered', 'distributed']);

  if ((slaughtered ?? 0) === 0) {
    return conflict('Belum ada hewan yang tercatat dipotong pada order ini.');
  }

  // Hewan yang ditandai wajib milik order ini dan sudah dipotong. Id-nya datang
  // dari klien, jadi kepemilikannya diperiksa terhadap database — bukan
  // dipercaya begitu saja.
  let verifiedAnimalIds: string[] = [];
  if (animal_ids && animal_ids.length > 0) {
    const { data: animals } = await supabase
      .from('animals')
      .select('id')
      .eq('order_id', order_id)
      .eq('status', 'slaughtered')
      .in('id', animal_ids);

    verifiedAnimalIds = (animals ?? []).map((a) => a.id);

    if (verifiedAnimalIds.length !== animal_ids.length) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Ada hewan terpilih yang bukan milik order ini atau belum berstatus Dipotong.',
          fields: { animal_ids: 'Pilihan hewan tidak valid.' },
        },
      };
    }
  }

  const { data: record, error } = await supabase
    .from('distributions')
    .insert({
      order_id,
      recipient_name: recipient_name || null,
      recipient_area: recipient_area || null,
      packages_count,
      distributed_by: session.id,
      ...(distributed_at ? { distributed_at } : {}),
      lat: lat ?? null,
      lng: lng ?? null,
    })
    .select('id')
    .maybeSingle();

  if (error) return internalError('Gagal mencatat distribusi', error);
  if (!record) return forbidden('Pencatatan ditolak untuk order di luar akses Anda.');

  if (verifiedAnimalIds.length > 0) {
    const { error: animalError } = await supabase
      .from('animals')
      .update({ status: 'distributed' })
      .in('id', verifiedAnimalIds)
      // Hanya yang masih `slaughtered` yang dinaikkan, supaya hewan yang sudah
      // ditandai penyaluran lain tidak ikut tersentuh.
      .eq('status', 'slaughtered');

    if (animalError) {
      return internalError(
        'Distribusi tersimpan, tetapi status hewan gagal diperbarui',
        animalError,
      );
    }
  }

  revalidatePath(`/orders/${order_id}`);
  revalidatePath('/dashboard');
  return { ok: true, data: { id: record.id } };
}

// =============================================================================
// Hapus catatan (koreksi)
// =============================================================================

export async function deleteDistribution(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'DELETE_FIELD_RECORD')) {
    return forbidden('Hanya Manager Program yang dapat menghapus catatan distribusi.');
  }

  const parsed = deleteDistributionSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { data: record } = await supabase
    .from('distributions')
    .select('id, order_id')
    .eq('id', parsed.data.id)
    .maybeSingle();

  if (!record) return notFound('Catatan distribusi tidak ditemukan.');

  const { data: deleted, error } = await supabase
    .from('distributions')
    .delete()
    .eq('id', parsed.data.id)
    .select('id');

  if (error) return internalError('Gagal menghapus catatan distribusi', error);
  if ((deleted ?? []).length === 0) {
    return conflict('Catatan sudah dihapus pihak lain atau di luar akses Anda.');
  }

  // Status hewan sengaja tidak ikut dikembalikan: satu penyaluran dapat
  // mencakup banyak hewan dan satu hewan dapat tersentuh beberapa penyaluran,
  // sehingga tidak ada pemetaan balik yang jelas. Koreksi status hewan
  // dilakukan terpisah lewat panel Hewan.
  revalidatePath(`/orders/${record.order_id}`);
  revalidatePath('/dashboard');
  return { ok: true, data: null };
}
