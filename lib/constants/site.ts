/**
 * Konfigurasi situs publik Sukses Aqiqah.
 *
 * Nilai kontak (WhatsApp, Instagram) diambil dari environment variable
 * sesuai 27_PAGE_MENU — JANGAN hardcode nomor/URL di komponen.
 * Fallback dipakai agar halaman tetap tampil saat env belum diisi (dev).
 */

/**
 * Alamat aplikasi, **tanpa garis miring di akhir**.
 *
 * Nilainya diketik manusia di dashboard hosting, dan garis miring penutup
 * gampang ikut tersalin — `${appUrl()}/atur-sandi` lalu jadi `...app//atur-sandi`.
 * Dinormalkan sekali di sini supaya tiap pemanggil tidak perlu mengingatnya.
 */
export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}

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
    'Lacak setiap tahap pesanan Anda dan terima laporan pelaksanaan berisi foto.',
  url: appUrl(),
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

/**
 * Menu footer. Hanya tujuan yang benar-benar ada: `/proses`, `/galeri`, `/faq`
 * dulu tercantum sebagai halaman padahal hanya section di landing (404), dan
 * Syarat Layanan / Kebijakan Privasi dicabut sampai teks resminya tersedia.
 */
export const footerNav = {
  layanan: [
    { label: 'Semua paket', href: '/paket' },
    { label: 'Pesan aqiqah', href: '/checkout' },
    { label: 'Pesan katering', href: '/checkout/katering' },
    { label: 'Proses layanan', href: '/#proses' },
  ],
  bantuan: [
    { label: 'Lacak pesanan', href: '/lacak' },
    { label: 'Galeri dokumentasi', href: '/#galeri' },
    { label: 'Pertanyaan umum', href: '/#faq' },
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
      'Berbagi kebahagiaan aqiqah dalam bentuk nasi box siap saji, dipesan bersama paket aqiqah Anda lewat tim kami.',
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
    // Rasio berkas aslinya 3:2 (5558×3705). Wadah hero mengikuti angka ini,
    // jadi foto lain dengan rasio berbeda akan terpotong.
    width: 1200,
    height: 800,
  },
  /**
   * Galeri dokumentasi — enam foto berurutan mengikuti tahapan sungguhan di
   * sistem (`fulfilment_sequence`), supaya yang dilihat pengunjung di landing
   * sama dengan yang nanti ia terima di laporan pelaksanaan.
   */
  gallery: [
    {
      src: 'images/landing/persiapan.webp',
      alt: 'Pemeriksaan kesehatan kambing sebelum disembelih',
      caption: 'Persiapan & pemeriksaan hewan',
    },
    {
      src: 'images/landing/penyembelihan.webp',
      alt: 'Proses penyembelihan sesuai syariat',
      caption: 'Penyembelihan sesuai syariat',
    },
    {
      src: 'images/landing/pembersihan2.webp',
      alt: 'Proses pembersihan & pengolahan daging aqiqah',
      caption: 'Proses pembersihan & pengolahan',
    },
    {
      src: 'images/landing/masak.webp',
      alt: 'Masakan aqiqah dikemas rapi sebelum diantar',
      caption: 'Proses memasak daging dengan higienis',
    },
    {
      src: 'images/landing/packing2.webp',
      alt: 'Pesanan aqiqah diantar ke alamat pemesan',
      caption: 'Pengemasan & pengiriman pesanan',
    },
    {
      src: 'images/landing/dok_akhir.webp',
      alt: 'Penyaluran daging aqiqah kepada penerima manfaat',
      caption: 'Penyaluran & pengiriman sesuai pesanan',
    },
  ],
} as const;

