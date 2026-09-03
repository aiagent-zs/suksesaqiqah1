'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deleteService, setServiceActive } from '@/server/actions/services';

/**
 * Aktif/non-aktif & hapus untuk satu paket.
 *
 * **Pindah dari baris daftar ke halaman detail**, sengaja: di sini jumlah
 * order yang memakai paket ini sudah terbaca di layar, jadi tombolnya bisa
 * menjelaskan diri **sebelum** ditekan alih-alih menolak sesudahnya. Pola yang
 * sama dipakai `VendorActiveToggle`.
 */
export function ServiceDetailActions({
  serviceId,
  isActive,
  showOnLanding,
  ordersUsing,
}: {
  serviceId: string;
  isActive: boolean;
  showOnLanding: boolean;
  ordersUsing: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function toggleActive() {
    setError(null);
    startTransition(async () => {
      const result = await setServiceActive({ id: serviceId, is_active: !isActive });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await deleteService({ id: serviceId });
      if (!result.ok) {
        setError(result.error.message);
        setConfirmDelete(false);
        return;
      }
      // Barisnya sudah tidak ada; bertahan di halamannya berarti menatap data
      // yang baru saja dihapus.
      router.push('/vendors?tab=katalog');
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={toggleActive} disabled={pending}>
          {isActive ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          {isActive ? 'Nonaktifkan' : 'Aktifkan'}
        </Button>

        {/* Hapus hanya untuk paket yang belum pernah dipakai. Menawarkannya
            pada yang sudah dipakai berarti tombol yang pasti ditolak, dan
            operator tidak punya cara menebak sebabnya sebelum menekannya. */}
        {ordersUsing === 0 &&
          (confirmDelete ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={remove}
              disabled={pending}
            >
              Yakin hapus?
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              disabled={pending}
            >
              <Trash2 className="size-3.5" />
              Hapus
            </Button>
          ))}
      </div>

      {isActive && showOnLanding && (
        <p className="text-muted-foreground text-right text-xs">
          Menonaktifkan juga mencabutnya dari halaman depan.
        </p>
      )}

      {ordersUsing > 0 && (
        <p className="text-muted-foreground text-right text-xs">
          Sudah dipakai {ordersUsing} order — tidak dapat dihapus, hanya dinonaktifkan.
        </p>
      )}

      {error && (
        <p role="alert" className="text-destructive text-right text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
