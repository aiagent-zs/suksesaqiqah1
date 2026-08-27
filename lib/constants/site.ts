/**
 * Konfigurasi situs publik Sukses Aqiqah.
 *
 * Nilai kontak (WhatsApp, Instagram) diambil dari environment variable
 * sesuai 27_PAGE_MENU — JANGAN hardcode nomor/URL di komponen.
 * Fallback dipakai agar halaman tetap tampil saat env belum diisi (dev).
 */

const rawWhatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '6281234567890';
// Normalisasi: buang karakter non-digit agar aman untuk link wa.me.
const whatsappNumber = rawWhatsapp.replace(/[^0-9]/g, '');

export const siteConfig = {
  name: 'Sukses Aqiqah',
  tagline: 'Tunaikan Ibadah, Tebarkan Manfaat',
  /**
   * Qurban sengaja tidak disebut di seluruh materi pemasaran (21 Agustus 2026).
   * Checkout hanya melayani aqiqah, jadi memasarkan Qurban berarti mengarahkan
   * pengunjung ke tawaran yang tidak bisa dipesan. Enum `service_type` dan
   * `SPECIES_BY_SERVICE_TYPE` di sisi kode **tetap** menyimpan qurban — yang
   * dicabut adalah pemasarannya, bukan kemampuannya.
   */
  description:
    'Layanan Aqiqah dan Sedekah Daging yang syar’i, amanah, dan terdokumentasi. ' +
    'Pantau setiap tahap secara real-time dan terima laporan transparan tanpa perlu bertanya.',
  url: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'halo@zakatsukses.org',
  instagram: {
    handle: '@zakatsukses',
    url: process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? 'https://instagram.com/zakatsukses',
  },
  whatsapp: {
    number: whatsappNumber,
    display: `+${whatsappNumber}`,
    href: (message?: string) =>
      `https://wa.me/${whatsappNumber}${message ? `?text=${encodeURIComponent(message)}` : ''}`,
  },
} as const;

/** Menu navigasi utama (anchor ke section di landing). */
/**
 * Menu navigasi utama (anchor ke section di landing).
 *
 * Urutannya mengikuti urutan section di halaman, jadi menu ini sekaligus jadi
 * daftar isi. "Keunggulan" sengaja tidak masuk meski sectionnya ada: ia berisi
 * klaim, sementara lima butir di bawah membawa pengunjung ke hal yang bisa
 * diperiksa sendiri — dan header hanya menyisakan ruang untuk lima.
 */
export const primaryNav = [
  { label: 'Layanan', href: '#layanan' },
  { label: 'Paket', href: '#paket' },
  { label: 'Proses', href: '#proses' },
  { label: 'Galeri', href: '#galeri' },
  { label: 'FAQ', href: '#faq' },
] as const;

/** Menu footer sesuai 27_PAGE_MENU. */
export const footerNav = {
  layanan: [
    { label: 'Proses', href: '/proses' },
    { label: 'Paket', href: '/paket' },
    { label: 'Galeri', href: '/galeri' },
  ],
  bantuan: [
    { label: 'FAQ', href: '/faq' },
    { label: 'Syarat Layanan', href: '/syarat-layanan' },
    { label: 'Kebijakan Privasi', href: '/kebijakan-privasi' },
  ],
} as const;

/**
 * Layanan inti (01_PROJECT_VISION).
 *
 * Qurban dicabut 21 Agustus 2026 — checkout hanya melayani aqiqah, jadi
 * memasarkannya berarti menjanjikan yang tidak bisa dipesan. Ikonnya
 * (`IconQurban`) sengaja dibiarkan hidup di `components/site/icons.tsx`: yang
 * berubah adalah keputusan pemasaran, dan ikon itu akan dibutuhkan lagi utuh
 * ketika Qurban dibuka.
 */
export const services = [
  {
    icon: 'aqiqah',
    title: 'Aqiqah Kirim',
    description:
      'Masakan aqiqah diantar langsung ke alamat Anda, siap disajikan untuk keluarga dan tetangga. Anda mengonfirmasi sendiri saat pesanan sampai.',
  },
  {
    icon: 'sedekah',
    title: 'Aqiqah Salur',
    description:
      'Daging aqiqah disalurkan tim kami kepada penghafal Qur’an dan dhuafa, lengkap dengan bukti penyaluran yang bisa Anda telusuri.',
  },
  {
    icon: 'aqiqah',
    title: 'Nasi Box Aqiqah',
    description:
      'Berbagi kebahagiaan aqiqah dalam bentuk nasi box siap saji — dipesan bersama paket aqiqah Anda lewat tim kami.',
  },
] as const;

