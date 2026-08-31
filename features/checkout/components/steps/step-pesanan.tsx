'use client';

import { Baby, Check, Minus, Plus, ShoppingBag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ANIMAL_SPECIES_LABEL } from '@/lib/constants/order';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CheckoutPackage, NasiBoxPackage } from '../../queries';
import type { Draft } from '../../draft';
import { FieldError } from './field-error';
import { StepperButton } from './stepper-button';
import { AQIQAH_FOR_OPTIONS, MAX_QTY, RECOMMENDED_QTY, SERVICE_TYPE_LABEL } from './constants';

/** Langkah 1 — apa yang dipesan: jenis kelamin, paket & jumlah ekor, nasi box. */
export function StepPesanan({
  draft,
  set,
  fieldErrors,
  packages,
  nasiBoxes,
  selectedBox,
  speciesOptions,
  boxSubtotal,
  pickPackage,
  pickAqiqahFor,
}: {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  fieldErrors: Record<string, string>;
  packages: CheckoutPackage[];
  nasiBoxes: NasiBoxPackage[];
  selectedBox: NasiBoxPackage | undefined;
  speciesOptions: string[];
  boxSubtotal: number;
  pickPackage: (pkg: CheckoutPackage) => void;
  pickAqiqahFor: (value: string) => void;
}) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-[420ms] ease-out">
      <div>
        <div className="mb-2.5 flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
          <Label id="co-aqiqahfor-label" className="text-base font-bold text-neutral-900">
            Aqiqah untuk siapa?
          </Label>
          <span className="text-xs text-neutral-500">Menentukan anjuran jumlah ekor</span>
        </div>
        <div
          id="co-aqiqahfor"
          role="radiogroup"
          aria-labelledby="co-aqiqahfor-label"
          aria-invalid={Boolean(fieldErrors.aqiqah_for)}
          tabIndex={-1}
          className={cn(
            'grid gap-2.5 rounded-lg sm:grid-cols-2',
            fieldErrors.aqiqah_for && 'animate-nudge',
          )}
        >
          {AQIQAH_FOR_OPTIONS.map((opt) => {
            const active = draft.aqiqah_for === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => pickAqiqahFor(opt.value)}
                role="radio"
                aria-checked={active}
                className={cn(
                  'relative flex items-center gap-3 rounded-lg border p-3.5 text-left transition-all duration-200 active:scale-[0.99] sm:p-4',
                  active
                    ? 'border-primary bg-primary/5 ring-primary shadow-sm ring-1'
                    : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50 hover:shadow-sm',
                )}
              >
                <div
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors sm:size-11',
                    active ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-500',
                  )}
                >
                  <Baby className="size-5" />
                </div>
                <div className="min-w-0 pr-4">
                  <p className="text-sm font-bold text-neutral-900 sm:text-base">{opt.label}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">{opt.hint}</p>
                </div>
                {active && (
                  <span className="bg-primary absolute top-3 right-3 flex size-5 items-center justify-center rounded-full text-white">
                    <Check className="size-3 stroke-[3]" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {fieldErrors.aqiqah_for && <FieldError message={fieldErrors.aqiqah_for} />}
      </div>

      {/* PAKET */}
      <div className="border-t border-neutral-100 pt-5 sm:pt-6">
        <div className="mb-2.5 flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
          <Label id="co-service-label" className="text-base font-bold text-neutral-900">
            Pilih Paket
          </Label>
          <span className="text-xs text-neutral-500">Harga net termasuk olahan &amp; laporan</span>
        </div>
        <div
          id="co-service"
          role="radiogroup"
          aria-labelledby="co-service-label"
          aria-invalid={Boolean(fieldErrors.service_id)}
          tabIndex={-1}
          className={cn(
            'grid gap-2.5 rounded-lg sm:grid-cols-2 lg:grid-cols-3',
            fieldErrors.service_id && 'animate-nudge',
          )}
        >
          {packages.map((pkg) => {
            const active = pkg.id === draft.service_id;
            return (
              <button
                key={pkg.id}
                type="button"
                onClick={() => pickPackage(pkg)}
                role="radio"
                aria-checked={active}
                className={cn(
                  'group relative flex flex-col justify-between rounded-lg border p-3.5 text-left transition-all duration-200 active:scale-[0.99] sm:p-4',
                  active
                    ? 'border-primary bg-primary/5 ring-primary shadow-sm ring-1'
                    : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50 hover:shadow-sm',
                )}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'inline-block rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase',
                        active ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-600',
                      )}
                    >
                      {SERVICE_TYPE_LABEL[pkg.type] ?? pkg.type}
                    </span>
                    {active && (
                      <span className="bg-primary flex size-5 items-center justify-center rounded-full text-white">
                        <Check className="size-3 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm font-bold text-neutral-900 sm:text-base">{pkg.name}</p>
                  {pkg.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{pkg.description}</p>
                  )}
                </div>
                <p className="text-primary mt-2.5 text-base font-extrabold tabular-nums sm:mt-3 sm:text-lg">
                  {formatCurrency(pkg.price)}
                </p>
              </button>
            );
          })}
        </div>
        {fieldErrors.service_id && <FieldError message={fieldErrors.service_id} />}
      </div>

      <div className="grid gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3.5 sm:grid-cols-2 sm:gap-6 sm:p-5">
        <div>
          <Label className="text-sm font-semibold text-neutral-800">Jenis Hewan</Label>
          <div className="mt-2 inline-flex rounded-xl bg-neutral-200/60 p-1">
            {speciesOptions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => set('species', s)}
                aria-pressed={draft.species === s}
                className={cn(
                  'rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all sm:px-4 sm:py-2',
                  draft.species === s
                    ? 'bg-white text-neutral-900 shadow-sm'
                    : 'text-neutral-600 hover:text-neutral-900',
                )}
              >
                {ANIMAL_SPECIES_LABEL[s as keyof typeof ANIMAL_SPECIES_LABEL]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label id="co-qty-label" className="text-sm font-semibold text-neutral-800">
            Jumlah Ekor
          </Label>
          <div
            id="co-qty"
            role="group"
            aria-labelledby="co-qty-label"
            tabIndex={-1}
            className={cn(
              'mt-2 inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white p-1 shadow-sm',
              fieldErrors.qty && 'animate-nudge border-red-300',
            )}
          >
            <StepperButton
              label="Kurangi jumlah"
              disabled={draft.qty <= 1}
              onClick={() => set('qty', Math.max(1, draft.qty - 1))}
            >
              <Minus className="size-4" />
            </StepperButton>
            <span className="w-10 text-center text-base font-bold text-neutral-900 tabular-nums sm:w-12">
              {draft.qty}
            </span>
            <StepperButton
              label="Tambah jumlah"
              disabled={draft.qty >= MAX_QTY}
              onClick={() => set('qty', Math.min(MAX_QTY, draft.qty + 1))}
            >
              <Plus className="size-4" />
            </StepperButton>
          </div>
          {draft.aqiqah_for && (
            <p className="mt-1.5 text-xs text-neutral-500">
              Anjuran untuk {draft.aqiqah_for === 'laki_laki' ? 'anak laki-laki' : 'anak perempuan'}
              : {RECOMMENDED_QTY[draft.aqiqah_for]} ekor
            </p>
          )}
          {fieldErrors.qty && <FieldError message={fieldErrors.qty} />}
        </div>
      </div>

      <div className="border-t border-neutral-100 pt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Label className="text-base font-bold text-neutral-900">
            Nasi Box <span className="font-normal text-neutral-500">(opsional)</span>
          </Label>
          <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
            <ShoppingBag className="size-3.5 text-blue-600" />
            Dibagikan bersama aqiqah Anda
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => {
              set('nasi_box_service_id', '');
              set('nasi_box_qty', 0);
            }}
            aria-pressed={!draft.nasi_box_service_id}
            className={cn(
              'relative rounded-lg border p-4 text-left transition-all active:scale-[0.99]',
              !draft.nasi_box_service_id
                ? 'border-primary bg-primary/5 ring-primary shadow-sm ring-1'
                : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50 hover:shadow-sm',
            )}
          >
            <p className="font-bold text-neutral-900">Tidak pakai</p>
            <p className="mt-1 text-xs text-neutral-500">Hanya paket ibadah saja</p>
            {!draft.nasi_box_service_id && (
              <span className="bg-primary absolute top-3 right-3 flex size-5 items-center justify-center rounded-full text-white">
                <Check className="size-3 stroke-[3]" />
              </span>
            )}
          </button>

          {nasiBoxes.map((box) => {
            const active = box.id === draft.nasi_box_service_id;
            return (
              <button
                key={box.id}
                type="button"
                onClick={() => {
                  set('nasi_box_service_id', box.id);
                  if (draft.nasi_box_qty < 1) set('nasi_box_qty', 10);
                }}
                aria-pressed={active}
                className={cn(
                  'relative rounded-lg border p-4 text-left transition-all active:scale-[0.99]',
                  active
                    ? 'border-primary bg-primary/5 ring-primary shadow-sm ring-1'
                    : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50 hover:shadow-sm',
                )}
              >
                <p className="font-bold text-neutral-900">{box.name}</p>
                <p className="text-primary mt-1.5 text-base font-extrabold tabular-nums">
                  {formatCurrency(box.price)}
                  <span className="ml-1 text-[11px] font-medium text-neutral-500">/ box</span>
                </p>
                {active && (
                  <span className="bg-primary absolute top-3 right-3 flex size-5 items-center justify-center rounded-full text-white">
                    <Check className="size-3 stroke-[3]" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {draft.nasi_box_service_id && (
          <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <Label htmlFor="co-boxqty" className="text-sm font-semibold text-neutral-800">
              Jumlah Box <span className="text-red-500">*</span>
            </Label>
            <Input
              id="co-boxqty"
              type="number"
              min={1}
              max={5000}
              step="1"
              inputMode="numeric"
              value={draft.nasi_box_qty || ''}
              aria-invalid={Boolean(fieldErrors.nasi_box_qty)}
              aria-describedby={fieldErrors.nasi_box_qty ? 'nasi_box_qty-error' : undefined}
              onChange={(e) => set('nasi_box_qty', Number(e.target.value) || 0)}
              className="mt-2 h-12 max-w-40 rounded-lg border-neutral-200 text-sm tabular-nums shadow-sm"
            />
            {selectedBox && draft.nasi_box_qty > 0 && (
              <p className="mt-2 text-xs text-neutral-600">
                {draft.nasi_box_qty} × {formatCurrency(selectedBox.price)} ={' '}
                <span className="text-primary font-bold">{formatCurrency(boxSubtotal)}</span>
              </p>
            )}
            {fieldErrors.nasi_box_qty && (
              <FieldError id="nasi_box_qty-error" message={fieldErrors.nasi_box_qty} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
