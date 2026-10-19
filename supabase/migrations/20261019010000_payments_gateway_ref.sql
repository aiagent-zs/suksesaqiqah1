-- Nomor pembayaran Durianpay (`pay_...`) untuk pembayaran yang dicatat webhook.
--
-- Unik supaya webhook yang dikirim ulang (Durianpay mencoba lagi sampai lima
-- kali) tidak pernah mencatat uang yang sama dua kali. NULL untuk pembayaran
-- manual — Postgres tidak menganggap dua NULL bentrok.
alter table public.payments add column gateway_ref text unique;
