'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Halaman ini gagal dimuat</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Data belum berhasil diambil dari server. Coba muat ulang; kalau tetap gagal, laporkan ke
        superadmin beserta jam kejadiannya.
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Button onClick={() => retry()} className="h-11">
          Muat ulang
        </Button>
        <Link href="/dashboard" className={cn(buttonVariants({ variant: 'outline' }), 'h-11')}>
          Ke dashboard
        </Link>
      </div>
    </div>
  );
}
