'use client';

import { useMemo, useState, useSyncExternalStore, useTransition } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberInput } from '@/components/ui/number-input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency, formatDate } from '@/lib/format';
import { AddressPicker } from '@/features/checkout/components/address-picker';
import { FieldError } from '@/features/checkout/components/steps/field-error';
import { createCateringOrderAction } from '@/server/actions/catering';
import type { RegionOption } from '@/features/checkout/queries';
import type { CateringPackage } from '../queries';
import { BOOKING_TIME_SLOTS, MAX_ITEM_LINES } from '../schema';
import {
  clearDraft,
  emptyDraft,
  getDraftServerSnapshot,
  getDraftSnapshot,
  saveDraft,
  subscribeDraft,
  type CateringDraft,
  type DraftItem,
} from '../draft';

const STEPS = ['Pesanan', 'Pengiriman', 'Konfirmasi'] as const;

/**
 * Medan → langkah tempatnya berada.
 *
 * Dipakai ketika server menolak sesuatu yang tidak terlihat di langkah yang
 * sedang terbuka: tanpa ini pemesan melihat "gagal" tanpa satu pun medan merah,
 * sebab yang ditolak ada di langkah lain.
 */
const FIELD_STEP: Record<string, number> = {
  items: 1,
  requested_date: 1,
  requested_time: 1,
  delivery_province_code: 2,
  delivery_city_code: 2,
  delivery_district_code: 2,
  delivery_village_code: 2,
  delivery_postal_code: 2,
  delivery_detail: 2,
  name: 3,
  phone: 3,
  email: 3,
};

