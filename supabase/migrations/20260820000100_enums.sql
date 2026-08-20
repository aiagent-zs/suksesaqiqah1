-- =============================================================================
-- Desain ulang skema · 01 Enum
--
-- Dua perubahan pokok dibanding skema lama:
--
-- 1. **Tahapan lapangan tidak tinggal di `order_status`.** `order_status` kini
--    murni rangkaian administratif dan tetap linear. Tahapan yang dikerjakan
--    vendor — dan yang **bercabang** menurut cara penyaluran — hidup di tabel
--    `order_stage_events` sebagai baris, bukan sebagai nilai status.
--
--    Alasannya bukan selera: `salur` sah terjadi **berkali-kali** dalam satu
--    order (beberapa titik penyaluran), dan sebuah status tidak bisa berulang
--    sementara baris bisa. Memaksa percabangan ke dalam enum status juga
--    menuntut setiap pembacanya — stepper, filter, guard transisi — jadi sadar
--    mode, dua jalur kembar yang harus dijaga sinkron selamanya.
--
-- 2. **`distribution_mode` naik jadi enum.** Dulu `text` + CHECK, karena ia
--    hanya menentukan wajib-tidaknya alamat. Sekarang ia menyetir percabangan
--    tahapan, jadi layak jadi tipe sungguhan.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- --- Peran ------------------------------------------------------------------
--
-- superadmin  segalanya: master data, harga, pengelolaan mitra & akun
-- admin       penghubung pembeli & vendor: verifikasi order, pembayaran,
--             penugasan vendor, validasi laporan tahap
-- vendor      pelaksana: melaporkan tiap tahap pekerjaannya
create type public.user_role as enum ('superadmin', 'admin', 'vendor');

-- --- Katalog ----------------------------------------------------------------
create type public.service_type as enum ('aqiqah', 'qurban', 'sedekah_daging', 'nasi_box');

-- --- Cara penyaluran --------------------------------------------------------
--
-- Inilah yang menentukan tahapan mana yang wajib dilaporkan vendor.
create type public.distribution_mode as enum ('salur', 'kirim');

comment on type public.distribution_mode is
  'salur = daging disalurkan ke penerima manfaat; kirim = diantar ke alamat pemesan. Menentukan urutan tahap di public.fulfilment_sequence().';

-- --- Tahapan pelaksanaan ----------------------------------------------------
--
-- Bahasa Indonesia karena istilah domain; `order_status` di bawah tetap Inggris
-- karena istilah siklus hidup yang umum. Pola yang sama sudah dipakai
-- `aqiqah_for` ('laki_laki'/'perempuan') dan `distribution_mode`.
--
-- Percabangannya: persiapan -> sembelih -> masak -> lalu
--   salur : salur                 (bisa banyak titik penyaluran)
--   kirim : kirim -> terkirim
create type public.fulfilment_stage as enum (
  'persiapan',
  'sembelih',
  'masak',
  'salur',
  'kirim',
  'terkirim'
);

-- --- Status satu tahap ------------------------------------------------------
--
-- `pending` lahir otomatis saat vendor ditugaskan: vendor tidak membuat tahap,
-- ia mengisi tahap yang sudah menunggu. Itu yang membuat layarnya jadi daftar
-- kerja, bukan formulir kosong.
create type public.stage_event_status as enum ('pending', 'reported', 'validated', 'rejected');

-- --- Siklus order -----------------------------------------------------------
--
-- Empat status lama (preparation, slaughtering, distribution, documentation)
-- melebur jadi `in_progress` + `validation`: rinciannya kini terbaca dari
-- `order_stage_events`, jauh lebih tepat daripada satu status tunggal yang
-- harus mewakili enam tahap.
create type public.order_status as enum (
  'new',          -- masuk, belum diverifikasi admin
  'verified',     -- admin sudah memverifikasi (khususnya order tamu)
  'paid',         -- gate pembayaran terlewati (lunas atau DP >= min_dp)
  'assigned',     -- vendor ditetapkan; daftar tahap terbit otomatis
  'in_progress',  -- vendor mengerjakan & melaporkan tahap
  'validation',   -- seluruh tahap dilaporkan, menunggu validasi akhir
  'reporting',    -- laporan peserta dibuat & dikirim
  'completed',
  'on_hold',
  'cancelled'
);

-- --- Pembayaran -------------------------------------------------------------
create type public.payment_status as enum ('unpaid', 'partial', 'paid');
create type public.payment_verification_status as enum ('pending', 'verified', 'rejected');

-- --- Hewan ------------------------------------------------------------------
--
-- `masak` sengaja TIDAK ditambahkan: yang dimasak adalah dagingnya, bukan
-- hewannya, dan memasak berlangsung per order — bukan per ekor.
create type public.animal_species as enum ('kambing', 'domba', 'sapi');
create type public.animal_status as enum ('registered', 'prepared', 'slaughtered', 'distributed');

-- --- Dokumentasi ------------------------------------------------------------
--
-- Nilainya sengaja cerminan `fulfilment_stage` + `umum`. Keselarasan ini
-- struktural, bukan kesepakatan tak tertulis: gerbang kelengkapan bukti
-- membandingkan keduanya secara langsung.
create type public.doc_type as enum ('photo', 'video', 'note');
create type public.doc_stage as enum (
  'persiapan', 'sembelih', 'masak', 'salur', 'kirim', 'terkirim', 'umum'
);

-- Validasi satu tingkat: vendor unggah (pending) -> admin memutuskan.
create type public.doc_status as enum ('pending', 'approved', 'rejected');

-- --- Notifikasi & kendala ---------------------------------------------------
create type public.notif_channel as enum ('whatsapp', 'email', 'dashboard');
create type public.notif_status as enum ('queued', 'sent', 'failed');
create type public.issue_severity as enum ('low', 'medium', 'high');
create type public.issue_status as enum ('open', 'in_progress', 'resolved');
