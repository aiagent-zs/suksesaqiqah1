'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  Package,
  RotateCcw,
  User,
} from 'lucide-react';
import { Toast, type ToastState } from '@/components/ui/toast';
import { formatDate } from '@/lib/format';
import { siteConfig } from '@/lib/constants/site';
import { createGuestOrderAction } from '@/server/actions/checkout';
import { orderWhatsAppMessage } from '../order-message';
import {
  BOOKING_MAX_DAYS,
  BOOKING_MIN_DAYS,
  CHILD_BIRTH_MIN_DATE,
  SPECIES_BY_SERVICE_TYPE,
} from '../schema';
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
import { StepPesanan } from './steps/step-pesanan';
import { StepJadwal } from './steps/step-jadwal';
import { StepDataPemesan } from './steps/step-data-pemesan';
import { StepRingkasan } from './steps/step-ringkasan';
import { StepHeader } from './steps/step-header';
import { SuccessPanel } from './steps/success-panel';
import { ErrorSummary } from './steps/error-summary';

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
  {
    id: 1,
    title: 'Pesanan',
    shortTitle: 'Pesanan',
    icon: Package,
    description: 'Paket, jumlah ekor, nasi box',
  },
  {
    id: 2,
    title: 'Jadwal & Penyaluran',
    shortTitle: 'Jadwal',
    icon: CalendarClock,
    description: 'Tanggal, jam, cara kirim',
  },
  {
    id: 3,
    title: 'Data Pemesan',
    shortTitle: 'Data',
    icon: User,
    description: 'Kontak & nama anak',
  },
  {
    id: 4,
    title: 'Ringkasan',
    shortTitle: 'Ringkasan',
    icon: ClipboardCheck,
    description: 'Periksa lalu konfirmasi',
  },
];

/**
 * Anjuran jumlah ekor per jenis kelamin — anjuran, bukan paksaan: pemesan tetap
 * bebas mengubahnya di tahap berikutnya.
 */
const RECOMMENDED_QTY: Record<string, number> = { laki_laki: 2, perempuan: 1 };

/**
 * Peta nama medan → id elemennya, dipakai untuk melompat ke medan yang ditolak.
 * Kunci di sisi kiri mengikuti nama yang dikembalikan `validationError` dari
 * server, sehingga galat dari zod maupun dari `validateStep` sama-sama tertaut.
 */
