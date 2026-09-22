'use client';

import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmModal } from '@/components/ui/modal';
import { Toast } from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';
import { deleteService } from '@/server/actions/services';
import type { ServiceRow } from '../queries';

/**
 * Penegasan penghapusan paket.
 *
 * ## Yang digantikannya
 *
 * Sebelumnya tombol "Hapus" berubah jadi "Yakin hapus?" **di tempat yang sama**.
 * Dua masalah: tombol yang bertukar teks di bawah kursor membuat klik kedua yang
 * tidak disengaja langsung menghapus, dan tidak ada ruang menjelaskan akibatnya.
 */
export function ServiceDeleteDialog({
  service,
  trigger,
}: {
  service: ServiceRow;
  trigger: ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { toast, show, dismiss } = useToast();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setError(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await deleteService({ id: service.id });

      if (!result.ok) {
        setError(result.error.message);
        show('error', result.error.message);
        return;
      }

      // Dialognya tertutup dan barisnya lenyap dari daftar. Tanpa toast,
      // hilangnya itu bisa terbaca sebagai halaman yang keliru memuat ulang —
      // dan operator tidak punya cara memastikan hapusnya benar-benar jadi.
      show('success', `Paket ${service.name} dihapus.`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {/* Di luar modal: toast harus tetap terlihat sesudah dialognya tertutup,
          dan isi portal ikut lepas bersama dialognya. */}
      <Toast state={toast} onDismiss={dismiss} />

      <ConfirmModal
        open={open}
        onOpenChange={handleOpenChange}
        trigger={trigger}
        title={`Hapus paket ${service.name}?`}
        description="Paket ini hilang dari katalog, checkout, dan halaman depan. Modal mitra yang tercatat untuknya ikut terhapus."
        hint={
          <>
            Kalau hanya perlu menghentikan penjualannya, pakai <strong>Nonaktifkan</strong> di
            halaman detail — paketnya tetap tersimpan beserta riwayatnya, dan bisa dihidupkan lagi
            kapan saja.
          </>
        }
        error={error}
        confirmLabel="Ya, hapus paket"
        pending={pending}
        onConfirm={submit}
      />
    </>
  );
}
