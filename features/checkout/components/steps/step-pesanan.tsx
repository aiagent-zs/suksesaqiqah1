'use client';

import { Ban, Baby, Beef, Info, Minus, Package, Plus, Soup } from 'lucide-react';
import { NumberInput } from '@/components/ui/number-input';
import { Label } from '@/components/ui/label';
import { ANIMAL_SPECIES_LABEL } from '@/lib/constants/order';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CheckoutPackage, NasiBoxPackage } from '../../queries';
import type { Draft } from '../../draft';
import { ChoiceCard } from './choice-card';
import { FieldError } from './field-error';
import { SectionLabel, StepIntro } from './step-header';
import { StepperButton } from './stepper-button';
import { AQIQAH_FOR_OPTIONS, MAX_QTY, RECOMMENDED_QTY, SERVICE_TYPE_LABEL } from './constants';

/** Langkah 1: apa yang dipesan. Jenis kelamin, paket & jumlah ekor, nasi box. */
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
  const recommended = draft.aqiqah_for ? RECOMMENDED_QTY[draft.aqiqah_for] : null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-10 duration-300 ease-out">
      <StepIntro title="Aqiqah apa yang ingin Anda pesan?">
        Pilih satu di tiap bagian. Total di atas ikut berubah.
      </StepIntro>

      <div>
        <SectionLabel
          id="co-aqiqahfor-label"
          index={1}
          done={Boolean(draft.aqiqah_for)}
          title="Aqiqah untuk siapa?"
          hint="Menentukan anjuran jumlah ekor."
        />
        <div
          id="co-aqiqahfor"
          role="radiogroup"
          aria-labelledby="co-aqiqahfor-label"
          aria-invalid={Boolean(fieldErrors.aqiqah_for)}
          tabIndex={-1}
          className={cn('grid gap-3 sm:grid-cols-2', fieldErrors.aqiqah_for && 'animate-nudge')}
        >
          {AQIQAH_FOR_OPTIONS.map((opt) => (
            <ChoiceCard
              key={opt.value}
              checked={draft.aqiqah_for === opt.value}
              onSelect={() => pickAqiqahFor(opt.value)}
              icon={Baby}
              title={opt.label}
              description={opt.hint}
            />
          ))}
        </div>
        {fieldErrors.aqiqah_for && <FieldError message={fieldErrors.aqiqah_for} />}
      </div>

      <div>
        <SectionLabel
          id="co-service-label"
          index={2}
          done={Boolean(draft.service_id)}
          title="Pilih paket"
          hint="Harga per ekor, sudah termasuk olahan dan laporan."
        />
        <div
          id="co-service"
          role="radiogroup"
          aria-labelledby="co-service-label"
          aria-invalid={Boolean(fieldErrors.service_id)}
          tabIndex={-1}
          className={cn(
            'grid gap-3 sm:grid-cols-2 lg:grid-cols-3',
            fieldErrors.service_id && 'animate-nudge',
          )}
        >
          {packages.map((pkg) => (
            <ChoiceCard
              key={pkg.id}
              checked={pkg.id === draft.service_id}
              onSelect={() => pickPackage(pkg)}
              layout="stacked"
              icon={Beef}
              badge={
                <span className="text-primary text-xs font-semibold">
                  {SERVICE_TYPE_LABEL[pkg.type] ??
                    pkg.type.charAt(0).toUpperCase() + pkg.type.slice(1)}
                </span>
              }
              title={pkg.name}
              description={pkg.description ?? undefined}
              includes={pkg.features}
              price={
                <>
                  {formatCurrency(pkg.price)}
                  <span className="text-ink-muted ml-1 text-sm font-normal">/ekor</span>
                </>
              }
            />
          ))}
        </div>
        {fieldErrors.service_id && <FieldError message={fieldErrors.service_id} />}
      </div>

      <div>
        <SectionLabel
          index={3}
          done={draft.qty >= 1 && Boolean(draft.species)}
          title="Jenis hewan & jumlah ekor"
        />
        <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
          {speciesOptions.length > 1 && (
            <div>
              <Label className="text-ink text-sm font-semibold">Jenis hewan</Label>
              <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Jenis hewan">
                {speciesOptions.map((s) => {
                  const on = draft.species === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => set('species', s)}
                      className={cn(
                        'min-h-11 rounded-lg border-2 px-4 text-sm font-semibold transition-colors duration-150',
                        on
                          ? 'border-primary bg-primary-light text-primary'
                          : 'border-line text-ink hover:border-primary/50 bg-white',
                      )}
                    >
                      {ANIMAL_SPECIES_LABEL[s as keyof typeof ANIMAL_SPECIES_LABEL]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <Label id="co-qty-label" className="text-ink text-sm font-semibold">
              Jumlah ekor
              {speciesOptions.length === 1 && (
                <span className="text-ink-muted font-normal">
                  {' '}
                  ({ANIMAL_SPECIES_LABEL[speciesOptions[0] as keyof typeof ANIMAL_SPECIES_LABEL]})
                </span>
              )}
            </Label>
            <div
              id="co-qty"
              role="group"
              aria-labelledby="co-qty-label"
              tabIndex={-1}
              className={cn(
                'border-line mt-2 inline-flex items-center gap-1 rounded-lg border-2 bg-white p-1',
                fieldErrors.qty && 'animate-nudge border-danger',
              )}
            >
              <StepperButton
                label="Kurangi jumlah"
                disabled={draft.qty <= 1}
                onClick={() => set('qty', Math.max(1, draft.qty - 1))}
              >
                <Minus className="size-5" />
              </StepperButton>
              <span
                aria-live="polite"
                className="text-ink w-12 text-center text-lg font-bold tabular-nums"
              >
                {draft.qty}
              </span>
              <StepperButton
                label="Tambah jumlah"
                disabled={draft.qty >= MAX_QTY}
                onClick={() => set('qty', Math.min(MAX_QTY, draft.qty + 1))}
              >
                <Plus className="size-5" />
              </StepperButton>
            </div>
            {/* Anjuran jadi tombol: satu ketukan menyamakan jumlah, alih-alih
                pemesan menghitung sendiri berapa kali harus menekan "+". */}
            {recommended && (
              <p className="text-ink-muted mt-2 flex flex-wrap items-center gap-x-2 text-sm">
                <Info aria-hidden className="text-primary size-4 shrink-0" />
                Anjuran untuk{' '}
                {draft.aqiqah_for === 'laki_laki' ? 'anak laki-laki' : 'anak perempuan'}:{' '}
                {recommended} ekor
                {draft.qty !== recommended && (
                  <button
                    type="button"
                    onClick={() => set('qty', recommended)}
                    className="text-primary inline-flex min-h-11 items-center font-semibold underline underline-offset-2"
                  >
                    Pakai anjuran
                  </button>
                )}
              </p>
            )}
            {fieldErrors.qty && <FieldError message={fieldErrors.qty} />}
          </div>
        </div>
      </div>

      <div className="border-line border-t pt-8">
        <SectionLabel
          index={4}
          done
          title={
            <>
              Tambah nasi box? <span className="text-ink-muted font-normal">(opsional)</span>
            </>
          }
          hint="Dibagikan bersama aqiqah Anda. Lewati dengan memilih Tidak pakai."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ChoiceCard
            role="button"
            checked={!draft.nasi_box_service_id}
            layout="stacked"
            onSelect={() => {
              set('nasi_box_service_id', '');
              set('nasi_box_qty', 0);
            }}
            icon={Ban}
            title="Tidak pakai"
            description="Hanya paket aqiqah"
          />
          {nasiBoxes.map((box) => (
            <ChoiceCard
              key={box.id}
              role="button"
              checked={box.id === draft.nasi_box_service_id}
              layout="stacked"
              onSelect={() => {
                set('nasi_box_service_id', box.id);
                if (draft.nasi_box_qty < 1) set('nasi_box_qty', 10);
              }}
              icon={box.name.toLowerCase().includes('kebuli') ? Soup : Package}
              title={box.name}
              includes={box.items}
              price={
                <>
                  {formatCurrency(box.price)}
                  <span className="text-ink-muted ml-1 text-sm font-normal">/box</span>
                </>
              }
            />
          ))}
        </div>

        {draft.nasi_box_service_id && (
          <div className="border-primary/30 bg-primary-light/50 animate-in fade-in mt-4 rounded-lg border p-4 duration-300">
            <Label htmlFor="co-boxqty" className="text-ink text-sm font-semibold">
              Berapa box? <span className="text-danger">*</span>
            </Label>
            <NumberInput
              id="co-boxqty"
              min={1}
              max={5000}
              step="1"
              inputMode="numeric"
              value={draft.nasi_box_qty || ''}
              aria-invalid={Boolean(fieldErrors.nasi_box_qty)}
              aria-describedby={fieldErrors.nasi_box_qty ? 'nasi_box_qty-error' : undefined}
              onChange={(e) => set('nasi_box_qty', Number(e.target.value) || 0)}
              className="field mt-2 max-w-40 tabular-nums"
            />
            {selectedBox && draft.nasi_box_qty > 0 && (
              <p className="text-ink-muted mt-2 text-sm">
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
