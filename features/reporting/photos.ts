import type { ReportMedia } from './types';

/**
 * Batas foto yang disematkan ke PDF.
 *
 * Setiap foto diunduh penuh ke memori server sebelum di-render. Tanpa batas,
 * order dengan puluhan bukti bisa membuat satu permintaan menahan ratusan MB
 * sekaligus menghasilkan PDF yang berat diunduh peserta.
 */
export const MAX_EMBEDDED_PHOTOS = 6;

/** Format gambar mentah yang diterima React PDF. */
export type EmbeddableFormat = 'jpg' | 'png';

export type EmbeddablePhoto = {
  storagePath: string;
  format: EmbeddableFormat;
  caption: string | null;
};

/**
 * Pilih foto bukti yang layak disematkan ke PDF.
 *
 * WebP sengaja dilewati: React PDF hanya menerima JPEG dan PNG sebagai data
 * mentah, dan menyodorkan WebP menghasilkan PDF rusak — bukan galat yang
 * terlihat saat render. Video juga dilewati; laporan menautkannya lewat halaman
 * publik, tidak menyematkannya.
 */
export function selectEmbeddablePhotos(
  media: ReportMedia[],
  max: number = MAX_EMBEDDED_PHOTOS,
): EmbeddablePhoto[] {
  const result: EmbeddablePhoto[] = [];

  for (const item of media) {
    if (result.length >= max) break;
    if (item.type !== 'photo' || !item.storagePath) continue;

    const lower = item.storagePath.toLowerCase();
    const format: EmbeddableFormat | null = lower.endsWith('.png')
      ? 'png'
      : lower.endsWith('.jpg') || lower.endsWith('.jpeg')
        ? 'jpg'
        : null;

    if (!format) continue;

    result.push({ storagePath: item.storagePath, format, caption: item.caption });
  }

  return result;
}
