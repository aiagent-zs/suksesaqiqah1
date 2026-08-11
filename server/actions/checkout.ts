'use server';

import { createClient } from '@/lib/supabase/server';
import { guestCheckoutSchema } from '@/features/checkout/schema';
import type { GuestOrderResult } from '@/features/checkout/queries';
import { scopedInternalError, validationError, type ActionResult } from './result';

const internalError = scopedInternalError('checkout');

/**
 * Kode error Postgres yang dipakai `create_guest_order` untuk penolakan yang
 * memang layak dibacakan ke pengunjung — bukan kegagalan tak terduga.
 *
 * Pesannya ditulis di dalam fungsi SQL dan sudah berbahasa Indonesia, jadi
 * diteruskan apa adanya. Selain kode-kode ini, pesan mentah Postgres tidak
 * pernah sampai ke layar: isinya membocorkan nama tabel dan kolom.
 */
const EXPECTED_REJECTIONS = new Set(['23514', 'P0002', 'P0003']);

/**
 * Buat order dari checkout mandiri (`prd.md` FR-C2).
 *
 * Pemanggilnya tidak login, jadi seluruh penulisan lewat RPC
 * `create_guest_order` yang SECURITY DEFINER — `anon` sendiri ditolak RLS pada
 * setiap tabel operasional. Harga, status, dan jumlah terbayar **tidak**
 * dikirim dari sini; RPC membacanya dari tabel `services`.
 */
export async function createGuestOrderAction(
  input: unknown,
): Promise<ActionResult<GuestOrderResult>> {
  const parsed = guestCheckoutSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;
  const supabase = await createClient();

  const { data: result, error } = await supabase.rpc('create_guest_order', {
    p_payload: {
      participant: {
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        address: data.address || null,
      },
      service_id: data.service_id,
      branch_id: data.branch_id,
      species: data.species,
      qty: data.qty,
      on_behalf_of: data.on_behalf_of,
      delivery_address: data.delivery_address || null,
      recipient_institution: data.recipient_institution || null,
      referral_code: data.referral_code || null,
      notes: data.notes || null,
    },
  });

  if (error) {
    if (EXPECTED_REJECTIONS.has(error.code ?? '')) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: error.message } };
    }
    return internalError('Gagal memproses pesanan', error);
  }

  if (!result)
    return internalError('Pesanan tidak terbentuk', { message: 'RPC mengembalikan null' });

  return { ok: true, data: result as unknown as GuestOrderResult };
}
