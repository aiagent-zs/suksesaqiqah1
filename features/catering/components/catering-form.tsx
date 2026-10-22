'use client';

import { useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberInput } from '@/components/ui/number-input';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { siteConfig } from '@/lib/constants/site';
import { orderWhatsAppMessage } from '@/features/checkout/order-message';
import { AddressPicker } from '@/features/checkout/components/address-picker';
import { FieldError } from '@/features/checkout/components/steps/field-error';
import { StepperButton } from '@/features/checkout/components/steps/stepper-button';
import { ErrorSummary } from '@/features/checkout/components/steps/error-summary';
import { SuccessPanel } from '@/features/checkout/components/steps/success-panel';
import { SummaryRow } from '@/features/checkout/components/steps/summary-row';
import {
  SectionLabel,
  StepHeader,
  StepIntro,
} from '@/features/checkout/components/steps/step-header';
import { createCateringOrderAction } from '@/server/actions/catering';
import type { RegionOption } from '@/features/checkout/queries';
import type { CateringPackage } from '../queries';
import { BOOKING_MAX_DAYS, BOOKING_TIME_SLOTS, MAX_QTY_PER_LINE } from '../schema';
import {
  clearDraft,
  emptyDraft,
  getDraftServerSnapshot,
  getDraftSnapshot,
  saveDraft,
  subscribeDraft,
  type CateringDraft,
} from '../draft';

/** Urutan dan nama langkah sengaja sejajar dengan checkout aqiqah. */
const STEPS = [
  { id: 1, title: 'Pesanan', shortTitle: 'Pesanan' },
  { id: 2, title: 'Jadwal & Alamat', shortTitle: 'Jadwal' },
  { id: 3, title: 'Data Pemesan', shortTitle: 'Data' },
  { id: 4, title: 'Ringkasan', shortTitle: 'Ringkasan' },
];

/** Tombol +/- melompat 10 box: pesanan katering jarang di bawah puluhan. */
const QTY_STEP = 10;

/** Jeda sebelum tombol kirim menerima klik; alasannya sama dengan checkout aqiqah. */
const SUBMIT_ARM_DELAY_MS = 700;

const TYPE_LABEL: Record<string, string> = {
  katering_ayam: 'Katering Ayam',
  katering_daging: 'Katering Daging',
  katering_kebuli: 'Katering Kebuli',
};

/**
 * Medan → langkah dan id elemennya. Dipakai saat validasi atau server menolak
 * sesuatu yang tidak terlihat di langkah yang sedang terbuka.
 */
