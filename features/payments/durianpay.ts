/**
 * Durianpay — dipanggil hanya dari server (server action & route webhook).
 *
 * Sandbox dan live beda kunci sekaligus beda host (API maupun halaman bayar):
 * kunci `dp_test_` ditolak (401) di host live, dan link sandbox tidak dikenal
 * di `links.`, jadi keduanya dipilih dari awalan kuncinya. Auth-nya Basic
 * dengan kunci sebagai username dan password kosong.
 */
const sandbox = () => process.env.DURIANPAY_SECRET_KEY?.startsWith('dp_test_') ?? false;

/** Durianpay tidak menjawab dengan benar (5xx, 429, jaringan, timeout): coba lagi nanti. */
export class DurianpayUnavailableError extends Error {}

async function dpFetch(path: string, init?: RequestInit): Promise<Record<string, unknown> | null> {
  const key = process.env.DURIANPAY_SECRET_KEY;
  if (!key) return null;
  const host = sandbox() ? 'api-sandbox.durianpay.id' : 'api.durianpay.id';
  let res: Response;
  try {
    res = await fetch(`https://${host}/v1${path}`, {
      ...init,
      headers: {
        Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
  } catch (err) {
    throw new DurianpayUnavailableError(`${init?.method ?? 'GET'} ${path}: ${String(err)}`);
  }
  if (!res.ok) {
    console.error(`[durianpay] ${init?.method ?? 'GET'} ${path} → ${res.status}`);
    // 4xx = permintaan ditolak permanen; 429 dan 5xx = Durianpay sedang bermasalah.
    if (res.status === 429 || res.status >= 500) {
      throw new DurianpayUnavailableError(`${path} → ${res.status}`);
    }
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
    return typeof code === 'string' && code
      ? `https://${sandbox() ? 'links-sandbox' : 'links'}.durianpay.id/payment/${code}`
      : null;
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
 *
 * `null` = ditolak permanen. Melempar `DurianpayUnavailableError` bila
 * Durianpay tidak bisa ditanya sekarang, supaya webhook dijawab 500 dan diulang.
 */
export async function fetchCompletedPayment(payId: string): Promise<VerifiedPayment | null> {
  if (!/^pay_[A-Za-z0-9]+$/.test(payId)) return null;
  // Tanpa `expand` endpoint detail menjawab 404 (teruji di sandbox, 2026-10-30);
  // `expand=order` sekaligus membawa `order_ref_id`, jadi cukup satu panggilan.
  const payment = await dpFetch(`/payments/${payId}?expand=order`);
  if (!payment || payment.status !== 'completed') return null;

  const order = payment.order as Record<string, unknown> | undefined;
  const orderNumber = order?.order_ref_id;
  if (typeof orderNumber !== 'string' || !orderNumber) {
    // `expand=order` baru teruji di sandbox; kalau bentuk live berbeda, log ini
    // yang menunjukkannya, dan Durianpay mengulang alih-alih uangnya hilang.
    throw new DurianpayUnavailableError(
      `order_ref_id tidak ada pada ${payId}; kunci: ${Object.keys(payment).join(',')}`,
    );
  }

  return {
    payId,
    orderNumber,
    amount: Number(payment.amount),
    method: String(payment.method_id ?? payment.payment_method ?? ''),
  };
}

/**
 * Pelunasan penuh: nominal harus pas dengan total order (dibulatkan sama
 * seperti saat link dibuat), dan order masih bisa menerima pembayaran.
 */
export function paymentMatchesOrder(
  amount: number,
  order: { total_amount: number; payment_status: string; status?: string; deleted_at?: string | null },
): boolean {
  return (
    order.payment_status !== 'paid' &&
    order.status !== 'cancelled' &&
    !order.deleted_at &&
    Number.isFinite(amount) &&
    Math.round(amount) === Math.round(Number(order.total_amount))
  );
}
