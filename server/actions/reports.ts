'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/server/auth/session';
import { canDo } from '@/server/auth/capabilities';
import { getReportData } from '@/features/reporting/queries';
import { renderReportPdf } from '@/server/services/report-pdf';
import { selectEmbeddablePhotos } from '@/features/reporting/photos';
import type { EmbeddedPhoto } from '@/features/reporting/pdf';
import { DOC_BUCKET } from '@/features/documentation/storage';
import { isDocumentationComplete } from '@/features/documentation/review';
import {
  conflict,
  forbidden,
  notFound,
  scopedInternalError,
  validationError,
  type ActionResult,
} from './result';
import { z } from 'zod';

const internalError = scopedInternalError('reports');

const generateReportSchema = z.object({ order_id: z.string().uuid('ID tidak valid') });

/**
 * Generate laporan peserta versi berikutnya (docs/11 section 4).
 *
 * Idempoten dalam arti yang dimaksud docs: memanggil ulang menambah `version`
 * baru dan menyimpan PDF baru, tetapi **tidak** menggandakan `public_token` —
 * tautan yang sudah dibagikan ke peserta tetap sama karena tokennya melekat
 * pada order.
 */
export async function generateReport(
  input: unknown,
): Promise<ActionResult<{ version: number; publicToken: string }>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'GENERATE_REPORT')) {
    return forbidden('Role Anda tidak berhak membuat laporan.');
  }

  const parsed = generateReportSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { order_id } = parsed.data;

  const supabase = await createClient();

  const { data: orderRow } = await supabase
    .from('orders')
    .select('id, order_number, public_token, branch:branches!orders_branch_id_fkey ( code )')
    .eq('id', order_id)
    .maybeSingle();

  if (!orderRow) return notFound('Order tidak ditemukan atau di luar akses Anda.');

  const order = orderRow as unknown as {
    id: string;
    order_number: string;
    public_token: string;
  };

  const data = await getReportData(order_id);
  if (!data) return notFound('Data order tidak dapat dimuat.');

  // Kelengkapan bukti yang sama dengan gerbang `validation → reporting`.
  // Diperiksa ulang di sini karena laporan bisa dibuat manual kapan saja,
  // bukan hanya lewat transisi status. Daftar tahap yang kurang datang dari
  // `v_order_progress` — satu sumber kebenaran dengan gerbangnya.
  const { data: progress } = await supabase
    .from('v_order_progress')
    .select('missing_doc_stages')
    .eq('order_id', order_id)
    .maybeSingle();

  const missingStages = progress?.missing_doc_stages ?? [];
  if (!isDocumentationComplete(missingStages)) {
    return conflict(
      `Laporan belum dapat dibuat: bukti belum lengkap pada tahap ${missingStages.join(', ')}.`,
    );
  }

  // --- Unduh foto bukti untuk disematkan --------------------------------------
  const photos: EmbeddedPhoto[] = [];
  for (const candidate of selectEmbeddablePhotos(data.media)) {
    const { data: blob } = await supabase.storage.from(DOC_BUCKET).download(candidate.storagePath);
    if (!blob) continue;

    photos.push({
      data: Buffer.from(await blob.arrayBuffer()),
      format: candidate.format,
      caption: candidate.caption,
    });
  }

  // --- Versi berikutnya --------------------------------------------------------
  const { data: latest } = await supabase
    .from('reports')
    .select('version')
    .eq('order_id', order_id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latest?.version ?? 0) + 1;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const publicUrl = `${appUrl.replace(/\/$/, '')}/r/${order.public_token}`;

  let pdf: Buffer;
  try {
    pdf = await renderReportPdf(
      {
        ...data,
        report: { version: nextVersion, pdfPath: null, generatedAt: new Date().toISOString() },
      },
      photos,
      publicUrl,
    );
  } catch (error) {
    return internalError('Gagal merender PDF laporan', {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  // Path mengikuti konvensi docs/17 section 3.
  const pdfPath = `${order.order_number}/v${nextVersion}/${order.order_number}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from('reports')
    .upload(pdfPath, pdf, { contentType: 'application/pdf', upsert: true });

  if (uploadError) return internalError('Gagal menyimpan PDF laporan', uploadError);

  const { data: inserted, error } = await supabase
    .from('reports')
    .insert({
      order_id,
      pdf_path: pdfPath,
      version: nextVersion,
      generated_by: session.profile?.full_name ?? session.email ?? 'sistem',
    })
    .select('version')
    .maybeSingle();

  if (error) {
    // `reports_order_version_unique` menolak versi ganda — tanda ada generate
    // lain yang menang adu cepat.
    if (error.code === '23505') {
      return conflict('Laporan versi ini baru saja dibuat pihak lain. Muat ulang halaman.');
    }
    return internalError('Gagal menyimpan data laporan', error);
  }

  if (!inserted) return forbidden('Penyimpanan laporan ditolak untuk order di luar akses Anda.');

  revalidatePath(`/orders/${order_id}`);
  revalidatePath('/dashboard');
  return { ok: true, data: { version: inserted.version, publicToken: order.public_token } };
}

const markSentSchema = z.object({ report_id: z.string().uuid('ID tidak valid') });

/**
 * Tandai laporan sudah dikirim ke peserta.
 *
 * Pengiriman sesungguhnya dilakukan operator lewat WA.me/Email (Tahap 8 akan
 * mengotomatiskannya lewat n8n). `sent_at` inilah yang dibaca
 * `v_order_progress.report_sent` dan menjadi syarat `reporting → completed`.
 */
export async function markReportSent(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'GENERATE_REPORT')) {
    return forbidden('Role Anda tidak berhak menandai pengiriman laporan.');
  }

  const parsed = markSentSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('reports')
    .update({ sent_at: new Date().toISOString() })
    .eq('id', parsed.data.report_id)
    .is('sent_at', null)
    .select('order_id');

  if (error) return internalError('Gagal menandai pengiriman laporan', error);

  if ((data ?? []).length === 0) {
    return conflict('Laporan sudah ditandai terkirim atau di luar akses Anda.');
  }

  const orderId = (data as Array<{ order_id: string }>)[0].order_id;
  revalidatePath(`/orders/${orderId}`);
  revalidatePath('/dashboard');
  return { ok: true, data: null };
}
