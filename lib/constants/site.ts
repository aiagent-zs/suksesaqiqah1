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
  description:
    'Layanan Aqiqah, Qurban, dan Sedekah Daging yang syar’i, amanah, dan terdokumentasi. ' +
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
export const primaryNav = [
  { label: 'Layanan', href: '#layanan' },
  { label: 'Paket', href: '#paket' },
  { label: 'Proses', href: '#proses' },
  { label: 'Keunggulan', href: '#keunggulan' },
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

/** Layanan inti (01_PROJECT_VISION). */
export const services = [
  {
    icon: 'aqiqah',
    title: 'Aqiqah',
    description:
      'Tunaikan aqiqah putra-putri Anda secara syar’i. Kambing sehat, pemotongan sesuai syariat, dan masakan siap antar ke keluarga maupun penerima manfaat.',
  },
  {
    icon: 'qurban',
    title: 'Qurban',
    description:
      'Ibadah qurban yang amanah dengan hewan tervalidasi dan distribusi daging tepat sasaran hingga ke pelosok yang membutuhkan.',
  },
  {
    icon: 'sedekah',
    title: 'Sedekah Daging',
    description:
      'Berbagi daging berkualitas kapan saja di luar momen aqiqah dan qurban — manfaat yang terus mengalir untuk sesama.',
  },
] as const;

/** Program Aqiqah — harga dari 28_HARGA_PROGRAM. */
export const aqiqahPrograms = [
  {
    slug: 'aqiqah-ekonomi',
    name: 'Ekonomi',
    price: 2_300_000,
    popular: false,
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

/** Paket Nasi Box Aqiqah — harga per box dari 28_HARGA_PROGRAM. */
export const nasiBoxPackages = [
  { slug: 'paket-a', name: 'Paket A', price: 21_000, popular: false },
  { slug: 'paket-b', name: 'Paket B', price: 27_000, popular: false },
  { slug: 'paket-c-favorit', name: 'Paket C', price: 32_000, popular: true },
  { slug: 'paket-d', name: 'Paket D', price: 45_000, popular: false },
  { slug: 'paket-e-premium', name: 'Paket E', price: 70_000, popular: false },
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
      'Sukses Aqiqah adalah layanan Aqiqah, Qurban, dan Sedekah Daging dari Zakat Sukses yang mengedepankan proses syar’i, amanah, dan terdokumentasi lengkap — sehingga Anda dapat memantau ibadah dan menerima laporan yang transparan.',
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