/* ------------------------------------------------------------------ */
/* Foto landing                                                        */
/* ------------------------------------------------------------------ */
/**
 * Seluruh foto landing didaftarkan di sini — satu tempat untuk melihat berkas
 * apa saja yang ditunggu, tanpa menyisir komponen satu per satu.
 *
 * Selama berkasnya belum ada di `public/`, `<SitePhoto>` merender kotak abu
 * bertuliskan path yang diharapkan. Jadi menambahkan foto **cukup dengan
 * menaruh berkasnya di path yang tertulis** — tidak ada kode yang perlu diubah.
 *
 * Ukuran `width`/`height` menentukan rasio kotak placeholder dan mencegah
 * pergeseran tata letak saat gambar sungguhan masuk. Foto boleh beresolusi
 * lebih besar dari angka ini — yang penting **rasionya sama**, kalau tidak
 * gambarnya akan terpotong oleh `object-cover`.
 */
export const landingPhotos = {
  /** Foto utama di hero. Lanskap; wajah/objek penting jangan di tepi bawah. */
  hero: {
    src: 'images/landing/hero.webp',
    alt: 'Tim Sukses Aqiqah menyiapkan pesanan aqiqah',
    width: 1200,
    height: 900,
  },
  /**
   * Galeri dokumentasi — enam foto berurutan mengikuti tahapan sungguhan di
   * sistem (`fulfilment_sequence`), supaya yang dilihat pengunjung di landing
   * sama dengan yang nanti ia terima di laporan pelaksanaan.
   */
  gallery: [
    {
      src: 'images/landing/galeri-1-persiapan.webp',
      alt: 'Pemeriksaan kesehatan kambing sebelum disembelih',
      caption: 'Persiapan & pemeriksaan hewan',
    },
    {
      src: 'images/landing/galeri-2-sembelih.webp',
      alt: 'Proses penyembelihan sesuai syariat',
      caption: 'Penyembelihan sesuai syariat',
    },
    {
      src: 'images/landing/galeri-3-masak.webp',
      alt: 'Pengolahan daging aqiqah di dapur mitra',
      caption: 'Pengolahan di dapur mitra',
    },
    {
      src: 'images/landing/galeri-4-kemas.webp',
      alt: 'Masakan aqiqah dikemas rapi sebelum diantar',
      caption: 'Pengemasan rapi & higienis',
    },
    {
      src: 'images/landing/galeri-5-kirim.webp',
      alt: 'Pesanan aqiqah diantar ke alamat pemesan',
      caption: 'Diantar ke alamat Anda',
    },
    {
      src: 'images/landing/galeri-6-salur.webp',
      alt: 'Penyaluran daging aqiqah kepada penerima manfaat',
      caption: 'Disalurkan ke penerima manfaat',
    },
  ],
} as const;

/** Program Aqiqah — harga dari 28_HARGA_PROGRAM. */
export const aqiqahPrograms = [
  {
    slug: 'aqiqah-ekonomi',
    name: 'Ekonomi',
    price: 2_300_000,
    popular: false,
    /** Foto masakan paket ini; rasio 4:3 seperti `landingPhotos`. */
    photo: {
      src: 'images/landing/paket-ekonomi.webp',
      alt: 'Sajian masakan paket Aqiqah Ekonomi',
    },
    tagline: 'Ibadah aqiqah lengkap dengan harga paling terjangkau.',
    features: [
      '1 ekor kambing sehat & tersertifikasi',
      'Pemotongan sesuai syariat',
      'Masakan siap antar',
      'Dokumentasi foto proses',
      'Laporan digital untuk keluarga',
    ],
  },
  {
    slug: 'aqiqah-favorit',
    name: 'Favorit',
    price: 2_800_000,
    popular: true,
    photo: {
      src: 'images/landing/paket-favorit.webp',
      alt: 'Sajian masakan paket Aqiqah Favorit',
    },
    tagline: 'Pilihan paling diminati — seimbang antara porsi dan nilai.',
    features: [
      'Kambing ukuran lebih besar',
      'Pemotongan sesuai syariat',
      'Menu masakan lebih variatif',
      'Dokumentasi foto & video',
      'Laporan digital + sertifikat aqiqah',
    ],
  },
  {
    slug: 'aqiqah-premium',
    name: 'Premium',
    price: 3_600_000,
    popular: false,
    photo: {
      src: 'images/landing/paket-premium.webp',
      alt: 'Sajian masakan paket Aqiqah Premium',
    },
    tagline: 'Porsi lebih besar dan layanan paling lengkap.',
    features: [
      'Kambing premium ukuran besar',
      'Pemotongan sesuai syariat',
      'Menu masakan premium & variatif',
      'Dokumentasi foto & video profesional',
      'Laporan digital + sertifikat + prioritas jadwal',
    ],
  },
] as const;

/**
 * Paket Nasi Box Aqiqah — harga per box dari 28_HARGA_PROGRAM.
 *
 * `slug` wajib sama persis dengan `services.slug` di database, sebab itulah
 * yang menjembatani kartu di halaman ini dengan katalog yang benar-benar
 * ditagih (`/checkout?paket={slug}` dicocokkan sebagai slug, bukan id).
 *
 * Dua di antaranya pernah menyimpang: `paket-c-favorit` dan `paket-e-premium`
 * membawa akhiran yang tidak pernah ada di katalog. Harganya kebetulan benar
 * dan slug nasi box belum dipakai sebagai tautan, jadi tidak ada yang rusak di
 * layar — tetapi begitu nasi box ditautkan dengan pola `?paket=` yang sama
 * seperti paket aqiqah, dua dari lima akan diam-diam jatuh ke paket pertama
 * tanpa galat apa pun. Dijaga `landing-catalogue.test.ts`.
 */
