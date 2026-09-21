-- =============================================================================
-- Nilai enum `katering` pada `service_type`
--
-- **Berkas ini sengaja hanya berisi satu baris.** Postgres menolak nilai enum
-- baru *dipakai* dalam transaksi yang sama dengan yang menambahkannya, dan
-- `supabase db push` membungkus tiap berkas sebagai satu transaksi. Seed paket
-- katering dan RPC-nya karena itu tinggal di berkas berikutnya — digabung ke
-- sini akan gagal dengan galat yang menyesatkan ("unsafe use of new value").
--
-- Kenapa katering butuh jenisnya sendiri, bukan menumpang `nasi_box`: Paket A–E
-- berisi gulai kambing & sate — itu lauk aqiqah, dan ia tambahan opsional atas
-- pesanan aqiqah, bukan pesanan yang berdiri sendiri. Katering acara punya menu,
-- harga, dan alur pemesanan yang berbeda sepenuhnya.
-- =============================================================================

alter type public.service_type add value if not exists 'katering';
