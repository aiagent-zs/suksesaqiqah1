'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Baby,
  CalendarClock,
  CheckCircle2,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  Minus,
  Package,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Truck,
  User,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ANIMAL_SPECIES_LABEL } from '@/lib/constants/order';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { createGuestOrderAction } from '@/server/actions/checkout';
import {
  BOOKING_MAX_DAYS,
  BOOKING_TIME_SLOTS,
  CHILD_BIRTH_MIN_DATE,
  SPECIES_BY_SERVICE_TYPE,
} from '../schema';
import { AddressPicker } from './address-picker';
import {
  clearDraft,
  emptyDraft,
  getDraftServerSnapshot,
  getDraftSnapshot,
  saveDraft,
  subscribeDraft,
  type Draft,
} from '../draft';
import type { CheckoutPackage, GuestOrderResult, NasiBoxPackage, RegionOption } from '../queries';

const SERVICE_TYPE_LABEL: Record<string, string> = {
  aqiqah: 'Aqiqah',
  // qurban: 'Qurban',
};

const MAX_QTY = 20;

/**
 * Jeda sebelum tombol kirim mau menerima klik, dihitung sejak tiba di langkah
 * terakhir. Cukup panjang untuk menelan klik ganda dan klik susulan yang tidak
 * disengaja, cukup pendek untuk tidak terasa oleh orang yang memang membaca
 * ringkasannya dulu.
 */
const SUBMIT_ARM_DELAY_MS = 700;

/**
 * Empat langkah, bukan enam.
 *
 * "Aqiqah untuk", "Paket", dan "Nasi box" disatukan pada 19 Agustus 2026:
 * ketiganya menjawab satu pertanyaan yang sama — *apa yang dipesan* — dan
 * masing-masing hanya menuntut satu klik. Memecahnya jadi tiga langkah membuat
 * pemesan menekan "Lanjut" dua kali tanpa mengisi apa pun di antaranya, sambil
 * menyembunyikan bahwa paket dan nasi box saling memengaruhi total.
 */
const STEPS = [
  { id: 1, title: 'Pesanan', shortTitle: 'Pesanan', icon: Package, description: 'Paket, jumlah ekor, nasi box' },
  {
    id: 2,
    title: 'Jadwal & Penyaluran',
    shortTitle: 'Jadwal',
    icon: CalendarClock,
    description: 'Tanggal, jam, cara kirim',
  },
  { id: 3, title: 'Data Pemesan', shortTitle: 'Data', icon: User, description: 'Kontak & nama anak' },
  { id: 4, title: 'Ringkasan', shortTitle: 'Ringkasan', icon: ClipboardCheck, description: 'Periksa lalu konfirmasi' },
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
  child_birth_place: 'co-birthplace',
  child_birth_date: 'co-birthdate',
  name: 'co-name',
  phone: 'co-phone',
  email: 'co-email',
  nasi_box_qty: 'co-boxqty',
  requested_date: 'co-date',
  requested_time: 'co-time',
  delivery_province_code: 'co-prov',
  delivery_city_code: 'co-city',
  delivery_district_code: 'co-dist',
  delivery_village_code: 'co-vill',
  delivery_postal_code: 'co-postal',
  delivery_detail: 'co-detail',
  recipient_institution: 'co-institution',
  referral_code: 'co-referral',
};

/** Langkah tempat tiap medan tinggal — server tidak tahu soal langkah. */
const FIELD_STEP: Record<string, number> = {
  aqiqah_for: 1,
  service_id: 1,
  species: 1,
  qty: 1,
  nasi_box_service_id: 1,
  nasi_box_qty: 1,
  requested_date: 2,
  requested_time: 2,
  distribution_mode: 2,
  delivery_province_code: 2,
  delivery_city_code: 2,
  delivery_district_code: 2,
  delivery_village_code: 2,
  delivery_postal_code: 2,
  delivery_detail: 2,
  recipient_institution: 2,
  child_name: 3,
  bin_binti: 3,
  child_birth_place: 3,
  child_birth_date: 3,
  name: 3,
  phone: 3,
  email: 3,
  referral_code: 4,
};

