-- =============================================================================
-- Tahap 1 — Database · 01 Extensions & Enum types
-- Acuan: docs/05_DATABASE_DESIGN.md (section 1, 4, 5), docs/08_WORKFLOW_MAP.md
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- --- Enum types -------------------------------------------------------------

-- docs/07_USER_ROLES.md section 1
create type public.user_role as enum (
  'direktur',
  'manager_program',
  'admin_pusat',
  'admin_cabang',
  'petugas_lapangan'
);

-- docs/05 section 4.4
create type public.service_type as enum (
  'aqiqah',
  'qurban',
  'sedekah_daging',
  'nasi_box'
);

-- docs/05 section 5 + docs/08 section 2
create type public.order_status as enum (
  'new',
  'paid',
  'scheduled',
  'preparation',
  'slaughtering',
  'distribution',
  'documentation',
  'reporting',
  'completed',
  'on_hold',
  'cancelled'
);

create type public.payment_status as enum (
  'unpaid',
  'partial',
  'paid'
);

-- CATATAN DEVIASI dari docs/05 section 4.9:
-- docs memakai `payment_status` untuk kolom status di tabel `payments`, tetapi nilai
-- unpaid/partial/paid tidak bermakna untuk satu baris pembayaran (itu status agregat
-- milik order). Baris pembayaran butuh status verifikasi. Karena itu dipakai enum
-- terpisah di bawah; `orders.payment_status` tetap memakai `payment_status`.
create type public.payment_verification_status as enum (
  'pending',
  'verified',
  'rejected'
);

create type public.animal_species as enum (
  'kambing',
  'domba',
  'sapi'
);

create type public.animal_status as enum (
  'registered',
  'prepared',
  'slaughtered',
  'distributed'
);

create type public.schedule_status as enum (
  'planned',
  'ongoing',
  'done'
);

create type public.doc_type as enum (
  'photo',
  'video',
  'note'
);

create type public.doc_stage as enum (
  'slaughter',
  'distribution',
  'general'
);

-- docs/10_DOCUMENTATION_FLOW.md — validasi 2 tingkat
create type public.doc_status as enum (
  'pending',
  'approved_supervisor',
  'approved',
  'rejected'
);

create type public.notif_channel as enum (
  'whatsapp',
  'email',
  'dashboard'
);

create type public.notif_status as enum (
  'queued',
  'sent',
  'failed'
);

create type public.issue_severity as enum (
  'low',
  'medium',
  'high'
);

create type public.issue_status as enum (
  'open',
  'in_progress',
  'resolved'
);

-- --- Trigger helper: updated_at ---------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at is
  'Trigger BEFORE UPDATE: menyegarkan kolom updated_at (docs/05 section 1).';

