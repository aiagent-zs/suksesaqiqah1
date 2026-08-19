import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { ValidationFilterInput } from './schema';
import { DOC_BUCKET, type DocStage, type DocStatus, type DocType } from './storage';

/** TTL signed URL media — docs/17 section 4 menyarankan 5–15 menit. */
const MEDIA_URL_TTL_SECONDS = 600;

export type DocumentationRow = {
  id: string;
  type: DocType;
  stage: DocStage;
  status: DocStatus;
  caption: string | null;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  uploaderId: string | null;
  uploaderName: string | null;
  reviewerName: string | null;
  animalTag: string | null;
  /** Signed URL berdurasi pendek; null untuk `note` atau bila gagal ditandatangani. */
  mediaUrl: string | null;
};

export type DocumentationSummary = {
  rows: DocumentationRow[];
  approvedSlaughter: number;
  approvedDistribution: number;
  pendingReview: number;
};

const DOC_SELECT = `
  id, type, stage, status, caption, review_note, created_at, reviewed_at,
  storage_path, uploaded_by,
  uploader:profiles!documentations_uploaded_by_fkey ( full_name ),
  reviewer:profiles!documentations_reviewed_by_fkey ( full_name ),
  animal:animals ( tag_code )
`;

type RawDoc = {
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
  reviewer: { full_name: string | null } | null;
  animal: { tag_code: string | null } | null;
};

/**
 * Tandatangani seluruh path sekaligus.
 *
 * Media tidak pernah punya URL publik permanen (docs/10 section 8), jadi setiap
 * pemuatan halaman menandatangani ulang. Dilakukan sekali untuk semua path
 * supaya tidak ada roundtrip berurutan saat satu order punya banyak foto.
 */
async function signPaths(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paths: string[],
): Promise<Map<string, string>> {
  const urlByPath = new Map<string, string>();
  if (paths.length === 0) return urlByPath;

  const { data } = await supabase.storage
    .from(DOC_BUCKET)
    .createSignedUrls(paths, MEDIA_URL_TTL_SECONDS);

  for (const item of data ?? []) {
    if (item.signedUrl && item.path) urlByPath.set(item.path, item.signedUrl);
  }
  return urlByPath;
}

function mapDoc(r: RawDoc, urlByPath: Map<string, string>): DocumentationRow {
  return {
    id: r.id,
    type: r.type,
    stage: r.stage,
    status: r.status,
    caption: r.caption,
    reviewNote: r.review_note,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at,
    uploaderId: r.uploaded_by,
    uploaderName: r.uploader?.full_name ?? null,
    reviewerName: r.reviewer?.full_name ?? null,
    animalTag: r.animal?.tag_code ?? null,
    mediaUrl: r.storage_path ? (urlByPath.get(r.storage_path) ?? null) : null,
  };
}

/** Dokumentasi satu order beserta hitungan kelengkapan (docs/10 section 5). */
export async function getOrderDocumentations(orderId: string): Promise<DocumentationSummary> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('documentations')
    .select(DOC_SELECT)
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });

  if (error) return { rows: [], approvedSlaughter: 0, approvedDistribution: 0, pendingReview: 0 };

  const raw = (data ?? []) as unknown as RawDoc[];
  const urlByPath = await signPaths(
    supabase,
    raw.map((r) => r.storage_path).filter((p): p is string => Boolean(p)),
  );

  const rows = raw.map((r) => mapDoc(r, urlByPath));

  return {
    rows,
    approvedSlaughter: rows.filter((r) => r.status === 'approved' && r.stage === 'slaughter')
      .length,
    approvedDistribution: rows.filter((r) => r.status === 'approved' && r.stage === 'distribution')
      .length,
    pendingReview: rows.filter((r) => r.status === 'pending' || r.status === 'approved_supervisor')
      .length,
  };
}

export type ValidationQueueItem = DocumentationRow & {
  orderId: string;
  orderNumber: string;
  branchCode: string;
  participantName: string;
};

export type ValidationQueueResult = {
  data: ValidationQueueItem[];
  page: number;
  page_size: number;
  total: number;
};

const QUEUE_SELECT = `
  ${DOC_SELECT},
  order:orders!inner (
    id, order_number, branch_id,
    participant:participants!orders_participant_id_fkey ( name ),
    branch:branches!orders_branch_id_fkey ( code )
  )
`;

/**
 * Antrian validasi (docs/10 section 6).
 *
 * Daftar `status` ditentukan pemanggil, bukan filter dari klien. Baris tetap
 * ter-scope RLS.
 */
export async function getValidationQueue(
  statuses: DocStatus[],
  filter: ValidationFilterInput,
): Promise<ValidationQueueResult> {
  const supabase = await createClient();
  const { page, page_size } = filter;

  let query = supabase
    .from('documentations')
    .select(QUEUE_SELECT, { count: 'exact' })
    // Daftar, bukan satu status: sejak validasi jadi satu tingkat, antrian ini
    // memuat `pending` **dan** sisa `approved_supervisor` dari tangga lama.
    .in('status', statuses)
    // Yang paling lama menunggu ditangani lebih dulu.
    .order('created_at', { ascending: true });

  if (filter.stage) query = query.eq('stage', filter.stage);

  const from = (page - 1) * page_size;
  const { data, count, error } = await query.range(from, from + page_size - 1);

  if (error) throw new Error(`Gagal memuat antrian validasi: ${error.message}`);

  const raw = (data ?? []) as unknown as Array<
    RawDoc & {
      order: {
        id: string;
        order_number: string;
        participant: { name: string } | null;
        branch: { code: string } | null;
      } | null;
    }
  >;

  const urlByPath = await signPaths(
    supabase,
    raw.map((r) => r.storage_path).filter((p): p is string => Boolean(p)),
  );

  return {
    data: raw.map((r) => ({
      ...mapDoc(r, urlByPath),
      orderId: r.order?.id ?? '',
      orderNumber: r.order?.order_number ?? '-',
      branchCode: r.order?.branch?.code ?? '-',
      participantName: r.order?.participant?.name ?? '-',
    })),
    page,
    page_size,
    total: count ?? 0,
  };
}
