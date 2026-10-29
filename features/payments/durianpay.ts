/**
 * Durianpay — dipanggil hanya dari server (server action & route webhook).
 *
 * Sandbox dan live beda kunci sekaligus beda host: kunci `dp_test_` ditolak
 * (401) di host live, jadi host dipilih dari awalan kuncinya. Auth-nya Basic
 * dengan kunci sebagai username dan password kosong.
 */
const LINK_BASE = 'https://links.durianpay.id/payment/';

async function dpFetch(path: string, init?: RequestInit): Promise<Record<string, unknown> | null> {
  const key = process.env.DURIANPAY_SECRET_KEY;
  if (!key) return null;
  const host = key.startsWith('dp_test_') ? 'api-sandbox.durianpay.id' : 'api.durianpay.id';
  const res = await fetch(`https://${host}/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error(`[durianpay] ${init?.method ?? 'GET'} ${path} → ${res.status}`);
    return null;
  }
  const body = (await res.json()) as Record<string, unknown>;
  // Sebagian respons dibungkus `data`, sebagian tidak — keduanya diterima.
  return (body.data as Record<string, unknown> | undefined) ?? body;
}

/** `0812-3456 789` → `08123456789`; `+62 812…` → `+62812…`. Durianpay hanya menerima dua bentuk itu. */
export function normalizeMobile(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('62')) return `+${digits}`;
  if (digits.startsWith('0')) return digits;
  return null;
}

/**
 * Buat payment link untuk satu order (pelunasan penuh).
 *
 * `order_ref_id` = nomor order kita — dari situlah webhook menemukan order-nya
 * kembali. Mengembalikan `null` bila kunci belum diisi atau Durianpay menolak:
 * order sudah tersimpan, jadi pemesan tetap bisa dilayani lewat WhatsApp.
 */
export async function createPaymentLink(order: {
  order_number: string;
  total_amount: number;
  name: string;
  phone: string;
  email?: string | null;
}): Promise<string | null> {
  try {
    const mobile = normalizeMobile(order.phone);
    const data = await dpFetch('/orders', {
      method: 'POST',
      body: JSON.stringify({
        amount: String(Math.round(order.total_amount)),
        currency: 'IDR',
        payment_option: 'full_payment',
        is_payment_link: true,
        order_ref_id: order.order_number,
        customer: {
          given_name: order.name,
          ...(mobile ? { mobile } : {}),
          ...(order.email ? { email: order.email } : {}),
        },
      }),
    });
    const code = data?.payment_link_url;
    return typeof code === 'string' && code ? `${LINK_BASE}${code}` : null;
  } catch (err) {
    console.error('[durianpay] gagal membuat payment link', err);
    return null;
  }
}

export type VerifiedPayment = {
  payId: string;
  orderNumber: string;
  amount: number;
  method: string;
};

/**
 * Tanya ulang Durianpay soal satu pembayaran — isi webhook tidak dipercaya.
 *
 * Siapa pun bisa menembak URL webhook dengan JSON karangan; yang tidak bisa
 * mereka palsukan adalah jawaban API Durianpay atas kunci rahasia kita. Jadi
 * yang dipakai dari webhook hanya `pay_...`-nya, sisanya dibaca dari sumbernya.
 */
export async function fetchCompletedPayment(payId: string): Promise<VerifiedPayment | null> {
  if (!/^pay_[A-Za-z0-9]+$/.test(payId)) return null;
  const payment = await dpFetch(`/payments/${payId}`);
  if (!payment || payment.status !== 'completed') return null;

  const dpOrderId = String(payment.order_id ?? '');
  if (!/^ord_[A-Za-z0-9]+$/.test(dpOrderId)) return null;
  const order = await dpFetch(`/orders/${dpOrderId}`);
  const orderNumber = order?.order_ref_id;
  if (typeof orderNumber !== 'string' || !orderNumber) return null;

  return {
    payId,
    orderNumber,
    amount: Number(payment.amount),
    method: String(payment.payment_method ?? payment.payment_method_id ?? ''),
  };
}

/** Pelunasan penuh: nominal harus pas dengan total order, dan order belum lunas. */
export function paymentMatchesOrder(
  amount: number,
  order: { total_amount: number; payment_status: string },
): boolean {
  return (
    order.payment_status !== 'paid' &&
    Number.isFinite(amount) &&
    amount === Number(order.total_amount)
  );
}
