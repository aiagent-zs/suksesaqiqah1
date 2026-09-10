'use client';

import { useState } from 'react';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BusyButton } from '@/components/ui/busy-button';
import { deleteReport } from '@/server/actions/reports';

/**
 * Hapus satu versi laporan.
 *
 * Dialog, bukan hapus langsung: versi laporan adalah berkas yang mungkin sudah
 * diunduh atau dibuka orang, dan tombol hapus duduk tepat di sebelah "Unduh
 * PDF" — jarak sekecil itu membuat salah klik bukan hal yang jauh.
 *
 * Yang **sudah ditandai terkirim** tidak pernah sampai ke sini: pemanggil tidak
 * merender tombolnya. Server tetap menolaknya sendiri — penjagaan di layar
 * hanya menghemat perjalanan, bukan yang menegakkan aturannya.
 */
export function DeleteReportDialog({
  reportId,
  version,
  disabled,
  onRun,
}: {
  reportId: string;
  version: number;
  disabled: boolean;
  /** Runner milik panel — pesan galat & refresh ditangani di satu tempat. */
  onRun: (fn: () => Promise<{ ok: boolean; error?: { message: string } }>) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger
        render={
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            aria-label={`Hapus versi ${version}`}
          >
            <Trash2 className="size-3.5" />
            Hapus
          </Button>
        }
      />

      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />

        <AlertDialog.Popup className="border-border bg-card fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border p-5 shadow-lg transition-all duration-150 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <AlertDialog.Title className="text-base font-semibold">
            Hapus laporan versi {version}?
          </AlertDialog.Title>
          <AlertDialog.Description className="text-muted-foreground mt-1.5 text-sm">
            PDF-nya ikut dihapus dan tidak bisa dikembalikan. Versi ini belum ditandai terkirim,
            jadi tautan yang dipegang peserta tidak terpengaruh.
          </AlertDialog.Description>

          <div className="mt-4 flex items-center justify-end gap-2">
            <AlertDialog.Close
              render={
                <Button type="button" variant="outline" disabled={disabled}>
                  Batal
                </Button>
              }
            />
            <BusyButton
              type="button"
              variant="destructive"
              busy={disabled}
              busyLabel="Menghapus…"
              onClick={() => {
                setOpen(false);
                onRun(() => deleteReport({ report_id: reportId }));
              }}
            >
              Ya, hapus versi {version}
            </BusyButton>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
