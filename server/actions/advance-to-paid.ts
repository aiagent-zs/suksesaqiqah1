import 'server-only';

import type { createClient } from '@/lib/supabase/server';
import { checkTransition } from '@/features/orders/state-machine';
import { getOrderDetail } from '@/features/orders/queries';

// Sengaja di luar berkas `'use server'`: setiap ekspor dari berkas itu menjadi
// endpoint yang bisa dipanggil klien, padahal fungsi ini tidak memeriksa
// sesi sendiri — pemanggilnya yang sudah memeriksa.

/**
 * Naikkan `verified → paid` bila tagihannya sudah lunas.
 *
 * Dipanggil sesudah verifikasi pembayaran berhasil, dan sesudah order
 * diverifikasi admin (`changeOrderStatus`) — order yang lebih dulu lunas lewat
 * Durianpay tidak perlu menunggu tombol "Terbayar". Alasannya: syarat transisi
 * itu **persis** hal yang barusan dikerjakan — `paymentGatePassed`, tidak ada
 * yang lain. Menyuruh admin menekan "Terbayar" sesudahnya berarti meminta ia
 * menegaskan sesuatu yang sudah ia buktikan satu detik sebelumnya, di panel
 * yang tepat di sebelahnya.
 *
 * **Tidak ada aturan baru di sini.** Keputusannya diserahkan ke
 * `checkTransition` yang sama dengan yang dipakai tombol manual, dengan konteks
 * yang dibaca ulang dari database sesudah trigger `sync_order_payment` selesai.
 * Jadi kenaikan otomatis ini tidak mungkin melewati gerbang yang akan menahan
 * penekanan tombolnya.
 *
 * **Gagal tidak membatalkan verifikasinya.** Pembayarannya sudah sah tersimpan;
 * kalau kenaikan status tertahan — order tamu belum diverifikasi, atau status
 * sudah digerakkan orang lain — yang benar adalah membiarkan tombolnya tetap
 * ada, bukan menggagalkan pencatatan uang yang sudah masuk. Karena itu
 * fungsinya tidak pernah melempar dan tidak mengembalikan kegagalan.
 *
 * Hanya `verified → paid` yang diotomatiskan. Transisi lain menuntut pekerjaan
 * yang tidak terjadi di panel ini (mitra ditetapkan, hewan didaftarkan), jadi
 * menaikkannya berantai akan melompati keputusan yang memang milik admin.
 */
export async function advanceToPaidIfReady(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
  role: Parameters<typeof checkTransition>[2],
): Promise<boolean> {
  // Dibaca ulang, bukan dihitung sendiri: `payment_status` baru ditulis oleh
  // trigger `sync_order_payment` sesudah UPDATE pembayaran di atas, dan
  // menyalin rumusnya ke sini berarti dua sumber kebenaran untuk gerbang yang
  // sama.
  const detail = await getOrderDetail(orderId);
  if (!detail) return false;

  if (detail.order.status !== 'verified') return false;
  if (!checkTransition('verified', 'paid', role, detail.guard).ok) return false;

  const { data } = await supabase
    .from('orders')
    .update({ status: 'paid' })
    .eq('id', orderId)
    // Status lama jadi syarat: kalau ada yang menggerakkannya lebih dulu,
    // kenaikan ini batal tanpa menimpa apa pun.
    .eq('status', 'verified')
    .select('id');

  return (data ?? []).length > 0;
}
