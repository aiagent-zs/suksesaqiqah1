'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Minus,
  Package,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Tag,
  User,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ANIMAL_SPECIES_LABEL } from '@/lib/constants/order';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { createGuestOrderAction } from '@/server/actions/checkout';
import { SPECIES_BY_SERVICE_TYPE } from '../schema';
import type { CheckoutBranch, CheckoutPackage, GuestOrderResult } from '../queries';

const SERVICE_TYPE_LABEL: Record<string, string> = {
  aqiqah: 'Aqiqah',
  qurban: 'Qurban',
};

const MAX_QTY = 20;

/**
 * Jeda sebelum tombol kirim mau menerima klik, dihitung sejak tiba di langkah
 * terakhir. Cukup panjang untuk menelan klik ganda dan klik susulan yang tidak
 * disengaja, cukup pendek untuk tidak terasa oleh orang yang memang membaca
 * ringkasannya dulu.
 */
const SUBMIT_ARM_DELAY_MS = 700;

type Draft = {
  service_id: string;
  branch_id: string;
  species: string;
  qty: number;
  on_behalf_of: string;
  name: string;
  phone: string;
  email: string;
  delivery_address: string;
  recipient_institution: string;
  referral_code: string;
  notes: string;
};

const STEPS = [
  { id: 1, title: 'Paket & Hewan', icon: Package, description: 'Pilih paket dan atas nama' },
  { id: 2, title: 'Data Pemesan', icon: User, description: 'Kontak pemesan & WhatsApp' },
  { id: 3, title: 'Pengiriman', icon: MapPin, description: 'Wilayah layanan & konfirmasi' },
];

/**
 * Peta nama medan → id elemennya, dipakai untuk melompat ke medan yang ditolak.
 * Kunci di sisi kiri mengikuti nama yang dikembalikan `validationError` dari
 * server, sehingga galat dari zod maupun dari `validateStep` sama-sama tertaut.
 */
const FIELD_ANCHOR: Record<string, string> = {
  on_behalf_of: 'co-behalf',
  name: 'co-name',
  phone: 'co-phone',
  email: 'co-email',
  delivery_address: 'co-delivery',
  recipient_institution: 'co-institution',
  referral_code: 'co-referral',
};

/** Langkah tempat tiap medan tinggal — server tidak tahu soal langkah. */
const FIELD_STEP: Record<string, number> = {
  service_id: 1,
  species: 1,
  qty: 1,
  on_behalf_of: 1,
  name: 2,
  phone: 2,
  email: 2,
  branch_id: 3,
  delivery_address: 3,
  recipient_institution: 3,
  referral_code: 3,
};

