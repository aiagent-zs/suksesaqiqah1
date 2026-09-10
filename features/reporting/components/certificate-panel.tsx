'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Award, AlertCircle, ImageIcon, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BusyButton } from '@/components/ui/busy-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { DOC_BUCKET } from '@/features/documentation/storage';
import { CHILD_PHOTO_ACCEPT, buildChildPhotoPath, checkChildPhoto } from '../child-photo';
import { generateCertificate, setChildPhoto } from '@/server/actions/reports';

/**
 * Sertifikat aqiqah — unduh lembarannya, dan kelola foto anak untuk varian
 * bergambar.
 *
 * **Terpisah dari panel Laporan** karena waktunya berbeda. Laporan menunggu
 * seluruh tahap lengkap dan tervalidasi; sertifikat sudah benar isinya sejak
 * hari penyembelihan, dan keluarga memintanya saat itu juga. Menaruhnya di
 * balik gerbang yang sama berarti menunda dokumen yang tidak perlu ditunda.
 *
 * Sertifikat yang sama tetap ikut sebagai halaman lanjutan di PDF laporan, jadi
 * yang menerima laporan lengkap tidak perlu meminta berkas kedua.
 */
export function CertificatePanel({
  orderId,
  orderNumber,
  orderCreatedAt,
  childPhotoPath,
  childNames,
  canManage,
}: {
  orderId: string;
  orderNumber: string;
  orderCreatedAt: string;
  childPhotoPath: string | null;
  /** Nama pada "atas nama" tiap hewan — satu sertifikat per nama. */
  childNames: string[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileKey, setFileKey] = useState(0);

  const busy = pending || uploading;

  /**
   * Unduh PDF yang dikembalikan Server Action.
   *
   * Server Action tidak bisa mengalirkan berkas, jadi PDF-nya datang sebagai
   * base64 dan dirakit jadi blob di sini. Untuk sertifikat satu-dua halaman
   * tanpa foto lapangan, ukurannya jauh di bawah batas badan respons.
   */
  function download() {
    setError(null);
    startTransition(async () => {
      const result = await generateCertificate({ order_id: orderId });
      if (!result.ok) {
        setError(result.error?.message ?? 'Terjadi kesalahan.');
        return;
      }

      const bytes = Uint8Array.from(atob(result.data.pdfBase64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = result.data.fileName;
      a.click();
      // Dibebaskan setelah peramban sempat memulai unduhannya; tanpa ini blob
      // 200 KB menetap di memori tab sampai halamannya ditutup.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    });
  }

  async function uploadPhoto(file: File) {
    setError(null);

    const check = checkChildPhoto(file);
    if (!check.ok) {
      setError(check.message);
      return;
    }

    setUploading(true);
    let path: string;
    try {
      const supabase = createClient();
      path = buildChildPhotoPath({
        orderNumber,
        orderCreatedAt,
        uuid: crypto.randomUUID(),
        ext: check.ext,
      });

      const { error: uploadError } = await supabase.storage
        .from(DOC_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        setError(`Gagal mengunggah foto: ${uploadError.message}`);
        return;
      }
    } finally {
      setUploading(false);
    }

    startTransition(async () => {
      const result = await setChildPhoto({ order_id: orderId, storage_path: path });
      if (!result.ok) {
        setError(result.error?.message ?? 'Terjadi kesalahan.');
        return;
      }
      setFileKey((k) => k + 1);
      router.refresh();
    });
  }

  function removePhoto() {
    setError(null);
    startTransition(async () => {
      // Berkasnya sengaja dibiarkan di Storage: yang menentukan varian
      // sertifikat adalah kolomnya, dan menghapus berkas yang mungkin sudah
      // tercetak di sertifikat lama tidak menambah apa pun.
      const result = await setChildPhoto({ order_id: orderId, storage_path: '' });
      if (!result.ok) {
        setError(result.error?.message ?? 'Terjadi kesalahan.');
        return;
      }
      setFileKey((k) => k + 1);
      router.refresh();
    });
  }

  const belumAdaNama = childNames.length === 0;

  return (
    <div>
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <p className="text-muted-foreground text-sm">
          {belumAdaNama
            ? 'Isi "Atas nama" pada daftar hewan lebih dulu.'
            : `${childNames.length} sertifikat · ${childNames.join(', ')}`}
        </p>

        {canManage && (
          <BusyButton
            type="button"
            size="sm"
            busy={busy}
            busyLabel="Menyiapkan…"
            disabled={belumAdaNama}
            onClick={download}
          >
            <Award className="size-3.5" />
            Unduh sertifikat
          </BusyButton>
        )}
      </div>

      {error && (
        <p className="border-destructive/20 bg-destructive/5 text-destructive flex items-start gap-2 border-b px-5 py-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {canManage && (
        <div className="px-5 py-4">
          <Label htmlFor="child-photo">Foto anak (opsional)</Label>
          <p className="text-muted-foreground mt-1 mb-2 text-xs">
            Ada dua wujud sertifikat: teks saja, atau teks beserta foto anaknya. Menambahkan foto di
            sini memilih yang kedua.
          </p>

          {childPhotoPath ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800">
                <ImageIcon className="size-3.5" />
                Foto terpasang — sertifikat memakai varian bergambar
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={removePhoto}
              >
                <Trash2 className="size-3.5" />
                Lepas foto
              </Button>
            </div>
          ) : (
            <>
              <Input
                key={fileKey}
                id="child-photo"
                type="file"
                accept={CHILD_PHOTO_ACCEPT}
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadPhoto(file);
                }}
              />
              <p className="text-muted-foreground mt-1 text-xs">
                {/* WebP ditolak walau bucket-nya menerima: React PDF hanya bisa
                    menyematkan JPG dan PNG. */}
                JPG atau PNG · maksimal 5 MB · sebaiknya potret
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
