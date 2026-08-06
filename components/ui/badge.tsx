import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Badge status — selalu pill (design.md: "Tags/Badges use fully rounded shapes").
 * Warna dikirim lewat className dari lib/constants/order.ts agar satu status
 * punya satu warna di seluruh aplikasi.
 */
function Badge({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="badge"
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
