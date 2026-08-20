import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { FulfilmentStage, StageEventStatus } from './sequence';

export type StageEventRow = {
  id: string;
  stage: FulfilmentStage;
  seq: number;
  status: StageEventStatus;
  animalId: string | null;
  animalTag: string | null;
  reportedBy: string | null;
  reporterName: string | null;
  reportedAt: string | null;
  occurredAt: string | null;
  notes: string | null;
  packagesCount: number | null;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientArea: string | null;
  weightKg: number | null;
  lat: number | null;
  lng: number | null;
  validatorName: string | null;
  validatedAt: string | null;
  reviewNote: string | null;
};

const STAGE_SELECT = `
  id, stage, seq, status, animal_id, reported_by, reported_at, occurred_at, notes,
  packages_count, recipient_name, recipient_phone, recipient_area, weight_kg,
  lat, lng, validated_at, review_note,
  animal:animals ( tag_code ),
  reporter:profiles!order_stage_events_reported_by_fkey ( full_name ),
  validator:profiles!order_stage_events_validated_by_fkey ( full_name )
`;

type RawStage = {
  id: string;
  stage: FulfilmentStage;
  seq: number;
  status: StageEventStatus;
  animal_id: string | null;
  reported_by: string | null;
  reported_at: string | null;
  occurred_at: string | null;
  notes: string | null;
  packages_count: number | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  recipient_area: string | null;
  weight_kg: number | string | null;
  lat: number | string | null;
  lng: number | string | null;
  validated_at: string | null;
  review_note: string | null;
  animal: { tag_code: string | null } | null;
  reporter: { full_name: string | null } | null;
  validator: { full_name: string | null } | null;
};

/**
 * Daftar tahap satu order, urut rangkaian.
 *
 * Barisnya sudah ada sejak mitra ditugaskan — trigger `generate_stage_checklist`
 * menerbitkannya sesuai cara penyaluran. Jadi yang dikembalikan di sini adalah
 * daftar kerja, bukan sekadar riwayat: tahap yang belum dikerjakan pun ikut,
 * berstatus `pending`.
 */
export async function getOrderStages(orderId: string): Promise<StageEventRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('order_stage_events')
    .select(STAGE_SELECT)
    .eq('order_id', orderId)
    .order('seq', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return [];

  return ((data ?? []) as unknown as RawStage[]).map((r) => ({
    id: r.id,
    stage: r.stage,
    seq: r.seq,
    status: r.status,
    animalId: r.animal_id,
    animalTag: r.animal?.tag_code ?? null,
    reportedBy: r.reported_by,
    reporterName: r.reporter?.full_name ?? null,
    reportedAt: r.reported_at,
    occurredAt: r.occurred_at,
    notes: r.notes,
    packagesCount: r.packages_count,
    recipientName: r.recipient_name,
    recipientPhone: r.recipient_phone,
    recipientArea: r.recipient_area,
    weightKg: r.weight_kg === null ? null : Number(r.weight_kg),
    lat: r.lat === null ? null : Number(r.lat),
    lng: r.lng === null ? null : Number(r.lng),
    validatorName: r.validator?.full_name ?? null,
    validatedAt: r.validated_at,
    reviewNote: r.review_note,
  }));
}

export type StageQueueItem = StageEventRow & {
  orderId: string;
  orderNumber: string;
  vendorName: string | null;
  participantName: string;
};

/**
 * Antrian laporan tahap yang menunggu validasi admin.
 *
 * Urut tertua dulu: laporan yang menggantung paling lama menahan seluruh tahap
 * sesudahnya, karena gerbangnya menuntut tahap sebelumnya **tervalidasi**.
 */
export async function getStageQueue(limit = 50): Promise<StageQueueItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('order_stage_events')
    .select(
      `${STAGE_SELECT},
       order:orders!inner (
         id, order_number,
         participant:participants!orders_participant_id_fkey ( name ),
         vendor:vendors!orders_vendor_id_fkey ( name )
       )`,
    )
    .eq('status', 'reported')
    .order('reported_at', { ascending: true })
    .limit(limit);

  if (error) return [];

  return (
    (data ?? []) as unknown as Array<
      RawStage & {
        order: {
          id: string;
          order_number: string;
          participant: { name: string } | null;
          vendor: { name: string } | null;
        } | null;
      }
    >
  ).map((r) => ({
    id: r.id,
    stage: r.stage,
    seq: r.seq,
    status: r.status,
    animalId: r.animal_id,
    animalTag: r.animal?.tag_code ?? null,
    reportedBy: r.reported_by,
    reporterName: r.reporter?.full_name ?? null,
    reportedAt: r.reported_at,
    occurredAt: r.occurred_at,
    notes: r.notes,
    packagesCount: r.packages_count,
    recipientName: r.recipient_name,
    recipientPhone: r.recipient_phone,
    recipientArea: r.recipient_area,
    weightKg: r.weight_kg === null ? null : Number(r.weight_kg),
    lat: r.lat === null ? null : Number(r.lat),
    lng: r.lng === null ? null : Number(r.lng),
    validatorName: r.validator?.full_name ?? null,
    validatedAt: r.validated_at,
    reviewNote: r.review_note,
    orderId: r.order?.id ?? '',
    orderNumber: r.order?.order_number ?? '-',
    vendorName: r.order?.vendor?.name ?? null,
    participantName: r.order?.participant?.name ?? '-',
  }));
}
