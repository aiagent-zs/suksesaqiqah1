'use client';

import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deleteLocation } from '@/server/actions/schedules';
import type { LocationOption } from '../queries';

/**
 * Penegasan penghapusan lokasi.
 *
 * `AlertDialog`, bukan `Dialog`: ia tidak bisa ditutup dengan klik di luar atau
 * Escape — tepat untuk aksi yang tidak bisa dibatalkan dari halaman ini juga.
 *
 * Penghapusannya sendiri `deleted_at`, bukan `delete`: `schedules.location_id`
 * merujuk baris ini, jadi penghapusan sungguhan memutus jejak ke mana
 * pelaksanaan sebuah order berlangsung — termasuk yang sudah tercetak di
 * laporan peserta. Order berjalan yang masih memakainya ditahan server lebih
 * dulu, dan pesannya menyebutkan berapa.
 */
export function LocationDeleteDialog({
  location,
  onDeleted,
  trigger,
}: {
  location: LocationOption;
  /** Dipanggil sesudah terhapus — pemanggil melepas pilihannya. */
  onDeleted?: () => void;
  trigger: ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setError(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await deleteLocation({ id: location.id });

      if (!result.ok) {
        setError(result.error?.message ?? 'Terjadi kesalahan.');
        return;
      }

      onDeleted?.();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={handleOpenChange}>
      <AlertDialog.Trigger render={trigger} />

      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />

        <AlertDialog.Popup className="border-border bg-card fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border p-5 shadow-lg transition-all duration-150 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <AlertDialog.Title className="text-base font-semibold">
            Hapus lokasi {location.name}?
          </AlertDialog.Title>
          <AlertDialog.Description className="text-muted-foreground mt-1.5 text-sm">
            Lokasi ini hilang dari daftar pilihan. Order lama yang pernah dilaksanakan di sini tetap
            menyimpan jejaknya, termasuk di laporan peserta.
          </AlertDialog.Description>

          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Lokasi yang masih dipakai order berjalan tidak bisa dihapus — pindahkan jadwalnya lebih
            dulu.
          </p>

          {error && (
            <p className="border-destructive/20 bg-destructive/5 text-destructive mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <AlertDialog.Close
              render={
                <Button type="button" variant="outline" disabled={pending}>
                  Batal
                </Button>
              }
            />
            <Button type="button" variant="destructive" disabled={pending} onClick={submit}>
              Ya, hapus lokasi
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
