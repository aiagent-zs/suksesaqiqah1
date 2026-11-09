'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { RotateCcw } from 'lucide-react';
import { Toast, type ToastState } from '@/components/ui/toast';
import { formatDate } from '@/lib/format';
import { ANIMAL_SPECIES_LABEL } from '@/lib/constants/order';
import { siteConfig } from '@/lib/constants/site';
import { createGuestOrderAction } from '@/server/actions/checkout';
import { orderWhatsAppMessage } from '../order-message';
import {
  BOOKING_MAX_DAYS,
  BOOKING_MIN_DAYS,
  CHILD_BIRTH_MIN_DATE,
  SPECIES_BY_SERVICE_TYPE,
  guestCheckoutSchema,
  issueOf,
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
import { StepCatatan } from './steps/step-catatan';
import { CheckoutSection, SubmitBar } from './steps/checkout-section';
import { SuccessPanel } from './steps/success-panel';
import { OrderAside } from './steps/order-aside';
import { ErrorSummary } from './steps/error-summary';

/**
 * Anjuran jumlah ekor per jenis kelamin — anjuran, bukan paksaan: pemesan tetap
 * bebas mengubahnya sesudahnya.
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

/**
 * Bagian tempat tiap medan tinggal, untuk mengurutkan galat sesuai urutan di
 * layar. Server memvalidasi seluruh payload sekaligus dan tidak tahu soal
 * bagian, jadi urutannya ditentukan di sini.
 */
const FIELD_SECTION: Record<string, number> = {
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
  brandName = 'Sukses Aqiqah',
}: {
  /** Nama merek kanal masuk, untuk sapaan pesan WhatsApp ke admin. */
  brandName?: string;
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
  /**
   * Pemberitahuan sekilas di pojok layar.
   *
   * `id` yang naik tiap kali, bukan sekadar pesannya: menekan kirim dua kali
   * dengan kesalahan yang sama harus memunculkan toast lagi. Kalau kuncinya
   * pesan, React melihat nilai yang sama dan tidak menganimasikan apa pun —
   * pemesan menekan tombol dan tampak tidak terjadi apa-apa.
   */
  const [toast, setToast] = useState<ToastState>(null);
  const toastSeq = useRef(0);

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
   * Draft yang baru berisi pilihan paket tidak ditawarkan: memilih paket ulang
   * hanya satu klik, dan menawarkannya menambah satu keputusan yang tidak
   * menyelamatkan pekerjaan siapa pun. Yang layak diselamatkan adalah isian
   * ketikan: jadwal, kontak, dan data anak.
   */
  const recovered = !recoveryHandled && stored && hasTypedWork(stored.draft) ? stored : null;

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
    // Langkah selalu 1: formnya kini satu halaman. Medannya tetap ada supaya
    // bentuk draft di `sessionStorage` tidak berubah.
    saveDraft(draft, 1);
  }, [draft, done, isDirty]);

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

  // Jumlah yang akan ditolak server tidak pernah ikut dihitung: total yang
  // tampil untuk 2,5 box atau 99999 box adalah angka yang tidak bisa dipesan.
  const qtyIssue = issueOf(guestCheckoutSchema.shape.qty, draft.qty);
  const boxQtyIssue = issueOf(guestCheckoutSchema.shape.nasi_box_qty, draft.nasi_box_qty);
  const packageSubtotal = selected && !qtyIssue ? selected.price * draft.qty : 0;
  const boxSubtotal = selectedBox && !boxQtyIssue ? selectedBox.price * draft.nasi_box_qty : 0;
  const total = packageSubtotal + boxSubtotal;

  /**
   * Memilih jenis kelamin ikut menyetel anjuran jumlah ekor (2 laki-laki,
   * 1 perempuan). Hanya anjuran — pemesan bebas mengubahnya sesudahnya.
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
   * Seluruh isian yang ditolak, dari bagian pertama sampai terakhir.
   *
   * Aturannya sengaja dibuat sama ketat dengan `guestCheckoutSchema`, bukan
   * sekadar "tidak kosong": nomor telepon ngawur harus ditolak di sini, di
   * samping medannya, bukan dikembalikan server sesudah pesanan dikirim.
   * Semua bagian diperiksa sekaligus — form ini satu halaman, jadi pemesan
   * melihat seluruh yang kurang dalam satu kali tekan, bukan satu per satu.
   */
  function collectErrors(): Record<string, string> {
    const errors: Record<string, string> = {};

    // 1 · Pesanan
    if (!draft.aqiqah_for) errors.aqiqah_for = 'Pilih salah satu terlebih dahulu';
    if (!draft.service_id) errors.service_id = 'Pilih paket terlebih dahulu';
    if (qtyIssue) errors.qty = qtyIssue;
    // Memilih paket box tanpa jumlah berarti tidak ada yang bisa dipesan.
    // Selebihnya (pecahan, negatif, di atas batas) memakai medan zod server.
    if (draft.nasi_box_service_id) {
      if (!draft.nasi_box_qty) errors.nasi_box_qty = 'Isi jumlah box, atau pilih "Tidak pakai"';
      else if (boxQtyIssue) errors.nasi_box_qty = boxQtyIssue;
    }

    // 2 · Jadwal & penyaluran. Batas tanggal dibandingkan sebagai teks:
    // `YYYY-MM-DD` berurut secara leksikografis, jadi tidak perlu mengurai
    // tanggal — sekaligus tidak membawa zona waktu peramban ke perbandingan.
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

    // 3 · Data pemesan & anak
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

    return errors;
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
   * Bawa perhatian ke satu medan: gulir ke sana, lalu fokuskan.
   *
   * Dipakai dua jalur — melompat otomatis ke galat pertama, dan menekan satu
   * baris di ringkasan galat. Keduanya harus berperilaku persis sama.
   */
  function jumpToField(field: string) {
    const anchor = FIELD_ANCHOR[field];
    if (!anchor) return;
    // Jeda kecil: pesan galatnya baru dirender sesudah `setFieldErrors`, dan
    // posisi medan bisa bergeser karenanya.
    window.setTimeout(() => {
      const el = document.getElementById(anchor);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (el as HTMLElement | null)?.focus({ preventScroll: true });
    }, 80);
  }

  /**
   * Bawa perhatian ke medan pertama yang bermasalah, menurut urutan bagian di
   * layar — bukan urutan kunci objek galat, yang bisa menaruh medan bagian 3
   * di depan medan bagian 1.
   */
  function focusFirstError(errors: Record<string, string>) {
    const first = Object.keys(errors)
      .filter((key) => FIELD_ANCHOR[key])
      .sort((a, b) => (FIELD_SECTION[a] ?? 99) - (FIELD_SECTION[b] ?? 99))[0];
    if (first) jumpToField(first);
  }

  /**
   * Menahan pengiriman implisit oleh tombol Enter.
   *
   * Form dengan satu tombol submit akan terkirim begitu Enter ditekan di
   * sembarang `<input>` — dan pesanan langsung tercatat tanpa pemesan pernah
   * menekan tombol kirim. Textarea butuh Enter untuk baris baru, dan tombol
   * punya perilakunya sendiri, jadi keduanya dibiarkan.
   */
  function handleEnterKey(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key !== 'Enter') return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') return;
    e.preventDefault();
  }

  function submit() {
    const errors = collectErrors();
    setFieldErrors(errors);
    const count = Object.keys(errors).length;
    if (count > 0) {
      showErrorToast(count);
      focusFirstError(errors);
      return;
    }

    setError(null);
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
        const n = Object.keys(fields).length;
        setToast({
          id: toastSeq.current,
          tone: 'error',
          message:
            n > 0
              ? n === 1
                ? '1 isian perlu diperbaiki'
                : `${n} isian perlu diperbaiki`
              : result.error.message,
        });
        focusFirstError(fields);
        return;
      }
      // Pesanan sudah tercatat di database. Draft-nya harus hilang sekarang
      // juga — kalau tidak, membuka checkout lagi akan menawarkan memulihkan
      // isian pesanan yang **sudah** dikirim, dan pemesan bisa mengirimnya dua
      // kali tanpa merasa melakukan sesuatu yang salah.
      clearDraft();
      setDone(result.data);
      window.scrollTo({ top: 0 });
    });
  }

  /** Memakai draft yang ditawarkan, lalu menutup tawarannya. */
  function restoreRecovered() {
    if (!recovered) return;
    setDraft(recovered.draft);
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
        phone={draft.phone}
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
            brandName,
          }),
        )}
      />
    );

  const speciesLabel =
    ANIMAL_SPECIES_LABEL[draft.species as keyof typeof ANIMAL_SPECIES_LABEL] ?? 'ekor';

  return (
    // Dua kolom di desktop: isian kiri, tagihan menempel kanan. Kolom kanan
    // hilang di bawah `lg`; totalnya tetap di bilah kirim bawah.
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-10">
      <div className="min-w-0">
        {/*
          Tawaran memulihkan isian yang tertinggal. Di atas form, bukan dialog
          yang menghadang: isian yang hilang memang menjengkelkan, tapi tidak
          cukup genting untuk menghalangi orang yang datang memesan hal lain.
        */}
        {recovered && (
          <div className="animate-in fade-in mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 duration-300">
            <div className="flex items-start gap-2.5">
              <RotateCcw className="mt-0.5 size-4 shrink-0 text-amber-700" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-900">Lanjutkan isian sebelumnya?</p>
                <p className="mt-1 text-xs leading-5 text-amber-800">
                  Kami menemukan pesanan yang belum selesai dari tab ini.
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

        <form
          // Pengiriman form TIDAK PERNAH mencatat pesanan. Jalur satu-satunya
          // adalah klik tombol kirim; submit implisit (Enter, autofill) diam.
          onSubmit={(e) => e.preventDefault()}
          onKeyDown={handleEnterKey}
          noValidate
          className="space-y-4"
        >
          <CheckoutSection
            id="bagian-pesanan"
            index={1}
            done={Boolean(draft.aqiqah_for && draft.service_id && !qtyIssue)}
            title="Pesanan"
          >
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
          </CheckoutSection>

          <CheckoutSection
            id="bagian-jadwal"
            index={2}
            done={Boolean(draft.requested_date && draft.requested_time && draft.distribution_mode)}
            title="Jadwal & penyaluran"
            hint="Jadwal ini masih permintaan. Tim kami mengonfirmasinya lewat WhatsApp."
          >
            <StepJadwal
              draft={draft}
              set={set}
              fieldErrors={fieldErrors}
              provinces={provinces}
              minDate={minDate}
              maxDate={maxDate}
            />
          </CheckoutSection>

          <CheckoutSection
            id="bagian-data"
            index={3}
            done={Boolean(
              draft.name &&
              draft.phone &&
              draft.email &&
              draft.child_name &&
              draft.child_birth_place &&
              draft.child_birth_date,
            )}
            title="Data pemesan & anak"
            hint="Kontak Anda dipakai untuk konfirmasi. Data anak dicetak di sertifikat aqiqah."
          >
            <StepDataPemesan draft={draft} set={set} fieldErrors={fieldErrors} today={today} />
          </CheckoutSection>

          <CheckoutSection id="bagian-catatan" index={4} done={false} title="Catatan & kirim">
            <StepCatatan draft={draft} set={set} fieldErrors={fieldErrors} error={error} />
          </CheckoutSection>

          {/* Ringkasan galat tepat di atas tombol kirim: di situlah mata pemesan
              berada saat tombolnya ditolak. Tiap baris melompat ke medannya. */}
          <ErrorSummary errors={fieldErrors} labels={FIELD_LABEL} onJump={jumpToField} />

          <SubmitBar
            total={total}
            status={
              selected && packageSubtotal > 0
                ? `${selected.name}, ${draft.qty} ${speciesLabel}`
                : 'Total'
            }
            pending={pending}
            disabled={!selected}
            onSubmit={submit}
          />
        </form>

        {/* Di luar <form> supaya tombol tutupnya tidak pernah ikut terbaca
            sebagai kontrol form, dan `fixed`-nya tidak terpengaruh transform
            milik pembungkus mana pun. */}
        <Toast state={toast} onDismiss={() => setToast(null)} />
      </div>
      <OrderAside
        lines={[
          ...(selected && packageSubtotal > 0
            ? [
                {
                  label: selected.name,
                  detail: `${draft.qty} ${speciesLabel}`,
                  amount: packageSubtotal,
                },
              ]
            : []),
          ...(selectedBox && boxSubtotal > 0
            ? [
                {
                  label: selectedBox.name,
                  detail: `${draft.nasi_box_qty} box`,
                  amount: boxSubtotal,
                },
              ]
            : []),
        ]}
        total={total}
        empty="Pilih paket untuk melihat tagihannya."
        brandName={brandName}
      />
    </div>
  );
}

/** Isian ketikan yang layak ditawarkan kembali (lihat `recovered`). */
function hasTypedWork(d: Draft): boolean {
  return Boolean(
    d.requested_date || d.name || d.phone || d.email || d.child_name || d.delivery.detail,
  );
}
