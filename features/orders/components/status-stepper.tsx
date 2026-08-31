import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ORDER_STATUS_FLOW, ORDER_STATUS_META, type OrderStatus } from '@/lib/constants/order';
import { statusStepIndex } from '../state-machine';

/**
 * Stepper rangkaian status order (docs/08 section 1).
 * `on_hold` dan `cancelled` berada di luar rangkaian sehingga ditampilkan
 * sebagai keterangan, bukan sebagai langkah.
 */
export function StatusStepper({ status }: { status: OrderStatus }) {
  const current = statusStepIndex(status);
  const offTrack = current === -1;

  return (
    <div>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
        {ORDER_STATUS_FLOW.map((step, index) => {
          const done = !offTrack && index < current;
          const active = !offTrack && index === current;

          return (
            <li key={step} className="flex items-center gap-1.5">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                  done && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                  active && 'border-primary bg-primary text-primary-foreground',
                  !done && !active && 'border-border bg-muted/50 text-muted-foreground',
                )}
              >
                {done && <Check className="size-3" />}
                {ORDER_STATUS_META[step].label}
              </span>
              {index < ORDER_STATUS_FLOW.length - 1 && (
                <span
                  aria-hidden
                  className={cn('h-px w-4', done ? 'bg-emerald-300' : 'bg-border')}
                />
              )}
            </li>
          );
        })}
      </ol>

      {offTrack && (
        <p className="text-muted-foreground mt-3 text-sm">
          Order berada di luar rangkaian normal:{' '}
          <span className="text-foreground font-medium">{ORDER_STATUS_META[status].label}</span>.
        </p>
      )}
    </div>
  );
}