export const nasiBoxPackages = [
  { slug: 'paket-a', name: 'Paket A', price: 21_000, popular: false },
  { slug: 'paket-b', name: 'Paket B', price: 27_000, popular: false },
  { slug: 'paket-c', name: 'Paket C', price: 32_000, popular: true },
  { slug: 'paket-d', name: 'Paket D', price: 45_000, popular: false },
  { slug: 'paket-e', name: 'Paket E', price: 70_000, popular: false },
] as const;

/** Tahapan layanan (08_WORKFLOW_MAP / 27_PAGE_MENU). */
export const processSteps = [
  {
    step: '01',
    title: 'Pemesanan',
    description:
      'Pilih paket dan pesan lewat WhatsApp atau website. Data langsung tercatat di sistem.',
  },
  {
    step: '02',
    title: 'Pembayaran',
    description:
      'Konfirmasi pembayaran diverifikasi tim kami dan status order otomatis diperbarui.',
  },
  {
    step: '03',
    title: 'Produksi',
    description: 'Pemotongan sesuai syariat dan pemasakan, seluruhnya terdokumentasi foto & video.',
  },
  {
    step: '04',
    title: 'Pengiriman',
    description: 'Masakan dan daging diantar tepat waktu ke keluarga maupun penerima manfaat.',
  },
  {
    step: '05',
    title: 'Pelaporan',
    description: 'Anda menerima laporan transparan berisi bukti dokumentasi melalui link unik.',
  },
] as const;

/** Keunggulan (01_PROJECT_VISION objectives). */
export const features = [
  {
    icon: 'shield',
    title: 'Syar’i & Amanah',
    description:
      'Hewan sehat tersertifikasi dan pemotongan sesuai syariat Islam yang dapat dipertanggungjawabkan.',
  },
  {
    icon: 'activity',
    title: 'Pantau Real-time',
    description:
      'Lihat progres setiap tahap order Anda tanpa perlu menelepon atau menunggu balasan chat.',
  },
  {
    icon: 'camera',
    title: 'Terdokumentasi',
    description:
      'Setiap proses direkam dalam foto dan video yang tervalidasi sebelum ditandai selesai.',
  },
  {
    icon: 'file',
    title: 'Laporan Transparan',
    description:
      'Laporan pelaksanaan lengkap dikirim otomatis via link unik — cukup dibuka tanpa login.',
  },
  {
    icon: 'clock',
    title: 'Tepat Waktu',
    description:
      'Penjadwalan yang rapi memastikan ibadah Anda ditunaikan sesuai waktu yang disepakati.',
  },
  {
    icon: 'heart',
    title: 'Manfaat Tersalurkan',
    description:
      'Daging sampai ke penerima yang tepat, dengan bukti distribusi yang bisa Anda telusuri.',
  },
] as const;

/** FAQ (juga dipakai untuk FAQPage JSON-LD / GEO — 27_PAGE_MENU). */
export const faqs = [
  {
    question: 'Apa itu Sukses Aqiqah?',
    answer:
      'Sukses Aqiqah adalah layanan Aqiqah dan Sedekah Daging dari Zakat Sukses yang mengedepankan proses syar’i, amanah, dan terdokumentasi lengkap — sehingga Anda dapat memantau ibadah dan menerima laporan yang transparan.',
  },
  {
    question: 'Bagaimana cara memesan?',
    answer:
      'Cukup hubungi kami melalui WhatsApp atau lakukan pemesanan di website. Pilih paket yang sesuai, lakukan pembayaran, lalu tim kami akan menjadwalkan pelaksanaan dan memberi kabar setiap tahapnya.',
  },
  {
    question: 'Apakah hewan dijamin sehat dan sesuai syariat?',
    answer:
      'Ya. Seluruh hewan dipastikan sehat dan memenuhi syarat syar’i. Proses pemotongan dilakukan sesuai syariat Islam dan didokumentasikan sebagai bukti pelaksanaan.',
  },
  {
    question: 'Apakah saya mendapat bukti pelaksanaan?',
    answer:
      'Tentu. Anda akan menerima laporan pelaksanaan berisi foto dan video dokumentasi yang dapat diakses melalui link unik, tanpa perlu login.',
  },
  {
    question: 'Apakah daging bisa disalurkan ke penerima manfaat?',
    answer:
      'Bisa. Anda dapat memilih agar daging disalurkan kepada penerima manfaat yang membutuhkan, lengkap dengan dokumentasi distribusi yang dapat Anda telusuri.',
  },
] as const;