export function CateringForm({
  packages,
  provinces,
  minDate,
  maxDate,
  initialServiceId,
}: {
  packages: CateringPackage[];
  provinces: RegionOption[];
  minDate: string;
  maxDate: string;
  /** Dari `?paket=` di halaman depan; jatuh ke paket pertama bila tak dikenal. */
  initialServiceId?: string;
}) {
  const stored = useSyncExternalStore(subscribeDraft, getDraftSnapshot, getDraftServerSnapshot);

  const [draft, setDraft] = useState<CateringDraft>(() =>
    emptyDraft(initialServiceId ?? packages[0]?.id ?? ''),
  );
  const [step, setStep] = useState(1);
  const [recovered, setRecovered] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    orderNumber: string;
    total: number;
    paymentUrl: string | null;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof CateringDraft>(key: K, value: CateringDraft[K]) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    saveDraft(next, step);
  }

  function setItem(index: number, patch: Partial<DraftItem>) {
    const items = draft.items.map((it, i) => (i === index ? { ...it, ...patch } : it));
    set('items', items);
  }

  function addItem() {
    if (draft.items.length >= MAX_ITEM_LINES) return;
    // Paket yang belum dipilih di baris mana pun, supaya baris baru tidak lahir
    // sebagai duplikat yang langsung ditolak.
    const taken = new Set(draft.items.map((i) => i.service_id));
    const next = packages.find((p) => !taken.has(p.id));
    set('items', [...draft.items, { service_id: next?.id ?? '', qty: '' }]);
  }

  function removeItem(index: number) {
    // Baris terakhir tidak dihapus melainkan dikosongkan: daftar tanpa baris
    // sama sekali tidak menunjukkan bentuk isiannya.
    if (draft.items.length === 1) {
      set('items', [{ service_id: packages[0]?.id ?? '', qty: '' }]);
      return;
    }
    set(
      'items',
      draft.items.filter((_, i) => i !== index),
    );
  }

  const lines = useMemo(
    () =>
      draft.items.map((item) => {
        const pkg = packages.find((p) => p.id === item.service_id);
        const qty = Number(item.qty) || 0;
        return { item, pkg, qty, subtotal: (pkg?.price ?? 0) * qty };
      }),
    [draft.items, packages],
  );

  const total = lines.reduce((sum, l) => sum + l.subtotal, 0);
  const totalBoxes = lines.reduce((sum, l) => sum + l.qty, 0);

  function goToStep(next: number) {
    setStep(next);
    saveDraft(draft, next);
    setFieldErrors({});
  }

  function submit() {
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await createCateringOrderAction({
        items: draft.items
          // Baris yang belum diisi diabaikan, bukan ditolak: menambah baris lalu
          // berubah pikiran adalah cara orang mengisi form, bukan kekeliruan.
          .filter((i) => i.service_id && Number(i.qty) > 0)
          .map((i) => ({ service_id: i.service_id, qty: Number(i.qty) })),
        requested_date: draft.requested_date,
        requested_time: draft.requested_time,
        name: draft.name,
        phone: draft.phone,
        email: draft.email,
        delivery_province_code: draft.delivery.province_code,
        delivery_city_code: draft.delivery.city_code,
        delivery_district_code: draft.delivery.district_code,
        delivery_village_code: draft.delivery.village_code,
        delivery_postal_code: draft.delivery.postal_code,
        delivery_detail: draft.delivery.detail,
        recipient_institution: draft.recipient_institution,
        referral_code: draft.referral_code,
        notes: draft.notes,
      });

      if (result.ok) {
        clearDraft();
        setDone({
          orderNumber: result.data.order_number,
          total: Number(result.data.total_amount),
          paymentUrl: result.data.payment_url ?? null,
        });
        return;
      }

      const fields = result.error.fields ?? {};
      setFieldErrors(fields);
      setError(result.error.message);

      // Lompat ke langkah tempat medan pertama yang ditolak berada — tanpa ini
      // pesan galat menunjuk sesuatu yang tidak terlihat di layar.
      const firstKey = Object.keys(fields)[0];
      if (firstKey) {
        const root = firstKey.split('.')[0];
        const target = FIELD_STEP[root];
        if (target && target !== step) setStep(target);
      }
    });
  }

  if (done) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 mt-8 duration-500">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
          <CheckCircle2 className="size-8" />
          <h2 className="mt-4 text-xl font-bold">Pesanan katering diterima</h2>
          <p className="mt-2 text-sm leading-6">
            Nomor pesanan Anda <strong className="tabular-nums">{done.orderNumber}</strong>.{' '}
            {done.paymentUrl
              ? 'Selesaikan pembayaran di halaman Durianpay, metode bayarnya dipilih di sana.'
              : 'Tim kami menghubungi Anda lewat WhatsApp untuk konfirmasi dan pembayaran.'}
          </p>
          <p className="mt-3 text-sm">
            Total tagihan <strong>{formatCurrency(done.total)}</strong>
          </p>
          {done.paymentUrl && (
            <a
              href={done.paymentUrl}
              className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 sm:w-auto"
            >
              Bayar Sekarang
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      {/* Tawaran memulihkan isian yang tertinggal. Ditawarkan, bukan dipulihkan
          diam-diam: isian lama yang muncul tanpa diminta membingungkan justru
          karena terbaca seperti isian sendiri. */}
      {stored && !recovered && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <span className="flex-1">Ada isian yang belum selesai dari sesi ini.</span>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setDraft(stored.draft);
              setStep(Math.min(stored.step, STEPS.length));
              setRecovered(true);
            }}
          >
            Lanjutkan
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              clearDraft();
              setRecovered(true);
            }}
          >
            Mulai baru
          </Button>
        </div>
      )}

      <ol className="flex items-center gap-2" aria-label="Langkah pemesanan">
        {STEPS.map((label, i) => {
          const n = i + 1;
          return (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                aria-current={n === step ? 'step' : undefined}
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  n === step
                    ? 'bg-primary text-white'
                    : n < step
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-neutral-100 text-neutral-500'
                }`}
              >
                {n}
              </span>
              <span
                className={`hidden text-xs font-medium sm:block ${
                  n === step ? 'text-neutral-900' : 'text-neutral-500'
                }`}
              >
                {label}
              </span>
              {n < STEPS.length && <span className="h-px flex-1 bg-neutral-200" />}
            </li>
          );
        })}
      </ol>

      <div className="mt-8">
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-[420ms] ease-out">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Paket & jumlah</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Boleh memesan lebih dari satu jenis paket dalam satu pesanan.
              </p>
            </div>

            <div className="space-y-3">
              {lines.map(({ item, pkg, subtotal }, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-neutral-200 p-4 sm:flex sm:items-end sm:gap-4"
                >
                  <div className="flex-1">
                    <Label htmlFor={`kt-pkg-${i}`}>Paket</Label>
                    <Select
                      id={`kt-pkg-${i}`}
                      value={item.service_id}
                      onChange={(e) => setItem(i, { service_id: e.target.value })}
                      className="mt-2"
                    >
                      <option value="">Pilih paket…</option>
                      {Array.from(new Set(packages.map((p) => p.type))).map((typeKey) => {
                        const typeLabels: Record<string, string> = {
                          katering_ayam: 'Katering Ayam',
                          katering_daging: 'Katering Daging',
                          katering_kebuli: 'Katering Kebuli',
                        };
                        const inGroup = packages.filter((p) => p.type === typeKey);
                        return (
                          <optgroup key={typeKey} label={typeLabels[typeKey] ?? 'Katering'}>
                            {inGroup.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} — {formatCurrency(p.price)}/box
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </Select>
                    {pkg && pkg.items.length > 0 && (
                      <p className="mt-1.5 text-xs text-neutral-500">{pkg.items.join(' · ')}</p>
                    )}
                    {fieldErrors[`items.${i}.service_id`] && (
                      <FieldError message={fieldErrors[`items.${i}.service_id`]} />
                    )}
                  </div>

                  <div className="mt-3 sm:mt-0 sm:w-32">
                    <Label htmlFor={`kt-qty-${i}`}>Jumlah box</Label>
                    <NumberInput
                      id={`kt-qty-${i}`}
                      min={1}
                      inputMode="numeric"
                      value={item.qty}
                      onChange={(e) => setItem(i, { qty: e.target.value })}
                      placeholder="50"
                      className="mt-2"
                    />
                    {fieldErrors[`items.${i}.qty`] && (
                      <FieldError message={fieldErrors[`items.${i}.qty`]} />
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 sm:mt-0 sm:w-40 sm:justify-end">
                    <span className="text-sm font-semibold text-neutral-900 tabular-nums">
                      {subtotal > 0 ? formatCurrency(subtotal) : '—'}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`Hapus baris ${i + 1}`}
                      onClick={() => removeItem(i)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {fieldErrors.items && <FieldError message={fieldErrors.items} />}

            {draft.items.length < MAX_ITEM_LINES && (
              <Button type="button" variant="ghost" size="sm" onClick={addItem}>
                <Plus className="size-4" /> Tambah paket
              </Button>
            )}

            <div className="grid gap-4 border-t border-neutral-200 pt-6 sm:grid-cols-2">
              <div>
                <Label htmlFor="kt-date">Tanggal pengiriman</Label>
                <Input
                  id="kt-date"
                  type="date"
                  min={minDate}
                  max={maxDate}
                  value={draft.requested_date}
                  onChange={(e) => set('requested_date', e.target.value)}
                  aria-invalid={Boolean(fieldErrors.requested_date)}
                  className="mt-2"
                />
                {fieldErrors.requested_date && <FieldError message={fieldErrors.requested_date} />}
              </div>

              <div>
                <Label htmlFor="kt-time">Jam pengiriman</Label>
                <Select
                  id="kt-time"
                  value={draft.requested_time}
                  onChange={(e) => set('requested_time', e.target.value)}
                  className="mt-2"
                >
                  <option value="">Pilih jam…</option>
                  {BOOKING_TIME_SLOTS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
                {fieldErrors.requested_time && <FieldError message={fieldErrors.requested_time} />}
              </div>
            </div>

            {total > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-5 py-4">
                <span className="text-sm text-neutral-600">
                  {totalBoxes.toLocaleString('id-ID')} box
                </span>
                <span className="text-lg font-bold text-neutral-900 tabular-nums">
                  {formatCurrency(total)}
                </span>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-[420ms] ease-out">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Alamat pengiriman</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Katering selalu kami antar ke alamat tujuan.
              </p>
            </div>

            <AddressPicker
              provinces={provinces}
              value={draft.delivery}
              onChange={(delivery) => set('delivery', delivery)}
              errors={fieldErrors}
            />

            <div>
              <Label htmlFor="kt-inst">Nama acara / instansi (opsional)</Label>
              <Input
                id="kt-inst"
                value={draft.recipient_institution}
                onChange={(e) => set('recipient_institution', e.target.value)}
                placeholder="Pengajian RT 05 / PT Sejahtera"
                className="mt-2"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-[420ms] ease-out">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Data pemesan</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Kami menghubungi nomor ini untuk konfirmasi dan pembayaran.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="kt-name">Nama pemesan</Label>
                <Input
                  id="kt-name"
                  value={draft.name}
                  onChange={(e) => set('name', e.target.value)}
                  aria-invalid={Boolean(fieldErrors.name)}
                  className="mt-2"
                />
                {fieldErrors.name && <FieldError message={fieldErrors.name} />}
              </div>

              <div>
                <Label htmlFor="kt-phone">Nomor WhatsApp</Label>
                <Input
                  id="kt-phone"
                  inputMode="tel"
                  value={draft.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="08123456789"
                  aria-invalid={Boolean(fieldErrors.phone)}
                  className="mt-2"
                />
                {fieldErrors.phone && <FieldError message={fieldErrors.phone} />}
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="kt-email">Email</Label>
                <Input
                  id="kt-email"
                  type="email"
                  value={draft.email}
                  onChange={(e) => set('email', e.target.value)}
                  aria-invalid={Boolean(fieldErrors.email)}
                  className="mt-2"
                />
                {fieldErrors.email && <FieldError message={fieldErrors.email} />}
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="kt-notes">Catatan (opsional)</Label>
                <Textarea
                  id="kt-notes"
                  rows={3}
                  value={draft.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  placeholder="Mohon tanpa sambal untuk 10 box."
                  className="mt-2"
                />
              </div>
            </div>

            {/* Ringkasan sebelum kirim. */}
            <div className="overflow-hidden rounded-lg border border-neutral-200">
              <div className="border-b border-neutral-100 bg-neutral-50/80 px-5 py-3">
                <p className="text-sm font-bold text-neutral-900">Rincian Pesanan</p>
              </div>
              <dl className="divide-y divide-neutral-100">
                {lines
                  .filter((l) => l.pkg && l.qty > 0)
                  .map(({ pkg, qty, subtotal }, i) => (
                    <div key={i} className="flex justify-between gap-4 px-5 py-3 text-sm">
                      <dt className="text-neutral-600">
                        {pkg?.name} × {qty.toLocaleString('id-ID')} box
                      </dt>
                      <dd className="font-medium text-neutral-900 tabular-nums">
                        {formatCurrency(subtotal)}
                      </dd>
                    </div>
                  ))}
                <div className="flex justify-between gap-4 px-5 py-3 text-sm">
                  <dt className="text-neutral-600">Dikirim</dt>
                  <dd className="text-right font-medium text-neutral-900">
                    {draft.requested_date ? formatDate(draft.requested_date) : '-'}
                    {draft.requested_time ? `, ${draft.requested_time}` : ''}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 bg-neutral-50/60 px-5 py-4">
                  <dt className="font-bold text-neutral-900">Total</dt>
                  <dd className="text-lg font-bold text-neutral-900 tabular-nums">
                    {formatCurrency(total)}
                  </dd>
                </div>
              </dl>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3 border-t border-neutral-200 pt-6">
        <Button
          type="button"
          variant="ghost"
          onClick={() => goToStep(step - 1)}
          disabled={step === 1 || pending}
        >
          <ArrowLeft className="size-4" /> Kembali
        </Button>

        {step < STEPS.length ? (
          <Button type="button" onClick={() => goToStep(step + 1)}>
            Lanjut <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? 'Mengirim…' : 'Kirim pesanan'}
          </Button>
        )}
      </div>
    </div>
  );
}
