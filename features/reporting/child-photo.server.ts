import 'server-only';
import { DOC_BUCKET } from '@/features/documentation/storage';
import type { ChildPhoto } from './certificate';

/**
 * Sisi server dari foto anak: mengunduhnya untuk disematkan ke PDF.
 *
 * Dipisah dari `child-photo.ts` karena berkas itu ikut ke bundel browser —
 * pemilihan berkas dan pembentukan path terjadi di sana. Menaruh
 * `'server-only'` di satu berkas yang sama membuat build gagal begitu komponen
 * klien mengimpornya, dengan pesan yang menyebut Pages Router dan sama sekali
 * tidak mengarah ke sini.
 */
type StorageClient = {
  storage: {
    from: (bucket: string) => {
      download: (path: string) => Promise<{ data: Blob | null }>;
    };
  };
};

/**
 * Unduh foto anak untuk disematkan ke PDF.
 *
 * Mengembalikan `null` — bukan melempar — pada setiap kegagalan: sertifikat
 * varian teks masih sepenuhnya sah, dan menggagalkan seluruh pembuatan karena
 * satu foto tidak terbaca akan menahan dokumen yang isinya sudah benar.
 */
export async function downloadChildPhoto(
  supabase: StorageClient,
  path: string | null,
): Promise<ChildPhoto | null> {
  if (!path) return null;

  const format = path.endsWith('.png') ? 'png' : 'jpg';
  const { data: blob } = await supabase.storage.from(DOC_BUCKET).download(path);
  if (!blob) return null;

  return { data: Buffer.from(await blob.arrayBuffer()), format };
}