const FIELD_STEP: Record<string, number> = {
  items: 1,
  requested_date: 2,
  requested_time: 2,
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

const FIELD_ANCHOR: Record<string, string> = {
  items: 'kt-packages',
  requested_date: 'kt-date',
  requested_time: 'kt-time',
  delivery_province_code: 'co-prov',
  delivery_city_code: 'co-city',
  delivery_district_code: 'co-dist',
  delivery_village_code: 'co-vill',
  delivery_postal_code: 'co-postal',
  delivery_detail: 'co-detail',
  name: 'kt-name',
  phone: 'kt-phone',
  email: 'kt-email',
};

const FIELD_LABEL: Record<string, string> = {
  items: 'Paket',
  requested_date: 'Tanggal pengiriman',
  requested_time: 'Jam pengiriman',
  delivery_province_code: 'Provinsi tujuan',
  delivery_city_code: 'Kabupaten/kota tujuan',
  delivery_district_code: 'Kecamatan tujuan',
  delivery_village_code: 'Kelurahan/desa tujuan',
  delivery_postal_code: 'Kode pos',
  delivery_detail: 'Alamat lengkap',
  name: 'Nama pemesan',
  phone: 'Nomor WhatsApp',
  email: 'Email',
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
  const submitArmedRef = useRef(false);
  const armTimerRef = useRef<number | undefined>(undefined);

  function set<K extends keyof CateringDraft>(key: K, value: CateringDraft[K]) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    saveDraft(next, step);
  }

  /** Jumlah box per paket. Tiap paket paling banyak satu baris di `items`. */
  const qtyOf = (id: string) => draft.items.find((i) => i.service_id === id)?.qty ?? '';

  function setQty(id: string, qty: string) {
    const rest = draft.items.filter((i) => i.service_id !== id && i.service_id);
    // Paket berjumlah kosong tetap disimpan sebagai baris supaya paket yang
    // datang dari `?paket=` tetap terlihat terpilih sebelum jumlahnya diisi.
    set('items', [...rest, { service_id: id, qty }]);
  }

  const lines = useMemo(
    () =>
      packages
        .map((pkg) => {
          const qty = Number(draft.items.find((i) => i.service_id === pkg.id)?.qty) || 0;
          return { pkg, qty, subtotal: pkg.price * qty };
        })
        .filter((l) => l.qty > 0),
    [draft.items, packages],
  );

  const total = lines.reduce((sum, l) => sum + l.subtotal, 0);
  const totalBoxes = lines.reduce((sum, l) => sum + l.qty, 0);

  const groups = useMemo(
    () =>
      Array.from(new Set(packages.map((p) => p.type))).map((type) => ({
        type,
        label: TYPE_LABEL[type] ?? 'Katering',
        items: packages.filter((p) => p.type === type),
      })),
    [packages],
  );

  function validateStep(n: number): boolean {
    const errors: Record<string, string> = {};
    if (n === 1) {
      if (lines.length === 0) errors.items = 'Isi jumlah box untuk minimal satu paket';
      else if (lines.some((l) => l.qty > MAX_QTY_PER_LINE)) {
        errors.items = `Untuk pesanan di atas ${MAX_QTY_PER_LINE} box per paket, hubungi admin`;
      }
    } else if (n === 2) {
      if (!draft.requested_date) errors.requested_date = 'Pilih tanggal pengiriman';
      else if (draft.requested_date < minDate) {
        errors.requested_date = `Paling cepat ${formatDate(minDate)}`;
      } else if (draft.requested_date > maxDate) {
        errors.requested_date = `Maksimal ${BOOKING_MAX_DAYS} hari ke depan`;
      }
      if (!draft.requested_time) errors.requested_time = 'Pilih jam pengiriman';

      const a = draft.delivery;
      if (!a.province_code) errors.delivery_province_code = 'Pilih provinsi tujuan';
      if (!a.city_code) errors.delivery_city_code = 'Pilih kabupaten/kota tujuan';
      if (!a.district_code) errors.delivery_district_code = 'Pilih kecamatan tujuan';
      if (!a.village_code) errors.delivery_village_code = 'Pilih kelurahan/desa tujuan';
      if (!/^[0-9]{5}$/.test(a.postal_code)) {
        errors.delivery_postal_code = a.postal_code
          ? 'Kode pos harus 5 digit angka'
          : 'Kode pos wajib diisi';
      }
      if (!a.detail.trim()) errors.delivery_detail = 'Isi nama jalan dan nomor bangunan';
    } else if (n === 3) {
      if (draft.name.trim().length < 2) errors.name = 'Nama pemesan wajib diisi';
      const phone = draft.phone.trim();
      if (!phone) errors.phone = 'Nomor WhatsApp wajib diisi';
      else if (phone.length < 8) errors.phone = 'Nomor telepon terlalu pendek';
      else if (!/^[0-9+()\- ]+$/.test(phone)) errors.phone = 'Hanya boleh angka dan tanda + ( ) -';
      const email = draft.email.trim();
      if (!email) errors.email = 'Email wajib diisi';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Format email tidak valid';
    }

    setFieldErrors(errors);
    const first = Object.keys(errors)[0];
    if (first) jumpToField(first);
    return !first;
  }

  function jumpToField(field: string) {
    const root = field.split('.')[0];
    const target = FIELD_STEP[root];
    if (target && target !== step) setStep(target);
    const anchor = FIELD_ANCHOR[root];
    if (!anchor) return;
    window.setTimeout(() => {
      const el = document.getElementById(anchor);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus({ preventScroll: true });
    }, 80);
  }

  function goToStep(next: number) {
    setError(null);
    setFieldErrors({});
    window.clearTimeout(armTimerRef.current);
    submitArmedRef.current = false;
    if (next === STEPS.length) {
      armTimerRef.current = window.setTimeout(() => {
        submitArmedRef.current = true;
      }, SUBMIT_ARM_DELAY_MS);
    }
    setStep(next);
    saveDraft(draft, next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function submit() {
    if (!submitArmedRef.current) return;
    for (const n of [1, 2, 3]) if (!validateStep(n)) return;

    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await createCateringOrderAction({
        items: lines.map((l) => ({ service_id: l.pkg.id, qty: l.qty })),
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
      const first = Object.keys(fields)[0];
      if (first) jumpToField(first);
    });
  }

  if (done) {
    return (
      <SuccessPanel
        orderNumber={done.orderNumber}
        total={done.total}
        paymentUrl={done.paymentUrl}
        waHref={siteConfig.whatsapp.href(
          orderWhatsAppMessage({
            orderNumber: done.orderNumber,
            totalAmount: done.total,
            packageName: lines.map((l) => `${l.pkg.name} (${l.qty} box)`).join(', '),
            requestedDate: draft.requested_date,
            requestedTime: draft.requested_time,
            customerName: draft.name,
          }),
        )}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <StepHeader
        steps={STEPS}
        current={step}
        total={total}
        onJump={(id) => {
          if (id < step || validateStep(step)) goToStep(id);
        }}
      />

      <ErrorSummary errors={fieldErrors} labels={FIELD_LABEL} onJump={jumpToField} />

      {/* Ditawarkan, bukan dipulihkan diam-diam: isian lama yang muncul tanpa
          diminta terbaca seperti isian sendiri. */}
      {stored && !recovered && (
        <div className="animate-in fade-in mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 duration-300">
          <div className="flex items-start gap-2.5">
            <RotateCcw className="mt-0.5 size-4 shrink-0 text-amber-700" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-900">Lanjutkan isian sebelumnya?</p>
              <p className="mt-1 text-xs leading-5 text-amber-800">
                Ada pesanan katering yang belum selesai dari tab ini.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDraft(stored.draft);
                    goToStep(Math.min(stored.step, STEPS.length));
                    setRecovered(true);
                  }}
                  className="inline-flex min-h-11 items-center rounded-lg bg-amber-700 px-4 text-xs font-semibold text-white transition-colors hover:bg-amber-800"
                >
                  Lanjutkan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearDraft();
                    setRecovered(true);
                  }}
                  className="inline-flex min-h-11 items-center rounded-lg border border-amber-300 bg-white px-4 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100"
                >
                  Mulai baru
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-2 pt-8 sm:p-4 sm:pt-10">
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 duration-[420ms] ease-out">
            <StepIntro title="Paket apa, dan berapa box?">
              Isi jumlah box di paket yang Anda mau, boleh lebih dari satu paket. Tombol + dan −
              menambah 10 box sekaligus, angkanya juga bisa diketik langsung.
            </StepIntro>

            <div id="kt-packages" tabIndex={-1} className="space-y-8 outline-none">
              {groups.map((group) => (
                <div key={group.type}>
                  <SectionLabel title={group.label} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    {group.items.map((pkg) => {
                      const raw = qtyOf(pkg.id);
                      const qty = Number(raw) || 0;
                      const active = qty > 0;
                      return (
                        <div
                          key={pkg.id}
                          className={cn(
                            'relative flex flex-col rounded-lg border p-4 transition-colors',
                            active
                              ? 'border-primary bg-primary/5 ring-primary ring-1'
                              : 'border-neutral-200 bg-white',
                          )}
                        >
                          {active && (
                            <span className="bg-primary absolute top-3 right-3 flex size-5 items-center justify-center rounded-full text-white">
                              <Check className="size-3 stroke-[3]" />
                            </span>
                          )}
                          <p className="pr-7 font-bold text-neutral-900">{pkg.name}</p>
                          <p className="text-primary mt-1 text-base font-extrabold tabular-nums">
                            {formatCurrency(pkg.price)}
                            <span className="ml-1 text-xs font-medium text-neutral-500">/ box</span>
                          </p>
                          {pkg.items.length > 0 && (
                            <p className="mt-2 text-sm leading-6 text-neutral-600">
                              {pkg.items.join(' · ')}
                            </p>
                          )}

                          <div className="mt-4 flex items-center justify-between gap-3 border-t border-neutral-200 pt-3">
                            <Label
                              htmlFor={`kt-qty-${pkg.id}`}
                              className="text-sm text-neutral-700"
                            >
                              Jumlah box
                            </Label>
                            <div className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-0.5">
                              <StepperButton
                                label={`Kurangi ${QTY_STEP} box ${pkg.name}`}
                                disabled={qty <= 0}
                                onClick={() =>
                                  setQty(pkg.id, String(Math.max(0, qty - QTY_STEP) || ''))
                                }
                              >
                                <Minus className="size-4" />
                              </StepperButton>
                              <NumberInput
                                id={`kt-qty-${pkg.id}`}
                                min={0}
                                max={MAX_QTY_PER_LINE}
                                inputMode="numeric"
                                value={raw}
                                placeholder="0"
                                onChange={(e) => setQty(pkg.id, e.target.value)}
                                className="h-11 w-16 border-0 text-center text-base font-bold tabular-nums shadow-none"
                              />
                              <StepperButton
                                label={`Tambah ${QTY_STEP} box ${pkg.name}`}
                                disabled={qty >= MAX_QTY_PER_LINE}
                                onClick={() =>
                                  setQty(pkg.id, String(Math.min(MAX_QTY_PER_LINE, qty + QTY_STEP)))
                                }
                              >
                                <Plus className="size-4" />
                              </StepperButton>
                            </div>
                          </div>
                          {active && (
                            <p className="mt-2 text-right text-xs text-neutral-600 tabular-nums">
                              Subtotal {formatCurrency(pkg.price * qty)}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {fieldErrors.items && <FieldError message={fieldErrors.items} />}
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 duration-[420ms] ease-out">
            <StepIntro title="Kapan dan ke mana kami antar?">
              Jadwal ini masih permintaan. Tim kami mengonfirmasinya lewat WhatsApp.
            </StepIntro>

            <div>
              <SectionLabel
                title="Waktu pengiriman"
                hint={`Paling cepat ${formatDate(minDate)}, paling lambat ${BOOKING_MAX_DAYS} hari ke depan.`}
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="kt-date" className="text-sm font-semibold text-neutral-800">
                    Tanggal
                  </Label>
                  <Input
                    id="kt-date"
                    type="date"
                    min={minDate}
                    max={maxDate}
                    value={draft.requested_date}
                    onChange={(e) => set('requested_date', e.target.value)}
                    aria-invalid={Boolean(fieldErrors.requested_date)}
                    className="mt-2 h-12 rounded-lg border-neutral-200 text-sm shadow-sm"
                  />
                  {fieldErrors.requested_date && (
                    <FieldError message={fieldErrors.requested_date} />
                  )}
                </div>
                <div>
                  <Label className="text-sm font-semibold text-neutral-800">Jam</Label>
                  <div
                    id="kt-time"
                    tabIndex={-1}
                    className="mt-2 grid grid-cols-3 gap-1.5 outline-none sm:flex sm:flex-wrap sm:gap-2"
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
                            'flex min-h-11 items-center justify-center rounded-lg border px-1 text-xs font-semibold tabular-nums transition-colors sm:px-3.5',
                            active
                              ? 'border-primary bg-primary text-white'
                              : 'hover:border-primary/40 border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50',
                          )}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                  {fieldErrors.requested_time && (
                    <FieldError message={fieldErrors.requested_time} />
                  )}
                </div>
              </div>
            </div>

            <AddressPicker
              provinces={provinces}
              value={draft.delivery}
              onChange={(delivery) => set('delivery', delivery)}
              errors={fieldErrors}
            />

            <div>
              <Label htmlFor="kt-inst" className="text-sm font-semibold text-neutral-800">
                Nama acara atau instansi{' '}
                <span className="font-normal text-neutral-500">(opsional)</span>
              </Label>
              <Input
                id="kt-inst"
                value={draft.recipient_institution}
                onChange={(e) => set('recipient_institution', e.target.value)}
                placeholder="Mis. Pengajian RT 05, PT Sejahtera"
                className="mt-2 h-12 rounded-lg border-neutral-200 text-sm shadow-sm"
              />
              <p className="mt-1.5 text-xs text-neutral-500">
                Membantu kurir menemukan lokasi acara.
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 duration-[420ms] ease-out">
            <StepIntro title="Siapa yang bisa kami hubungi?">
              Kami mengirim konfirmasi dan rincian pembayaran ke nomor WhatsApp ini.
            </StepIntro>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="kt-name" className="text-sm font-semibold text-neutral-800">
                  Nama pemesan
                </Label>
                <Input
                  id="kt-name"
                  autoComplete="name"
                  value={draft.name}
                  onChange={(e) => set('name', e.target.value)}
                  aria-invalid={Boolean(fieldErrors.name)}
                  placeholder="Nama Anda"
                  className="mt-2 h-12 rounded-lg border-neutral-200 text-sm shadow-sm"
                />
                {fieldErrors.name && <FieldError message={fieldErrors.name} />}
              </div>

              <div>
                <Label htmlFor="kt-phone" className="text-sm font-semibold text-neutral-800">
                  Nomor WhatsApp
                </Label>
                <Input
                  id="kt-phone"
                  inputMode="tel"
                  autoComplete="tel"
                  value={draft.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="0812xxxxxxxx"
                  aria-invalid={Boolean(fieldErrors.phone)}
                  className="mt-2 h-12 rounded-lg border-neutral-200 text-sm shadow-sm"
                />
                {fieldErrors.phone && <FieldError message={fieldErrors.phone} />}
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="kt-email" className="text-sm font-semibold text-neutral-800">
                  Email
                </Label>
                <Input
                  id="kt-email"
                  type="email"
                  autoComplete="email"
                  value={draft.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="email@domain.com"
                  aria-invalid={Boolean(fieldErrors.email)}
                  className="mt-2 h-12 rounded-lg border-neutral-200 text-sm shadow-sm"
                />
                <p className="mt-1.5 text-xs text-neutral-500">Untuk salinan pesanan.</p>
                {fieldErrors.email && <FieldError message={fieldErrors.email} />}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 duration-[420ms] ease-out">
            <StepIntro title="Periksa sekali lagi sebelum dikirim">
              Ada yang keliru? Ketuk nama langkahnya di atas untuk mengubah.
            </StepIntro>

            <div className="overflow-hidden rounded-lg border border-neutral-200">
              <div className="border-b border-neutral-100 bg-neutral-50/80 px-5 py-3">
                <p className="text-sm font-bold text-neutral-900">Rincian Pesanan</p>
              </div>
              <dl className="divide-y divide-neutral-100">
                {lines.map(({ pkg, qty, subtotal }) => (
                  <SummaryRow key={pkg.id} label={pkg.name}>
                    {qty.toLocaleString('id-ID')} box
                    <span className="block text-xs text-neutral-500 tabular-nums">
                      {formatCurrency(subtotal)}
                    </span>
                  </SummaryRow>
                ))}
                <SummaryRow label="Dikirim">
                  {draft.requested_date ? formatDate(draft.requested_date) : '-'}
                  {draft.requested_time && ` · ${draft.requested_time} WIB`}
                  <span className="mt-1 block text-xs leading-5 text-neutral-500">
                    {draft.delivery.detail}
                    <br />
                    Kel. {draft.delivery.village_name}, Kec. {draft.delivery.district_name}
                    <br />
                    {draft.delivery.city_name}, {draft.delivery.province_name}{' '}
                    {draft.delivery.postal_code}
                  </span>
                </SummaryRow>
                <SummaryRow label="Pemesan">
                  {draft.name}
                  <span className="block text-xs text-neutral-500">
                    {draft.phone} · {draft.email}
                  </span>
                </SummaryRow>
              </dl>
              <div className="bg-primary/5 flex items-center justify-between px-5 py-3.5">
                <span className="text-sm font-bold text-neutral-900">
                  Total Tagihan ({totalBoxes.toLocaleString('id-ID')} box)
                </span>
                <span className="text-primary text-xl font-extrabold tabular-nums">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="kt-referral" className="text-sm font-semibold text-neutral-800">
                  Kode referral <span className="font-normal text-neutral-500">(opsional)</span>
                </Label>
                <Input
                  id="kt-referral"
                  value={draft.referral_code}
                  onChange={(e) => set('referral_code', e.target.value)}
                  placeholder="Mis. SA-BUDI"
                  className="mt-2 h-12 rounded-lg border-neutral-200 text-sm uppercase shadow-sm"
                />
                {fieldErrors.referral_code && <FieldError message={fieldErrors.referral_code} />}
              </div>
              <div>
                <Label htmlFor="kt-notes" className="text-sm font-semibold text-neutral-800">
                  Catatan <span className="font-normal text-neutral-500">(opsional)</span>
                </Label>
                <Textarea
                  id="kt-notes"
                  rows={3}
                  value={draft.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  placeholder="Mis. 10 box tanpa sambal"
                  className="mt-2 rounded-lg border-neutral-200 text-sm shadow-sm"
                />
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {error}
              </p>
            )}

            <p className="text-center text-xs leading-5 text-neutral-500">
              Tidak ada pembayaran di halaman ini. Tim kami menghubungi Anda lebih dulu untuk
              konfirmasi.
            </p>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-2 border-t border-neutral-100 pt-6">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => goToStep(step - 1)}
              disabled={pending}
              className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-neutral-300 bg-white px-3.5 text-xs font-semibold text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 sm:gap-1.5 sm:px-5"
            >
              <ChevronLeft className="size-4" /> Kembali
            </button>
          ) : (
            <div />
          )}

          {/* `key` berbeda wajib: tanpanya React memakai ulang elemen tombol
              Lanjut sebagai tombol kirim, lengkap dengan fokusnya. */}
          {step < STEPS.length ? (
            <button
              key="nav-next"
              type="button"
              onClick={() => validateStep(step) && goToStep(step + 1)}
              className="bg-primary hover:bg-primary-dark inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-sm font-semibold text-white shadow-sm transition-colors sm:px-6"
            >
              Lanjut ke {STEPS[step].title} <ChevronRight className="size-4 shrink-0" />
            </button>
          ) : (
            <button
              key="nav-submit"
              type="button"
              onClick={submit}
              disabled={pending}
              className="bg-primary hover:bg-primary-dark inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-6 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:px-7"
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              {pending ? 'Mengirim pesanan…' : 'Konfirmasi & Kirim Pesanan'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
