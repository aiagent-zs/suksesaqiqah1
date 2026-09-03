'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Toast } from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import { clearServicePhoto, setServicePhoto } from '@/server/actions/services';
import {
  checkServicePhoto,
  isRepoPhotoPath,
  PUBLIC_ASSET_BUCKET,
  servicePhotoPath,
} from '../storage';

/**
 * Foto satu paket, untuk kartu di halaman depan.
 *
 * ## Diunggah langsung dari peramban ke Storage
 *
 * Sama seperti bukti pembayaran, dan alasannya sama: berkas 5 MB tidak perlu
 * menempuh dua kali perjalanan (klien→server→Storage). Yang lewat server
 * action hanyalah **path**-nya.
 *
 * Validasi MIME & ukuran di sini murni kenyamanan — memberi tahu sebelum
 * menunggu unggahan gagal. Yang mengikat adalah `checkServicePhoto` di server
 * action ditambah `allowed_mime_types` pada bucket itu sendiri.
 *
 * ## Pratinjau memakai `<img>`, bukan `next/image`
 *
 * Berbeda dengan `SitePhoto` di halaman depan yang justru ingin dioptimasi.
 * Di sini yang ditampilkan foto yang **baru saja** diunggah, dan pengoptimal
 * Next menyinggahkan hasilnya per URL — pratinjau yang tertinggal satu versi
 * setelah mengganti foto akan terbaca sebagai "unggahannya gagal".
 */
export function ServicePhotoField({
  serviceId,
  slug,
  photoPath,
  photoAlt,
  publicBase,
}: {
  serviceId: string;
  slug: string;
  photoPath: string | null;
  photoAlt: string | null;
  /** `NEXT_PUBLIC_SUPABASE_URL`; dari server supaya tidak dibaca ulang di klien. */
  publicBase: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alt, setAlt] = useState(photoAlt ?? '');
  const { toast, show, dismiss } = useToast();

  const busy = pending || uploading;

  const previewUrl = photoPath
    ? isRepoPhotoPath(photoPath)
      ? `/${photoPath}`
      : `${publicBase.replace(/\/$/, '')}/storage/v1/object/public/${PUBLIC_ASSET_BUCKET}/${photoPath}`
    : null;

  async function upload(file: File) {
    setError(null);

    const check = checkServicePhoto(file);
    if (!check.ok) {
      setError(check.message);
      show('error', check.message);
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const path = servicePhotoPath(slug, check.ext);

      const { error: uploadError } = await supabase.storage
        .from(PUBLIC_ASSET_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        const message = `Gagal mengunggah foto: ${uploadError.message}`;
        setError(message);
        show('error', message);
        return;
      }

      const result = await setServicePhoto({ id: serviceId, photo_path: path, photo_alt: alt });
      if (!result.ok) {
        setError(result.error.message);
        show('error', result.error.message);
        return;
      }

      show('success', 'Foto tersimpan.');
      router.refresh();
    } finally {
      setUploading(false);
      // Input dikosongkan supaya memilih berkas yang sama dua kali tetap
      // memicu `onChange` — tanpa ini, mengunggah ulang foto yang barusan
      // ditolak server terasa seperti tombolnya mati.
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await clearServicePhoto({ id: serviceId });
      if (!result.ok) {
        setError(result.error.message);
        show('error', result.error.message);
        return;
      }
      show('success', 'Foto dihapus.');
      setAlt('');
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Toast state={toast} onDismiss={dismiss} />
      <Label>Foto kartu</Label>

      <div className="flex flex-wrap items-start gap-3">
        <div className="bg-muted relative h-24 w-36 shrink-0 overflow-hidden rounded-lg border">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={photoAlt ?? 'Pratinjau foto paket'}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="text-muted-foreground flex h-full w-full flex-col items-center justify-center gap-1 text-center">
              <ImagePlus className="size-5" />
              <span className="text-[10px]">Belum ada foto</span>
            </div>
          )}

          {busy && (
            <div className="bg-background/70 absolute inset-0 flex items-center justify-center">
              <Loader2 className="size-4 animate-spin" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
            className="file:bg-muted hover:file:bg-muted/70 block w-full text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm"
          />

          <Input
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="Teks alternatif — mis. Sajian masakan paket Ekonomi"
            disabled={busy}
          />
          {/* Teks alternatif dibaca pembaca layar dan tampil saat fotonya gagal
              dimuat. Ia menyusul unggahan berikutnya kalau diubah sendirian —
              disebutkan supaya tidak terbaca sebagai perubahan yang hilang. */}
          <p className="text-muted-foreground text-xs">
            JPG, PNG, atau WebP · maks 5 MB · rasio 3:2 (mis. 600×400).
            {photoPath && ' Teks alternatif tersimpan saat foto berikutnya diunggah.'}
          </p>

          {photoPath && (
            <Button type="button" variant="ghost" size="sm" onClick={remove} disabled={busy}>
              <Trash2 className="size-3.5" />
              Hapus foto
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}

      {photoPath && isRepoPhotoPath(photoPath) && (
        <p className="text-muted-foreground text-xs">
          Foto ini bawaan aplikasi (<code className="text-[11px]">{photoPath}</code>). Mengunggah
          foto baru akan menggantikannya tanpa menyentuh berkas aslinya.
        </p>
      )}
    </div>
  );
}