/*
 * Katalog paket **pindah ke database** (3 September).
 *
 * `aqiqahPrograms` & `nasiBoxPackages` dulu berdiri di sini — nama, harga,
 * tagline, fitur, dan foto ketiga paket aqiqah beserta kelima nasi box. Halaman
 * depan membacanya langsung, sehingga ia statis dan nol query.
 *
 * Yang membuatnya harus pindah: daftar itu **kembaran** `services` di database,
 * dan keduanya dijaga sinkron oleh tangan. Kembaran semacam itu menyimpang
 * diam-diam — `paket-c-favorit` & `paket-e-premium` pernah membawa akhiran yang
 * tidak pernah ada di katalog, dan tidak ada yang menghasilkan galat: `?paket=`
 * yang tak dikenal sengaja jatuh ke paket pertama. Pengunjung mengira memesan
 * Premium dan mendapat Ekonomi.
 *
 * Sekarang satu sumber: `features/landing/catalogue.ts` membaca `services`, dan
 * pemilik usaha mengubahnya sendiri lewat `/vendors?tab=katalog` tanpa memanggil
 * developer. `landingPhotos` di atas tetap tinggal di sini — hero & galeri
 * bukan katalog, dan tidak punya baris di `services`.
 */

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
    title: 'Pantau Sendiri',
    description:
      'Buka halaman Lacak Pesanan dengan nomor pesanan Anda untuk melihat tahap yang sedang berjalan, tanpa menunggu balasan chat.',
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
      'Laporan pelaksanaan lengkap dikirim otomatis via link unik dan cukup dibuka tanpa login.',
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

/**
 * Testimoni pemesan. **Isi hanya dengan ulasan asli** yang sudah diizinkan
 * pemiliknya untuk ditampilkan. Selama daftar ini kosong, section testimoni
 * di landing tidak dirender sama sekali.
 *
 * `name`: nama atau inisial sesuai izin pemesan, misalnya "Ibu R." atau "Budi S."
 * `city`: kota pemesan (opsional).
 * `service`: layanan yang dipesan, misalnya "Aqiqah Kirim, 2 ekor" (opsional).
 * `quote`: isi ulasan, apa adanya. 1 sampai 3 kalimat paling enak dibaca.
 * `rating`: bintang 1 sampai 5 yang **diberikan pemesan sendiri** (opsional).
 * `date`: kapan pesanan dilaksanakan, misalnya "September 2026" (opsional).
 * `photo`: foto dari pesanan pemesan itu, path relatif `public/`, misalnya
 *   `images/testimoni/adam.webp`, rasio 4:3 (opsional, hanya dengan izin).
 *
 * Field opsional yang kosong tidak dirender: jangan isi dengan tebakan.
 * Ulasan pertama tampil sebagai sorotan besar di landing: taruh yang paling
 * spesifik di urutan teratas.
 */
export const testimonials: readonly {
  name: string;
  city?: string;
  service?: string;
  quote: string;
  rating?: 1 | 2 | 3 | 4 | 5;
  date?: string;
  photo?: { src: string; alt: string };
}[] = [
  {
    name: 'Adam',
    city: 'Bogor',
    service: 'Aqiqah Salur, 2 ekor',
    quote:
      'Sangat cepat dan laporannya sangat lengkap. Kami bisa melihat proses pesanan kami secara realtime.',
    rating: 5,
    date: 'September 2026',
    photo: {
      src: 'images/testimoni/testing1.webp',
      alt: 'Daging aqiqah pesanan Adam dibagikan ke penerima',
    },
  },
  {
    name: 'Ghaida',
    city: 'Depok',
    service: 'Aqiqah Kirim, 1 ekor',
    quote: 'Pelayanan cepat dan sampai di tujuan.',
  },
];

/** FAQ (juga dipakai untuk FAQPage JSON-LD / GEO — 27_PAGE_MENU). */
export const faqs = [
  {
    question: 'Apa itu Sukses Aqiqah?',
    answer:
      'Sukses Aqiqah adalah layanan Aqiqah dan Sedekah Daging dari Zakat Sukses yang mengedepankan proses syar’i, amanah, dan terdokumentasi lengkap, sehingga Anda dapat memantau ibadah dan menerima laporan yang transparan.',
  },
  {
    question: 'Bagaimana cara memesan?',
    answer:
      'Pilih paket di halaman Paket lalu isi form pemesanan, atau hubungi kami lewat WhatsApp. Setelah pesanan masuk, Anda menerima nomor pesanan untuk membayar dan melacak setiap tahapnya.',
  },
  {
    question: 'Bagaimana cara melihat sampai mana pesanan saya?',
    answer:
      'Buka halaman Lacak Pesanan, lalu masukkan nomor pesanan dan 4 digit terakhir nomor HP yang Anda pakai saat memesan. Di sana terlihat tahap yang sudah selesai dan yang sedang berjalan.',
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