export function CheckoutForm({
  packages,
  nasiBoxes,
  provinces,
  minDate,
  maxDate,
  initialServiceId,
}: {
  packages: CheckoutPackage[];
  nasiBoxes: NasiBoxPackage[];
  /** Tingkat teratas pemilih alamat; sisanya diambil peramban saat dipilih. */
  provinces: RegionOption[];
  /**
   * Jendela tanggal pemesanan (`YYYY-MM-DD`), dihitung di server dalam WIB.
   *
   * Tidak dihitung di sini: memanggil jam di badan komponen melanggar aturan
   * kemurnian React, dan jam peramban pemesan bisa berada di zona waktu mana
   * saja — sementara batas yang ditegakkan `create_guest_order` selalu WIB.
   */
  minDate: string;
  maxDate: string;
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
  /**
   * Berapa entri riwayat yang sudah kami dorong sendiri.
   *
   * Dipakai `prevStep` untuk memastikan `history.back()` mendarat di langkah
   * sebelumnya, bukan melempar pemesan keluar dari halaman checkout — di entri
   * paling awal tidak ada apa pun milik kami untuk dimundurkan.
   */
  const pushedRef = useRef(0);

  const [draft, setDraft] = useState<Draft>(() =>
    emptyDraft(initialServiceId ?? packages[0]?.id ?? ''),
  );

  /**
   * Draft tersimpan yang ditemukan saat halaman dibuka.
   *
   * `useSyncExternalStore`, bukan `useState` + efek: `sessionStorage` tidak ada
   * saat render di server, dan hook inilah yang memang dirancang untuk sumber
   * data di luar React yang jawabannya berbeda antara server dan klien —
   * snapshot server mengembalikan `null`, jadi hidrasinya tetap cocok.
   */
  const stored = useSyncExternalStore(
    subscribeDraft,
    getDraftSnapshot,
    getDraftServerSnapshot,
  );

  /** Draft yang sudah dijawab pemesan — dipulihkan atau dibuang. */
  const [recoveryHandled, setRecoveryHandled] = useState(false);

  /**
   * Memulihkan draft **ditawarkan, tidak dipaksakan**.
   *
   * Isian ini memuat nama anak dan alamat rumah; memuat ulang halaman lalu
   * mendapati kolom sudah terisi data yang tidak diketahui asalnya lebih
   * meresahkan daripada menolong — terlebih bila perangkatnya dipakai berdua.
   * Jadi bacanya di sini, tapi yang memasangnya klik pemesan.
   *
   * Draft yang berhenti di langkah 1 tidak ditawarkan: pemesan menutup tab
   * sebelum menyelesaikan apa pun, dan menawarkannya hanya menambah satu
   * keputusan yang tidak menyelamatkan pekerjaan siapa pun.
   */
  const recovered = !recoveryHandled && stored && stored.step > 1 ? stored : null;

  /**
   * Patokan "belum disentuh", dipakai menentukan apakah ada yang layak
   * diselamatkan.
   *
   * `useMemo`, bukan ref: nilainya dibaca saat render, dan membaca
   * `ref.current` saat render adalah persis yang dilarang React — hasilnya
   * bisa tidak sejalan dengan apa yang sedang dirender.
   */
  const pristine = useMemo(
    () => JSON.stringify(emptyDraft(initialServiceId ?? packages[0]?.id ?? '')),
    [initialServiceId, packages],
  );
  const isDirty = JSON.stringify(draft) !== pristine;

  /** Simpan tiap kali isian berubah — tanpa tombol "simpan", tanpa diumumkan. */
  useEffect(() => {
    if (done || !isDirty) return;
    saveDraft(draft, currentStep);
  }, [draft, currentStep, done, isDirty]);

  /**
   * Peringatan bawaan peramban sebelum tab ditutup atau dimuat ulang.
   *
   * Jaring terakhir, bukan yang utama — sebagian peramban mengabaikannya bila
   * pemesan belum berinteraksi dengan halaman, dan gestur *back-swipe* di ponsel
   * tidak selalu memicunya. Yang sungguh menyelamatkan isian adalah draft
   * tersimpan di atas; ini hanya memberi kesempatan membatalkan.
   */
  useEffect(() => {
    if (!isDirty || done || pending) return;

    function warn(e: BeforeUnloadEvent) {
      e.preventDefault();
      // Teksnya sendiri tidak pernah tampil — peramban modern selalu memakai
      // kalimatnya sendiri. Yang dibaca hanyalah "event ini dibatalkan".
      e.returnValue = '';
    }

    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty, done, pending]);

  /**
   * Tombol "kembali" peramban memundurkan **langkah**, bukan meninggalkan
   * halaman.
   *
   * Di ponsel, gestur usap-dari-tepi adalah cara paling lazim untuk membatalkan
   * sesuatu. Tanpa ini, gestur itu membuang tiga langkah isian sekaligus — dan
   * `beforeunload` tidak selalu sempat menahannya. Tiap perpindahan langkah
   * menambah satu entri riwayat, jadi "kembali" mendarat di langkah sebelumnya.
   *
   * `window.history` dipakai langsung, bukan `router.push`: panduan Next 16
   * menyatakan `pushState`/`replaceState` sudah terintegrasi dengan router-nya,
   * dan ini tidak berpindah rute — hanya menandai posisi di dalam satu halaman.
   */
  useEffect(() => {
    function onPop(e: PopStateEvent) {
      const state = e.state as { saStep?: number } | null;
      const step = state?.saStep;
      // Entri tanpa penanda kami berarti pemesan sudah memundur melewati
      // seluruh langkah — biarkan peramban meninggalkan halaman seperti biasa.
      if (typeof step !== 'number') return;
      window.clearTimeout(armTimerRef.current);
      submitArmedRef.current = false;
      pushedRef.current = Math.max(0, pushedRef.current - 1);
      setError(null);
      setCurrentStep(Math.min(STEPS.length, Math.max(1, step)));
    }

    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

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
      if (!draft.service_id) errors.service_id = 'Pilih paket terlebih dahulu';
      // Memilih paket box tanpa jumlah berarti tidak ada yang bisa dipesan.
      if (draft.nasi_box_service_id && draft.nasi_box_qty < 1) {
        errors.nasi_box_qty = 'Isi jumlah box, atau pilih "Tidak pakai"';
      }
    } else if (step === 2) {
      // Batasnya dibandingkan sebagai teks: `YYYY-MM-DD` berurut secara
      // leksikografis, jadi tidak perlu mengurai tanggal — sekaligus tidak
      // memperkenalkan zona waktu peramban ke dalam perbandingan.
      if (!draft.requested_date) errors.requested_date = 'Pilih tanggal pelaksanaan';
      else if (draft.requested_date < minDate) {
        errors.requested_date = 'Tanggal pelaksanaan sudah lewat';
      } else if (draft.requested_date > maxDate) {
        errors.requested_date = `Maksimal ${BOOKING_MAX_DAYS} hari ke depan`;
      }

      if (!draft.requested_time) errors.requested_time = 'Pilih jam pelaksanaan';

      if (!draft.distribution_mode) errors.distribution_mode = 'Pilih cara penyaluran';

      if (draft.distribution_mode === 'kirim') {
        const a = draft.delivery;
        if (!a.province_code) errors.delivery_province_code = 'Pilih provinsi tujuan';
        if (!a.city_code) errors.delivery_city_code = 'Pilih kabupaten/kota tujuan';
        if (!a.district_code) errors.delivery_district_code = 'Pilih kecamatan tujuan';
        if (!a.village_code) errors.delivery_village_code = 'Pilih kelurahan/desa tujuan';
        if (!a.postal_code) errors.delivery_postal_code = 'Kode pos wajib diisi';
        else if (!/^[0-9]{5}$/.test(a.postal_code)) {
          errors.delivery_postal_code = 'Kode pos harus 5 digit angka';
        }
        if (!a.detail.trim()) errors.delivery_detail = 'Isi nama jalan dan nomor rumah';
      }
    } else if (step === 3) {
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

      if (draft.child_birth_place.trim().length < 2) {
        errors.child_birth_place = 'Tempat lahir anak wajib diisi';
      }

      // `minDate` di sini dipinjam sebagai "hari ini menurut WIB" — nilainya
      // memang itu (`bookingMinDate()` di server). Tanggal lahir tidak butuh
      // props sendiri selama batas atasnya persis hari ini.
      if (!draft.child_birth_date) errors.child_birth_date = 'Isi tanggal lahir anak';
      else if (draft.child_birth_date > minDate) {
        errors.child_birth_date = 'Tanggal lahir tidak boleh di masa depan';
      } else if (draft.child_birth_date < CHILD_BIRTH_MIN_DATE) {
        errors.child_birth_date = 'Periksa lagi tahun lahirnya';
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
    pushStepHistory(next);
    setCurrentStep(next);
  }

  /**
   * Menandai posisi langkah di riwayat peramban.
   *
   * Entri pertama di-`replaceState` supaya langkah 1 tetap bisa ditinggalkan
   * dengan sekali "kembali" — kalau ikut di-`push`, pemesan yang baru tiba
   * harus menekan "kembali" dua kali untuk keluar dari halaman, dan itu
   * terbaca sebagai halaman yang menyandera.
   */
  function pushStepHistory(next: number) {
    const current = (window.history.state as { saStep?: number } | null)?.saStep;
    if (typeof current !== 'number') {
      // Entri yang sedang ditempati belum bertanda. Tandai dulu dengan langkah
      // sekarang, supaya `popstate` mengenalinya saat pemesan mundur ke sini.
      window.history.replaceState({ ...window.history.state, saStep: currentStep }, '');
    }
    if (next === current) return;
    window.history.pushState({ saStep: next }, '');
    pushedRef.current += 1;
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
   * Di langkah-langkah sebelumnya Enter tetap berguna: dipakai untuk maju. Di
   * langkah terakhir sengaja tidak melakukan apa-apa — mengirim pesanan harus
   * lewat klik yang disengaja.
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

  /**
   * Tombol "Kembali" di layar menempuh jalur yang **sama** dengan tombol
   * kembali peramban: keduanya memundurkan riwayat.
   *
   * Kalau ia hanya menyetel state langsung, tiap kali mundur akan menyisakan
   * entri "maju" yang menganggur — pemesan yang menekan kembali peramban
   * sesudahnya justru terlempar ke langkah yang lebih jauh, bukan lebih dekat.
   * Dengan `history.back()`, penanganan keduanya bertemu di satu tempat
   * (`popstate`) dan tumpukannya tetap runut.
   */
  function prevStep() {
    setError(null);
    if (pushedRef.current > 0) {
      window.history.back();
      return;
    }
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
    for (const step of [1, 2, 3]) {
      if (!validateStep(step)) {
        setCurrentStep(step);
        return;
      }
    }

    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      // Alamat diratakan jadi medan-medan datar, dan **hanya kodenya** yang
      // ikut: nama wilayah dibaca ulang RPC dari `regions`, jadi mengirimnya
      // dari sini hanya membuka celah nama yang tidak cocok dengan kodenya.
      const { delivery, ...rest } = draft;
      const result = await createGuestOrderAction({
        ...rest,
        qty: String(draft.qty),
        delivery_province_code: delivery.province_code,
        delivery_city_code: delivery.city_code,
        delivery_district_code: delivery.district_code,
        delivery_village_code: delivery.village_code,
        delivery_postal_code: delivery.postal_code,
        delivery_detail: delivery.detail,
      });
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
      // Pesanan sudah tercatat di database. Draft-nya harus hilang sekarang
      // juga — kalau tidak, membuka checkout lagi akan menawarkan memulihkan
      // isian pesanan yang **sudah** dikirim, dan pemesan bisa mengirimnya dua
      // kali tanpa merasa melakukan sesuatu yang salah.
      clearDraft();
      setDone(result.data);
    });
  }

  /** Memakai draft yang ditawarkan, lalu menutup tawarannya. */
  function restoreRecovered() {
    if (!recovered) return;
    setDraft(recovered.draft);
    goToStep(Math.min(STEPS.length, recovered.step));
    setRecoveryHandled(true);
  }

  /** Menolak tawaran — draft-nya dibuang, bukan sekadar disembunyikan. */
  function discardRecovered() {
    clearDraft();
    setRecoveryHandled(true);
  }

  if (done) return <SuccessPanel result={done} />;

  const progressPct = (currentStep / STEPS.length) * 100;

  return (
    <div className="mx-auto max-w-3xl">
      {/*
        Kepala wizard.

        Dulu dibingkai sebagai "modal": kartu melayang dengan `shadow-xl`,
        sudut `rounded-3xl`, latar gradasi, dan lencana ✨ "Modal Pemesanan".
        Padahal ini halaman penuh, bukan modal — dan pemesan yang sedang
        mengisi data pembayaran tidak butuh dihibur, ia butuh tahu posisinya.

        Sekarang: garis rambut sebagai pemisah, satu baris status, dan total
        yang selalu terbaca. Sejalan dengan `design.md §1` — clarity over
        decoration.
      */}
      <div className="sticky top-16 z-30 -mx-4 border-b border-neutral-200 bg-white/95 px-4 py-3.5 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm font-medium text-neutral-500">
            Langkah <span className="font-semibold text-neutral-900">{currentStep}</span> dari{' '}
            {STEPS.length}
            <span className="ml-2 hidden text-neutral-400 sm:inline">
              · {STEPS[currentStep - 1]?.title}
            </span>
          </p>
          {/* Total ikut di kepala wizard, bukan hanya di langkah terakhir:
              pemesan mengubah paket & jumlah di langkah 1, jadi di situlah
              angkanya paling dibutuhkan. */}
          <p aria-live="polite" className="text-right text-sm">
            <span className="text-neutral-500">Total </span>
            <span className="font-bold text-neutral-900 tabular-nums">
              {formatCurrency(total)}
            </span>
          </p>
        </div>

        {/* Bilah kemajuan setipis garis — penanda, bukan hiasan. Persentasenya
            sengaja tidak ditulis: "25% Selesai" pada langkah 1 keliru, karena
            beban tiap langkah tidak sama. */}
        <div className="mt-3 h-0.5 w-full bg-neutral-200">
          <div
            className="bg-primary h-full transition-[width] duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Nama langkah, bukan kartu bertumpuk. Di ponsel hanya nomor +
            label pendek; deskripsi panjang di dalam kotak kecil dulu terpotong
            jadi elipsis dan tidak menolong siapa pun. */}
        <nav aria-label="Langkah pemesanan" className="mt-3 flex gap-1">
          {STEPS.map((step) => {
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
                  'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-1.5 py-1.5 text-xs transition-colors sm:justify-start sm:px-2.5',
                  isCurrent
                    ? 'text-primary bg-primary/8 font-semibold'
                    : isPassed
                      ? 'font-medium text-neutral-700 hover:bg-neutral-100'
                      : 'text-neutral-400',
                )}
              >
                {isPassed ? (
                  <Check className="size-3.5 shrink-0 stroke-[2.5]" />
                ) : (
                  <span className="shrink-0 tabular-nums">{step.id}.</span>
                )}
                <span className="truncate">
                  <span className="sm:hidden">{step.shortTitle}</span>
                  <span className="hidden sm:inline">{step.title}</span>
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/*
        Tawaran memulihkan isian yang tertinggal.

        Ditaruh di bawah kepala wizard, bukan sebagai dialog yang menghadang:
        isian yang hilang memang menjengkelkan, tapi tidak cukup genting untuk
        menghalangi orang yang justru datang untuk memesan hal lain.
      */}
      {recovered && (
        <div className="animate-in fade-in mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 duration-300">
          <div className="flex items-start gap-2.5">
            <RotateCcw className="mt-0.5 size-4 shrink-0 text-amber-700" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-900">Lanjutkan isian sebelumnya?</p>
              <p className="mt-1 text-xs leading-5 text-amber-800">
                Kami menemukan pesanan yang belum selesai dari tab ini, tersimpan sampai langkah{' '}
                {recovered.step} ({STEPS[recovered.step - 1]?.title}).
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={restoreRecovered}
                  className="inline-flex min-h-11 items-center rounded-lg bg-amber-700 px-4 text-xs font-semibold text-white transition-colors hover:bg-amber-800 active:bg-amber-900"
                >
                  Lanjutkan
                </button>
                <button
                  type="button"
                  onClick={discardRecovered}
                  className="inline-flex min-h-11 items-center rounded-lg border border-amber-300 bg-white px-4 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100 active:bg-amber-200"
                >
                  Mulai baru
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
        className="p-2 sm:p-4"
      >
        {/* STEP 1: PESANAN — aqiqah untuk, paket & jumlah ekor, nasi box.
            Ketiganya dulu langkah terpisah; disatukan karena masing-masing
            hanya menuntut satu klik dan total tagihannya saling memengaruhi. */}
        {currentStep === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-[420ms] ease-out">
            <div>
              <div className="mb-2.5 flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                <Label className="text-base font-bold text-neutral-900">Aqiqah untuk siapa?</Label>
                <span className="text-xs text-neutral-500">Menentukan anjuran jumlah ekor</span>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {AQIQAH_FOR_OPTIONS.map((opt) => {
                  const active = draft.aqiqah_for === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => pickAqiqahFor(opt.value)}
                      aria-pressed={active}
                      className={cn(
                        'relative flex items-center gap-3 rounded-lg border p-3.5 text-left transition-all duration-200 sm:p-4',
                        active
                          ? 'border-primary bg-primary/5 ring-primary ring-1'
                          : 'border-neutral-200 bg-white hover:border-neutral-400 hover:bg-neutral-50',
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
                <Label className="text-base font-bold text-neutral-900">Pilih Paket</Label>
                <span className="text-xs text-neutral-500">
                  Harga net termasuk olahan &amp; laporan
                </span>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {packages.map((pkg) => {
                  const active = pkg.id === draft.service_id;
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => pickPackage(pkg)}
                      aria-pressed={active}
                      className={cn(
                        'group relative flex flex-col justify-between rounded-lg border p-3.5 text-left transition-all duration-200 sm:p-4',
                        active
                          ? 'border-primary bg-primary/5 ring-primary ring-1'
                          : 'border-neutral-200 bg-white hover:border-neutral-400 hover:bg-neutral-50',
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
                          <p className="mt-1 line-clamp-2 text-xs text-neutral-500">
                            {pkg.description}
                          </p>
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

            <div className="grid gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3.5 sm:gap-6 sm:p-5 sm:grid-cols-2">
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
                <Label className="text-sm font-semibold text-neutral-800">Jumlah Ekor</Label>
                <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white p-1 shadow-sm">
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
                    Anjuran untuk{' '}
                    {draft.aqiqah_for === 'laki_laki' ? 'anak laki-laki' : 'anak perempuan'}:{' '}
                    {RECOMMENDED_QTY[draft.aqiqah_for]} ekor
                  </p>
                )}
                {fieldErrors.qty && <FieldError message={fieldErrors.qty} />}
              </div>
            </div>

            <div className="border-t border-neutral-100 pt-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <Label className="text-base font-bold text-neutral-900">
                  Nasi Box <span className="font-normal text-neutral-400">(opsional)</span>
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
                    'relative rounded-lg border p-4 text-left transition-colors',
                    !draft.nasi_box_service_id
                      ? 'border-primary bg-primary/5 ring-primary ring-1'
                      : 'border-neutral-200 bg-white hover:border-neutral-400 hover:bg-neutral-50',
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
                        'relative rounded-lg border p-4 text-left transition-colors',
                        active
                          ? 'border-primary bg-primary/5 ring-primary ring-1'
                          : 'border-neutral-200 bg-white hover:border-neutral-400 hover:bg-neutral-50',
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
          </div>
        )}

        {/* STEP 2: JADWAL & PENYALURAN */}
        {currentStep === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-5 duration-[420ms] ease-out">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3.5 sm:p-5">
              <div className="mb-2.5 flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                <Label htmlFor="co-date" className="text-base font-bold text-neutral-900">
                  Kapan dilaksanakan? <span className="text-red-500">*</span>
                </Label>
                <span className="text-xs text-neutral-500">
                  Maksimal {BOOKING_MAX_DAYS} hari ke depan
                </span>
              </div>

              <div className="grid gap-4 sm:gap-5 sm:grid-cols-2">
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
                    onChange={(e) => set('requested_date', e.target.value)}
                    className="mt-2 h-11 rounded-xl border-neutral-200 text-sm shadow-sm sm:h-12"
                  />
                  {fieldErrors.requested_date && (
                    <FieldError message={fieldErrors.requested_date} />
                  )}
                </div>

                <div>
                  <Label className="text-sm font-semibold text-neutral-800">Jam</Label>
                  <div id="co-time" className="mt-2 grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
                    {BOOKING_TIME_SLOTS.map((slot) => {
                      const active = draft.requested_time === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => set('requested_time', slot)}
                          aria-pressed={active}
                          className={cn(
                            'flex items-center justify-center rounded-xl border py-2 px-1 text-center text-xs font-semibold tabular-nums transition-all sm:px-3.5',
                            active
                              ? 'border-primary bg-primary/5 text-primary ring-primary ring-1'
                              : 'hover:border-primary/40 border-neutral-200 bg-white text-neutral-700',
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

              <p className="mt-3 text-xs leading-5 text-neutral-500">
                Jadwal ini permintaan Anda. Tim kami mengonfirmasinya lewat WhatsApp sebelum
                ditetapkan — bisa bergeser bila petugas atau lokasi pada jam itu sudah penuh.
              </p>
            </div>

            <div>
              <Label className="mb-2.5 block text-base font-bold text-neutral-900">
                Cara Penyaluran
              </Label>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {DISTRIBUTION_OPTIONS.map((opt) => {
                  const active = draft.distribution_mode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set('distribution_mode', opt.value)}
                      aria-pressed={active}
                      className={cn(
                        'relative rounded-lg border p-4 text-left transition-colors',
                        active
                          ? 'border-primary bg-primary/5 ring-primary ring-1'
                          : 'border-neutral-200 bg-white hover:border-neutral-400 hover:bg-neutral-50',
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
            </div> */}
          </div>
        )}

        {/* STEP 3: DATA PEMESAN */}
        {currentStep === 3 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-[420ms] ease-out">
            {/* <div className="flex items-start gap-2.5 rounded-2xl border border-blue-100 bg-blue-50/50 p-4 text-xs text-blue-900">
              <User className="mt-0.5 size-4 shrink-0 text-blue-600" />
              <span>
                Tim kami menghubungi nomor WhatsApp ini untuk konfirmasi pesanan, bukti transfer,
                dan jadwal pelaksanaan.
              </span>
            </div> */}

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

              <div>
                <Label htmlFor="co-birthplace" className="text-sm font-semibold text-neutral-800">
                  Tempat Lahir <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="co-birthplace"
                  value={draft.child_birth_place}
                  required
                  aria-required
                  aria-invalid={Boolean(fieldErrors.child_birth_place)}
                  placeholder="Mis. Bandung"
                  onChange={(e) => set('child_birth_place', e.target.value)}
                  className="mt-2 h-12 rounded-xl border-neutral-200 text-sm shadow-sm"
                />
                {fieldErrors.child_birth_place && (
                  <FieldError message={fieldErrors.child_birth_place} />
                )}
              </div>

              <div>
                <Label htmlFor="co-birthdate" className="text-sm font-semibold text-neutral-800">
                  Tanggal Lahir <span className="text-red-500">*</span>
                </Label>
                {/* `max` adalah hari ini menurut WIB — `minDate` memang bernilai
                    itu, dihitung di server. Sama seperti pemilih tanggal
                    pelaksanaan, atribut ini cuma membantu peramban; penolakan
                    sungguhannya di `validateStep`, `guestCheckoutSchema`, dan
                    RPC, karena input `date` bisa diisi lewat keyboard. */}
                <Input
                  id="co-birthdate"
                  type="date"
                  min={CHILD_BIRTH_MIN_DATE}
                  max={minDate}
                  value={draft.child_birth_date}
                  required
                  aria-required
                  aria-invalid={Boolean(fieldErrors.child_birth_date)}
                  onChange={(e) => set('child_birth_date', e.target.value)}
                  className="mt-2 h-12 rounded-xl border-neutral-200 text-sm shadow-sm"
                />
                <p className="mt-1.5 text-xs text-neutral-500">
                  Dicetak di sertifikat aqiqah bersama nama anak.
                </p>
                {fieldErrors.child_birth_date && (
                  <FieldError message={fieldErrors.child_birth_date} />
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: RINGKASAN & KONFIRMASI */}
        {currentStep === 4 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-[420ms] ease-out">
            <div className="overflow-hidden rounded-lg border border-neutral-200">
              <div className="border-b border-neutral-100 bg-neutral-50/80 px-5 py-3">
                <p className="text-sm font-bold text-neutral-900">Rincian Pesanan</p>
              </div>

              <dl className="divide-y divide-neutral-100">
                <SummaryRow label="Aqiqah untuk">
                  {draft.aqiqah_for === 'laki_laki' ? 'Anak Laki-laki' : 'Anak Perempuan'}
                </SummaryRow>
                <SummaryRow label="Atas nama">
                  {[draft.child_name, draft.bin_binti].filter(Boolean).join(' ') || '-'}
                  {/* Tempat & tanggal lahir ikut ditampilkan di sini, bukan
                      sebagai barisnya sendiri: keduanya menerangkan anak yang
                      sama, dan inilah kesempatan terakhir pemesan mengoreksi
                      salah ketik sebelum keduanya tercetak di sertifikat. */}
                  {(draft.child_birth_place || draft.child_birth_date) && (
                    <span className="block text-xs text-neutral-500">
                      Lahir di {draft.child_birth_place || '-'}
                      {draft.child_birth_date && `, ${formatDate(draft.child_birth_date)}`}
                    </span>
                  )}
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
                <SummaryRow label="Pelaksanaan">
                  {formatDate(draft.requested_date)}
                  {draft.requested_time && ` · ${draft.requested_time} WIB`}
                  <span className="block text-xs text-neutral-500">
                    Menunggu konfirmasi tim kami
                  </span>
                </SummaryRow>
                <SummaryRow label="Penyaluran">
                  {draft.distribution_mode === 'kirim' ? 'Aqiqah Kirim' : 'Aqiqah Salur'}
                  {/* Bagian alamat ditampilkan terpisah, tidak dirangkai jadi
                      satu baris. Bentuk satu barisnya dirakit `create_guest_order`
                      dan hanya di sana — merakitnya lagi di sini berarti dua
                      tempat menyusun teks yang sama dengan hasil bisa berbeda. */}
                  {draft.distribution_mode === 'kirim' && draft.delivery.village_code && (
                    <span className="mt-1 block text-xs leading-5 text-neutral-500">
                      {draft.delivery.detail}
                      <br />
                      Kel. {draft.delivery.village_name}, Kec. {draft.delivery.district_name}
                      <br />
                      {draft.delivery.city_name}, {draft.delivery.province_name}{' '}
                      {draft.delivery.postal_code}
                    </span>
                  )}
                </SummaryRow>
                <SummaryRow label="Pemesan">
                  {draft.name}
                  <span className="block text-xs text-neutral-500">
                    {draft.phone} · {draft.email}
                  </span>
                </SummaryRow>
              </dl>

              <div className="bg-primary/5 flex items-center justify-between border-b border-neutral-200 px-5 py-3.5">
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
        <div className="mt-6 flex items-center justify-between gap-2 border-t border-neutral-100 pt-4 sm:mt-8 sm:pt-6">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={prevStep}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-neutral-700 shadow-sm transition-all hover:bg-neutral-50 sm:gap-1.5 sm:px-5 sm:py-3"
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
              className="bg-primary hover:bg-primary-dark active:bg-primary-dark inline-flex items-center justify-center gap-1.5 rounded-lg px-5 py-3 text-sm font-semibold text-white transition-colors sm:px-6"
            >
              Lanjut ke {STEPS[currentStep].title} <ChevronRight className="size-4 shrink-0" />
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
              className="bg-primary hover:bg-primary-dark active:bg-primary-dark inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:px-7 sm:py-3.5"
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
    <div className="mx-auto max-w-xl overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-6 py-8 text-center sm:px-8">
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
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3.5">
          <dt className="text-[11px] font-medium text-neutral-500 uppercase">Nomor Pesanan</dt>
          <dd className="mt-1 text-lg font-extrabold tracking-tight text-neutral-900 tabular-nums">
            {result.order_number}
          </dd>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3.5">
          <dt className="text-[11px] font-medium text-neutral-500 uppercase">Total Tagihan</dt>
          <dd className="text-primary mt-1 text-lg font-extrabold tracking-tight tabular-nums">
            {formatCurrency(result.total_amount)}
          </dd>
        </div>
      </dl>

      <div className="border-t border-neutral-100 px-6 py-6 sm:px-8">
        <Link
          href="/"
          className="inline-flex w-full items-center justify-center rounded-lg bg-neutral-900 px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
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
