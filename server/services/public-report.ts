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
  vendor_name: string | null;
  participant_name: string | null;
  child_birth_place: string | null;
  child_birth_date: string | null;
  services: Array<{ name: string; qty: number }> | null;
  animals: Array<{
    species: ReportData['animals'][number]['species'];
    tag_code: string | null;
    on_behalf_of: string | null;
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
    stages_total: number | null;
    stages_validated: number | null;
  } | null;
  stages: Array<{
    stage: string;
    occurred_at: string | null;
    notes: string | null;
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
    vendorName: p.vendor_name,
    participantName: p.participant_name,
    // Order lama & order qurban tidak punya keduanya — RPC mengembalikan null,
    // dan tampilan menyembunyikan barisnya, bukan mencetak "-".
    childBirthPlace: p.child_birth_place ?? null,
    childBirthDate: p.child_birth_date ?? null,
    services: p.services ?? [],
    animals: (p.animals ?? []).map((a) => ({
      species: a.species,
      tagCode: a.tag_code,
      onBehalfOf: a.on_behalf_of,
    })),
    schedule: p.schedule
      ? {
          scheduledDate: p.schedule.scheduled_date,
          scheduledTime: p.schedule.scheduled_time,
          locationName: p.schedule.location_name,
        }
      : null,
    // Angkanya datang dari `v_order_progress` lewat RPC — sumber yang sama
    // dengan `getReportData`, supaya halaman publik dan PDF internal tidak
    // pernah menyebut angka berbeda untuk order yang sama.
    progress: {
      animalsTotal: Number(p.progress?.animals_total ?? 0),
      animalsSlaughtered: Number(p.progress?.animals_slaughtered ?? 0),
      animalsDistributed: Number(p.progress?.animals_distributed ?? 0),
      stagesTotal: Number(p.progress?.stages_total ?? 0),
      stagesValidated: Number(p.progress?.stages_validated ?? 0),
    },
    // Tahap yang sudah tervalidasi — inilah yang membuat halaman ini bercerita
    // runtut kepada pemesan, bukan sekadar menyatakan "selesai".
    //
    // Rincian penerima & jumlah paket sengaja tidak ikut: laporan ini dibagikan
    // lewat tautan, dan nama penerima manfaat bukan milik pemegang tautan.
    // Jalur internal (`getReportData`) tetap membawanya.
    stages: (p.stages ?? []).map((s) => ({
      stage: s.stage,
      occurredAt: s.occurred_at,
      notes: s.notes,
      packagesCount: null,
      recipientName: null,
      recipientArea: null,
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
