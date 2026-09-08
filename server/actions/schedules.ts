'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/server/auth/session';
import { canDo } from '@/server/auth/capabilities';
import {
  assignVendorSchema,
  createLocationSchema,
  deleteLocationSchema,
  saveScheduleSchema,
  updateLocationSchema,
} from '@/features/schedules/schema';

import {
  conflict,
  forbidden,
  notFound,
  scopedInternalError,
  validationError,
  type ActionResult,
} from './result';

const internalError = scopedInternalError('schedules');

// =============================================================================
// Tetapkan tanggal & lokasi
// =============================================================================

/**
 * Simpan (buat atau perbarui) jadwal sebuah order.
 *
 * `schedules.order_id` unik — satu order satu jadwal — jadi operasinya upsert
 * dengan `onConflict: 'order_id'`, bukan insert yang akan gagal pada
 * penyuntingan kedua.
 *
 * Yang **hilang** dari versi sebelumnya: pemeriksaan `pic.branch_id !==
 * order.branch_id`. Cek itu menolak setiap vendor yang baru dibuat, karena
 * akun vendor lahir tanpa cabang sementara order selalu punya — jadi sistemnya
 * macet total di titik penugasan. Cabang sudah tidak ada, dan penugasan mitra
 * kini punya action-nya sendiri di bawah.
 */
export async function saveSchedule(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_SCHEDULE')) {
    return forbidden('Role Anda tidak berhak mengatur jadwal.');
  }

  const parsed = saveScheduleSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { order_id, location_id, scheduled_date, scheduled_time, notes } = parsed.data;

  const supabase = await createClient();

  const { data: order } = await supabase
    .from('orders')
    .select('id, status, vendor_id')
    .eq('id', order_id)
    .maybeSingle();

  if (!order) return notFound('Order tidak ditemukan atau di luar akses Anda.');

  if (order.status === 'completed' || order.status === 'cancelled') {
    return conflict('Order yang sudah selesai atau dibatalkan tidak dapat dijadwalkan ulang.');
  }

  // Lokasi milik mitra lain tidak masuk akal untuk order ini. Pemeriksaan ini
  // baru punya arti sejak lokasi dimiliki mitra — sebelumnya ia membandingkan
  // cabang, yang sudah lama tidak membatasi apa pun.
  if (location_id) {
    const { data: location } = await supabase
      .from('locations')
      .select('id, vendor_id')
      .eq('id', location_id)
      .maybeSingle();

    if (!location) return notFound('Lokasi tidak ditemukan.');

    if (location.vendor_id && order.vendor_id && location.vendor_id !== order.vendor_id) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Lokasi ini milik mitra lain.',
          fields: { location_id: 'Bukan lokasi mitra yang ditugaskan.' },
        },
      };
    }
  }

  const { data, error } = await supabase
    .from('schedules')
    .upsert(
      {
        order_id,
        location_id: location_id || null,
        scheduled_date,
        scheduled_time: scheduled_time || null,
        notes: notes || null,
      },
      { onConflict: 'order_id' },
    )
    .select('order_id');

  if (error) return internalError('Gagal menyimpan jadwal', error);

  // PostgREST tidak menganggap upsert yang mengenai 0 baris sebagai error —
  // tanpa cek ini, penolakan RLS terlihat sebagai sukses di layar.
  if ((data ?? []).length === 0) {
    return forbidden('Penyimpanan ditolak untuk order di luar akses Anda.');
  }

  revalidatePath(`/orders/${order_id}`);
  revalidatePath('/schedule');
  return { ok: true, data: null };
}

// =============================================================================
// Daftarkan lokasi baru
// =============================================================================

/**
 * Buat satu lokasi pelaksanaan baru.
 *
 * Tabel `locations` sebelumnya tidak punya satu pun jalan masuk lewat aplikasi:
 * barisnya hanya lahir dari seed, sehingga menambah tempat baru menuntut akses
 * langsung ke database. Itu tidak berkelanjutan — lokasi salur berganti hampir
 * tiap order (masjid, panti, kampung penerima manfaat yang berbeda-beda),
 * sementara yang tahu tempatnya adalah admin yang sedang menjadwalkan.
 *
 * **`vendor_id` diisi server, tidak pernah diterima dari klien.** Kalau boleh
 * dikirim, seseorang bisa mendaftarkan lokasi atas nama mitra lain lalu
 * memakainya untuk menembus pemeriksaan "lokasi ini milik mitra lain" di
 * `saveSchedule` — penjaga yang justru baru punya arti sejak lokasi dimiliki
 * mitra.
 *
 * Wewenangnya `MANAGE_SCHEDULE` (staf), bukan `MANAGE_MASTER_DATA`: lokasi
 * dibuat di tengah penjadwalan, oleh orang yang sedang mengerjakan order itu.
 * Menahannya di superadmin berarti admin harus meminta tolong setiap kali ada
 * alamat baru — dan yang terjadi kemudian adalah alamat ditulis di kolom
 * catatan, di luar jangkauan seluruh laporan.
 *
 * RLS `locations_write` masih menuntut `is_superadmin()`, jadi admin tetap
 * ditolak database sampai migration pendampingnya ikut naik. Penolakannya
 * dikenali dan diterjemahkan di bawah, bukan dibiarkan tampil sebagai galat
 * internal yang tidak bisa ditindaklanjuti siapa pun.
 */
