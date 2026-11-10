import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { DOC_BUCKET, type DocStage, type DocStatus, type DocType } from './storage';

/** TTL signed URL media — docs/17 section 4 menyarankan 5–15 menit. */
const MEDIA_URL_TTL_SECONDS = 600;

export type DocumentationRow = {
  id: string;
  type: DocType;
  stage: DocStage;
  status: DocStatus;
  /** Laporan tahap yang dibuktikan baris ini — dasar pengelompokan di layar. */
  stageEventId: string | null;
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
  pendingReview: number;
};

const DOC_SELECT = `
  id, type, stage, status, caption, review_note, created_at, reviewed_at,
  storage_path, uploaded_by, stage_event_id,
  uploader:profiles!documentations_uploaded_by_fkey ( full_name ),
  reviewer:profiles!documentations_reviewed_by_fkey ( full_name ),
  animal:animals ( tag_code )
`;

type RawDoc = {
  id: string;
  type: DocType;
  stage: DocStage;
  status: DocStatus;
  stage_event_id: string | null;
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
export async function signPaths(
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
    stageEventId: r.stage_event_id,
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

  if (error) {
    // Penolakan RLS bagi role yang tidak berhak tampak sebagai error di sini;
    // galat lain dicatat supaya kesalahan bentuk query tidak lagi menyamar
    // jadi panel kosong — persis yang pernah terjadi pada `getOrderPayments`.
    if (error.code !== '42501' && error.code !== 'PGRST301') {
      console.error('[documentation] Gagal memuat bukti:', error.code ?? '-', error.message);
    }
    return { rows: [], pendingReview: 0 };
  }

  const raw = (data ?? []) as unknown as RawDoc[];
  const urlByPath = await signPaths(
    supabase,
    raw.map((r) => r.storage_path).filter((p): p is string => Boolean(p)),
  );

  const rows = raw.map((r) => mapDoc(r, urlByPath));

  return {
    rows,
    pendingReview: rows.filter((r) => r.status === 'pending').length,
  };
}
