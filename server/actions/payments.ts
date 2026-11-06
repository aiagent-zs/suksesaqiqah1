'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/server/auth/session';
import { canDo } from '@/server/auth/capabilities';
import {
  deletePaymentSchema,
  recordPaymentSchema,
  verifyPaymentSchema,
} from '@/features/payments/schema';
import { isProofPathForOrder } from '@/features/payments/storage';
import { advanceToPaidIfReady } from './advance-to-paid';

import { conflict, scopedInternalError, validationError, type ActionResult } from './result';

const internalError = scopedInternalError('payments');

/** Konteks order yang dibutuhkan untuk memvalidasi pembayaran. */
type OrderContext = {
  id: string;
  order_number: string;
  total_amount: number;
  paid_amount: number;
  vendor_code: string;
};

async function loadOrderContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
): Promise<OrderContext | null> {
  const { data } = await supabase
    .from('orders')
    .select(
      'id, order_number, total_amount, paid_amount, vendor:vendors!orders_vendor_id_fkey ( code )',
    )
    .eq('id', orderId)
    .maybeSingle();

  if (!data) return null;

  const row = data as unknown as {
    id: string;
    order_number: string;
    total_amount: number | string;
    paid_amount: number | string;
    vendor: { code: string } | null;
  };

  return {
    id: row.id,
    order_number: row.order_number,
    total_amount: Number(row.total_amount),
    paid_amount: Number(row.paid_amount),
    vendor_code: row.vendor?.code ?? '',
  };
}

export async function recordPayment(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'RECORD_PAYMENT')) {
    return {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Role Anda tidak berhak mencatat pembayaran.' },
    };
  }

  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { order_id, amount, method, proof_path, note } = parsed.data;

  const supabase = await createClient();
  const order = await loadOrderContext(supabase, order_id);

  if (!order) {
    return {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Order tidak ditemukan atau di luar akses Anda.' },
    };
  }

  // Path bukti datang dari klien (unggahan langsung ke Storage), sementara
  // kebijakan bucket hanya membatasi bucket — bukan foldernya. Tanpa cek ini,
  // seseorang bisa menautkan bukti milik order lain ke pembayaran ini.
  if (proof_path && !isProofPathForOrder(proof_path, order.order_number)) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Path bukti transfer tidak sesuai dengan order ini.',
        fields: { proof_path: 'Bukti transfer tidak dikenali.' },
      },
    };
  }

  // Pelunasan penuh, bukan cicilan (keputusan pemilik, 29 September 2026).
  // Sebelumnya nominal apa pun di bawah sisa tagihan diterima dan order
  // berjalan begitu DP 50% terverifikasi; sekarang gerbangnya menuntut lunas,
  // jadi catatan parsial hanya akan menumpuk sebagai uang yang tidak pernah
  // menggerakkan apa pun.
  //
  // Sisa tagihan dihitung dari `paid_amount` — jumlah pembayaran yang sudah
  // **terverifikasi**. Catatan yang masih `pending` sengaja tidak ikut
  // dikurangkan: ia belum tentu jadi uang, dan mengurangkannya berarti nominal
  // yang benar ditolak hanya karena ada catatan yang belum diputuskan.
  //
  // Dibandingkan dalam sen bulat: kolom numeric(14,2) datang sebagai float, dan
  // selisih seperti 0.1 + 0.2 akan menolak nominal yang sebenarnya pas.
  const outstanding = order.total_amount - order.paid_amount;
  const amountCents = Math.round(amount * 100);
  const outstandingCents = Math.round(outstanding * 100);
  if (order.total_amount > 0 && amountCents !== outstandingCents) {
    const kurang = amountCents < outstandingCents;
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: kurang
          ? `Pembayaran harus lunas. Nominalnya ${outstanding.toLocaleString('id-ID')}, bukan sebagian.`
          : `Nominal melebihi sisa tagihan (${outstanding.toLocaleString('id-ID')}).`,
        fields: {
          amount: kurang ? 'Harus pas dengan sisa tagihan.' : 'Melebihi sisa tagihan.',
        },
      },
    };
  }

  // Satu pelunasan menunggu sudah menutup seluruh sisa tagihan, jadi catatan
  // kedua hampir pasti transfer yang sama dicatat dua kali (Simpan ditekan ulang,
  // atau dua admin di order yang sama). Dibiarkan, "Menunggu" terbaca dua kali
  // lipat nilai order dan verifikator harus menebak mana yang asli.
  const { count: pendingCount, error: pendingError } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', order_id)
    .eq('status', 'pending');
  if (pendingError) return internalError('Gagal memeriksa pembayaran tertunda', pendingError);
  if ((pendingCount ?? 0) > 0) {
    return conflict(
      'Order ini sudah punya pembayaran yang menunggu verifikasi. Verifikasi atau tolak dulu catatan itu.',
    );
  }

  const { data, error } = await supabase
    .from('payments')
    .insert({
      order_id,
      amount,
      method,
      proof_path: proof_path || null,
      note: note || null,
      status: 'pending',
    })
    .select('id')
    .maybeSingle();

  if (error) return internalError('Gagal mencatat pembayaran', error);

  if (!data) {
    return {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Pencatatan ditolak untuk order di luar akses Anda.' },
    };
  }

  revalidatePath(`/orders/${order_id}`);
  return { ok: true, data: { id: data.id } };
}

// =============================================================================
// Verifikasi / tolak (prd.md FR-P2)
// =============================================================================

/**
 * Menyetujui atau menolak satu pembayaran.
 *
 * Inilah titik uang diakui: begitu status menjadi `verified`, trigger
 * `sync_order_payment` memperbarui `orders.paid_amount` & `payment_status`,
 * dan gerbang pelunasan pada state machine ikut terbuka.
 */