export async function createLocation(
  input: unknown,
): Promise<ActionResult<{ id: string; name: string }>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_SCHEDULE')) {
    return forbidden('Role Anda tidak berhak mendaftarkan lokasi.');
  }

  const parsed = createLocationSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { name, address } = parsed.data;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('locations')
    .insert({
      name,
      address,
      // Selalu milik bersama. Kepemilikan mitra hanya ada pada baris seed lama
      // dan tidak pernah dibuat dari aplikasi — lihat `createLocationSchema`.
      vendor_id: null,
    })
    .select('id, name')
    .maybeSingle();

  // `42501` = insufficient_privilege, penolakan RLS yang eksplisit.
  if (error?.code === '42501') {
    return forbidden('Pendaftaran lokasi baru masih dibatasi superadmin.');
  }
  if (error) return internalError('Gagal mendaftarkan lokasi', error);

  // PostgREST tidak menganggap insert yang tersaring RLS sebagai error; tanpa
  // cek ini penolakannya terlihat sebagai sukses di layar.
  if (!data) return forbidden('Pendaftaran lokasi ditolak untuk role Anda.');

  revalidatePath('/schedule');
  return { ok: true, data: { id: data.id, name: data.name } };
}

/**
 * Ubah nama atau alamat sebuah lokasi.
 *
 * Salah ketik nama tempat paling sering ketahuan justru saat order berikutnya
 * dijadwalkan di sana — oleh admin yang sama, yang sebelumnya tidak bisa
 * membetulkannya sendiri.
 *
 * `vendor_id` sengaja tidak ikut disunting: memindahkan kepemilikan lokasi
 * membuat ia lenyap dari order mitra lain yang sudah memakainya, dan itu bukan
 * hal yang layak terjadi sebagai efek samping dari membetulkan sebuah alamat.
 */
export async function updateLocation(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_SCHEDULE')) {
    return forbidden('Role Anda tidak berhak mengubah lokasi.');
  }

  const parsed = updateLocationSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { id, name, address } = parsed.data;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('locations')
    .update({ name, address })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id');

  if (error?.code === '42501') {
    return forbidden('Perubahan lokasi masih dibatasi superadmin.');
  }
  if (error) return internalError('Gagal mengubah lokasi', error);
  if ((data ?? []).length === 0) return notFound('Lokasi tidak ditemukan.');

  revalidatePath('/schedule');
  return { ok: true, data: null };
}

/**
 * Hapus lokasi — `deleted_at`, bukan `delete`.
 *
 * `schedules.location_id` merujuknya, jadi penghapusan sungguhan memutus jejak
 * ke mana pelaksanaan sebuah order berlangsung — termasuk yang sudah tercetak
 * di laporan peserta. Seluruh pembacaan lokasi sudah menyaring
 * `deleted_at is null`, jadi barisnya hilang dari daftar tanpa memutus rujukan.
 *
 * Lokasi yang masih dipakai order berjalan ditahan lebih dulu: menghapusnya
 * meninggalkan jadwal yang menunjuk tempat yang tidak lagi muncul di mana pun,
 * dan mitra yang membuka ordernya kehilangan alamat tujuannya menjelang
 * berangkat.
 */
export async function deleteLocation(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  // Sejalan dengan `locations_delete` yang menuntut `is_superadmin()`:
  // menawarkan tombol yang pasti ditolak database hanya membuang waktu.
  if (session.profile?.role !== 'superadmin') {
    return forbidden('Penghapusan lokasi hanya dapat dilakukan superadmin.');
  }

  const parsed = deleteLocationSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { id } = parsed.data;

  const supabase = await createClient();

  const { count, error: countError } = await supabase
    .from('schedules')
    .select('order_id, order:orders!inner ( status )', { count: 'exact', head: true })
    .eq('location_id', id)
    .not('order.status', 'in', '("completed","cancelled")');

  // Hitungan yang gagal menahan, bukan meloloskan: `count` null pada error, dan
  // `(count ?? 0) > 0` justru akan meloloskan penghapusan saat datanya tidak
  // terbaca — persis keadaan yang paling perlu ditahan.
  if (countError || count === null) {
    return internalError(
      'Gagal memeriksa pemakaian lokasi',
      countError ?? { message: 'count kosong' },
    );
  }

  if (count > 0) {
    return conflict(
      `Lokasi ini masih dipakai ${count} order berjalan. Pindahkan jadwalnya lebih dulu.`,
    );
  }

  const { data, error } = await supabase
    .from('locations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id');

  if (error?.code === '42501') {
    return forbidden('Penghapusan lokasi hanya dapat dilakukan superadmin.');
  }
  if (error) return internalError('Gagal menghapus lokasi', error);
  if ((data ?? []).length === 0) return notFound('Lokasi tidak ditemukan.');

  revalidatePath('/schedule');
  return { ok: true, data: null };
}

