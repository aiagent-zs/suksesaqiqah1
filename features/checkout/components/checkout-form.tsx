'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Baby,
  CheckCircle2,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  Minus,
  Package,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Tag,
  Truck,
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
import type { CheckoutBranch, CheckoutPackage, GuestOrderResult, NasiBoxPackage } from '../queries';

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
  aqiqah_for: string;
  service_id: string;
  branch_id: string;
  species: string;
  qty: number;
  nasi_box_service_id: string;
  nasi_box_qty: number;
  distribution_mode: string;
  child_name: string;
  bin_binti: string;
  name: string;
  phone: string;
  email: string;
  delivery_address: string;
  recipient_institution: string;
  referral_code: string;
  notes: string;
};

const STEPS = [
  { id: 1, title: 'Aqiqah Untuk', icon: Baby, description: 'Anak laki-laki / perempuan' },
  { id: 2, title: 'Paket Kambing', icon: Package, description: 'Pilih paket & jumlah ekor' },
  { id: 3, title: 'Nasi Box', icon: ShoppingBag, description: 'Tambahan, boleh dilewati' },
  { id: 4, title: 'Penyaluran', icon: Truck, description: 'Disalurkan atau dikirim' },
  { id: 5, title: 'Data Pemesan', icon: User, description: 'Kontak & nama anak' },
  { id: 6, title: 'Ringkasan', icon: ClipboardCheck, description: 'Periksa lalu konfirmasi' },
];

/**
 * Anjuran jumlah ekor per jenis kelamin — anjuran, bukan paksaan: pemesan tetap
 * bebas mengubahnya di tahap berikutnya.
 */
const RECOMMENDED_QTY: Record<string, number> = { laki_laki: 2, perempuan: 1 };

const AQIQAH_FOR_OPTIONS = [
  { value: 'laki_laki', label: 'Anak Laki-laki', hint: 'Rekomendasi 2 ekor' },
  { value: 'perempuan', label: 'Anak Perempuan', hint: 'Rekomendasi 1 ekor' },
];

const DISTRIBUTION_OPTIONS = [
  {
    value: 'salur',
    label: 'Aqiqah Salur',
    hint: 'Daging disalurkan ke penghafal Qur’an dan dhuafa oleh tim kami.',
  },
  {
    value: 'kirim',
    label: 'Aqiqah Kirim',
    hint: 'Hasil olahan diantar ke alamat yang Anda tentukan.',
  },
];

/**
 * Peta nama medan → id elemennya, dipakai untuk melompat ke medan yang ditolak.
 * Kunci di sisi kiri mengikuti nama yang dikembalikan `validationError` dari
 * server, sehingga galat dari zod maupun dari `validateStep` sama-sama tertaut.
 */
const FIELD_ANCHOR: Record<string, string> = {
  child_name: 'co-child',
  bin_binti: 'co-binbinti',
  name: 'co-name',
  phone: 'co-phone',
  email: 'co-email',
  nasi_box_qty: 'co-boxqty',
  delivery_address: 'co-delivery',
  recipient_institution: 'co-institution',
  referral_code: 'co-referral',
};

/** Langkah tempat tiap medan tinggal — server tidak tahu soal langkah. */
const FIELD_STEP: Record<string, number> = {
  aqiqah_for: 1,
  service_id: 2,
  species: 2,
  qty: 2,
  nasi_box_service_id: 3,
  nasi_box_qty: 3,
  distribution_mode: 4,
  branch_id: 4,
  delivery_address: 4,
  recipient_institution: 4,
  child_name: 5,
  bin_binti: 5,
  name: 5,
  phone: 5,
  email: 5,
  referral_code: 6,
};

