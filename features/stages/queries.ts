import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { signPaths, type DocumentationRow } from '@/features/documentation/queries';
import type { DocStage, DocStatus, DocType } from '@/features/documentation/storage';
import type { FulfilmentStage, StageEventStatus } from './sequence';

/**
 * Medan bukti yang ikut terbaca di antrean.
 *
 * Lebih sempit daripada `DOC_SELECT` milik halaman order: antrean menilai
 * laporan yang **belum** diputuskan, jadi nama peninjau dan waktu peninjauan
 * belum ada isinya. Yang diambil hanya yang benar-benar dipakai kartu antrean.
 */
const DOC_QUEUE_FIELDS = `
  id, type, stage, status, caption, review_note, created_at, reviewed_at,
  storage_path, uploaded_by,
  uploader:profiles!documentations_uploaded_by_fkey ( full_name )
`;

type RawQueueDoc = {
  id: string;
  type: DocType;
  stage: DocStage;
  status: DocStatus;
  caption: string | null;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  storage_path: string | null;
  uploaded_by: string | null;
  uploader: { full_name: string | null } | null;
};

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
  /** Bukti yang menyertai laporan ini — dinilai bersamaan, bukan terpisah. */
  docs: DocumentationRow[];
};

/**
 * Antrian laporan tahap yang menunggu validasi admin.
 *
 * Urut tertua dulu: laporan yang menggantung paling lama menahan seluruh tahap
 * sesudahnya, karena gerbangnya menuntut tahap sebelumnya **tervalidasi**.
 *
 * **Buktinya ikut.** Sebelumnya halaman `/validation` menampilkan antrean foto
 * lintas order, sementara laporan tahapnya hanya bisa dinilai dari halaman
 * order — dua antrean untuk satu keputusan. Sejak bukti menempel pada laporan
 * tahapnya, keduanya dibaca sekaligus di sini.
 *
 * Dibatasi 50 tanpa paginasi: antreannya hanya berisi yang berstatus
 * `reported`, jadi ia pendek menurut bentuknya sendiri.
 * `ponytail: batas 50 tanpa Pagination — pasang kalau antreannya rutin penuh.`
 */
export async function getStageQueue(
  filter?: { stage?: FulfilmentStage },
  limit = 50,
): Promise<StageQueueItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from('order_stage_events')
    .select(
      `${STAGE_SELECT},
       order:orders!inner (
         id, order_number,
         participant:participants!orders_participant_id_fkey ( name ),
         vendor:vendors!orders_vendor_id_fkey ( name )
       ),
       documentations ( ${DOC_QUEUE_FIELDS} )`,
    )
    .eq('status', 'reported')
    .order('reported_at', { ascending: true })
    .limit(limit);

  if (filter?.stage) query = query.eq('stage', filter.stage);

  const { data, error } = await query;

  if (error) {
    console.error('[stages] Gagal memuat antrian tahap:', error.code ?? '-', error.message);
    return [];
  }

  const rows = (data ?? []) as unknown as Array<
    RawStage & {
      order: {
        id: string;
        order_number: string;
        participant: { name: string } | null;
        vendor: { name: string } | null;
      } | null;
      documentations: RawQueueDoc[] | null;
    }
  >;

  // Seluruh berkas ditandatangani sekali untuk satu halaman — bukan per baris.
  // Antrean 50 laporan yang masing-masing punya 3 foto berarti 150 permintaan
  // kalau ditandatangani satu per satu.
  const urlByPath = await signPaths(
    supabase,
    rows.flatMap((r) =>
      (r.documentations ?? []).map((d) => d.storage_path).filter((p): p is string => Boolean(p)),
    ),
  );

  return rows.map((r) => ({
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
    docs: (r.documentations ?? []).map((d) => ({
      id: d.id,
      type: d.type,
      stage: d.stage,
      status: d.status,
      stageEventId: r.id,
      caption: d.caption,
      reviewNote: d.review_note,
      createdAt: d.created_at,
      reviewedAt: d.reviewed_at,
      uploaderId: d.uploaded_by,
      uploaderName: d.uploader?.full_name ?? null,
      reviewerName: null,
      animalTag: r.animal?.tag_code ?? null,
      mediaUrl: d.storage_path ? (urlByPath.get(d.storage_path) ?? null) : null,
    })),
  }));
}
