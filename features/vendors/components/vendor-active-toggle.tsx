'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { setVendorActive } from '@/server/actions/vendors';

/**
 * Aktif / non-aktif satu mitra.
 *
 * Order berjalan sudah dihitung di server, jadi tombolnya bisa menjelaskan diri
 * **sebelum** ditekan — `setVendorActive` tetap menolak di sisi server, tapi
 * penolakan yang baru muncul setelah diklik memaksa orang menebak apa yang
 * salah.
 */
export function VendorActiveToggle({
  vendorId,
  isActive,
  ordersOpen,
}: {
  vendorId: string;
  isActive: boolean;
  ordersOpen: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const blocked = isActive && ordersOpen > 0;

  return (
    <div className="shrink-0 text-right">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending || blocked}
        title={
          blocked
            ? `Masih memegang ${ordersOpen} order berjalan — selesaikan atau pindahkan lebih dulu`
            : undefined
        }
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await setVendorActive({ id: vendorId, is_active: !isActive });
            if (!result.ok) {
              setError(result.error.message);
              return;
            }
            router.refresh();
          });
        }}
      >
        {isActive ? 'Nonaktifkan' : 'Aktifkan'}
      </Button>
      {error && <p className="text-destructive mt-1.5 max-w-60 text-xs">{error}</p>}
    </div>
  );
}
