'use client';

import { Check, ShieldCheck, Truck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { BOOKING_MAX_DAYS, BOOKING_TIME_SLOTS } from '../../schema';
import type { Draft } from '../../draft';
import type { RegionOption } from '../../queries';
import { AddressPicker } from '../address-picker';
import { FieldError } from './field-error';
import { DISTRIBUTION_OPTIONS } from './constants';

/** Langkah 2 — kapan dan bagaimana pesanan disalurkan. */
export function StepJadwal({
  draft,
  set,
  fieldErrors,
  provinces,
  minDate,
  maxDate,
}: {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  fieldErrors: Record<string, string>;
  provinces: RegionOption[];
  minDate: string;
  maxDate: string;
}) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-5 duration-[420ms] ease-out">
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3.5 sm:p-5">
        <div className="mb-2.5 flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
          <Label htmlFor="co-date" className="text-base font-bold text-neutral-900">
            Kapan dilaksanakan? <span className="text-red-500">*</span>
          </Label>
          <span className="text-xs text-neutral-500">
            Paling cepat {formatDate(minDate)} · maksimal {BOOKING_MAX_DAYS} hari ke depan
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
          <div>
            <Label htmlFor="co-date" className="text-sm font-semibold text-neutral-800">
              Tanggal
            </Label>
            {/* `min`/`max` datang dari server dalam WIB — atribut ini hanya
                      membantu pemilih tanggal peramban; penolakan sungguhannya
                      tetap di `validateStep`, `guestCheckoutSchema`, dan RPC,
                      karena input `date` bisa diisi lewat keyboard. */}
            <Input
              id="co-date"
              type="date"
              min={minDate}
              max={maxDate}
              value={draft.requested_date}
              required
              aria-required
              aria-invalid={Boolean(fieldErrors.requested_date)}
              aria-describedby={fieldErrors.requested_date ? 'requested_date-error' : undefined}
              onChange={(e) => set('requested_date', e.target.value)}
              className="mt-2 h-11 rounded-lg border-neutral-200 text-sm shadow-sm sm:h-12"
            />
            {fieldErrors.requested_date && (
              <FieldError id="requested_date-error" message={fieldErrors.requested_date} />
            )}
          </div>

          <div>
            <Label className="text-sm font-semibold text-neutral-800">Jam</Label>
            <div
              id="co-time"
              className="mt-2 grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:gap-2"
            >
              {BOOKING_TIME_SLOTS.map((slot) => {
                const active = draft.requested_time === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => set('requested_time', slot)}
                    aria-pressed={active}
                    className={cn(
                      'flex min-h-11 items-center justify-center rounded-lg border px-1 text-center text-xs font-semibold tabular-nums transition-all active:scale-[0.97] sm:px-3.5',
                      active
                        ? 'border-primary bg-primary text-white shadow-sm'
                        : 'hover:border-primary/40 border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50',
                    )}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
            {fieldErrors.requested_time && <FieldError message={fieldErrors.requested_time} />}
          </div>
        </div>

        <p className="mt-3 text-xs leading-5 text-neutral-500">
          Jadwal ini permintaan Anda. Tim kami mengonfirmasinya lewat WhatsApp sebelum ditetapkan —
          bisa bergeser bila petugas atau lokasi pada jam itu sudah penuh.
        </p>
      </div>

      <div>
        <Label
          id="co-distribution-label"
          className="mb-2.5 block text-base font-bold text-neutral-900"
        >
          Cara Penyaluran
        </Label>
        <div
          id="co-distribution"
          role="radiogroup"
          aria-labelledby="co-distribution-label"
          aria-invalid={Boolean(fieldErrors.distribution_mode)}
          tabIndex={-1}
          className={cn(
            'grid gap-2.5 rounded-lg sm:grid-cols-2',
            fieldErrors.distribution_mode && 'animate-nudge',
          )}
        >
          {DISTRIBUTION_OPTIONS.map((opt) => {
            const active = draft.distribution_mode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => set('distribution_mode', opt.value)}
                role="radio"
                aria-checked={active}
                className={cn(
                  'relative rounded-lg border p-4 text-left transition-all active:scale-[0.99]',
                  active
                    ? 'border-primary bg-primary/5 ring-primary shadow-sm ring-1'
                    : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50 hover:shadow-sm',
                )}
              >
                <div
                  className={cn(
                    'flex size-10 items-center justify-center rounded-xl transition-colors',
                    active ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-500',
                  )}
                >
                  {opt.value === 'salur' ? (
                    <ShieldCheck className="size-5" />
                  ) : (
                    <Truck className="size-5" />
                  )}
                </div>
                <p className="mt-3 font-bold text-neutral-900">{opt.label}</p>
                <p className="mt-1 text-xs leading-5 text-neutral-500">{opt.hint}</p>
                {active && (
                  <span className="bg-primary absolute top-3 right-3 flex size-5 items-center justify-center rounded-full text-white">
                    <Check className="size-3 stroke-[3]" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {fieldErrors.distribution_mode && <FieldError message={fieldErrors.distribution_mode} />}
      </div>

      {/* Hanya bermakna kalau dagingnya diantar ke pemesan. */}
      {draft.distribution_mode === 'kirim' && (
        <AddressPicker
          provinces={provinces}
          value={draft.delivery}
          onChange={(next) => set('delivery', next)}
          errors={fieldErrors}
        />
      )}

      {/* <div>
              <Label htmlFor="co-institution" className="text-sm font-semibold text-neutral-800">
                Instansi Penerima Risalah{' '}
                <span className="font-normal text-neutral-500">(opsional)</span>
              </Label>
              <Input
                id="co-institution"
                value={draft.recipient_institution}
                placeholder="Mis. Panti Asuhan Al-Amin, Masjid Nurul Iman"
                onChange={(e) => set('recipient_institution', e.target.value)}
                className="mt-2 h-12 rounded-lg border-neutral-200 text-sm shadow-sm"
              />
              {fieldErrors.recipient_institution && (
                <FieldError message={fieldErrors.recipient_institution} />
              )}
            </div> */}
    </div>
  );
}
