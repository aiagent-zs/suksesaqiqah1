'use client';

import { useState } from 'react';
import { Paperclip, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createClient } from '@/lib/supabase/client';
import { uploadDocumentation } from '@/server/actions/documentation';
import { DOC_BUCKET, buildDocPath, checkDocFile, type DocStage } from '../storage';

type Outcome = { ok: boolean; error?: { message: string } };

/**
 * Unggah bukti untuk **satu laporan tahap**.
 *
 * Menggantikan panel Dokumentasi yang berdiri sendiri. Di sana pengunggah harus
 * memilih sendiri tahap dan hewannya lewat dua dropdown — padahal keduanya
 * sudah pasti begitu tombolnya ditekan dari dalam baris tahap. Pilihan yang
 * jawabannya sudah diketahui hanya menambah kesempatan salah pilih, dan salah
 * pilih di situ membuat bukti menempel pada tahap yang keliru.
 *
 * Berkasnya diunggah **langsung dari browser ke Storage**, lalu path-nya
 * dikirim ke Server Action. Bukan pilihan gaya: badan Server Action dibatasi
 * 1 MB sementara bucket menerima 25 MB, dan foto dari kamera ponsel rutin
 * melewati batas itu.
 *
 * `stage` tetap dikirim ke `buildDocPath` karena ia bagian dari path berkas —
 * tetapi server membacanya ulang dari baris tahapnya dan membandingkannya,
 * jadi path yang dibangun di folder tahap yang keliru tertolak di sana.
 */
export function StageDocUpload({
  stageEventId,
  stage,
  orderNumber,
  orderCreatedAt,
  disabled,
  onRun,
}: {
  stageEventId: string;
  stage: DocStage;
  orderNumber: string;
  orderCreatedAt: string;
  disabled: boolean;
  onRun: (fn: () => Promise<Outcome>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  // Input file tidak bisa dikosongkan lewat prop `value`; menaikkan key ini
  // memasang ulang elemennya sehingga nama berkas lama hilang dari layar.
  const [fileKey, setFileKey] = useState(0);
  const [caption, setCaption] = useState('');
  const [isNote, setIsNote] = useState(false);

  const busy = disabled || uploading;

  function reset() {
    setFile(null);
    setFileKey((k) => k + 1);
    setCaption('');
    setIsNote(false);
    setError(null);
    setNotice(null);
    setOpen(false);
  }

  async function submit() {
    setError(null);
    setNotice(null);

    let storagePath = '';
    let type: 'photo' | 'video' | 'note' = 'note';

    if (!isNote) {
      if (!file) {
        setError('Pilih berkas foto atau video lebih dulu.');
        return;
      }

      const check = checkDocFile(file);
      if (!check.ok) {
        setError(check.message);
        return;
      }
      type = check.type;

      if (check.oversizePhoto) {
        setNotice('Foto lebih besar dari 2 MB — pertimbangkan memperkecilnya untuk hemat kuota.');
      }

      setUploading(true);
      try {
        const supabase = createClient();
        storagePath = buildDocPath({
          orderNumber,
          orderCreatedAt,
          stage,
          uuid: crypto.randomUUID(),
          ext: check.ext,
        });

        const { error: uploadError } = await supabase.storage
          .from(DOC_BUCKET)
          .upload(storagePath, file, { contentType: file.type, upsert: false });

        if (uploadError) {
          // Penyebab tersering justru bukan berkasnya, melainkan sesi yang
          // kedaluwarsa — pesannya dibawa apa adanya supaya terbaca.
          setError(`Gagal mengunggah berkas: ${uploadError.message}`);
          return;
        }
      } finally {
        setUploading(false);
      }
    }

    onRun(async () => {
      const result = await uploadDocumentation({
        stage_event_id: stageEventId,
        type,
        storage_path: storagePath,
        caption,
      });
      if (result.ok) reset();
      return result;
    });
  }

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => setOpen(true)}
      >
        <Paperclip className="size-3.5" />
        Tambah bukti
      </Button>
    );
  }

  return (
    <div className="border-border bg-card mt-2 space-y-2 rounded-lg border p-3">
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={isNote}
          disabled={busy}
          onChange={(e) => {
            setIsNote(e.target.checked);
            setFile(null);
            setFileKey((k) => k + 1);
          }}
          className="border-border accent-primary size-3.5 rounded"
        />
        <span className="text-muted-foreground">Catatan tertulis, tanpa berkas</span>
      </label>

      {!isNote && (
        <div>
          <Label htmlFor={`doc-file-${stageEventId}`}>Foto atau video</Label>
          <Input
            key={fileKey}
            id={`doc-file-${stageEventId}`}
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4"
            disabled={busy}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1.5"
          />
          <p className="text-muted-foreground mt-1 text-xs">
            JPG, PNG, WebP, atau MP4 · maksimal 25 MB
          </p>
        </div>
      )}

      <div>
        <Label htmlFor={`doc-caption-${stageEventId}`}>
          Keterangan{isNote ? '' : ' (opsional)'}
        </Label>
        <Textarea
          id={`doc-caption-${stageEventId}`}
          rows={2}
          value={caption}
          disabled={busy}
          placeholder="Mis. penyerahan ke Panti Asuhan Harapan"
          onChange={(e) => setCaption(e.target.value)}
          className="mt-1.5"
        />
      </div>

      {notice && <p className="text-xs text-amber-700">{notice}</p>}
      {error && <p className="text-destructive text-xs">{error}</p>}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={busy || (isNote ? !caption.trim() : !file)}
          onClick={submit}
        >
          {uploading ? (
            <>
              <Upload className="size-3.5 animate-pulse" />
              Mengunggah…
            </>
          ) : (
            'Simpan bukti'
          )}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={reset}>
          Batal
        </Button>
      </div>
    </div>
  );
}
