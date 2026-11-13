import { after, NextResponse } from 'next/server';
import { sendQueuedEmails } from '@/features/notifications/send-email';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  DurianpayUnavailableError,
  fetchCompletedPayment,
  paymentMatchesOrder,
  sandbox,
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
    data?: { id?: string; is_live?: boolean };
  } | null;

  if (body?.event !== 'payment.completed') return NextResponse.json({ ok: true });

  // Webhook dari dashboard sandbox tapi server memakai kunci live (atau
  // sebaliknya): pembayarannya tidak akan pernah ditemukan di host yang kita
  // tanya. Tetap diteruskan ke verifikasi (yang akan menolak), tapi sebabnya
  // dicatat terang supaya tidak terbaca sebagai pembayaran palsu.
  if (typeof body.data?.is_live === 'boolean' && body.data.is_live === sandbox()) {
    console.error(
      `[durianpay] webhook is_live=${body.data.is_live}, tapi DURIANPAY_SECRET_KEY server ` +
        `adalah kunci ${sandbox() ? 'sandbox (dp_test_)' : 'live'}. Samakan mode kunci dan dashboard.`,
    );
  }

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
  // Kiriman ulang untuk pembayaran yang sudah tercatat: order-nya kini sudah
  // lunas, jadi `paymentMatchesOrder` pasti menolak dan log-nya akan menyuruh
  // memeriksa refund yang tidak perlu. Dicek lebih dulu supaya tetap idempoten.
  const { data: recorded, error: recordedError } = await supabase
    .from('payments')
    .select('id')
    .eq('gateway_ref', payment.payId)
    .maybeSingle();
  if (recordedError) {
    console.error('[durianpay] gagal membaca pembayaran', recordedError);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  if (recorded) return NextResponse.json({ ok: true });

  if (!order || !paymentMatchesOrder(payment.amount, order)) {
    // Termasuk order batal/terhapus yang tetap dibayar: uangnya perlu dikembalikan.
    console.error(
      '[durianpay] webhook ditolak: order tidak cocok — periksa refund',
      payment,
      order,
    );
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

  // 23514 = `sync_order_payment` menolak kelebihan bayar: pembayaran lain
  // (mis. transfer yang diverifikasi admin) melunasi order ini sesaat sebelum
  // webhook masuk. Mengulang tidak akan mengubah apa pun, jadi dijawab 200 dan
  // uangnya diserahkan ke pemeriksaan manual.
  if (error?.code === '23514') {
    console.error('[durianpay] kelebihan bayar ditolak — periksa refund', payment, error.message);
    return NextResponse.json({ ok: true });
  }

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

  // Invoice lunas diantrekan trigger saat `payment_status` jadi `paid`;
  // dikirim sesudah Durianpay menerima 200, jadi webhook tidak ikut lambat.
  after(() => sendQueuedEmails().catch((e) => console.error('[email]', e)));

  return NextResponse.json({ ok: true });
}
