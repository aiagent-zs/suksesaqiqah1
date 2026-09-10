'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/server/auth/session';
import { canDo } from '@/server/auth/capabilities';
import { getReportData } from '@/features/reporting/queries';
import { renderReportPdf, renderCertificatePdf } from '@/server/services/report-pdf';
import { selectEmbeddablePhotos } from '@/features/reporting/photos';
import { groupAnimalsByChild } from '@/features/reporting/certificate';
import { downloadChildPhoto } from '@/features/reporting/child-photo.server';
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
    .select('id, order_number, public_token, vendor:vendors!orders_vendor_id_fkey ( code )')
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
      // Sertifikat ikut sebagai halaman lanjutan; fotonya dipakai bila ada.
      await downloadChildPhoto(supabase, data.childPhotoPath),
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
      // **uuid profil, bukan namanya.** Kolomnya `uuid` dengan FK ke
      // `profiles`; mengisinya dengan nama membuat Postgres menolak seluruh
      // INSERT dengan `22P02 invalid input syntax for type uuid` — dan
      // laporannya tidak pernah tercatat meski PDF-nya sudah terunggah.
      // Nama pembuatnya dibaca lewat join saat ditampilkan, jadi tidak ada
      // yang hilang.
      generated_by: session.profile?.id ?? null,
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

const certificateSchema = z.object({ order_id: z.string().uuid('ID tidak valid') });

/**
 * Sertifikat aqiqah sebagai PDF tersendiri.
 *
 * **Tidak menunggu kelengkapan bukti**, berbeda dari `generateReport`. Yang
 * dicatat sertifikat adalah bahwa penyembelihan atas nama anak itu terjadi —
 * dan keluarga meminta lembarannya sesudah acara, bukan berhari-hari kemudian
 * saat seluruh tahap salur ikut tervalidasi. Menahannya di gerbang yang sama
 * berarti menunda dokumen yang isinya sudah benar sejak hari pelaksanaan.
 *
 * **Tidak disimpan ke Storage dan tidak dicatat sebagai versi.** Isinya
 * seluruhnya diturunkan dari data order, jadi mencetaknya ulang selalu
 * menghasilkan lembar yang sama. Menyimpannya berarti dua sumber kebenaran
 * yang bisa berbeda saat nama anak dibetulkan — dan riwayat versinya tidak
 * menjawab pertanyaan siapa pun.
 *
 * Dikembalikan sebagai base64: Server Action tidak bisa mengalirkan berkas,
 * dan sertifikat satu-dua halaman tanpa foto lapangan jauh di bawah batas
 * badan responsnya.
 */
export async function generateCertificate(
  input: unknown,
): Promise<ActionResult<{ fileName: string; pdfBase64: string; count: number }>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'GENERATE_REPORT')) {
    return forbidden('Role Anda tidak berhak membuat sertifikat.');
  }

  const parsed = certificateSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { order_id } = parsed.data;

  const supabase = await createClient();

  const { data: orderRow } = await supabase
    .from('orders')
    .select('order_number, public_token')
    .eq('id', order_id)
    .maybeSingle();

  if (!orderRow) return notFound('Order tidak ditemukan atau di luar akses Anda.');

  const data = await getReportData(order_id);
  if (!data) return notFound('Data order tidak dapat dimuat.');

  const children = groupAnimalsByChild(data.animals);
  if (children.length === 0) {
    // Nama anak adalah isi pokok lembarannya; tanpa itu tidak ada yang bisa
    // dicetak. Disebutkan apa yang kurang, bukan sekadar "tidak bisa".
    return conflict(
      'Sertifikat belum dapat dibuat: belum ada hewan yang tercatat atas nama siapa pun. ' +
        'Isi "Atas nama" pada daftar hewan lebih dulu.',
    );
  }

  const childPhoto = await downloadChildPhoto(supabase, data.childPhotoPath);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const publicUrl = `${appUrl.replace(/\/$/, '')}/r/${orderRow.public_token}`;

  let pdf: Buffer;
  try {
    pdf = await renderCertificatePdf(data, publicUrl, childPhoto);
  } catch (error) {
    return internalError('Gagal merender sertifikat', {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    ok: true,
    data: {
      fileName: `Sertifikat-Aqiqah-${orderRow.order_number}.pdf`,
      pdfBase64: pdf.toString('base64'),
      count: children.length,
    },
  };
}

const childPhotoSchema = z.object({
  order_id: z.string().uuid('ID tidak valid'),
  /** Kosongkan untuk melepas foto — sertifikat kembali ke varian teks saja. */
  storage_path: z.string().trim().max(300).optional().or(z.literal('')),
});

/**
 * Pasang atau lepas foto anak untuk sertifikat.
 *
 * Berkasnya sudah lebih dulu diunggah langsung dari browser ke Storage; yang
 * dikerjakan di sini hanya mencatat path-nya. Pola yang sama dengan bukti
 * tahap, dan alasannya sama: badan Server Action dibatasi 1 MB sementara foto
 * dari kamera ponsel rutin melewatinya.
 *
 * `UPDATE_ORDER`, bukan `GENERATE_REPORT` — foto anak bagian dari data order,
 * dan yang boleh membetulkan nama anaknya semestinya boleh pula memperbaiki
 * fotonya.
 */
export async function setChildPhoto(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'UPDATE_ORDER')) {
    return forbidden('Role Anda tidak berhak mengubah data order.');
  }

  const parsed = childPhotoSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { order_id, storage_path } = parsed.data;

  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from('orders')
    .update({ child_photo_path: storage_path || null })
    .eq('id', order_id)
    .select('id')
    .maybeSingle();

  if (error) return internalError('Gagal menyimpan foto anak', error);
  if (!updated) return forbidden('Perubahan ditolak untuk order di luar akses Anda.');

  revalidatePath(`/orders/${order_id}`);
  return { ok: true, data: null };
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
