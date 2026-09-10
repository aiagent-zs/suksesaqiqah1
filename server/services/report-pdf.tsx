import 'server-only';
import { renderToBuffer } from '@react-pdf/renderer';
import { ReportDocument, type EmbeddedPhoto } from '@/features/reporting/pdf';
import { CertificateDocument, type ChildPhoto } from '@/features/reporting/certificate';
import type { ReportData } from '@/features/reporting/types';

/**
 * Render dokumen laporan menjadi PDF.
 *
 * Dipisahkan dari `server/actions/reports.ts` karena berkas berdirektif
 * `'use server'` hanya boleh mengekspor fungsi async — sementara pemanggilan
 * React PDF di sini butuh JSX, yang menuntut berkas `.tsx`.
 */
export function renderReportPdf(
  data: ReportData,
  photos: EmbeddedPhoto[],
  publicUrl: string,
  childPhoto: ChildPhoto | null = null,
): Promise<Buffer> {
  return renderToBuffer(
    <ReportDocument data={data} photos={photos} publicUrl={publicUrl} childPhoto={childPhoto} />,
  ) as Promise<Buffer>;
}

/**
 * Sertifikat sebagai berkas tersendiri.
 *
 * Terpisah dari laporan karena waktunya berbeda: keluarga meminta sertifikat
 * begitu penyembelihan selesai, sementara laporan menunggu seluruh tahap
 * lengkap dan tervalidasi — kadang berhari-hari kemudian.
 */
export function renderCertificatePdf(
  data: ReportData,
  publicUrl: string,
  childPhoto: ChildPhoto | null,
): Promise<Buffer> {
  return renderToBuffer(
    <CertificateDocument
      data={data}
      childPhoto={childPhoto}
      publicUrl={publicUrl}
      withPhoto={childPhoto !== null}
    />,
  ) as Promise<Buffer>;
}
