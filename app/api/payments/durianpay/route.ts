import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  DurianpayUnavailableError,
  fetchCompletedPayment,
  paymentMatchesOrder,
} from '@/features/payments/durianpay';

/**
 * Webhook Durianpay — dipasang di dashboard Durianpay sebagai URL webhook primary.
 *
 * Isi webhook tidak dipercaya; pembayarannya dibaca ulang dari API Durianpay
 * (`fetchCompletedPayment`). Pembayaran yang lolos langsung dicatat `verified`,
 * dan trigger `sync_order_payment` menaikkan `payment_status` order-nya.
 *
 * Status HTTP-nya bermakna: 200 = selesai (termasuk "diabaikan"), 500 = coba
 * lagi. Durianpay mengulang hanya bila tidak menerima 200, jadi penolakan
 * permanen (pembayaran palsu, nominal salah) tetap dijawab 200 supaya tidak
 * diulang lima kali — jejaknya ada di log. Durianpay yang sedang bermasalah
 * dijawab 500: kalau 200, pembayaran sungguhan tidak pernah tercatat.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    event?: string;
    data?: { id?: string };
  } | null;

  if (body?.event !== 'payment.completed') return NextResponse.json({ ok: true });

  let payment: Awaited<ReturnType<typeof fetchCompletedPayment>>;
  try {
    payment = await fetchCompletedPayment(String(body.data?.id ?? ''));
  } catch (err) {
    if (!(err instanceof DurianpayUnavailableError)) throw err;
    console.error('[durianpay] belum bisa memverifikasi, minta diulang', err.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  if (!payment) {
    console.warn('[durianpay] webhook ditolak: pembayaran tidak terverifikasi', body.data?.id);
    return NextResponse.json({ ok: true });
  }

  const supabase = createAdminClient();
  const { data: order, error: readError } = await supabase
    .from('orders')
    .select('id, status, total_amount, payment_status, deleted_at')
    .eq('order_number', payment.orderNumber)
    .maybeSingle();

  if (readError) {
    console.error('[durianpay] gagal membaca order', readError);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  if (!order || !paymentMatchesOrder(payment.amount, order)) {
    // Termasuk order batal/terhapus yang tetap dibayar: uangnya perlu dikembalikan.
    console.error('[durianpay] webhook ditolak: order tidak cocok — periksa refund', payment, order);
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase.from('payments').insert({
    order_id: order.id,
    amount: payment.amount,
    method: 'durianpay',
    status: 'verified',
    verified_at: new Date().toISOString(),
    gateway_ref: payment.payId,
    note: `Durianpay ${payment.method}`.trim(),
  });

  // 23505 = `gateway_ref` sudah ada: webhook kiriman ulang, uangnya sudah tercatat.
  if (error && error.code !== '23505') {
    console.error('[durianpay] gagal mencatat pembayaran', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // Sama dengan `advanceToPaidIfReady` pada verifikasi manual: order yang sudah
  // diverifikasi admin naik ke `paid` begitu lunas. Order tamu yang belum
  // diverifikasi tetap di `new` — admin yang memverifikasinya lebih dulu.
  const { error: advanceError } = await supabase
    .from('orders')
    .update({ status: 'paid' })
    .eq('id', order.id)
    .eq('status', 'verified')
    .eq('payment_status', 'paid');
  if (advanceError) console.error('[durianpay] gagal menaikkan status ke paid', advanceError);

  return NextResponse.json({ ok: true });
}