export async function verifyPayment(
  input: unknown,
): Promise<ActionResult<{ advancedToPaid: boolean }>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'VERIFY_PAYMENT')) {
    return {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Role Anda tidak berhak memverifikasi pembayaran.' },
    };
  }

  const parsed = verifyPaymentSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { payment_id, decision, note } = parsed.data;

  const supabase = await createClient();
  const { data: payment, error: readError } = await supabase
    .from('payments')
    .select('id, order_id, amount, status')
    .eq('id', payment_id)
    .maybeSingle();

  if (readError) return internalError('Gagal memuat data pembayaran', readError);

  if (!payment) {
    return {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Pembayaran tidak ditemukan atau di luar akses Anda.' },
    };
  }

  if (payment.status !== 'pending') {
    return {
      ok: false,
      error: {
        code: 'CONFLICT',
        message: 'Pembayaran ini sudah pernah diverifikasi atau ditolak.',
      },
    };
  }

  if (decision === 'verified') {
    const order = await loadOrderContext(supabase, payment.order_id);
    if (!order) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Order induk tidak ditemukan.' } };
    }

    // Dicek ulang di sini, bukan hanya saat pencatatan: dua catatan pending
    // bisa masing-masing pas dengan sisa tagihan saat dicatat, lalu menjadi
    // kelebihan bayar begitu diverifikasi berurutan.
    const afterVerify = order.paid_amount + Number(payment.amount);
    if (order.total_amount > 0 && afterVerify > order.total_amount) {
      return {
        ok: false,
        error: {
          code: 'CONFLICT',
          message: `Verifikasi ini membuat total terbayar (${afterVerify.toLocaleString('id-ID')}) melebihi nilai order (${order.total_amount.toLocaleString('id-ID')}).`,
        },
      };
    }
  }

  const { data, error } = await supabase
    .from('payments')
    .update({
      status: decision,
      verified_by: session.id,
      // Constraint `payments_verified_consistency_check`: `verified_at` hanya
      // boleh terisi ketika status `verified`. Penolakan tetap mencatat siapa
      // yang memutuskan lewat `verified_by` dan audit trail.
      verified_at: decision === 'verified' ? new Date().toISOString() : null,
      ...(note ? { note } : {}),
    })
    .eq('id', payment_id)
    // Status lama ikut jadi syarat: dua verifikator yang menekan bersamaan
    // tidak boleh sama-sama dianggap berhasil.
    .eq('status', 'pending')
    .select('order_id')
    .maybeSingle();

  // 23514 dari `sync_order_payment`: pembayaran lain (webhook Durianpay atau
  // verifikator lain) terverifikasi di antara cek di atas dan UPDATE ini.
  // Database yang menolak, jadi pesannya bukan galat internal.
  if (error?.code === '23514') {
    return conflict(
      'Order ini sudah lunas oleh pembayaran lain. Muat ulang halaman, lalu tolak pembayaran ini bila memang ganda.',
    );
  }
  if (error) return internalError('Gagal memperbarui status pembayaran', error);

  if (!data) {
    return {
      ok: false,
      error: {
        code: 'CONFLICT',
        message:
          'Pembayaran sudah diproses pihak lain. Muat ulang halaman untuk melihat kondisi terkini.',
      },
    };
  }

  // Tagihan mungkin baru saja lunas — naikkan statusnya sekalian, kalau memang
  // sudah boleh. Tidak menggagalkan apa pun bila tertahan; lihat fungsinya.
  const advanced =
    decision === 'verified'
      ? await advanceToPaidIfReady(supabase, data.order_id, session.profile?.role)
      : false;

  revalidatePath(`/orders/${data.order_id}`);
  revalidatePath('/orders');
  revalidatePath('/dashboard');
  return { ok: true, data: { advancedToPaid: advanced } };
}

// =============================================================================
// Hapus catatan yang belum diverifikasi
// =============================================================================

/**
 * Menghapus pembayaran yang masih `pending` — mis. salah input.
 *
 * Berkas bukti di Storage sengaja dibiarkan: role pencatat tidak punya hak
 * hapus di bucket (`storage_payment_proofs_delete` hanya Manager Program), dan
 * berkas yatim memang sudah punya jadwal pembersihan sendiri (docs/17 section 5).
 */
export async function deletePayment(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'RECORD_PAYMENT')) {
    return {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Role Anda tidak berhak menghapus catatan pembayaran.' },
    };
  }

  const parsed = deletePaymentSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { data: payment } = await supabase
    .from('payments')
    .select('order_id, status')
    .eq('id', parsed.data.payment_id)
    .maybeSingle();

  if (!payment) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Pembayaran tidak ditemukan.' } };
  }

  // Pembayaran terverifikasi adalah bukti keuangan — tidak dihapus. Statusnya
  // ikut difilter di DELETE untuk menutup celah TOCTOU: tanpa itu, baris bisa
  // berubah menjadi `verified` di antara SELECT dan DELETE.
  const { data: deleted, error } = await supabase
    .from('payments')
    .delete()
    .eq('id', parsed.data.payment_id)
    .eq('status', 'pending')
    .select('id');

  if (error) return internalError('Gagal menghapus catatan pembayaran', error);

  if ((deleted ?? []).length === 0) {
    return {
      ok: false,
      error: {
        code: 'CONFLICT',
        message: 'Pembayaran sudah diverifikasi atau di luar akses Anda, jadi tidak dapat dihapus.',
      },
    };
  }

  revalidatePath(`/orders/${payment.order_id}`);
  return { ok: true, data: null };
}