export function CheckoutForm({
  packages,
  branches,
  initialServiceId,
}: {
  packages: CheckoutPackage[];
  branches: CheckoutBranch[];
  initialServiceId?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<GuestOrderResult | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(1);
  /**
   * Apakah tombol kirim sudah boleh dianggap benar-benar disengaja.
   *
   * Penanda boolean + timer, bukan perbandingan `Date.now()`: memanggil jam di
   * badan komponen melanggar aturan kemurnian React (hasilnya bisa berbeda tiap
   * render ulang).
   */
  const submitArmedRef = useRef(false);
  const armTimerRef = useRef<number | undefined>(undefined);

  const [draft, setDraft] = useState<Draft>({
    service_id: initialServiceId ?? packages[0]?.id ?? '',
    branch_id: branches[0]?.id ?? '',
    species: 'kambing',
    qty: 1,
    on_behalf_of: '',
    name: '',
    phone: '',
    email: '',
    delivery_address: '',
    recipient_institution: '',
    referral_code: '',
    notes: '',
  });

  const selected = useMemo(
    () => packages.find((p) => p.id === draft.service_id),
    [packages, draft.service_id],
  );

  const speciesOptions = selected
    ? (SPECIES_BY_SERVICE_TYPE[selected.type] ?? ['kambing'])
    : ['kambing'];

  const total = selected ? selected.price * draft.qty : 0;

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function pickPackage(pkg: CheckoutPackage) {
    setDraft((prev) => {
      const allowed = SPECIES_BY_SERVICE_TYPE[pkg.type] ?? [];
      return {
        ...prev,
        service_id: pkg.id,
        species:
          allowed.length > 0 && !allowed.includes(prev.species as 'kambing')
            ? allowed[0]
            : prev.species,
      };
    });
  }

  /**
   * Aturannya sengaja dibuat sama ketat dengan `guestCheckoutSchema`, bukan
   * sekadar "tidak kosong". Kalau di sini lebih longgar, nomor telepon ngawur
   * baru ketahuan setelah pemesan mengisi seluruh langkah dan menekan kirim —
   * penolakan datang di tempat yang jauh dari penyebabnya.
   */
  function validateStep(step: number): boolean {
    const errors: Record<string, string> = {};

    if (step === 1) {
      if (!draft.service_id) errors.service_id = 'Pilih paket terlebih dahulu';
      if (draft.on_behalf_of.trim().length < 2) {
        errors.on_behalf_of = 'Nama atas nama ibadah wajib diisi';
      }
    } else if (step === 2) {
      if (draft.name.trim().length < 2) errors.name = 'Nama pemesan wajib diisi';

      const phone = draft.phone.trim();
      if (!phone) errors.phone = 'Nomor WhatsApp wajib diisi';
      else if (phone.length < 8) errors.phone = 'Nomor telepon terlalu pendek';
      else if (!/^[0-9+()\- ]+$/.test(phone)) {
        errors.phone = 'Hanya boleh angka dan tanda + ( ) -';
      }

      const email = draft.email.trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.email = 'Format email tidak valid';
      }
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstError(errors);
      return false;
    }
    return true;
  }

  /**
   * Bawa perhatian ke medan pertama yang bermasalah. Tanpa ini pesan galat bisa
   * berada di luar layar dan tombol "Lanjut" tampak tidak merespons.
   */
  function focusFirstError(errors: Record<string, string>) {
    const anchor = Object.keys(errors)
      .map((key) => FIELD_ANCHOR[key])
      .find(Boolean);
    if (!anchor) return;

    // Jeda kecil, bukan rAF: medannya bisa berada di langkah lain yang baru
    // akan dirender setelah `setCurrentStep`. rAF kerap menyala sebelum React
    // sempat memasangnya, sehingga elemennya belum ada saat dicari.
    window.setTimeout(() => {
      const el = document.getElementById(anchor);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (el as HTMLInputElement | null)?.focus({ preventScroll: true });
    }, 80);
  }

  /**
   * Satu-satunya jalan berpindah langkah, supaya penguncian tombol kirim tidak
   * bisa terlewat lewat jalur lain.
   */
  function goToStep(next: number) {
    setError(null);
    // Tombol "Lanjut" dan "Konfirmasi & Kirim" menempati titik layar yang sama.
    // Begitu langkah berpindah, tombol kirim langsung berada tepat di bawah
    // kursor — klik kedua yang menyusul (atau klik ganda) mendarat di sana dan
    // pesanan tercatat tanpa pernah dimaksudkan. `key` berbeda tidak menolong:
    // itu hanya mencegah fokus ikut berpindah, bukan posisinya di layar.
    window.clearTimeout(armTimerRef.current);
    submitArmedRef.current = false;
    if (next === STEPS.length) {
      armTimerRef.current = window.setTimeout(() => {
        submitArmedRef.current = true;
      }, SUBMIT_ARM_DELAY_MS);
    }
    setCurrentStep(next);
  }

  function nextStep() {
    if (validateStep(currentStep)) {
      goToStep(Math.min(STEPS.length, currentStep + 1));
    }
  }

  /**
   * Menahan pengiriman implisit oleh tombol Enter.
   *
   * Form dengan satu tombol submit akan terkirim begitu Enter ditekan di
   * sembarang `<input>`. Di langkah terakhir itu berarti pesanan **langsung
   * tercatat** saat pemesan sekadar mengetik di kolom instansi atau kode
   * referral — tanpa pernah menekan tombol konfirmasi, dan tanpa bisa
   * dibatalkan sendiri karena ordernya sudah masuk database.
   *
   * Di langkah 1-2 Enter tetap berguna: dipakai untuk maju. Di langkah
   * terakhir sengaja tidak melakukan apa-apa — mengirim pesanan harus lewat
   * klik yang disengaja.
   */
  function handleEnterKey(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key !== 'Enter') return;

    const target = e.target as HTMLElement;
    // Textarea memang butuh Enter untuk baris baru, dan tombol punya
    // perilakunya sendiri (Enter = klik) yang tidak boleh diganggu.
    if (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') return;

    e.preventDefault();
    if (currentStep < STEPS.length) nextStep();
  }

  function prevStep() {
    setError(null);
    setCurrentStep((prev) => Math.max(1, prev - 1));
  }

  function submit() {
    // Abaikan klik yang datang terlalu cepat setelah tiba di langkah terakhir —
    // itu sisa klik pada tombol "Lanjut", bukan persetujuan mengirim pesanan.
    // Pesanan tercatat di database dan tidak bisa dibatalkan pemesan, jadi
    // ambang ragu-ragu ini lebih murah daripada order yang tidak diinginkan.
    if (!submitArmedRef.current) return;

    // Galat bisa berada di langkah yang sedang tidak tampil — mis. pemesan
    // melompat lewat penunjuk langkah. Kalau hanya di-`return`, pesannya tidak
    // pernah dirender dan tombol kirim terlihat seperti rusak. Jadi pindah dulu
    // ke langkah yang bermasalah.
    for (const step of [1, 2]) {
      if (!validateStep(step)) {
        setCurrentStep(step);
        return;
      }
    }

    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await createGuestOrderAction({ ...draft, qty: String(draft.qty) });
      if (!result.ok) {
        const fields = result.error.fields ?? {};
        setError(result.error.message);
        setFieldErrors(fields);

        // Server memvalidasi seluruh payload sekaligus dan tidak tahu soal
        // langkah. Kalau medan yang ditolak ada di langkah lain, pindah ke sana
        // — kalau tidak, pesannya tidak pernah tampil di layar.
        const step = Object.keys(fields)
          .map((key) => FIELD_STEP[key])
          .filter(Boolean)
          .sort((a, b) => a - b)[0];
        if (step && step !== currentStep) setCurrentStep(step);
        focusFirstError(fields);
        return;
      }
      setDone(result.data);
    });
  }

  if (done) return <SuccessPanel result={done} />;

  const progressPct = (currentStep / STEPS.length) * 100;

  return (
    <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-xl shadow-neutral-900/5 transition-all">
      {/* Modal / Wizard Header */}
      <div className="from-primary/5 to-primary/5 relative border-b border-neutral-100 bg-gradient-to-r via-white px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide">
              <Sparkles className="size-3.5" /> Modal Pemesanan Aqiqah & Qurban
            </span>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl">
              Checkout Pesanan Mandiri
            </h2>
          </div>
          {/* Total ikut di kepala wizard, bukan hanya di langkah terakhir:
              pemesan mengubah paket & jumlah di langkah 1, jadi di situlah
              angkanya paling dibutuhkan. */}
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-2xl bg-neutral-100/80 px-4 py-2 text-xs font-medium text-neutral-600 backdrop-blur-sm sm:flex">
              <ShieldCheck className="size-4 text-emerald-600" />
              <span>Tanpa Perlu Login Akun</span>
            </div>
            <div
              aria-live="polite"
              className="border-primary/15 bg-primary/5 rounded-2xl border px-4 py-2 text-right"
            >
              <p className="text-[10px] font-medium tracking-wide text-neutral-500 uppercase">
                Total
              </p>
              <p className="text-primary text-base font-bold tracking-tight tabular-nums">
                {formatCurrency(total)}
              </p>
            </div>
          </div>
        </div>

        {/* Stepper Nav & Progress Bar */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-neutral-500">
            <span>
              Langkah {currentStep} dari {STEPS.length}
            </span>
            <span className="text-primary">{Math.round(progressPct)}% Selesai</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className="from-primary to-primary-dark h-full bg-gradient-to-r transition-all duration-300 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {STEPS.map((step) => {
              const Icon = step.icon;
              const isCurrent = step.id === currentStep;
              const isPassed = step.id < currentStep;
              return (
                <button
                  key={step.id}
                  type="button"
                  aria-current={isCurrent ? 'step' : undefined}
                  onClick={() => {
                    if (step.id < currentStep || validateStep(currentStep)) {
                      goToStep(step.id);
                    }
                  }}
                  className={cn(
                    'flex items-center gap-2.5 rounded-2xl border p-2.5 text-left transition-all sm:px-3.5 sm:py-3',
                    isCurrent
                      ? 'border-primary bg-primary/10 text-primary ring-primary/20 font-semibold shadow-sm ring-2'
                      : isPassed
                        ? 'border-emerald-200 bg-emerald-50/50 text-emerald-800'
                        : 'border-neutral-100 bg-neutral-50/50 text-neutral-400 hover:bg-neutral-100',
                  )}
                >
                  <div
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-all',
                      isCurrent
                        ? 'bg-primary text-white shadow-sm'
                        : isPassed
                          ? 'bg-emerald-600 text-white'
                          : 'bg-neutral-200 text-neutral-600',
                    )}
                  >
                    {isPassed ? (
                      <Check className="size-4 stroke-[3]" />
                    ) : (
                      <Icon className="size-3.5" />
                    )}
                  </div>
                  <div className="hidden min-w-0 sm:block">
                    <p className="truncate text-xs font-medium">{step.title}</p>
                    <p className="truncate text-[10px] opacity-75">{step.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal Body / Steps Content */}
      <form
        onSubmit={(e) => {
          // Pengiriman form TIDAK PERNAH mencatat pesanan. Jalur satu-satunya
          // adalah klik tombol konfirmasi. Apa pun yang memicu submit implisit
          // — Enter di input, tombol yang luput diberi `type`, autofill
          // peramban — paling jauh hanya memajukan langkah.
          e.preventDefault();
          if (currentStep < STEPS.length) nextStep();
        }}
        onKeyDown={handleEnterKey}
        className="p-6 sm:p-8"
      >
        {/* STEP 1: PAKET & HEWAN */}
        {currentStep === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-300">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <Label className="text-base font-bold text-neutral-900">Pilih Paket Layanan</Label>
                <span className="text-xs text-neutral-500">
                  Harga net termasuk olahan & laporan
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {packages.map((pkg) => {
                  const active = pkg.id === draft.service_id;
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => pickPackage(pkg)}
                      aria-pressed={active}
                      className={cn(
                        'group relative flex flex-col justify-between rounded-2xl border p-4.5 text-left transition-all duration-200',
                        active
                          ? 'border-primary bg-primary/5 ring-primary/20 shadow-md ring-2'
                          : 'hover:border-primary/40 border-neutral-200 bg-white hover:shadow-md',
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
                        <p className="mt-2 font-bold text-neutral-900">{pkg.name}</p>
                        {pkg.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-neutral-500">
                            {pkg.description}
                          </p>
                        )}
                      </div>
                      <p className="text-primary mt-3 text-lg font-extrabold tabular-nums">
                        {formatCurrency(pkg.price)}
                      </p>
                    </button>
                  );
                })}
              </div>
              {fieldErrors.service_id && <FieldError message={fieldErrors.service_id} />}
            </div>

            <div className="grid gap-6 rounded-2xl border border-neutral-100 bg-neutral-50/60 p-5 sm:grid-cols-2">
              <div>
                <Label className="text-sm font-semibold text-neutral-800">Jenis Hewan</Label>
                <div className="mt-2.5 inline-flex rounded-xl bg-neutral-200/60 p-1">
                  {speciesOptions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => set('species', s)}
                      aria-pressed={draft.species === s}
                      className={cn(
                        'rounded-lg px-4 py-2 text-xs font-semibold transition-all',
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
                <Label className="text-sm font-semibold text-neutral-800">Jumlah Hewan</Label>
                <div className="mt-2.5 inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white p-1 shadow-sm">
                  <StepperButton
                    label="Kurangi jumlah"
                    disabled={draft.qty <= 1}
                    onClick={() => set('qty', Math.max(1, draft.qty - 1))}
                  >
                    <Minus className="size-4" />
                  </StepperButton>
                  <span className="w-12 text-center text-base font-bold text-neutral-900 tabular-nums">
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
                {fieldErrors.qty && <FieldError message={fieldErrors.qty} />}
              </div>
            </div>

            <div>
              <Label htmlFor="co-behalf" className="text-sm font-semibold text-neutral-800">
                Atas Nama Ibadah <span className="text-red-500">*</span>
              </Label>
              <Input
                id="co-behalf"
                value={draft.on_behalf_of}
                required
                aria-required
                aria-invalid={Boolean(fieldErrors.on_behalf_of)}
                placeholder="Nama anak yang diaqiqahi / nama pequrban (cth: Fatih bin Ahmad)"
                onChange={(e) => set('on_behalf_of', e.target.value)}
                className="focus:border-primary focus:ring-primary/20 mt-2 h-12 rounded-xl border-neutral-200 text-sm shadow-sm"
              />
              {fieldErrors.on_behalf_of && <FieldError message={fieldErrors.on_behalf_of} />}
            </div>
          </div>
        )}

        {/* STEP 2: DATA PEMESAN */}
        {currentStep === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-300">
            <div className="flex items-start gap-2.5 rounded-2xl border border-blue-100 bg-blue-50/50 p-4 text-xs text-blue-900">
              <User className="mt-0.5 size-4 shrink-0 text-blue-600" />
              <span>
                Tim kami akan menghubungi nomor WhatsApp ini untuk konfirmasi pesanan, bukti
                transfer, dan jadwal pengiriman.
              </span>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="co-name" className="text-sm font-semibold text-neutral-800">
                  Nama Lengkap Pemesan <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="co-name"
                  value={draft.name}
                  autoComplete="name"
                  required
                  aria-required
                  aria-invalid={Boolean(fieldErrors.name)}
                  placeholder="Nama sesuai WhatsApp/KTP"
                  onChange={(e) => set('name', e.target.value)}
                  className="mt-2 h-12 rounded-xl border-neutral-200 text-sm shadow-sm"
                />
                {fieldErrors.name && <FieldError message={fieldErrors.name} />}
              </div>

              <div>
                <Label htmlFor="co-phone" className="text-sm font-semibold text-neutral-800">
                  Nomor WhatsApp <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="co-phone"
                  value={draft.phone}
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  aria-required
                  aria-invalid={Boolean(fieldErrors.phone)}
                  placeholder="0812xxxxxxxx"
                  onChange={(e) => set('phone', e.target.value)}
                  className="mt-2 h-12 rounded-xl border-neutral-200 text-sm shadow-sm"
                />
                {fieldErrors.phone && <FieldError message={fieldErrors.phone} />}
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="co-email" className="text-sm font-semibold text-neutral-800">
                  Email{' '}
                  <span className="font-normal text-neutral-400">
                    (opsional untuk salinan laporan)
                  </span>
                </Label>
                <Input
                  id="co-email"
                  type="email"
                  value={draft.email}
                  autoComplete="email"
                  aria-invalid={Boolean(fieldErrors.email)}
                  placeholder="email@domain.com"
                  onChange={(e) => set('email', e.target.value)}
                  className="mt-2 h-12 rounded-xl border-neutral-200 text-sm shadow-sm"
                />
                {fieldErrors.email && <FieldError message={fieldErrors.email} />}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: PENGIRIMAN & RINGKASAN */}
        {currentStep === 3 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-300">
            <div>
              <Label className="text-sm font-semibold text-neutral-800">
                Pilih Wilayah Layanan
              </Label>
              <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
                {branches.map((b) => {
                  const active = b.id === draft.branch_id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => set('branch_id', b.id)}
                      aria-pressed={active}
                      className={cn(
                        'flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-semibold transition-all',
                        active
                          ? 'border-primary bg-primary/10 text-primary ring-primary/20 shadow-sm ring-2'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300',
                      )}
                    >
                      <MapPin className="size-4 shrink-0" />
                      <span className="truncate">{b.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label htmlFor="co-delivery" className="text-sm font-semibold text-neutral-800">
                Alamat Lokasi Pengiriman Hasil Olahan
              </Label>
              <Textarea
                id="co-delivery"
                value={draft.delivery_address}
                placeholder="Alamat lengkap tujuan pengiriman masakan Nasi Box / Olahan Daging"
                onChange={(e) => set('delivery_address', e.target.value)}
                className="mt-2 rounded-xl border-neutral-200 text-sm shadow-sm"
              />
              {fieldErrors.delivery_address && (
                <FieldError message={fieldErrors.delivery_address} />
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="co-institution" className="text-sm font-semibold text-neutral-800">
                  Instansi Penerima Risalah{' '}
                  <span className="font-normal text-neutral-400">(opsional)</span>
                </Label>
                <Input
                  id="co-institution"
                  value={draft.recipient_institution}
                  placeholder="Panti Asuhan / Yayasan / Masjid"
                  onChange={(e) => set('recipient_institution', e.target.value)}
                  className="mt-2 h-11 rounded-xl border-neutral-200 text-sm shadow-sm"
                />
              </div>

              <div>
                <Label
                  htmlFor="co-referral"
                  className="flex items-center gap-1 text-sm font-semibold text-neutral-800"
                >
                  <Tag className="text-primary size-3.5" /> Kode Referral{' '}
                  <span className="font-normal text-neutral-400">(opsional)</span>
                </Label>
                <Input
                  id="co-referral"
                  value={draft.referral_code}
                  placeholder="Mis. SA-BUDI"
                  onChange={(e) => set('referral_code', e.target.value)}
                  className="mt-2 h-11 rounded-xl border-neutral-200 text-sm uppercase shadow-sm"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="co-notes" className="text-sm font-semibold text-neutral-800">
                Catatan Tambahan <span className="font-normal text-neutral-400">(opsional)</span>
              </Label>
              <Textarea
                id="co-notes"
                value={draft.notes}
                placeholder="Catatan permintaan khusus waktu potong / pembagian"
                onChange={(e) => set('notes', e.target.value)}
                className="mt-2 rounded-xl border-neutral-200 text-sm shadow-sm"
              />
            </div>

            {/* Glassmorphism Final Summary Card inside Step 3 */}
            <div className="border-primary/20 from-primary/5 to-primary/5 rounded-2xl border bg-gradient-to-br via-white p-5 shadow-sm">
              <div className="border-primary/10 flex items-center justify-between border-b pb-3">
                <span className="flex items-center gap-2 text-sm font-bold text-neutral-900">
                  <ShoppingBag className="text-primary size-4" /> Rincian Akhir Pesanan
                </span>
                <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-bold">
                  {selected?.name ?? 'Paket'}
                </span>
              </div>
              <div className="mt-3 space-y-2 text-xs text-neutral-600">
                <div className="flex justify-between">
                  <span>Atas nama ibadah:</span>
                  <span className="font-semibold text-neutral-900">
                    {draft.on_behalf_of || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Pemesan & WA:</span>
                  <span className="font-semibold text-neutral-900">
                    {draft.name ? `${draft.name} (${draft.phone})` : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Jumlah hewan:</span>
                  <span className="font-semibold text-neutral-900">
                    {draft.qty} ×{' '}
                    {ANIMAL_SPECIES_LABEL[draft.species as keyof typeof ANIMAL_SPECIES_LABEL]}
                  </span>
                </div>
              </div>
              <div className="border-primary/10 mt-4 flex items-baseline justify-between border-t pt-3">
                <span className="text-sm font-bold text-neutral-900">Total Tagihan:</span>
                <span className="text-primary text-2xl font-extrabold tabular-nums">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div className="mt-6 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
            <AlertCircle className="size-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Controls / Navigation Bar */}
        <div className="mt-8 flex items-center justify-between border-t border-neutral-100 pt-6">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={prevStep}
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-5 py-3 text-xs font-semibold text-neutral-700 shadow-sm transition-all hover:bg-neutral-50"
            >
              <ChevronLeft className="size-4" /> Kembali
            </button>
          ) : (
            <div />
          )}

          {/* `key` berbeda itu wajib, bukan hiasan.
              Tanpanya kedua tombol menempati slot yang sama di pohon React,
              sehingga React memakai ulang elemen DOM yang sama dan hanya
              menukar `type` serta handler-nya. Akibatnya tombol "Lanjut" yang
              baru diklik berubah menjadi tombol kirim sambil tetap memegang
              fokus dan berada di bawah kursor — klik kedua atau Enter langsung
              mencatat pesanan. `key` memaksa React melepas yang lama dan
              memasang elemen baru, jadi fokus maupun klik yang menyusul tidak
              mendarat di tombol kirim. */}
          {currentStep < STEPS.length ? (
            <button
              key="nav-next"
              type="button"
              onClick={nextStep}
              className="bg-primary shadow-primary/20 hover:bg-primary-dark inline-flex items-center gap-1.5 rounded-xl px-6 py-3 text-xs font-semibold text-white shadow-md transition-all hover:shadow-lg"
            >
              Lanjut ke {STEPS[currentStep].title} <ChevronRight className="size-4" />
            </button>
          ) : (
            /* `type="button"` + onClick, bukan `type="submit"`: pesanan tercatat
               di database dan tidak bisa dibatalkan pemesan, jadi jalurnya tidak
               boleh bisa dipicu pengiriman form implisit dari mana pun. */
            <button
              key="nav-submit"
              type="button"
              onClick={submit}
              disabled={pending || !selected}
              className="bg-primary shadow-primary/30 hover:bg-primary-dark inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              {pending ? 'Mengirim pesanan…' : 'Konfirmasi & Kirim Pesanan'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function StepperButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-lg text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function SuccessPanel({ result }: { result: GuestOrderResult }) {
  return (
    <div className="mx-auto max-w-xl overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-2xl">
      <div className="border-b border-emerald-100 bg-gradient-to-b from-emerald-50 via-white to-white px-6 py-8 text-center sm:px-8">
        <span className="inline-flex size-16 items-center justify-center rounded-full bg-emerald-100/80 ring-8 ring-emerald-50">
          <CheckCircle2 className="size-9 text-emerald-600" />
        </span>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-neutral-900">
          Pesanan Berhasil Terkirim!
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-xs leading-6 text-neutral-600">
          Pesanan Anda telah tercatat di sistem. Tim admin Sukses Aqiqah akan segera menghubungi
          Anda via WhatsApp.
        </p>
      </div>

      <dl className="grid gap-4 px-6 py-6 sm:grid-cols-2 sm:px-8">
        <div className="rounded-2xl border border-neutral-100 bg-neutral-50/70 px-4 py-3.5">
          <dt className="text-[11px] font-medium text-neutral-500 uppercase">Nomor Pesanan</dt>
          <dd className="mt-1 text-lg font-extrabold tracking-tight text-neutral-900 tabular-nums">
            {result.order_number}
          </dd>
        </div>
        <div className="rounded-2xl border border-neutral-100 bg-neutral-50/70 px-4 py-3.5">
          <dt className="text-[11px] font-medium text-neutral-500 uppercase">Total Tagihan</dt>
          <dd className="text-primary mt-1 text-lg font-extrabold tracking-tight tabular-nums">
            {formatCurrency(result.total_amount)}
          </dd>
        </div>
      </dl>

      <div className="border-t border-neutral-100 px-6 py-6 sm:px-8">
        <Link
          href="/"
          className="inline-flex w-full items-center justify-center rounded-xl bg-neutral-900 px-5 py-3.5 text-xs font-bold text-white shadow-md transition-all hover:bg-neutral-800"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}

function FieldError({ message }: { message: string }) {
  return <p className="mt-1 text-xs font-medium text-red-600">{message}</p>;
}
