'use client';

import { useMemo, useState, useSyncExternalStore, useTransition } from 'react';
import {
  AlertCircle,
  Beef,
  Building2,
  CalendarDays,
  Check,
  Clock,
  Drumstick,
  Mail,
  Minus,
  Package,
  Phone,
  Plus,
  RotateCcw,
  ShieldCheck,
  Soup,
  Tag,
  User,
  type LucideIcon,
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
import { OrderAside } from '@/features/checkout/components/steps/order-aside';
import { CheckoutSection, SubmitBar } from '@/features/checkout/components/steps/checkout-section';
import { SectionLabel } from '@/features/checkout/components/steps/step-header';
import { createCateringOrderAction } from '@/server/actions/catering';
import type { RegionOption } from '@/features/checkout/queries';
import type { CateringPackage } from '../queries';
import { issueOf } from '@/features/checkout/schema';
import {
  BOOKING_MAX_DAYS,
  BOOKING_TIME_SLOTS,
  MAX_QTY_PER_LINE,
  MAX_TOTAL_BOXES,
  cateringItemSchema,
} from '../schema';
import {
  clearDraft,
  emptyDraft,
  getDraftServerSnapshot,
  getDraftSnapshot,
  saveDraft,
  subscribeDraft,
  type CateringDraft,
} from '../draft';

/** Tombol +/- melompat 10 box: pesanan katering jarang di bawah puluhan. */
const QTY_STEP = 10;

const TYPE_LABEL: Record<string, string> = {
  katering_ayam: 'Katering Ayam',
  katering_daging: 'Katering Daging',
  katering_kebuli: 'Katering Kebuli',
};

/** Ikon tab & kartu per jenis: membedakan jenis sekilas, tanpa membaca label. */
const TYPE_ICON: Record<string, LucideIcon> = {
  katering_ayam: Drumstick,
  katering_daging: Beef,
  katering_kebuli: Soup,
};

/**
 * Medan → bagian dan id elemennya. Bagian menentukan urutan galat yang
 * difokuskan lebih dulu, sesuai urutan di layar.
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
  brandName = 'Sukses Aqiqah',
}: {
  /** Nama merek kanal masuk, untuk sapaan pesan WhatsApp ke admin. */
  brandName?: string;
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
  const [activeType, setActiveType] = useState(
    () => packages.find((p) => p.id === initialServiceId)?.type ?? packages[0]?.type ?? '',
  );
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
    // Langkah selalu 1: formnya kini satu halaman. Medannya tetap ada supaya
    // bentuk draft di `sessionStorage` tidak berubah.
    saveDraft(next, 1);
  }

  /** Jumlah box per paket. Tiap paket paling banyak satu baris di `items`. */
  const qtyOf = (id: string) => draft.items.find((i) => i.service_id === id)?.qty ?? '';

  function setQty(id: string, qty: string) {
    const rest = draft.items.filter((i) => i.service_id !== id && i.service_id);
    // Paket berjumlah kosong tetap disimpan sebagai baris supaya paket yang
    // datang dari `?paket=` tetap terlihat terpilih sebelum jumlahnya diisi.
    set('items', [...rest, { service_id: id, qty }]);
  }

  /**
   * Baris yang terisi, beserta penolakannya menurut medan zod server.
   *
   * Baris yang akan ditolak (2,5 box, di atas batas) tetap ikut di sini supaya
   * `collectErrors` bisa menyebutnya, tapi subtotalnya nol: total yang tampil
   * tidak boleh dihitung dari jumlah yang tidak bisa dipesan.
   */
  const lines = useMemo(
    () =>
      packages
        .map((pkg) => {
          const qty = Number(draft.items.find((i) => i.service_id === pkg.id)?.qty) || 0;
          const issue = issueOf(cateringItemSchema.shape.qty, qty);
          return { pkg, qty, issue, subtotal: issue ? 0 : pkg.price * qty };
        })
        .filter((l) => l.qty > 0),
    [draft.items, packages],
  );

  const total = lines.reduce((sum, l) => sum + l.subtotal, 0);
  const totalBoxes = lines.reduce((sum, l) => sum + l.qty, 0);

  // Paket yang dipilih dari halaman depan naik ke urutan pertama, berikut
  // kelompoknya: pemesan tidak perlu mencarinya lagi di antara paket lain.
  const groups = useMemo(() => {
    const first = (a: CateringPackage, b: CateringPackage) =>
      Number(b.id === initialServiceId) - Number(a.id === initialServiceId);
    const sorted = [...packages].sort(first);
    return Array.from(new Set(sorted.map((p) => p.type))).map((type) => ({
      type,
      label: TYPE_LABEL[type] ?? 'Katering',
      items: sorted.filter((p) => p.type === type),
    }));
  }, [packages, initialServiceId]);

  /**
   * Seluruh isian yang ditolak, dari bagian pertama sampai terakhir. Form ini
   * satu halaman, jadi pemesan melihat semua yang kurang dalam satu kali tekan.
   */
  function collectErrors(): Record<string, string> {
    const errors: Record<string, string> = {};

    const invalid = lines.find((l) => l.issue);
    if (lines.length === 0) errors.items = 'Isi jumlah box untuk minimal satu paket';
    else if (invalid) errors.items = `${invalid.pkg.name}: ${invalid.issue}`;
    else if (totalBoxes > MAX_TOTAL_BOXES) {
      errors.items = `Total di atas ${MAX_TOTAL_BOXES.toLocaleString('id-ID')} box. Hubungi admin untuk penawaran khusus.`;
    }

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

    if (draft.name.trim().length < 2) errors.name = 'Nama pemesan wajib diisi';
    const phone = draft.phone.trim();
    if (!phone) errors.phone = 'Nomor WhatsApp wajib diisi';
    else if (phone.length < 8) errors.phone = 'Nomor telepon terlalu pendek';
    else if (!/^[0-9+()\- ]+$/.test(phone)) errors.phone = 'Hanya boleh angka dan tanda + ( ) -';
    const email = draft.email.trim();
    if (!email) errors.email = 'Email wajib diisi';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Format email tidak valid';

    return errors;
  }

  function jumpToField(field: string) {
    const anchor = FIELD_ANCHOR[field.split('.')[0]];
    if (!anchor) return;
    window.setTimeout(() => {
      const el = document.getElementById(anchor);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus({ preventScroll: true });
    }, 80);
  }

  /** Galat pertama menurut urutan bagian di layar, bukan urutan kunci objek. */
  function focusFirstError(errors: Record<string, string>) {
    const first = Object.keys(errors).sort(
      (x, y) => (FIELD_STEP[x.split('.')[0]] ?? 99) - (FIELD_STEP[y.split('.')[0]] ?? 99),
    )[0];
    if (first) jumpToField(first);
  }

  function submit() {
    const errors = collectErrors();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstError(errors);
      return;
    }

    setError(null);
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
        window.scrollTo({ top: 0 });
        return;
      }

      const fields = result.error.fields ?? {};
      setFieldErrors(fields);
      setError(result.error.message);
      focusFirstError(fields);
    });
  }

  if (done) {
    return (
      <SuccessPanel
        orderNumber={done.orderNumber}
        total={done.total}
        paymentUrl={done.paymentUrl}
        phone={draft.phone}
        waHref={siteConfig.whatsapp.href(
          orderWhatsAppMessage({
            orderNumber: done.orderNumber,
            totalAmount: done.total,
            packageName: lines.map((l) => `${l.pkg.name} (${l.qty} box)`).join(', '),
            requestedDate: draft.requested_date,
            requestedTime: draft.requested_time,
            customerName: draft.name,
            brandName,
          }),
        )}
      />
    );
  }

  return (
    // Dua kolom di desktop, sama dengan checkout aqiqah (`OrderAside`).
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-10">
      <div className="min-w-0">
        {/* Ditawarkan, bukan dipulihkan diam-diam: isian lama yang muncul tanpa
          diminta terbaca seperti isian sendiri. */}
        {stored && !recovered && (
          <div className="animate-in fade-in mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 duration-300">
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

        <div className="space-y-4">
          <CheckoutSection
            id="bagian-pesanan"
            index={1}
            done={lines.length > 0 && !lines.some((l) => l.issue)}
            title="Pesanan"
            hint="Isi jumlah box di paket yang Anda mau, boleh lebih dari satu paket. Tombol + dan - menambah atau mengurangi 10 box."
          >
            <div id="kt-packages" tabIndex={-1} className="outline-none">
              {/* Satu jenis per tampilan: tiga kelompok yang ditumpuk memaksa
                  pemesan menggulir jauh hanya untuk membandingkan jenis. */}
              {groups.length > 1 && (
                <div
                  role="tablist"
                  aria-label="Jenis katering"
                  // Tiga kolom sama lebar: di ponsel ketiganya tetap sebaris, tidak
                  // terlipat jadi dua baris yang tampak seperti dua kelompok.
                  className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap"
                >
                  {groups.map((group) => {
                    const on = group.type === activeType;
                    const picked = lines.filter((l) => l.pkg.type === group.type).length;
                    return (
                      <button
                        key={group.type}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        onClick={() => setActiveType(group.type)}
                        className={cn(
                          'flex min-h-11 items-center justify-center gap-1.5 rounded-lg border-2 px-2 text-sm font-semibold transition-colors duration-150 sm:gap-2 sm:px-4',
                          on
                            ? 'border-primary bg-primary text-white'
                            : 'border-line text-ink hover:border-primary/50 bg-white',
                        )}
                      >
                        <TypeIcon type={group.type} className="size-4" />
                        {group.label.replace('Katering ', '')}
                        {picked > 0 && (
                          <span
                            className={cn(
                              'flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs tabular-nums',
                              on ? 'text-primary bg-white' : 'bg-primary text-white',
                            )}
                          >
                            {picked}
                            <span className="sr-only"> paket dipilih</span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {groups
                .filter((group) => groups.length === 1 || group.type === activeType)
                .map((group) => (
                  <ul
                    key={group.type}
                    role={groups.length > 1 ? 'tabpanel' : undefined}
                    className="mt-4 space-y-3"
                  >
                    {group.items.map((pkg) => {
                      const raw = qtyOf(pkg.id);
                      const qty = Number(raw) || 0;
                      const qtyIssue = qty > 0 && issueOf(cateringItemSchema.shape.qty, qty);
                      return (
                        <li
                          key={pkg.id}
                          className={cn(
                            'flex flex-col gap-4 rounded-lg border-2 p-4 transition-colors duration-150 sm:flex-row sm:items-center sm:justify-between sm:gap-6',
                            qty > 0 ? 'border-primary bg-primary-light' : 'border-line bg-white',
                          )}
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            {/* Ikon jenis berganti centang begitu paket diberi
                                jumlah: tanda yang terlihat tanpa membaca angka. */}
                            <span
                              aria-hidden
                              className={cn(
                                'flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors duration-150',
                                qty > 0 ? 'bg-primary text-white' : 'bg-surface-muted text-primary',
                              )}
                            >
                              {qty > 0 ? (
                                <Check className="size-5 stroke-[3]" />
                              ) : (
                                <TypeIcon type={pkg.type} className="size-5" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <Label
                                htmlFor={`kt-qty-${pkg.id}`}
                                className="text-ink text-base font-semibold"
                              >
                                {pkg.name}
                              </Label>
                              {pkg.description && (
                                <p className="text-ink-muted mt-0.5 text-sm leading-6">
                                  {pkg.description}
                                </p>
                              )}
                              {/* Daftar bercentang, bukan satu baris dipisah titik:
                                  lauknya yang membedakan paket satu dengan lainnya,
                                  jadi harus bisa dipindai butir per butir. */}
                              {pkg.items.length > 0 && (
                                <ul
                                  aria-label={`Isi ${pkg.name}`}
                                  className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2"
                                >
                                  {pkg.items.map((item) => (
                                    <li
                                      key={item}
                                      className="text-ink flex items-start gap-2 text-sm leading-5"
                                    >
                                      <Check
                                        aria-hidden
                                        className="text-primary mt-0.5 size-3.5 shrink-0 stroke-[3]"
                                      />
                                      {item}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
                            <p className="text-right text-sm tabular-nums">
                              <span className="text-ink font-bold">
                                {formatCurrency(pkg.price)}
                              </span>
                              <span className="text-ink-muted"> /box</span>
                              {qty > 0 && !qtyIssue && (
                                <span className="text-primary block text-sm font-semibold">
                                  {formatCurrency(pkg.price * qty)}
                                </span>
                              )}
                              {qtyIssue && (
                                <span className="text-danger block text-sm font-semibold">
                                  {qtyIssue}
                                </span>
                              )}
                            </p>
                            <div className="border-line inline-flex items-center gap-1 rounded-lg border-2 bg-white p-0.5">
                              <StepperButton
                                label={`Kurangi ${QTY_STEP} box ${pkg.name}`}
                                disabled={qty <= 0}
                                onClick={() =>
                                  setQty(pkg.id, String(Math.max(0, qty - QTY_STEP) || ''))
                                }
                              >
                                <Minus className="size-5" />
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
                                <Plus className="size-5" />
                              </StepperButton>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ))}
            </div>
            {fieldErrors.items && <FieldError message={fieldErrors.items} />}
          </CheckoutSection>

          <CheckoutSection
            id="bagian-jadwal"
            index={2}
            done={Boolean(
              draft.requested_date && draft.requested_time && draft.delivery.village_code,
            )}
            title="Jadwal & alamat"
            hint="Jadwal ini masih permintaan. Tim kami mengonfirmasinya lewat WhatsApp."
          >
            <div>
              <SectionLabel
                index={1}
                done={Boolean(draft.requested_date && draft.requested_time)}
                title="Waktu pengiriman"
                hint={`Paling cepat ${formatDate(minDate)}, paling lambat ${BOOKING_MAX_DAYS} hari ke depan.`}
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label
                    htmlFor="kt-date"
                    className="text-ink flex items-center gap-1.5 text-sm font-semibold"
                  >
                    <CalendarDays aria-hidden className="text-primary size-4" />
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
                    className="field mt-2 h-12"
                  />
                  {fieldErrors.requested_date && (
                    <FieldError message={fieldErrors.requested_date} />
                  )}
                </div>
                <div>
                  <Label
                    id="kt-time-label"
                    className="text-ink flex items-center gap-1.5 text-sm font-semibold"
                  >
                    <Clock aria-hidden className="text-primary size-4" />
                    Jam
                  </Label>
                  <div
                    id="kt-time"
                    tabIndex={-1}
                    role="radiogroup"
                    aria-labelledby="kt-time-label"
                    className="mt-2 grid grid-cols-3 gap-2 outline-none sm:flex sm:flex-wrap"
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
                            'flex min-h-11 items-center justify-center rounded-lg border-2 px-1 text-sm font-semibold tabular-nums transition-colors duration-150 sm:px-4',
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
              <Label htmlFor="kt-inst" className="text-ink text-sm font-semibold">
                Nama acara atau instansi{' '}
                <span className="text-ink-muted font-normal">(opsional)</span>
              </Label>
              <div className="relative mt-2">
                <Building2
                  aria-hidden
                  className="text-ink-muted pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
                />
                <Input
                  id="kt-inst"
                  value={draft.recipient_institution}
                  onChange={(e) => set('recipient_institution', e.target.value)}
                  placeholder="Mis. Pengajian RT 05, PT Sejahtera"
                  className="field h-12 pl-10"
                />
              </div>
              <p className="text-ink-muted mt-1.5 text-sm">
                Membantu kurir menemukan lokasi acara.
              </p>
            </div>
          </CheckoutSection>

          <CheckoutSection
            id="bagian-data"
            index={3}
            done={Boolean(draft.name && draft.phone && draft.email)}
            title="Data pemesan"
            hint="Kami mengirim konfirmasi dan rincian pembayaran ke nomor WhatsApp ini."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="kt-name" className="text-ink text-sm font-semibold">
                  Nama pemesan
                </Label>
                <div className="relative mt-2">
                  <User
                    aria-hidden
                    className="text-ink-muted pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
                  />
                  <Input
                    id="kt-name"
                    autoComplete="name"
                    value={draft.name}
                    onChange={(e) => set('name', e.target.value)}
                    aria-invalid={Boolean(fieldErrors.name)}
                    placeholder="Nama Anda"
                    className="field h-12 pl-10"
                  />
                </div>
                {fieldErrors.name && <FieldError message={fieldErrors.name} />}
              </div>

              <div>
                <Label htmlFor="kt-phone" className="text-ink text-sm font-semibold">
                  Nomor WhatsApp
                </Label>
                <div className="relative mt-2">
                  <Phone
                    aria-hidden
                    className="text-ink-muted pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
                  />
                  <Input
                    id="kt-phone"
                    type="tel"
                    autoComplete="tel"
                    value={draft.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    placeholder="0812xxxxxxxx"
                    aria-invalid={Boolean(fieldErrors.phone)}
                    className="field h-12 pl-10"
                  />
                </div>
                {fieldErrors.phone && <FieldError message={fieldErrors.phone} />}
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="kt-email" className="text-ink text-sm font-semibold">
                  Email
                </Label>
                <div className="relative mt-2">
                  <Mail
                    aria-hidden
                    className="text-ink-muted pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
                  />
                  <Input
                    id="kt-email"
                    type="email"
                    autoComplete="email"
                    value={draft.email}
                    onChange={(e) => set('email', e.target.value)}
                    placeholder="email@domain.com"
                    aria-invalid={Boolean(fieldErrors.email)}
                    className="field h-12 pl-10"
                  />
                </div>
                <p className="text-ink-muted mt-1.5 text-sm">Untuk salinan pesanan.</p>
                {fieldErrors.email && <FieldError message={fieldErrors.email} />}
              </div>
            </div>
          </CheckoutSection>

          <CheckoutSection id="bagian-catatan" index={4} done={false} title="Catatan & kirim">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label
                  htmlFor="kt-referral"
                  className="text-ink flex items-center gap-1.5 text-sm font-semibold"
                >
                  <Tag aria-hidden className="text-primary size-4" />
                  Kode referral <span className="text-ink-muted font-normal">(opsional)</span>
                </Label>
                <Input
                  id="kt-referral"
                  autoComplete="off"
                  autoCapitalize="characters"
                  value={draft.referral_code}
                  onChange={(e) => set('referral_code', e.target.value)}
                  placeholder="Mis. SA-BUDI"
                  className="field mt-2 h-12 uppercase"
                />
                {fieldErrors.referral_code && <FieldError message={fieldErrors.referral_code} />}
              </div>
              <div>
                <Label htmlFor="kt-notes" className="text-ink text-sm font-semibold">
                  Catatan <span className="text-ink-muted font-normal">(opsional)</span>
                </Label>
                <Textarea
                  id="kt-notes"
                  rows={3}
                  value={draft.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  placeholder="Mis. 10 box tanpa sambal"
                  className="border-line mt-2 rounded-lg text-base"
                />
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="border-danger/30 text-danger flex items-start gap-2 rounded-lg border bg-red-50 px-4 py-3 text-sm"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {error}
              </p>
            )}

            <p className="bg-surface-muted text-ink flex items-start gap-2.5 rounded-lg p-4 text-sm leading-6">
              <ShieldCheck aria-hidden className="text-primary mt-0.5 size-5 shrink-0" />
              Setelah Anda menekan Kirim Pesanan, kami menampilkan nomor pesanan dan cara
              pembayarannya. Simpan nomor itu untuk melacak pesanan.
            </p>
          </CheckoutSection>

          {/* Ringkasan galat tepat di atas tombol kirim, tempat mata pemesan
              berada saat tombolnya ditolak. Tiap baris melompat ke medannya. */}
          <ErrorSummary errors={fieldErrors} labels={FIELD_LABEL} onJump={jumpToField} />

          <SubmitBar
            total={total}
            status={
              totalBoxes > 0
                ? `${totalBoxes.toLocaleString('id-ID')} box dari ${lines.length} paket`
                : 'Belum ada paket dipilih'
            }
            pending={pending}
            onSubmit={submit}
          />
        </div>
      </div>
      <OrderAside
        lines={lines
          .filter((l) => l.subtotal > 0)
          .map((l) => ({
            label: l.pkg.name,
            detail: `${l.qty.toLocaleString('id-ID')} box`,
            amount: l.subtotal,
          }))}
        total={total}
        empty="Isi jumlah box untuk melihat tagihannya."
        brandName={brandName}
      />
    </div>
  );
}

function TypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = TYPE_ICON[type] ?? Package;
  return <Icon aria-hidden className={className} />;
}
