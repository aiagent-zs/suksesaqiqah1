'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { changeOrderStatus } from '@/server/actions/orders';
import type { TransitionOption } from '../state-machine';
import type { OrderStatus } from '@/lib/constants/order';

/** Transisi yang wajib disertai alasan (docs/16 section 3: field `reason`). */
const REASON_REQUIRED: OrderStatus[] = ['on_hold', 'cancelled'];

export function StatusActions({
  orderId,
  options,
}: {
  orderId: string;
  options: TransitionOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<TransitionOption | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (options.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Info className="size-4" />
        Tidak ada transisi status yang tersedia untuk role Anda pada tahap ini.
      </p>
    );
  }

  function run(option: TransitionOption, withReason: string) {
    setError(null);
    startTransition(async () => {
      const result = await changeOrderStatus({
        order_id: orderId,
        to: option.to,
        reason: withReason,
      });

      if (result.ok) {
        setSelected(null);
        setReason('');
        router.refresh();
        return;
      }
      setError(result.error.message);
    });
  }

  function handleClick(option: TransitionOption) {
    if (REASON_REQUIRED.includes(option.to)) {
      setSelected(option);
      setError(null);
      return;
    }
    run(option, '');
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option.to}
            size="lg"
            variant={REASON_REQUIRED.includes(option.to) ? 'outline' : 'default'}
            disabled={!option.allowed || pending}
            title={option.reason ?? undefined}
            onClick={() => handleClick(option)}
          >
            <ArrowRight className="size-4" />
            {option.label}
          </Button>
        ))}
      </div>

      {/* Alasan precondition yang belum terpenuhi — operator tahu apa yang kurang. */}
      {options.some((o) => !o.allowed) && (
        <ul className="space-y-1">
          {options
            .filter((o) => !o.allowed)
            .map((o) => (
              <li key={o.to} className="flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  <span className="font-medium">{o.label}:</span> {o.reason}
                </span>
              </li>
            ))}
        </ul>
      )}

      {selected && (
        <div className="rounded-xl border border-border bg-muted/40 p-4">
          <Label htmlFor="status-reason">Alasan {selected.label.toLowerCase()}</Label>
          <Textarea
            id="status-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Contoh: akses jalan ke lokasi tergenang banjir."
            className="mt-1.5 bg-card"
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSelected(null);
                setReason('');
              }}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={reason.trim().length < 5 || pending}
              onClick={() => run(selected, reason.trim())}
            >
              {pending ? 'Memproses…' : `Konfirmasi ${selected.label}`}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