// =============================================================================
// Tetapkan mitra pelaksana
// =============================================================================

/**
 * Tugaskan sebuah order kepada mitra.
 *
 * Dipisah dari penyimpanan jadwal dengan sengaja: inilah satu-satunya hal yang
 * membuat vendor bisa melihat order sama sekali — `can_read_order`
 * membandingkan `orders.vendor_id` dengan `profiles.vendor_id`. Aksi sepenting
 * itu pantas berdiri sendiri, terlihat jelas di layar dan di audit.
 *
 * Begitu status order naik ke `assigned`, trigger `generate_stage_checklist`
 * menerbitkan daftar tahap sesuai cara penyaluran — vendor langsung punya
 * daftar kerja, bukan formulir kosong.
 */
export async function assignVendor(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'ASSIGN_VENDOR')) {
    return forbidden('Penugasan mitra dilakukan admin.');
  }

  const parsed = assignVendorSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { order_id, vendor_id } = parsed.data;

  const supabase = await createClient();

  const { data: order } = await supabase
    .from('orders')
    .select('id, status, distribution_mode, vendor_id')
    .eq('id', order_id)
    .maybeSingle();

  if (!order) return notFound('Order tidak ditemukan atau di luar akses Anda.');

  if (order.status === 'completed' || order.status === 'cancelled') {
    return conflict('Order yang sudah selesai atau dibatalkan tidak dapat ditugaskan ulang.');
  }

  // Cara penyaluran menentukan rangkaian tahap yang akan terbit. Tanpa itu
  // trigger tidak tahu daftar apa yang harus dibuat — dan memang menolak.
  if (!order.distribution_mode) {
    return conflict('Cara penyaluran belum ditentukan, jadi tahapannya belum bisa disusun.');
  }

  const { data: vendor } = await supabase
    .from('vendors')
    .select('id, name, is_active, service_modes')
    .eq('id', vendor_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!vendor) return notFound('Mitra tidak ditemukan.');

  if (!vendor.is_active) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Mitra ini sedang tidak aktif.',
        fields: { vendor_id: 'Mitra non-aktif.' },
      },
    };
  }

  // Mitra yang tidak melayani "kirim" tidak boleh dapat order Aqiqah Kirim:
  // tahap pengantaran akan terbit dan tidak akan pernah bisa ia penuhi.
  if (!vendor.service_modes.includes(order.distribution_mode)) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `Mitra ${vendor.name} tidak melayani cara penyaluran ini.`,
        fields: { vendor_id: 'Mode tidak dilayani mitra ini.' },
      },
    };
  }

  // Penguncian optimistik: dua admin yang menugaskan bersamaan tidak bisa
  // sama-sama berhasil — yang kedua menemukan `vendor_id` sudah bukan nilai
  // yang ia baca, dan barisnya tidak ikut terbarui.
  //
  // Cabang `is null` bukan gaya penulisan, melainkan keharusan: SQL `= NULL`
  // tidak pernah benar, dan PostgREST menerjemahkan `.eq(col, null)` menjadi
  // `vendor_id=eq.null` — Postgres lalu mencoba membaca string "null" sebagai
  // uuid dan gagal dengan 22P02. Order yang belum punya mitra **selalu** NULL,
  // jadi cabang ini persis jalur penugasan pertama: yang paling sering dipakai,
  // dan satu-satunya yang tidak pernah berhasil sebelum ini.
  const guarded = supabase.from('orders').update({ vendor_id }).eq('id', order_id);

  const { data, error } = await (
    order.vendor_id === null
      ? guarded.is('vendor_id', null)
      : guarded.eq('vendor_id', order.vendor_id)
  ).select('id');

  if (error) return internalError('Gagal menetapkan mitra', error);

  if ((data ?? []).length === 0) {
    return conflict('Penugasan tidak tersimpan: mitra sudah diubah orang lain lebih dulu.');
  }

  revalidatePath(`/orders/${order_id}`);
  revalidatePath('/schedule');
  return { ok: true, data: null };
}
