import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

/**
 * Paginasi berbasis URL (docs/16 section 1: ?page=&page_size=).
 * Link biasa, bukan tombol — halaman list tetap bisa dinavigasi tanpa JavaScript.
 */
export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  searchParams,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const buildHref = (targetPage: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value && key !== 'page') params.set(key, value);
    }
    params.set('page', String(targetPage));
    return `${basePath}?${params.toString()}`;
  };

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-muted-foreground">
        Menampilkan <span className="font-medium tabular-nums">{first}</span>–
        <span className="font-medium tabular-nums">{last}</span> dari{' '}
        <span className="font-medium tabular-nums">{total}</span> order
      </p>

      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={buildHref(page - 1)}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            <ChevronLeft className="size-3.5" />
            Sebelumnya
          </Link>
        ) : (
          <span className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'opacity-50')}>
            <ChevronLeft className="size-3.5" />
            Sebelumnya
          </span>
        )}

        <span className="px-2 text-sm tabular-nums">
          {page} / {totalPages}
        </span>

        {page < totalPages ? (
          <Link
            href={buildHref(page + 1)}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            Berikutnya
            <ChevronRight className="size-3.5" />
          </Link>
        ) : (
          <span className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'opacity-50')}>
            Berikutnya
            <ChevronRight className="size-3.5" />
          </span>
        )}
      </div>
    </div>
  );
}
