import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { DOC_BUCKET } from '@/features/documentation/storage';
import type { Database } from '@/types/database';
import type { ReportData } from '@/features/reporting/types';
import { supabaseUrl } from '@/lib/supabase/env';

/** TTL signed URL di halaman publik (docs/17 section 4). */
const PUBLIC_MEDIA_TTL_SECONDS = 600;

/**
 * Klien service role — **hanya** untuk menandatangani berkas.
 *
 * Kunci ini melewati seluruh RLS, jadi cakupannya sengaja sesempit mungkin:
 * satu-satunya hal yang dikerjakannya adalah membuat signed URL untuk path yang
 * **sudah dikembalikan** oleh `get_public_report(token)`. Datanya sendiri tidak
 * pernah diambil lewat klien ini — RPC SECURITY DEFINER yang mengunci bentuk
 * dan cakupannya di level database.
 *
 * Penandatanganan tidak bisa memakai kunci publik: kebijakan
 * `storage_documentation_read` ditujukan `to authenticated`, sementara pembaca
 * halaman ini anonim.
 */
function serviceRoleClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'Environment SUPABASE_SERVICE_ROLE_KEY belum diisi — halaman laporan publik tidak dapat menandatangani media.',
    );
  }

  return createSupabaseClient<Database>(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type RpcPayload = {
  order_number: string;
  status: ReportData['status'];
  created_at: string;
  branch_name: string | null;
  participant_name: string | null;
  services: Array<{ name: string; qty: number }> | null;
  animals: Array<{
    species: ReportData['animals'][number]['species'];
    tag_code: string | null;
    on_behalf_of: string | null;
    status: ReportData['animals'][number]['status'];
  }> | null;
  schedule: {
    scheduled_date: string | null;
    scheduled_time: string | null;
    location_name: string | null;
  } | null;
  progress: {
    animals_total: number | null;
    animals_slaughtered: number | null;
    animals_distributed: number | null;
    packages_total: number | null;
  } | null;
  distributions: Array<{
    recipient_area: string | null;
    packages_count: number;
    distributed_at: string;
  }> | null;
  documentations: Array<{
    type: ReportData['media'][number]['type'];
    stage: ReportData['media'][number]['stage'];
    caption: string | null;
    storage_path: string | null;
  }> | null;
  report: { version: number; pdf_path: string | null; generated_at: string } | null;
};

export type PublicReport = ReportData & { pdfUrl: string | null };

/**
 * Data halaman `/r/{token}`.
 *
 * Mengembalikan null untuk token yang tidak dikenal, terlalu pendek, atau milik
 * order yang laporannya belum pernah dibuat — halaman memperlakukan ketiganya
 * sebagai 404 yang sama, sehingga tidak ada isyarat mana token yang "hampir"
 * benar (docs/11 section 6).
 */
export async function getPublicReport(token: string): Promise<PublicReport | null> {
  // Pemanggilan RPC memakai klien anon biasa: fungsinya SECURITY DEFINER dan
  // sudah di-grant ke `anon`, jadi tidak perlu hak istimewa apa pun di sini.
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('get_public_report', { p_token: token });
  if (error || !data) return null;

  const p = data as unknown as RpcPayload;

  const media = (p.documentations ?? []).map((d) => ({
    type: d.type,
    stage: d.stage,
    caption: d.caption,
    storagePath: d.storage_path,
    url: null as string | null,
  }));

  // --- Penandatanganan terbatas ------------------------------------------------
  const mediaPaths = media.map((m) => m.storagePath).filter((v): v is string => Boolean(v));
  const pdfPath = p.report?.pdf_path ?? null;

  let pdfUrl: string | null = null;

  if (mediaPaths.length > 0 || pdfPath) {
    try {
      const admin = serviceRoleClient();

      if (mediaPaths.length > 0) {
        const { data: signed } = await admin.storage
          .from(DOC_BUCKET)
          .createSignedUrls(mediaPaths, PUBLIC_MEDIA_TTL_SECONDS);

        const urlByPath = new Map<string, string>();
        for (const item of signed ?? []) {
          if (item.signedUrl && item.path) urlByPath.set(item.path, item.signedUrl);
        }
        for (const m of media) {
          if (m.storagePath) m.url = urlByPath.get(m.storagePath) ?? null;
        }
      }

      if (pdfPath) {
        const { data: signedPdf } = await admin.storage
          .from('reports')
          .createSignedUrl(pdfPath, PUBLIC_MEDIA_TTL_SECONDS);
        pdfUrl = signedPdf?.signedUrl ?? null;
      }
    } catch (err) {
      // Halaman tetap tampil tanpa media daripada gagal total: teks laporan
      // sudah cukup membuktikan pelaksanaan.
      console.error('[public-report] gagal menandatangani media:', err);
    }
  }

  return {
    orderNumber: p.order_number,
    status: p.status,
    createdAt: p.created_at,
    branchName: p.branch_name,
    participantName: p.participant_name,
    services: p.services ?? [],
    animals: (p.animals ?? []).map((a) => ({
      species: a.species,
      tagCode: a.tag_code,
      onBehalfOf: a.on_behalf_of,
      status: a.status,
    })),
    schedule: p.schedule
      ? {
          scheduledDate: p.schedule.scheduled_date,
          scheduledTime: p.schedule.scheduled_time,
          locationName: p.schedule.location_name,
        }
      : null,
    progress: {
      animalsTotal: p.progress?.animals_total ?? 0,
      animalsSlaughtered: p.progress?.animals_slaughtered ?? 0,
      animalsDistributed: p.progress?.animals_distributed ?? 0,
      packagesTotal: p.progress?.packages_total ?? 0,
    },
    distributions: (p.distributions ?? []).map((d) => ({
      recipientArea: d.recipient_area,
      packagesCount: d.packages_count ?? 0,
      distributedAt: d.distributed_at,
    })),
    media,
    report: p.report
      ? {
          version: p.report.version,
          pdfPath: p.report.pdf_path,
          generatedAt: p.report.generated_at,
        }
      : null,
    pdfUrl,
  };
}