const FIELD_ANCHOR: Record<string, string> = {
  // Empat yang pertama menunjuk pembungkus grup tombol, bukan `<input>`.
  // Sebelumnya keempatnya tidak ada di peta sama sekali, jadi galatnya tidak
  // pernah bisa dilompati — dan ringkasan galat yang bisa diklik menjadikan
  // celah itu terlihat: barisnya ada, tapi menekannya tidak membawa ke mana pun.
  aqiqah_for: 'co-aqiqahfor',
  service_id: 'co-service',
  qty: 'co-qty',
  distribution_mode: 'co-distribution',
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

/**
 * Nama medan yang layak dibaca orang, untuk ringkasan galat.
 *
 * Tanpa ini barisnya berbunyi "delivery_village_code — wajib diisi", yang
 * menuntut pemesan menebak medan mana yang dimaksud.
 */
const FIELD_LABEL: Record<string, string> = {
  aqiqah_for: 'Aqiqah untuk',
  service_id: 'Paket',
  species: 'Jenis hewan',
  qty: 'Jumlah ekor',
  nasi_box_service_id: 'Paket nasi box',
  nasi_box_qty: 'Jumlah nasi box',
  requested_date: 'Tanggal pelaksanaan',
  requested_time: 'Jam pelaksanaan',
  distribution_mode: 'Cara penyaluran',
  delivery_province_code: 'Provinsi tujuan',
  delivery_city_code: 'Kabupaten/kota tujuan',
  delivery_district_code: 'Kecamatan tujuan',
  delivery_village_code: 'Kelurahan/desa tujuan',
  delivery_postal_code: 'Kode pos',
  delivery_detail: 'Alamat lengkap',
  recipient_institution: 'Instansi penerima',
  child_name: 'Nama anak',
  bin_binti: 'Bin / Binti',
  child_birth_place: 'Tempat lahir anak',
  child_birth_date: 'Tanggal lahir anak',
  name: 'Nama pemesan',
  phone: 'Nomor WhatsApp',
  email: 'Email',
  referral_code: 'Kode referral',
  notes: 'Catatan',
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
  today,
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
   *
   * `minDate` sudah memuat jeda persiapan (`BOOKING_MIN_DAYS`), jadi ia **bukan**
   * hari ini. Yang butuh hari ini memakai `today`.
   */
  minDate: string;
  maxDate: string;
  /**
   * Hari ini menurut WIB — batas atas tanggal lahir anak.
   *
   * Dulu `minDate` dipinjam untuk peran ini karena nilainya kebetulan sama.
   * Sejak ada jeda persiapan keduanya berbeda `BOOKING_MIN_DAYS` hari, dan
   * meminjamnya lagi berarti meloloskan tanggal lahir yang belum terjadi.
   */
  today: string;
  initialServiceId?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<GuestOrderResult | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(1);
  /**
   * Pemberitahuan sekilas di pojok layar.
   *
   * `id` yang naik tiap kali, bukan sekadar pesannya: menekan "Lanjut" dua kali
   * dengan kesalahan yang sama harus memunculkan toast lagi. Kalau kuncinya
   * pesan, React melihat nilai yang sama dan tidak menganimasikan apa pun —
   * pemesan menekan tombol dan tampak tidak terjadi apa-apa.
   */
  const [toast, setToast] = useState<ToastState>(null);
  const toastSeq = useRef(0);
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
  const stored = useSyncExternalStore(subscribeDraft, getDraftSnapshot, getDraftServerSnapshot);

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
      else if (draft.requested_date < today) {
        errors.requested_date = 'Tanggal pelaksanaan sudah lewat';
      } else if (draft.requested_date < minDate) {
        errors.requested_date = `Paling cepat ${BOOKING_MIN_DAYS} hari setelah pemesanan (${formatDate(minDate)})`;
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

      if (!draft.child_birth_date) errors.child_birth_date = 'Isi tanggal lahir anak';
      else if (draft.child_birth_date > today) {
        errors.child_birth_date = 'Tanggal lahir tidak boleh di masa depan';
      } else if (draft.child_birth_date < CHILD_BIRTH_MIN_DATE) {
        errors.child_birth_date = 'Periksa lagi tahun lahirnya';
      }
    }

    setFieldErrors(errors);
    const count = Object.keys(errors).length;
    if (count > 0) {
      showErrorToast(count);
      focusFirstError(errors);
      return false;
    }
    return true;
  }

  /**
   * Munculkan toast penolakan.
   *
   * Jumlahnya disebut, bukan sekadar "ada yang salah": pemesan yang tahu
   * tinggal dua medan akan memperbaikinya, yang tidak tahu berapa cenderung
   * mengira formnya rusak.
   */
  function showErrorToast(count: number) {
    toastSeq.current += 1;
    setToast({
      id: toastSeq.current,
      tone: 'error',
      message: count === 1 ? '1 isian perlu diperbaiki' : `${count} isian perlu diperbaiki`,
    });
  }

  /**
   * Bawa perhatian ke satu medan: pindah langkah bila perlu, gulir ke sana,
   * lalu fokuskan.
   *
   * Dipakai dua jalur — melompat otomatis ke galat pertama, dan menekan satu
   * baris di ringkasan galat. Keduanya harus berperilaku persis sama, jadi
   * keduanya lewat sini.
   */
  function jumpToField(field: string) {
    const step = FIELD_STEP[field];
    if (step && step !== currentStep) setCurrentStep(step);

    const anchor = FIELD_ANCHOR[field];
    if (!anchor) return;

    // Jeda kecil, bukan rAF: medannya bisa berada di langkah lain yang baru
    // akan dirender setelah `setCurrentStep`. rAF kerap menyala sebelum React
    // sempat memasangnya, sehingga elemennya belum ada saat dicari.
    window.setTimeout(() => {
      const el = document.getElementById(anchor);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (el as HTMLElement | null)?.focus({ preventScroll: true });
    }, 80);
  }

  /**
   * Bawa perhatian ke medan pertama yang bermasalah. Tanpa ini pesan galat bisa
   * berada di luar layar dan tombol "Lanjut" tampak tidak merespons.
   *
   * Urutannya mengikuti `FIELD_STEP` lalu `FIELD_ANCHOR`, bukan urutan kunci
   * pada objek galat — yang terakhir itu urutan penyisipan, dan bisa menaruh
   * medan langkah 3 di depan medan langkah 1.
   */
  function focusFirstError(errors: Record<string, string>) {
    const first = Object.keys(errors)
      .filter((key) => FIELD_ANCHOR[key])
      .sort((a, b) => (FIELD_STEP[a] ?? 99) - (FIELD_STEP[b] ?? 99))[0];
    if (!first) return;
    jumpToField(first);
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

        // Penolakan dari server kerap datang tanpa rincian per medan (rem laju,
        // paket keburu dinonaktifkan). Toast-nya harus tetap muncul — dan yang
        // dibacakan pesan dari server, bukan hitungan medan yang nol.
        toastSeq.current += 1;
        const count = Object.keys(fields).length;
        setToast({
          id: toastSeq.current,
          tone: 'error',
          message:
            count > 0
              ? count === 1
                ? '1 isian perlu diperbaiki'
                : `${count} isian perlu diperbaiki`
              : result.error.message,
        });

        // Server memvalidasi seluruh payload sekaligus dan tidak tahu soal
        // langkah. `focusFirstError` yang memindahkan langkahnya lewat
        // `jumpToField`, jadi tidak ada lagi perpindahan terpisah di sini —
        // dulu keduanya menghitung langkah dengan cara berbeda.
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

  if (done)
    return (
      <SuccessPanel
        orderNumber={done.order_number}
        total={done.total_amount}
        paymentUrl={done.payment_url ?? null}
        waHref={siteConfig.whatsapp.href(
          orderWhatsAppMessage({
            orderNumber: done.order_number,
            totalAmount: done.total_amount,
            packageName: selected?.name ?? null,
            qty: draft.qty,
            boxName: selectedBox?.name ?? null,
            boxQty: draft.nasi_box_qty,
            requestedDate: draft.requested_date,
            requestedTime: draft.requested_time,
            distributionMode: draft.distribution_mode,
            customerName: draft.name,
          }),
        )}
      />
    );

  return (
    <div className="mx-auto max-w-3xl">
      <StepHeader
        steps={STEPS}
        current={currentStep}
        total={total}
        onJump={(id) => {
          if (id < currentStep || validateStep(currentStep)) goToStep(id);
        }}
      />

      {/* Ringkasan galat: menetap di atas form, tiap baris melompat ke medannya.
          Ditaruh sebelum tawaran pemulihan karena galat lebih mendesak — yang
          satu menghalangi pemesan melanjutkan, yang satu cuma menawarkan. */}
      <ErrorSummary errors={fieldErrors} labels={FIELD_LABEL} onJump={jumpToField} />

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
          <StepPesanan
            draft={draft}
            set={set}
            fieldErrors={fieldErrors}
            packages={packages}
            nasiBoxes={nasiBoxes}
            selectedBox={selectedBox}
            speciesOptions={speciesOptions}
            boxSubtotal={boxSubtotal}
            pickPackage={pickPackage}
            pickAqiqahFor={pickAqiqahFor}
          />
        )}

        {/* STEP 2: JADWAL & PENYALURAN */}
        {currentStep === 2 && (
          <StepJadwal
            draft={draft}
            set={set}
            fieldErrors={fieldErrors}
            provinces={provinces}
            minDate={minDate}
            maxDate={maxDate}
          />
        )}

        {/* STEP 3: DATA PEMESAN */}
        {currentStep === 3 && (
          <StepDataPemesan draft={draft} set={set} fieldErrors={fieldErrors} today={today} />
        )}

        {/* STEP 4: RINGKASAN & KONFIRMASI */}
        {currentStep === 4 && (
          <StepRingkasan
            draft={draft}
            set={set}
            fieldErrors={fieldErrors}
            selected={selected}
            selectedBox={selectedBox}
            packageSubtotal={packageSubtotal}
            boxSubtotal={boxSubtotal}
            total={total}
            error={error}
          />
        )}

        {/* Modal Controls / Navigation Bar */}
        <div className="mt-6 flex items-center justify-between gap-2 border-t border-neutral-100 pt-4 sm:mt-8 sm:pt-6">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={prevStep}
              className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-neutral-300 bg-white px-3.5 text-xs font-semibold text-neutral-700 shadow-sm transition-all hover:bg-neutral-50 active:scale-[0.98] sm:gap-1.5 sm:px-5"
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
              className="bg-primary hover:bg-primary-dark active:bg-primary-dark inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow active:scale-[0.98] sm:px-6"
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
              className="bg-primary hover:bg-primary-dark active:bg-primary-dark inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-6 text-sm font-semibold text-white shadow-sm transition-all hover:shadow active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 sm:min-h-12 sm:px-7"
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              {pending ? 'Mengirim pesanan…' : 'Konfirmasi & Kirim Pesanan'}
            </button>
          )}
        </div>
      </form>

      {/* Di luar <form> supaya tombol tutupnya tidak pernah ikut terbaca
          sebagai kontrol form, dan `fixed`-nya tidak terpengaruh transform
          milik pembungkus mana pun. */}
      <Toast state={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
