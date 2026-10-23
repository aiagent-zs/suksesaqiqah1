'use client';

import { CalendarDays, Clock, HandHeart, Truck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { BOOKING_MAX_DAYS, BOOKING_TIME_SLOTS } from '../../schema';
import type { Draft } from '../../draft';
import type { RegionOption } from '../../queries';
import { AddressPicker } from '../address-picker';
import { ChoiceCard } from './choice-card';
import { FieldError } from './field-error';
import { SectionLabel, StepIntro } from './step-header';
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
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-10 duration-300 ease-out">
      <StepIntro title="Kapan aqiqahnya, dan dagingnya ke mana?">
        Jadwal ini masih permintaan. Tim kami mengonfirmasinya lewat WhatsApp.
      </StepIntro>

      <div>
        <SectionLabel
          index={1}
          done={Boolean(draft.requested_date && draft.requested_time)}
          title="Kapan dilaksanakan?"
          hint={`Paling cepat ${formatDate(minDate)}, paling lambat ${BOOKING_MAX_DAYS} hari ke depan.`}
        />

        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
          <div>
            <Label
              htmlFor="co-date"
              className="text-ink flex items-center gap-1.5 text-sm font-semibold"
            >
              <CalendarDays aria-hidden className="text-primary size-4" />
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
              className="field mt-2 h-12"
            />
            {fieldErrors.requested_date && (
              <FieldError id="requested_date-error" message={fieldErrors.requested_date} />
            )}
          </div>

          <div>
            <Label
              id="co-time-label"
              className="text-ink flex items-center gap-1.5 text-sm font-semibold"
            >
              <Clock aria-hidden className="text-primary size-4" />
              Jam
            </Label>
            <div
              id="co-time"
              role="radiogroup"
              aria-labelledby="co-time-label"
              className="mt-2 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap"
            >
              {BOOKING_TIME_SLOTS.map((slot) => {
                const active = draft.requested_time === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => set('requested_time', slot)}
                    role="radio"
                    aria-checked={active}
                    className={cn(
                      'flex min-h-11 items-center justify-center rounded-lg border-2 px-1 text-center text-sm font-semibold tabular-nums transition-colors duration-150 active:scale-[0.97] sm:px-4',
                      active
                        ? 'border-primary bg-primary text-white'
                        : 'border-line text-ink hover:border-primary/50 bg-white',
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

        <p className="text-ink-muted mt-3 text-sm leading-6">
          Jadwal bisa bergeser bila petugas atau lokasi pada jam itu sudah penuh.
        </p>
      </div>

      <div>
        <SectionLabel
          id="co-distribution-label"
          index={2}
          done={Boolean(draft.distribution_mode)}
          title="Dagingnya mau ke mana?"
          hint="Mau dagingnya kami salurkan, atau diantar ke alamat Anda?"
        />
        <div
          id="co-distribution"
          role="radiogroup"
          aria-labelledby="co-distribution-label"
          aria-invalid={Boolean(fieldErrors.distribution_mode)}
          tabIndex={-1}
          className={cn(
            'grid gap-3 sm:grid-cols-2',
            fieldErrors.distribution_mode && 'animate-nudge',
          )}
        >
          {DISTRIBUTION_OPTIONS.map((opt) => (
            <ChoiceCard
              key={opt.value}
              checked={draft.distribution_mode === opt.value}
              onSelect={() => set('distribution_mode', opt.value)}
              icon={opt.value === 'salur' ? HandHeart : Truck}
              title={opt.label}
              description={opt.hint}
            />
          ))}
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
