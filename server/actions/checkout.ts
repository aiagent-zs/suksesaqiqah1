'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { guestCheckoutSchema } from '@/features/checkout/schema';
import type { GuestOrderResult } from '@/features/checkout/queries';
import { RateLimiter, clientIpFrom } from '@/lib/security/rate-limit';
import { scopedInternalError, validationError, type ActionResult } from './result';

const internalError = scopedInternalError('checkout');

/**
 * Rem laju per alamat IP untuk checkout publik.
 *
 * Rem di database (`create_guest_order`: 5 order/jam per nomor telepon) memakai
 * kunci yang dikirim pengirimnya sendiri — skrip yang mengarang nomor acak
 * melewatinya tanpa hambatan. Kunci di sini tidak bisa dipilih pengirim.
 *
 * Angkanya sengaja longgar (10 per 10 menit): satu keluarga di balik satu IP
 * kantor atau NAT operator seluler harus tetap bisa memesan berulang kali,
 * sementara skrip yang membanjiri tabel `orders` tetap tertahan.
 *
 * Modul-level, jadi umurnya seumur instance server — lihat batas yang disengaja
 * di `lib/security/rate-limit.ts`. Untuk serangan terdistribusi, pertahanan yang
 * benar tetap rate limit di tepi (WAF / Redis bersama) atau captcha.
 */
const checkoutLimiter = new RateLimiter({ limit: 10, windowMs: 10 * 60 * 1000 });

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
  // Rem laju sebelum validasi: menolak banjiran permintaan tidak boleh menuntut
  // pekerjaan parsing lebih dulu.
  const ip = clientIpFrom(await headers());
  if (ip) {
    const gate = checkoutLimiter.consume(ip);
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
  }

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
      // `branch_id` sengaja tidak dikirim: pemilih wilayah dicabut dari form,
      // dan RPC menjatuhkannya ke `branches.is_default`.
      species: data.species,
      qty: data.qty,
      aqiqah_for: data.aqiqah_for,
      requested_date: data.requested_date,
      requested_time: data.requested_time,
      distribution_mode: data.distribution_mode,
      // Kosong = "Tidak pakai". RPC memperlakukan id kosong sebagai tanpa add-on.
      nasi_box_service_id: data.nasi_box_service_id || null,
      nasi_box_qty: data.nasi_box_qty ?? 0,
      // Nama anak dan nasabnya disatukan di sini — `animals.on_behalf_of`
      // menyimpannya sebagai satu teks.
      on_behalf_of: [data.child_name, data.bin_binti].filter(Boolean).join(' ').trim(),
      // Hanya kode wilayahnya. `delivery_address` satu baris tidak dikirim dari
      // sini — RPC merakitnya sendiri dari nama yang ia baca di `regions`.
      delivery_province_code: data.delivery_province_code || null,
      delivery_city_code: data.delivery_city_code || null,
      delivery_district_code: data.delivery_district_code || null,
      delivery_village_code: data.delivery_village_code || null,
      delivery_postal_code: data.delivery_postal_code || null,
      delivery_detail: data.delivery_detail || null,
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
