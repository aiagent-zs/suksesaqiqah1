'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, MessageCircle } from 'lucide-react';
import { markNotificationSent } from '@/server/actions/notifications';

/**
 * Tombol per baris panel "Perlu Tindakan": kirim WhatsApp dan/atau tandai
 * selesai.
 *
 * **Klik "Kirim WA" sekaligus menandai baris selesai.** Dua tombol terpisah
 * berarti admin harus ingat menekan yang kedua, dan yang lupa meninggalkan
 * baris `queued` selamanya — persis keadaan yang panel ini ada untuk
 * menghilangkan. Tautannya tetap dibiarkan menavigasi seperti biasa; penandaan
 * berjalan di sampingnya, jadi WhatsApp tetap terbuka walau penandaannya gagal.
 *
 * ponytail: "selesai" di sini berarti "admin sudah dibawa ke WhatsApp", bukan
 * bukti pesannya benar-benar terkirim. Ganti dengan status dari worker/webhook
 * pengirim saat Tahap 8 selesai.
 */
export function AlertActions({ id, waHref }: { id: string; waHref: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function markSent() {
    setError(null);
    startTransition(async () => {
      const result = await markNotificationSent({ id });
      if (result.ok) {
        router.refresh();
        return;
      }
      setError(result.error.message);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        {waHref ? (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={markSent}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
          >
            <MessageCircle className="size-3.5" />
            Kirim WA
          </a>
        ) : null}

        <button
          type="button"
          onClick={markSent}
          disabled={pending}
          title="Tandai sudah ditangani"
          aria-label="Tandai sudah ditangani"
          className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-8 items-center justify-center rounded-md transition-colors disabled:opacity-50"
        >
          <Check className="size-4" />
        </button>
      </div>

      {error ? <p className="text-destructive max-w-[16rem] text-right text-xs">{error}</p> : null}
    </div>
  );
}
