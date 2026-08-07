import { FileText, ImageOff } from 'lucide-react';
import type { DocumentationRow } from '../queries';

/**
 * Pratinjau media dokumentasi.
 *
 * Sengaja memakai `<img>`/`<video>` biasa, **bukan** `next/image`. Media ini
 * privat dan hanya diakses lewat signed URL ber-TTL 10 menit (docs/10 section 8);
 * menyalurkannya lewat optimizer Next berarti salinan hasil optimasi tetap
 * tersaji setelah tanda tangannya kedaluwarsa — persis yang ingin dicegah.
 * Optimizer juga menuntut `remotePatterns` yang harus mengizinkan query string
 * token, sehingga polanya menjadi longgar tanpa manfaat sepadan.
 */
export function DocPreview({ doc }: { doc: DocumentationRow }) {
  if (doc.type === 'note') {
    return (
      <div className="border-border bg-muted/50 flex size-20 shrink-0 items-center justify-center rounded-xl border">
        <FileText className="text-muted-foreground size-6" />
      </div>
    );
  }

  if (!doc.mediaUrl) {
    return (
      <div
        className="border-border bg-muted/50 flex size-20 shrink-0 items-center justify-center rounded-xl border"
        title="Berkas tidak dapat diakses"
      >
        <ImageOff className="text-muted-foreground size-6" />
      </div>
    );
  }

  if (doc.type === 'video') {
    return (
      <video
        src={doc.mediaUrl}
        controls
        preload="metadata"
        className="border-border size-20 shrink-0 rounded-xl border object-cover"
      />
    );
  }

  return (
    <a href={doc.mediaUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={doc.mediaUrl}
        alt={doc.caption ?? 'Dokumentasi lapangan'}
        loading="lazy"
        className="border-border size-20 rounded-xl border object-cover transition-opacity hover:opacity-80"
      />
    </a>
  );
}
