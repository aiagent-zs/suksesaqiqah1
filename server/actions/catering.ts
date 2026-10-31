'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getChannel } from '@/lib/brand-server';
import { cateringCheckoutSchema } from '@/features/catering/schema';
import type { CateringOrderResult } from '@/features/catering/queries';
import { createPaymentLink } from '@/features/payments/durianpay';
import { RateLimiter, clientIpFrom } from '@/lib/security/rate-limit';
import { scopedInternalError, validationError, type ActionResult } from './result';

const internalError = scopedInternalError('catering');

/**
 * Rem laju per alamat IP untuk checkout katering.
 *
 * **Instance sendiri, bukan berbagi dengan checkout aqiqah** — dan itu memang
 * yang diinginkan: pemesan yang baru saja memesan aqiqah tidak seharusnya
 * tertahan ketika ia juga ingin memesan katering untuk acara yang sama.
 *
 * Angkanya sengaja longgar (10 per 10 menit): satu keluarga di balik satu IP
 * kantor atau NAT operator seluler harus tetap bisa memesan berulang kali,
 * sementara skrip yang membanjiri tabel `orders` tetap tertahan.
 *
 * Rem di database (`create_catering_order`: 5 order/jam per nomor telepon)
 * memakai kunci yang dikirim pengirimnya sendiri — skrip yang mengarang nomor
 * acak melewatinya tanpa hambatan. Kunci di sini tidak bisa dipilih pengirim.
 */
const cateringLimiter = new RateLimiter({ limit: 10, windowMs: 10 * 60 * 1000 });

/**
 * Kode error Postgres yang dipakai `create_catering_order` untuk penolakan yang
 * memang layak dibacakan ke pengunjung — bukan kegagalan tak terduga.
 *
 * Pesannya ditulis di dalam fungsi SQL dan sudah berbahasa Indonesia, jadi
 * diteruskan apa adanya. Selain kode-kode ini, pesan mentah Postgres tidak
 * pernah sampai ke layar: isinya membocorkan nama tabel dan kolom.
 */
const EXPECTED_REJECTIONS = new Set(['23514', 'P0002', 'P0003']);

/**
 * Buat order katering dari checkout publik.
 *
 * Pemanggilnya tidak login, jadi seluruh penulisan lewat RPC
 * `create_catering_order` yang SECURITY DEFINER — `anon` sendiri ditolak RLS
 * pada setiap tabel operasional. Harga, status, dan jumlah terbayar **tidak**
 * dikirim dari sini; RPC membacanya dari tabel `services`.
 */
export async function createCateringOrderAction(
  input: unknown,
): Promise<ActionResult<CateringOrderResult>> {
  // Rem laju sebelum validasi: menolak banjiran permintaan tidak boleh menuntut
  // pekerjaan parsing lebih dulu.
  // Tanpa IP berbagi satu kunci: tidak dihitung sama sekali = tanpa rem.
  const gate = cateringLimiter.consume(clientIpFrom(await headers()) ?? 'unknown');
  if (!gate.allowed) {
    const minutes = Math.max(1, Math.ceil(gate.retryAfterMs / 60_000));
    return {
      ok: false,
      error: {
        code: 'CONFLICT',
        message:
          `Terlalu banyak percobaan pemesanan dari jaringan ini. ` +
          `Coba lagi dalam ${minutes} menit, atau hubungi kami lewat WhatsApp.`,
      },
    };
  }

  const parsed = cateringCheckoutSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;
  const supabase = await createClient();

  const { data: result, error } = await supabase
    .rpc('create_catering_order', {
      p_payload: {
        participant: {
          name: data.name,
          phone: data.phone,
          email: data.email,
          address: data.address || null,
        },
        // Beberapa paket sekaligus. Hanya id & jumlahnya — harga tiap baris
        // dibaca ulang RPC dari `services`.
        items: data.items.map((i) => ({ service_id: i.service_id, qty: i.qty })),
        requested_date: data.requested_date,
        requested_time: data.requested_time,
        // `distribution_mode` sengaja tidak dikirim: katering selalu `kirim`, dan
        // RPC menetapkannya sendiri. Menerimanya dari klien berarti membuka mode
        // `salur` untuk pesanan yang memang harus diantar.
        delivery_province_code: data.delivery_province_code,
        delivery_city_code: data.delivery_city_code,
        delivery_district_code: data.delivery_district_code,
        delivery_village_code: data.delivery_village_code,
        delivery_postal_code: data.delivery_postal_code,
        delivery_detail: data.delivery_detail,
        recipient_institution: data.recipient_institution || null,
        referral_code: data.referral_code || null,
        notes: data.notes || null,
      },
    })
    // Kanal masuk → `orders.channel` lewat trigger `set_order_channel`.
    .setHeader('x-order-channel', await getChannel());

  if (error) {
    if (EXPECTED_REJECTIONS.has(error.code ?? '')) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: error.message } };
    }
    return internalError('Gagal memproses pesanan katering', error);
  }

  if (!result)
    return internalError('Pesanan tidak terbentuk', { message: 'RPC mengembalikan null' });

  const order = result as unknown as CateringOrderResult;
  // Gagal membuat link tidak menggagalkan pesanan — order sudah tersimpan, dan
  // layar sukses jatuh kembali ke WhatsApp admin.
  const payment_url = await createPaymentLink({
    order_number: order.order_number,
    total_amount: Number(order.total_amount),
    name: data.name,
    phone: data.phone,
    email: data.email,
  });
  return { ok: true, data: { ...order, payment_url } };
}