export function CheckoutForm({
  packages,
  nasiBoxes,
  branches,
  initialServiceId,
}: {
  packages: CheckoutPackage[];
  nasiBoxes: NasiBoxPackage[];
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
    aqiqah_for: '',
    service_id: initialServiceId ?? packages[0]?.id ?? '',
    branch_id: branches[0]?.id ?? '',
    species: 'kambing',
    qty: 1,
    nasi_box_service_id: '',
    nasi_box_qty: 0,
    distribution_mode: '',
    child_name: '',
    bin_binti: '',
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

  const selectedBox = useMemo(
    () => nasiBoxes.find((b) => b.id === draft.nasi_box_service_id),
    [nasiBoxes, draft.nasi_box_service_id],
  );

  const packageSubtotal = selected ? selected.price * draft.qty : 0;
  const boxSubtotal = selectedBox ? selectedBox.price * draft.nasi_box_qty : 0;
  const total = packageSubtotal + boxSubtotal;

  /**
   * Memilih jenis kelamin ikut menyetel anjuran jumlah ekor (2 laki-laki,
   * 1 perempuan). Hanya anjuran — pemesan bebas mengubahnya di tahap 2.
   */
  function pickAqiqahFor(value: string) {
    setDraft((prev) => ({
      ...prev,
      aqiqah_for: value,
      qty: RECOMMENDED_QTY[value] ?? prev.qty,
    }));
  }

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
      if (!draft.aqiqah_for) errors.aqiqah_for = 'Pilih salah satu terlebih dahulu';
    } else if (step === 2) {
      if (!draft.service_id) errors.service_id = 'Pilih paket terlebih dahulu';
    } else if (step === 3) {
      // Memilih paket box tanpa jumlah berarti tidak ada yang bisa dipesan.
      if (draft.nasi_box_service_id && draft.nasi_box_qty < 1) {
        errors.nasi_box_qty = 'Isi jumlah box, atau pilih "Tidak pakai"';
      }
    } else if (step === 4) {
      if (!draft.distribution_mode) errors.distribution_mode = 'Pilih cara penyaluran';
      if (draft.distribution_mode === 'kirim' && !draft.delivery_address.trim()) {
        errors.delivery_address = 'Alamat pengiriman wajib diisi untuk Aqiqah Kirim';
      }
    } else if (step === 5) {
      if (draft.name.trim().length < 2) errors.name = 'Nama pemesan wajib diisi';

      const phone = draft.phone.trim();
      if (!phone) errors.phone = 'Nomor WhatsApp wajib diisi';
      else if (phone.length < 8) errors.phone = 'Nomor telepon terlalu pendek';
      else if (!/^[0-9+()\- ]+$/.test(phone)) {
        errors.phone = 'Hanya boleh angka dan tanda + ( ) -';
      }

      const email = draft.email.trim();
      if (!email) errors.email = 'Email wajib diisi';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.email = 'Format email tidak valid';
      }

      if (draft.child_name.trim().length < 2) errors.child_name = 'Nama anak wajib diisi';
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
    for (const step of [1, 2, 3, 4, 5]) {
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
        {/* STEP 1: AQIQAH UNTUK */}
        {currentStep === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-300">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <Label className="text-base font-bold text-neutral-900">Aqiqah untuk siapa?</Label>
                <span className="text-xs text-neutral-500">Menentukan anjuran jumlah ekor</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {AQIQAH_FOR_OPTIONS.map((opt) => {
                  const active = draft.aqiqah_for === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => pickAqiqahFor(opt.value)}
                      aria-pressed={active}
                      className={cn(
                        'relative flex items-center gap-3 rounded-2xl border p-4.5 text-left transition-all duration-200',
                        active
                          ? 'border-primary bg-primary/5 ring-primary/20 shadow-md ring-2'
                          : 'hover:border-primary/40 border-neutral-200 bg-white hover:shadow-md',
                      )}
                    >
                      <div
                        className={cn(
                          'flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors',
                          active ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-500',
                        )}
                      >
                        <Baby className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-neutral-900">{opt.label}</p>
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
          </div>
        )}

        {/* STEP 2: PAKET KAMBING */}
        {currentStep === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-300">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <Label className="text-base font-bold text-neutral-900">Pilih Paket</Label>
                <span className="text-xs text-neutral-500">
                  Harga net termasuk olahan &amp; laporan
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
                <Label className="text-sm font-semibold text-neutral-800">Jumlah Ekor</Label>
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
                {draft.aqiqah_for && (
                  <p className="mt-1.5 text-xs text-neutral-500">
                    Anjuran untuk{' '}
                    {draft.aqiqah_for === 'laki_laki' ? 'anak laki-laki' : 'anak perempuan'}:{' '}
                    {RECOMMENDED_QTY[draft.aqiqah_for]} ekor
                  </p>
                )}
                {fieldErrors.qty && <FieldError message={fieldErrors.qty} />}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: NASI BOX (OPSIONAL) */}
        {currentStep === 3 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-300">
            <div className="flex items-start gap-2.5 rounded-2xl border border-blue-100 bg-blue-50/50 p-4 text-xs text-blue-900">
              <ShoppingBag className="mt-0.5 size-4 shrink-0 text-blue-600" />
              <span>
                Tambahan nasi box untuk dibagikan bersama aqiqah Anda. Boleh dilewati — pilih
                &ldquo;Tidak pakai&rdquo;.
              </span>
            </div>

            <div>
              <Label className="mb-3 block text-base font-bold text-neutral-900">
                Paket Nasi Box
              </Label>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <button
                  type="button"
                  onClick={() => {
                    set('nasi_box_service_id', '');
                    set('nasi_box_qty', 0);
                  }}
                  aria-pressed={!draft.nasi_box_service_id}
                  className={cn(
                    'relative rounded-2xl border p-4.5 text-left transition-all duration-200',
                    !draft.nasi_box_service_id
                      ? 'border-primary bg-primary/5 ring-primary/20 shadow-md ring-2'
                      : 'hover:border-primary/40 border-neutral-200 bg-white hover:shadow-md',
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
                        'relative rounded-2xl border p-4.5 text-left transition-all duration-200',
                        active
                          ? 'border-primary bg-primary/5 ring-primary/20 shadow-md ring-2'
                          : 'hover:border-primary/40 border-neutral-200 bg-white hover:shadow-md',
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
            </div>

            {draft.nasi_box_service_id && (
              <div className="rounded-2xl border border-neutral-100 bg-neutral-50/60 p-5">
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
                  onChange={(e) => set('nasi_box_qty', Number(e.target.value) || 0)}
                  className="mt-2 h-12 max-w-40 rounded-xl border-neutral-200 text-sm tabular-nums shadow-sm"
                />
                {selectedBox && draft.nasi_box_qty > 0 && (
                  <p className="mt-2 text-xs text-neutral-600">
                    {draft.nasi_box_qty} × {formatCurrency(selectedBox.price)} ={' '}
                    <span className="text-primary font-bold">{formatCurrency(boxSubtotal)}</span>
                  </p>
                )}
                {fieldErrors.nasi_box_qty && <FieldError message={fieldErrors.nasi_box_qty} />}
              </div>
            )}
          </div>
        )}

        {/* STEP 4: PENYALURAN */}
        {currentStep === 4 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-300">
            <div>
              <Label className="mb-3 block text-base font-bold text-neutral-900">
                Cara Penyaluran
              </Label>
              <div className="grid gap-3 sm:grid-cols-2">
                {DISTRIBUTION_OPTIONS.map((opt) => {
                  const active = draft.distribution_mode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set('distribution_mode', opt.value)}
                      aria-pressed={active}
                      className={cn(
                        'relative rounded-2xl border p-4.5 text-left transition-all duration-200',
                        active
                          ? 'border-primary bg-primary/5 ring-primary/20 shadow-md ring-2'
                          : 'hover:border-primary/40 border-neutral-200 bg-white hover:shadow-md',
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
              {fieldErrors.distribution_mode && (
                <FieldError message={fieldErrors.distribution_mode} />
              )}
            </div>

            <div>
              <Label className="text-sm font-semibold text-neutral-800">Wilayah Layanan</Label>
              <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
                {branches.map((b) => {
                  const active = b.id === draft.branch_id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => set('branch_id', b.id)}
                      aria-pressed={active}
                      className={cn(
                        'rounded-xl border px-4 py-3 text-xs font-semibold transition-all',
                        active
                          ? 'border-primary bg-primary/5 text-primary ring-primary/20 ring-2'
                          : 'hover:border-primary/40 border-neutral-200 bg-white text-neutral-700',
                      )}
                    >
                      {b.name}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-neutral-500">
                Cabang yang melaksanakan dan mengantar pesanan Anda.
              </p>
            </div>

            {/* Hanya bermakna kalau dagingnya diantar ke pemesan. */}
            {draft.distribution_mode === 'kirim' && (
              <div className="animate-in fade-in duration-200">
                <Label htmlFor="co-delivery" className="text-sm font-semibold text-neutral-800">
                  Alamat Pengiriman <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="co-delivery"
                  value={draft.delivery_address}
                  aria-invalid={Boolean(fieldErrors.delivery_address)}
                  placeholder="Alamat lengkap tujuan pengiriman hasil olahan"
                  onChange={(e) => set('delivery_address', e.target.value)}
                  className="mt-2 rounded-xl border-neutral-200 text-sm shadow-sm"
                />
                {fieldErrors.delivery_address && (
                  <FieldError message={fieldErrors.delivery_address} />
                )}
              </div>
            )}

            <div>
              <Label htmlFor="co-institution" className="text-sm font-semibold text-neutral-800">
                Instansi Penerima Risalah{' '}
                <span className="font-normal text-neutral-400">(opsional)</span>
              </Label>
              <Input
                id="co-institution"
                value={draft.recipient_institution}
                placeholder="Mis. Panti Asuhan Al-Amin, Masjid Nurul Iman"
                onChange={(e) => set('recipient_institution', e.target.value)}
                className="mt-2 h-12 rounded-xl border-neutral-200 text-sm shadow-sm"
              />
              {fieldErrors.recipient_institution && (
                <FieldError message={fieldErrors.recipient_institution} />
              )}
            </div>
          </div>
        )}

        {/* STEP 5: DATA PEMESAN */}
        {currentStep === 5 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-300">
            <div className="flex items-start gap-2.5 rounded-2xl border border-blue-100 bg-blue-50/50 p-4 text-xs text-blue-900">
              <User className="mt-0.5 size-4 shrink-0 text-blue-600" />
              <span>
                Tim kami menghubungi nomor WhatsApp ini untuk konfirmasi pesanan, bukti transfer,
                dan jadwal pelaksanaan.
              </span>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="co-name" className="text-sm font-semibold text-neutral-800">
                  Nama Pemesan <span className="text-red-500">*</span>
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
                  No. WhatsApp <span className="text-red-500">*</span>
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
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="co-email"
                  type="email"
                  value={draft.email}
                  autoComplete="email"
                  required
                  aria-required
                  aria-invalid={Boolean(fieldErrors.email)}
                  placeholder="email@domain.com"
                  onChange={(e) => set('email', e.target.value)}
                  className="mt-2 h-12 rounded-xl border-neutral-200 text-sm shadow-sm"
                />
                <p className="mt-1.5 text-xs text-neutral-500">
                  Dipakai mengirim salinan pesanan dan tautan laporan pelaksanaan.
                </p>
                {fieldErrors.email && <FieldError message={fieldErrors.email} />}
              </div>

              <div>
                <Label htmlFor="co-child" className="text-sm font-semibold text-neutral-800">
                  Nama Anak <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="co-child"
                  value={draft.child_name}
                  required
                  aria-required
                  aria-invalid={Boolean(fieldErrors.child_name)}
                  placeholder="Mis. Fatih"
                  onChange={(e) => set('child_name', e.target.value)}
                  className="mt-2 h-12 rounded-xl border-neutral-200 text-sm shadow-sm"
                />
                {fieldErrors.child_name && <FieldError message={fieldErrors.child_name} />}
              </div>

              <div>
                <Label htmlFor="co-binbinti" className="text-sm font-semibold text-neutral-800">
                  Bin / Binti <span className="font-normal text-neutral-400">(opsional)</span>
                </Label>
                <Input
                  id="co-binbinti"
                  value={draft.bin_binti}
                  aria-invalid={Boolean(fieldErrors.bin_binti)}
                  placeholder="Mis. bin Ahmad"
                  onChange={(e) => set('bin_binti', e.target.value)}
                  className="mt-2 h-12 rounded-xl border-neutral-200 text-sm shadow-sm"
                />
                {fieldErrors.bin_binti && <FieldError message={fieldErrors.bin_binti} />}
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: RINGKASAN & KONFIRMASI */}
        {currentStep === 6 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-300">
            <div className="overflow-hidden rounded-2xl border border-neutral-200">
              <div className="border-b border-neutral-100 bg-neutral-50/80 px-5 py-3">
                <p className="text-sm font-bold text-neutral-900">Rincian Pesanan</p>
              </div>

              <dl className="divide-y divide-neutral-100">
                <SummaryRow label="Aqiqah untuk">
                  {draft.aqiqah_for === 'laki_laki' ? 'Anak Laki-laki' : 'Anak Perempuan'}
                </SummaryRow>
                <SummaryRow label="Atas nama">
                  {[draft.child_name, draft.bin_binti].filter(Boolean).join(' ') || '-'}
                </SummaryRow>
                <SummaryRow label="Paket">
                  {selected?.name ?? '-'} · {draft.qty}{' '}
                  {ANIMAL_SPECIES_LABEL[draft.species as keyof typeof ANIMAL_SPECIES_LABEL]}
                  <span className="block text-xs text-neutral-500 tabular-nums">
                    {formatCurrency(packageSubtotal)}
                  </span>
                </SummaryRow>
                {selectedBox && draft.nasi_box_qty > 0 && (
                  <SummaryRow label="Nasi box">
                    {selectedBox.name} · {draft.nasi_box_qty} box
                    <span className="block text-xs text-neutral-500 tabular-nums">
                      {formatCurrency(boxSubtotal)}
                    </span>
                  </SummaryRow>
                )}
                <SummaryRow label="Penyaluran">
                  {draft.distribution_mode === 'kirim' ? 'Aqiqah Kirim' : 'Aqiqah Salur'}
                  {draft.distribution_mode === 'kirim' && draft.delivery_address && (
                    <span className="block text-xs text-neutral-500">{draft.delivery_address}</span>
                  )}
                </SummaryRow>
                <SummaryRow label="Wilayah">
                  {branches.find((b) => b.id === draft.branch_id)?.name ?? '-'}
                </SummaryRow>
                <SummaryRow label="Pemesan">
                  {draft.name}
                  <span className="block text-xs text-neutral-500">
                    {draft.phone} · {draft.email}
                  </span>
                </SummaryRow>
              </dl>

              <div className="from-primary/5 flex items-center justify-between bg-gradient-to-r to-transparent px-5 py-4">
                <span className="text-sm font-bold text-neutral-900">Total Tagihan:</span>
                <span className="text-primary text-xl font-extrabold tabular-nums">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="co-referral" className="text-sm font-semibold text-neutral-800">
                  <Tag className="mr-1 inline size-3.5" />
                  Kode Referral <span className="font-normal text-neutral-400">(opsional)</span>
                </Label>
                <Input
                  id="co-referral"
                  value={draft.referral_code}
                  aria-invalid={Boolean(fieldErrors.referral_code)}
                  placeholder="Mis. SA-BUDI"
                  onChange={(e) => set('referral_code', e.target.value)}
                  className="mt-2 h-12 rounded-xl border-neutral-200 text-sm uppercase shadow-sm"
                />
                {fieldErrors.referral_code && <FieldError message={fieldErrors.referral_code} />}
              </div>

              <div>
                <Label htmlFor="co-notes" className="text-sm font-semibold text-neutral-800">
                  Catatan <span className="font-normal text-neutral-400">(opsional)</span>
                </Label>
                <Textarea
                  id="co-notes"
                  value={draft.notes}
                  placeholder="Permintaan khusus, waktu yang diharapkan, dan sebagainya"
                  onChange={(e) => set('notes', e.target.value)}
                  className="mt-2 rounded-xl border-neutral-200 text-sm shadow-sm"
                />
              </div>
            </div>

            {error && (
              <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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

/** Satu baris rincian di tahap ringkasan. */
function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3">
      <dt className="shrink-0 text-xs font-medium text-neutral-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-neutral-900">{children}</dd>
    </div>
  );
}

function FieldError({ message }: { message: string }) {
  return <p className="mt-1 text-xs font-medium text-red-600">{message}</p>;
}
