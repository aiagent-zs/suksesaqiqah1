import 'server-only';
import { renderToBuffer } from '@react-pdf/renderer';
import { ReportDocument, type EmbeddedPhoto } from '@/features/reporting/pdf';
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
): Promise<Buffer> {
  return renderToBuffer(
    <ReportDocument data={data} photos={photos} publicUrl={publicUrl} />,
  ) as Promise<Buffer>;
}
