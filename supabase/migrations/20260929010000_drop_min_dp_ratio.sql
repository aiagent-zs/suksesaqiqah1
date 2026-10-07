-- =============================================================================
-- Cabut gerbang DP parsial
--
-- Keputusan pemilik 29 September 2026: order tidak bergerak sampai tagihannya
-- lunas. Sebelumnya `verified -> paid` terbuka begitu pembayaran terverifikasi
-- mencapai `min_dp_ratio` (50%), jadi mitra bisa mulai bekerja di atas uang
-- yang belum utuh.
--
-- Yang dicabut di sini hanya sisa-sisanya di database. Gerbangnya sendiri tidak
-- pernah tinggal di sini: `paymentGatePassed` di
-- `features/orders/state-machine.ts` yang menegakkannya, dan ia kini membaca
-- `orders.payment_status` — kolom yang sudah ditulis `sync_order_payment` dari
-- jumlah pembayaran terverifikasi saja.
--
-- `sync_order_payment` sengaja TIDAK disentuh. Ia tetap menuliskan `partial`
-- untuk pembayaran yang belum menutup tagihan, dan itu memang yang benar:
-- status itu menggambarkan keadaan uang, bukan izin order berjalan. Order lama
-- yang terlanjur `partial` tetap terbaca apa adanya, hanya tidak lagi bisa
-- naik status sampai dilunasi.
-- =============================================================================

drop function if exists public.min_dp_ratio();

delete from public.app_settings where key = 'min_dp_ratio';
