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
      vendor:vendors!orders_vendor_id_fkey ( name ),
      participant:participants!orders_participant_id_fkey ( name ),
      items:order_items ( qty, service:services ( name ) ),
      animals ( species, tag_code, on_behalf_of, status ),
      schedule:schedules ( scheduled_date, scheduled_time, location:locations ( name ) ),
      stages:order_stage_events (
        stage, status, occurred_at, notes, packages_count, recipient_name, recipient_area
      )
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
    vendor: { name: string } | null;
    participant: { name: string } | null;
    items: Array<{ qty: number; service: { name: string } | null }>;
    animals: Array<{
      species: AnimalSpecies;
      tag_code: string | null;
      on_behalf_of: string | null;
      status: AnimalStatus;
    }>;
    stages: Array<{
      stage: string;
      status: string;
      occurred_at: string | null;
      notes: string | null;
      packages_count: number | null;
      recipient_name: string | null;
      recipient_area: string | null;
    }>;
    schedule: {
      scheduled_date: string | null;
      scheduled_time: string | null;
      location: { name: string } | null;
    } | null;
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
      .select(
        'animals_total, animals_slaughtered, animals_distributed, stages_total, stages_validated',
      )
      .eq('order_id', orderId)
      .maybeSingle(),
  ]);

  return {
    orderNumber: r.order_number,
    status: r.status,
    createdAt: r.created_at,
    vendorName: r.vendor?.name ?? null,
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
      animalsTotal: Number(progress?.animals_total ?? 0),
      animalsSlaughtered: Number(progress?.animals_slaughtered ?? 0),
      animalsDistributed: Number(progress?.animals_distributed ?? 0),
      stagesValidated: Number(progress?.stages_validated ?? 0),
      // `stages_total` menghitung BARIS tahap, dan `stages_validated` menghitung
      // baris juga — keduanya harus menghitung hal yang sama. `stages_in_sequence`
      // (jumlah tahap dalam rangkaian mode) sengaja tidak dipakai di sini: tahap
      // `sembelih` terbit satu baris per ekor, jadi order 3 ekor bermode `kirim`
      // punya 7 baris untuk 5 tahap, dan mencampur keduanya mencetak "7/5 tahap".
      // Penyebut yang sama dipakai `get_public_report`.
      stagesTotal: Number(progress?.stages_total ?? 0),
    },
    // Tahap yang sudah tervalidasi — inilah yang membuat laporan bercerita
    // runtut kepada pemesan, bukan sekadar "selesai".
    stages: (r.stages ?? [])
      .filter((s) => s.status === 'validated')
      .map((s) => ({
        stage: s.stage,
        occurredAt: s.occurred_at,
        notes: s.notes,
        packagesCount: s.packages_count,
        recipientName: s.recipient_name,
        recipientArea: s.recipient_area,
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
