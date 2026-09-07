'use client';

import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deleteUser } from '@/server/actions/users';
import type { UserRow } from '../queries';

/**
 * Penegasan penghapusan akun.
 *
 * `AlertDialog`, bukan `Dialog`: ia tidak bisa ditutup dengan klik di luar atau
 * Escape, dan itu tepat untuk satu-satunya tombol di halaman ini yang tidak bisa
 * dibatalkan dari halaman ini juga.
 *
 * Isinya menyebutkan dua hal yang paling sering jadi alasan orang menekan tombol
 * ini secara keliru: jejaknya tetap tersimpan (jadi tidak perlu takut kehilangan
 * riwayat), dan Nonaktifkan sudah cukup kalau yang dimaksud hanya menghentikan
 * akses sementara.
 */
export function UserDeleteDialog({ user, trigger }: { user: UserRow; trigger: ReactElement }) {
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
      const result = await deleteUser({ user_id: user.id });

      if (!result.ok) {
        setError(result.error?.message ?? 'Terjadi kesalahan.');
        return;
      }

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
            Hapus akun {user.fullName ?? user.email ?? 'ini'}?
          </AlertDialog.Title>
          <AlertDialog.Description className="text-muted-foreground mt-1.5 text-sm">
            Akun ini tidak akan bisa login lagi dan hilang dari daftar. Jejaknya di laporan tahap,
            validasi, dan audit tetap tersimpan.
          </AlertDialog.Description>

          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Kalau hanya perlu menghentikan aksesnya sementara, pakai <strong>Nonaktifkan</strong> —
            akunnya bisa dihidupkan lagi kapan saja.
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
              Ya, hapus akun
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
