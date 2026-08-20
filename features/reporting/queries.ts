import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { AnimalSpecies, AnimalStatus, OrderStatus } from '@/lib/constants/order';
import type { DocStage, DocType } from '@/features/documentation/storage';
import type { ReportData } from './types';

export type ReportListItem = {
  id: string;
  version: number;
  generatedAt: string;
  sentAt: string | null;
  generatedBy: string | null;
  pdfPath: string | null;
  /** Signed URL untuk mengunduh PDF dari halaman internal. */
  pdfUrl: string | null;
};

/** TTL signed URL PDF — sejalan dengan media lain (docs/17 section 4). */
const PDF_URL_TTL_SECONDS = 600;

/** Riwayat versi laporan satu order (docs/11 section 7). */
export async function getOrderReports(orderId: string): Promise<ReportListItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('reports')
    .select('id, version, generated_at, sent_at, generated_by, pdf_path')
    .eq('order_id', orderId)
    .order('version', { ascending: false });

  if (error) return [];

  const rows = data ?? [];
  const paths = rows.map((r) => r.pdf_path).filter((p): p is string => Boolean(p));

  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from('reports')
      .createSignedUrls(paths, PDF_URL_TTL_SECONDS);
    for (const item of signed ?? []) {
      if (item.signedUrl && item.path) urlByPath.set(item.path, item.signedUrl);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    version: r.version,
    generatedAt: r.generated_at,
    sentAt: r.sent_at,
    generatedBy: r.generated_by,
    pdfPath: r.pdf_path,
    pdfUrl: r.pdf_path ? (urlByPath.get(r.pdf_path) ?? null) : null,
  }));
}

/**
 * Kumpulkan seluruh isi laporan dari sisi terotentikasi (docs/11 section 3).
 *
 * Baris tetap ter-scope RLS — hanya order dalam cakupan akses pemanggil yang
 * terbaca, jadi generate laporan tidak bisa dipakai memancing data cabang lain.
 */
export async function getReportData(orderId: string): Promise<ReportData | null> {
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from('orders')
    .select(
      `
      order_number, status, created_at,
      child_birth_place, child_birth_date,
      branch:branches!orders_branch_id_fkey ( name ),
      participant:participants!orders_participant_id_fkey ( name ),
      items:order_items ( qty, service:services ( name ) ),
      animals ( species, tag_code, on_behalf_of, status ),
      schedule:schedules ( scheduled_date, scheduled_time, location:locations ( name ) ),
      distributions ( recipient_area, packages_count, distributed_at )
    `,
    )
    .eq('id', orderId)
    .maybeSingle();

  if (error || !row) return null;

  const r = row as unknown as {
    order_number: string;
    status: OrderStatus;
    created_at: string;
    child_birth_place: string | null;
    child_birth_date: string | null;
    branch: { name: string } | null;
    participant: { name: string } | null;
    items: Array<{ qty: number; service: { name: string } | null }>;
    animals: Array<{
      species: AnimalSpecies;
      tag_code: string | null;
      on_behalf_of: string | null;
      status: AnimalStatus;
    }>;
    schedule: {
      scheduled_date: string | null;
      scheduled_time: string | null;
      location: { name: string } | null;
    } | null;
    distributions: Array<{
      recipient_area: string | null;
      packages_count: number;
      distributed_at: string;
    }>;
  };

  // Hanya dokumentasi tervalidasi penuh yang boleh masuk laporan (docs/10 section 6).
  const [{ data: docs }, { data: progress }] = await Promise.all([
    supabase
      .from('documentations')
      .select('type, stage, caption, storage_path')
      .eq('order_id', orderId)
      .eq('status', 'approved')
      .order('created_at', { ascending: true }),
    supabase
      .from('v_order_progress')
      .select('animals_total, animals_slaughtered, animals_distributed, packages_total')
      .eq('order_id', orderId)
      .maybeSingle(),
  ]);

  return {
    orderNumber: r.order_number,
    status: r.status,
    createdAt: r.created_at,
    branchName: r.branch?.name ?? null,
    participantName: r.participant?.name ?? null,
    childBirthPlace: r.child_birth_place,
    childBirthDate: r.child_birth_date,
    services: (r.items ?? []).map((i) => ({ name: i.service?.name ?? '-', qty: i.qty })),
    animals: (r.animals ?? []).map((a) => ({
      species: a.species,
      tagCode: a.tag_code,
      onBehalfOf: a.on_behalf_of,
      status: a.status,
    })),
    schedule: r.schedule
      ? {
          scheduledDate: r.schedule.scheduled_date,
          scheduledTime: r.schedule.scheduled_time,
          locationName: r.schedule.location?.name ?? null,
        }
      : null,
    progress: {
      animalsTotal: progress?.animals_total ?? 0,
      animalsSlaughtered: progress?.animals_slaughtered ?? 0,
      animalsDistributed: progress?.animals_distributed ?? 0,
      packagesTotal: progress?.packages_total ?? 0,
    },
    distributions: (r.distributions ?? []).map((d) => ({
      recipientArea: d.recipient_area,
      packagesCount: d.packages_count ?? 0,
      distributedAt: d.distributed_at,
    })),
    media: (docs ?? []).map((d) => ({
      type: d.type as DocType,
      stage: d.stage as DocStage,
      caption: d.caption,
      storagePath: d.storage_path,
      url: null,
    })),
    report: null,
  };
}
