import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import {
  faqs,
  features,
  landingPhotos,
  processSteps,
  services,
  siteConfig,
} from '@/lib/constants/site';
import {
  getLandingCatalogue,
  type LandingBox,
  type LandingCatering,
  type LandingProgram,
} from '@/features/landing/catalogue';
import { formatIDR } from '@/lib/format/currency';
import { Icon, IconArrowRight, IconCheck, IconWhatsApp } from '@/components/site/icons';
import { SitePhoto } from '@/components/site/site-photo';
import { Reveal } from '@/components/site/reveal';
import { PackageFilter } from '@/components/site/package-filter';

export const metadata: Metadata = {
  title: `${siteConfig.name} — ${siteConfig.tagline}`,
  description: siteConfig.description,
  alternates: { canonical: '/' },
};

const orderMessage = (paket?: string) =>
  `Halo Sukses Aqiqah, saya ingin memesan${paket ? ` paket ${paket}` : ' layanan'}.`;
export default async function LandingPage() {
  const { programs, boxes, catering } = await getLandingCatalogue();

  return (
    <>
      <JsonLd />
      <Hero />
      <ServicesSection />
      <PackagesSection programs={programs} boxes={boxes} catering={catering} />
      <ProcessSection />
      {/* Galeri tepat setelah Proses: bagian itu menjanjikan tiap tahap
          terdokumentasi, dan galerilah buktinya. */}
      <GallerySection />
      <FeaturesSection />
      <FaqSection />
      <CtaSection />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */
function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-neutral-200">
      {/* Latar bertekstur */}
      <div
        aria-hidden
        className="bg-grid pointer-events-none absolute inset-0 z-0 [mask-image:radial-gradient(120%_90%_at_15%_0%,black,transparent_70%)]"
      />
      <div
        aria-hidden
        className="bg-grid-fine pointer-events-none absolute inset-0 z-0 [mask-image:radial-gradient(45%_55%_at_8%_5%,black,transparent)]"
      />
      <div
        aria-hidden
        className="from-primary/6 pointer-events-none absolute inset-0 z-0 bg-gradient-to-br via-transparent to-transparent"
      />
      {/* Watermark Logo Transparan di Latar Belakang */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 top-1/2 z-0 -translate-y-1/2 opacity-[0.08] select-none lg:-right-4"
      >
        <Image
          src="/images/logo_new.webp"
          alt=""
          width={520}
          height={520}
          className="rotate-12 object-contain"
        />
      </div>

      <div className="relative z-10 mx-auto grid max-w-6xl gap-10 px-4 pt-8 pb-14 sm:gap-12 sm:px-6 sm:pt-12 sm:pb-20 lg:grid-cols-[1fr_0.85fr] lg:items-end lg:gap-16 lg:pt-14 lg:pb-24">
        <div>
          <Reveal>
            <p className="text-[#5eb349] text-xs font-semibold tracking-[0.14em] uppercase">
              Layanan Aqiqah · Zakat Sukses
            </p>
          </Reveal>

          <Reveal delay={90}>
            <h1 className="mt-3.5 text-[2rem] leading-[1.1] font-bold tracking-tight text-neutral-900 sm:mt-4 sm:text-5xl lg:text-6xl">
              Tunaikan ibadah,
              <br />
              <span className="text-[#5eb349]">tebarkan manfaat.</span>
            </h1>
          </Reveal>

          <Reveal delay={180}>
            <p className="mt-5 max-w-xl text-base leading-7 text-neutral-600 sm:mt-6 sm:text-lg sm:leading-8">
              Aqiqah yang dikerjakan sesuai syariat dan dicatat di setiap tahapnya. Anda memantau
              prosesnya, lalu menerima laporan pelaksanaan berisi bukti — tanpa perlu bertanya.
            </p>
          </Reveal>

          <Reveal delay={270}>
            <div className="mt-6 flex flex-col gap-2 sm:mt-9 sm:flex-row sm:gap-3">
              <Link
                href="/checkout"
                className="bg-primary hover:bg-primary-dark active:bg-primary-dark inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:shadow active:scale-[0.98] sm:gap-2 sm:px-6 sm:py-3.5 sm:text-sm"
              >
                Pesan online sekarang
                <IconArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Link>
              <a
                href={siteConfig.whatsapp.href(orderMessage())}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-neutral-300 px-4 py-2.5 text-xs font-semibold text-neutral-800 transition-all hover:border-neutral-400 hover:bg-neutral-50 active:scale-[0.98] active:bg-neutral-100 sm:gap-2 sm:px-6 sm:py-3.5 sm:text-sm"
              >
                <IconWhatsApp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Tanya via WhatsApp
              </a>
            </div>
          </Reveal>

          <Reveal delay={360}>
            <dl className="mt-6 grid grid-cols-3 gap-1 text-[10px] sm:mt-9 sm:gap-4 sm:text-sm">
              {[
                { value: 'Tanpa akun', label: 'Pesan langsung di web' },
                { value: 'Tiap tahap', label: 'Divalidasi sebelum lanjut' },
                { value: 'Link laporan', label: 'Dibuka tanpa login' },
              ].map((s) => (
                // Garis aksen kiri + latar tipis: cukup untuk memisahkan ketiga
                // fakta ini dari paragraf di atasnya, tanpa jadi tiga kartu
                // melayang yang menuntut perhatian sebesar CTA di sebelahnya.
                <div
                  key={s.value}
                  className="border-primary/40 min-w-0 border-l-2 py-0.5 pl-1.5 sm:pl-3"
                >
                  <dt className="font-semibold text-neutral-900">{s.value}</dt>
                  <dd className="mt-0.5 text-[9px] leading-3 text-neutral-500 sm:text-xs sm:leading-5">
                    {s.label}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>

        {/* Foto dalam bingkai datar bergaris rambut — tanpa bayangan tebal,
            tanpa sudut membulat besar. */}
        <Reveal
          as="figure"
          delay={180}
          anim="scale"
          className="group/hero relative mx-auto w-[62%] sm:w-[72%] lg:mx-0 lg:ml-30 lg:w-[60%] lg:pb-1"
        >
          <div
            aria-hidden
            className="bg-primary/[0.07] pointer-events-none absolute inset-x-[8%] top-[12%] bottom-0 -z-10 rounded-[48%_48%_8%_8%]"
          />
          <div className="overflow-hidden">
            <SitePhoto
              src={landingPhotos.hero.src}
              alt={landingPhotos.hero.alt}
              width={landingPhotos.hero.width}
              height={landingPhotos.hero.height}
              priority
              sizes="(min-width: 1024px) 42vw, 100vw"
              className="h-full w-full object-cover transition-transform duration-700 group-hover/hero:scale-[1.02]"
            />
          </div>
          <figcaption className="mt-3 flex items-start gap-2 text-xs leading-5 text-neutral-500">
            {/* <IconCheck className="text-primary mt-0.5 h-3.5 w-3.5 shrink-0" /> */}
            {/* <span>
              Setiap foto pada laporan Anda melewati validasi tim sebelum tahap berikutnya dibuka.
            </span> */}
          </figcaption>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Layanan                                                             */
/* ------------------------------------------------------------------ */
function ServicesSection() {
  return (
    <Section bg="grid" id="layanan" index="01" eyebrow="Layanan">
      {/* Watermark Logo Motif Transparan */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-12 top-1/2 z-0 -translate-y-1/2 opacity-[0.06] select-none"
      >
        <Image
          src="/images/logo_new.webp"
          alt=""
          width={380}
          height={380}
          className="-rotate-12 object-contain"
        />
      </div>

      <SectionIntro
        title="Pilih cara aqiqah Anda ditunaikan"
        lead="Keduanya menempuh proses yang sama sampai daging siap; yang berbeda hanya ke mana ia berakhir."
      />

      <div className="mt-10 grid gap-4 sm:mt-12 md:grid-cols-3">
        {services.map((s, i) => (
          <Reveal
            key={s.title}
            delay={i * 110}
            anim="scale"
            className="rounded-lg border border-neutral-200 bg-white p-6 transition-colors hover:border-neutral-300 sm:p-7"
          >
            <Icon name={s.icon} className="text-primary h-7 w-7" />
            <h3 className="mt-5 text-lg font-semibold text-neutral-900">{s.title}</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-600">{s.description}</p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Paket & Harga                                                       */
/* ------------------------------------------------------------------ */

/**
 * Satu kartu paket — bentuk yang sama untuk **seluruh layanan**.
 *
 * ## Kenapa satu bentuk
 *
 * Sampai 22 September halaman ini punya tiga bentuk berbeda: kartu penuh untuk
 * aqiqah, lalu dua blok berjudul berisi baris ringkas untuk nasi box dan
 * katering. Akibatnya terbaca sebagai tiga kelas layanan yang berbeda derajat —
 * padahal katering justru pesanan yang berdiri sendiri dengan nilai yang bisa
 * jauh lebih besar daripada satu ekor aqiqah.
 *
 * Sekarang ketiganya satu bentuk dalam satu kisi. Yang membedakan tinggal dua
 * hal yang memang berbeda: **label jenis** di atas nama, dan **ke mana
 * tombolnya mengarah**.
 *
 * Data dinormalkan jadi `PackageCardData` oleh pemanggil, bukan diterima
 * sebagai tiga tipe dengan tiga cabang render di dalam sini — cabang di dalam
 * kartu akan tumbuh tiap kali jenis layanan bertambah.
 */
type PackageCardData = {
  slug: string;
  /** Nama sebagaimana dibaca pengunjung, sudah termasuk awalan jenisnya. */
  title: string;
  /** Label kecil di atas nama: "Aqiqah", "Katering", "Nasi Box". */
  kind: string;
  price: number;
  /** Satuan harga — "ekor" untuk aqiqah, "box" untuk sisanya. */
  unit: string;
  popular: boolean;
  /** Teks penanda populer; berbeda per jenis ("Terpopuler" vs "Favorit"). */
  popularLabel: string;
  tagline: string | null;
  /** Fitur paket aqiqah atau daftar lauk per box — keduanya daftar bercentang. */
  features: string[];
  photo: { src: string; alt: string } | null;
  action: ReactNode;
};

function PackageCard({ data, delay }: { data: PackageCardData; delay: number }) {
  return (
    <Reveal
      as="article"
      delay={delay}
      anim="scale"
      className={`group/card relative flex flex-col bg-white transition-shadow hover:shadow-sm ${
        data.popular ? 'ring-primary/40 z-10 ring-2' : ''
      }`}
    >
      {/* Paket tanpa foto merender kartu tanpa blok gambar sama sekali, bukan
          placeholder: `SitePhoto` menampilkan kotak bertuliskan path berkas
          yang ditunggu — petunjuk kerja yang berguna bagi yang menyiapkan
          foto, tapi tidak ada artinya bagi pengunjung. Sejak fotonya bisa
          diunggah lewat aplikasi, paket baru memang wajar belum punya foto. */}
      {data.photo && (
        <div className="aspect-video overflow-hidden bg-neutral-100">
          <SitePhoto
            src={data.photo.src}
            alt={data.photo.alt}
            width={600}
            height={400}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-[1.03]"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {/* Label jenis menggantikan judul blok yang dulu memisahkan
                ketiganya. Ia mengerjakan hal yang sama — memberi tahu ini
                layanan apa — tanpa memecah halaman jadi tiga bagian. */}
            <p className="text-primary text-[11px] font-semibold tracking-[0.1em] uppercase">
              {data.kind}
            </p>
            <h3 className="mt-1 text-base font-semibold text-neutral-900">{data.title}</h3>
          </div>

          {/* Penanda populer jadi label teks kecil, bukan pita mengambang yang
              menggeser tata letak kartunya. */}
          {data.popular && (
            <span className="bg-accent shrink-0 rounded px-2 py-0.5 text-[10px] font-bold tracking-wide text-neutral-900 uppercase">
              {data.popularLabel}
            </span>
          )}
        </div>

        <p className="mt-3 text-3xl font-bold tracking-tight text-neutral-900 tabular-nums">
          {formatIDR(data.price)}
          <span className="ml-1 text-sm font-normal text-neutral-500">/{data.unit}</span>
        </p>
        {data.tagline && <p className="mt-2 text-sm leading-6 text-neutral-600">{data.tagline}</p>}

        {data.features.length > 0 && (
          <ul className="mt-6 flex-1 space-y-2.5 border-t border-neutral-100 pt-5">
            {data.features.map((feat) => (
              <li key={feat} className="flex items-start gap-2.5 text-sm text-neutral-700">
                <IconCheck className="text-primary mt-[3px] h-3.5 w-3.5 shrink-0" />
                <span className="leading-6">{feat}</span>
              </li>
            ))}
          </ul>
        )}

        {/* `flex-1` pindah ke sini ketika tidak ada daftar fitur, supaya tombol
            tetap menempel di dasar kartu dan tingginya seragam dengan kartu
            lain di baris yang sama. */}
        <div className={data.features.length > 0 ? 'mt-6' : 'mt-6 flex-1 content-end'}>
          {data.action}
        </div>
      </div>
    </Reveal>
  );
}

/** Kisi tunggal untuk seluruh kartu paket, apa pun jenisnya. */
function PackageGrid({ cards }: { cards: PackageCardData[] }) {
  return (
    <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200 lg:grid-cols-3">
      {cards.map((card, i) => (
        <PackageCard key={`${card.kind}-${card.slug}`} data={card} delay={i * 90} />
      ))}
    </div>
  );
}

/**
 * Nasi box — **keterangan, bukan pilihan.**
 *
 * Sempat dijadikan kartu sejajar aqiqah & katering (22 September), lalu
 * dikembalikan: nasi box bukan pesanan yang berdiri sendiri melainkan tambahan
 * opsional atas paket aqiqah, dan `create_guest_order` memang menolaknya
 * sebagai paket utama. Kartu dengan tombol "Pesan" menawarkan sesuatu yang
 * tidak bisa dipesan — persis jenis kekeliruan yang tidak menghasilkan galat
 * apa pun, hanya pengunjung yang kecewa di ujung alur.
 *
 * Bentuk ringkasnya justru menyampaikan perannya: satu blok bersahaja di bawah
 * deretan kartu, dengan satu tombol tanya ke WhatsApp untuk seluruh paket.
 */
function NasiBoxNote({ boxes }: { boxes: LandingBox[] }) {
  return (
    <Reveal anim="scale" className="mt-6 rounded-lg border border-neutral-200 bg-white p-5 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl">
          <h3 className="text-base font-semibold text-neutral-900">
            Nasi box aqiqah{' '}
            <span className="font-normal text-neutral-500">— tambahan opsional</span>
          </h3>
          <p className="mt-1.5 text-sm leading-6 text-neutral-600">
            Berbagi kebahagiaan aqiqah dalam bentuk nasi box siap saji. Harga per porsi, dipesan{' '}
            <strong>bersama paket aqiqah</strong> lewat tim kami.
          </p>
        </div>
        <a
          href={siteConfig.whatsapp.href(orderMessage('Nasi Box Aqiqah'))}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-800 transition-all hover:border-neutral-400 hover:bg-neutral-50 active:scale-[0.98]"
        >
          <IconWhatsApp className="h-4 w-4" />
          Tanya nasi box
        </a>
      </div>

      {/* Lauknya dipisah koma, bukan daftar bertitik: pembeda antar paket
          adalah panjang rangkaiannya, dan itu paling cepat terbaca kalau
          kelimanya bisa dibandingkan sekilas. */}
      <ul className="mt-6 grid gap-3 border-t border-neutral-100 pt-6 sm:mt-7 sm:grid-cols-2 lg:grid-cols-3">
        {boxes.map((box) => (
          <li
            key={box.slug}
            className={`rounded-lg border p-4 ${
              box.popular ? 'border-primary/30 bg-primary/3' : 'border-neutral-200'
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="text-sm font-semibold text-neutral-900">
                {box.name}
                {box.popular && (
                  <span className="bg-primary/10 text-primary ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                    Favorit
                  </span>
                )}
              </h4>
              <p className="text-sm font-semibold text-neutral-900 tabular-nums">
                {formatIDR(box.price)}
              </p>
            </div>
            <p className="mt-1.5 text-xs leading-5 text-neutral-600">{box.items.join(', ')}</p>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}

function PackagesSection({
  programs,
  boxes,
  catering,
}: {
  programs: LandingProgram[];
  boxes: LandingBox[];
  catering: LandingCatering[];
}) {
  // Katalog kosong berarti database tak terjangkau (query-nya mengembalikan
  // daftar kosong alih-alih melempar). Section-nya disembunyikan seluruhnya:
  // judul "Harga sudah termasuk seluruh prosesnya" di atas ruang kosong
  // terbaca sebagai halaman rusak, sementara tanpanya halaman tetap utuh —
  // hero, proses, galeri, dan jalan menghubungi lewat WhatsApp semuanya tetap
  // ada.
  if (programs.length === 0 && boxes.length === 0 && catering.length === 0) return null;

  const aqiqahCards: PackageCardData[] = programs.map((p) => ({
    slug: p.slug,
    // Katalog menyimpan "Aqiqah Ekonomi" tetapi `catalogue.ts` memangkas
    // awalannya supaya kartu lama tidak berbunyi "Aqiqah Aqiqah Ekonomi".
    // Di sini awalannya sudah pindah ke label jenis, jadi namanya berdiri apa
    // adanya.
    title: p.name,
    kind: 'Aqiqah',
    price: p.price,
    unit: 'ekor',
    popular: p.popular,
    popularLabel: 'Terpopuler',
    tagline: p.tagline,
    features: p.features,
    photo: p.photo,
    action: (
      <Link
        href={`/checkout?paket=${p.slug}`}
        className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold transition-all active:scale-[0.98] ${
          p.popular
            ? 'bg-primary hover:bg-primary-dark text-white shadow-sm hover:shadow'
            : 'border border-neutral-300 text-neutral-800 hover:border-neutral-400 hover:bg-neutral-50'
        }`}
      >
        Pesan paket {p.name}
        <IconArrowRight className="h-4 w-4" />
      </Link>
    ),
  }));

  const cateringCards: PackageCardData[] = catering.map((c) => ({
    slug: c.slug,
    title: c.name,
    kind: 'Katering',
    price: c.price,
    unit: 'box',
    popular: c.popular,
    popularLabel: 'Favorit',
    tagline: c.tagline,
    features: c.items,
    photo: c.photo,
    action: (
      // Katering pesanan yang berdiri sendiri, jadi ia punya formnya sendiri —
      // `create_catering_order` melayaninya langsung.
      <Link
        href={`/checkout/katering?paket=${c.slug}`}
        className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold transition-all active:scale-[0.98] ${
          c.popular
            ? 'bg-primary hover:bg-primary-dark text-white shadow-sm hover:shadow'
            : 'border border-neutral-300 text-neutral-800 hover:border-neutral-400 hover:bg-neutral-50'
        }`}
      >
        Pesan {c.name}
        <IconArrowRight className="h-4 w-4" />
      </Link>
    ),
  }));

  /**
   * Tab "Pilihan": **katering dan aqiqah yang paling diminati.**
   *
   * Aqiqah yang masuk sini adalah yang bertanda `is_popular` **di katalog**,
   * bukan yang dipilih di kode: penandanya bisa disunting superadmin lewat
   * halaman katalog, jadi keputusan pemasarannya tetap di tangan pemilik usaha.
   * Kalau tak satu pun ditandai, seluruh paket aqiqah yang tampil — lebih baik
   * daripada tab "Pilihan" yang kosong separuh.
   */
  const featured = aqiqahCards.filter((c) => c.popular);
  const featuredAqiqah = featured.length > 0 ? featured : aqiqahCards;

  const tabs = [
    {
      id: 'pilihan',
      label: 'Pilihan',
      count: featuredAqiqah.length + cateringCards.length,
      content: (
        <>
          <PackageGrid cards={[...featuredAqiqah, ...cateringCards]} />
          {/* Ikut di sini juga: tab ini memuat paket aqiqah, dan nasi box
              adalah tambahan atasnya — menyebutkannya hanya di tab Aqiqah
              berarti pengunjung yang berhenti di tab bawaan tidak pernah tahu
              tambahan itu ada. */}
          {boxes.length > 0 && <NasiBoxNote boxes={boxes} />}
        </>
      ),
    },
    {
      id: 'aqiqah',
      label: 'Aqiqah',
      // Hitungannya paket aqiqah saja. Nasi box tidak ikut dihitung karena ia
      // bukan pilihan sejajar — lihat `NasiBoxNote`.
      count: aqiqahCards.length,
      content: (
        <>
          <PackageGrid cards={aqiqahCards} />
          {boxes.length > 0 && <NasiBoxNote boxes={boxes} />}
        </>
      ),
    },
    {
      id: 'katering',
      label: 'Katering',
      count: cateringCards.length,
      content: <PackageGrid cards={cateringCards} />,
    },
  ];

  return (
    <Section bg="tinted" id="paket" index="02" eyebrow="Paket & Harga">
      <SectionIntro
        title="Harga sudah termasuk seluruh prosesnya"
        lead="Pemotongan syar’i, pemasakan, dokumentasi, dan laporan pelaksanaan — tidak ada biaya yang menyusul di belakang."
      />

      {/* Penyaringnya komponen klien, tetapi kartunya tetap dirakit di server:
          `SitePhoto` memeriksa berkas lewat `node:fs`, jadi ia tidak bisa hidup
          di klien. Yang dikirim ke bawah adalah blok yang sudah jadi — dan itu
          yang membuat halaman ini **tetap prerender statis** sekaligus memuat
          seluruh kartu di HTML awal, sehingga mesin pencari membaca semuanya. */}
      <PackageFilter tabs={tabs} defaultTab="pilihan" />
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Proses                                                              */
/* ------------------------------------------------------------------ */
function ProcessSection() {
  return (
    <section id="proses" className="bg-primary-dark relative overflow-hidden text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 [background-image:radial-gradient(circle,white_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.07]"
      />
      {/* Watermark Logo Transparan */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 top-1/2 z-0 -translate-y-1/2 opacity-[0.12] select-none"
      >
        <Image
          src="/images/logo_new.webp"
          alt=""
          width={500}
          height={500}
          className="rotate-45 object-contain filter invert"
        />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <Reveal>
          <p className="text-xs font-semibold tracking-[0.14em] text-white/50 uppercase">
            03 — Alur Layanan
          </p>
          <h2 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Lima langkah, semuanya tercatat
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-white/70">
            Setiap langkah punya penanggung jawab dan bukti. Tahap berikutnya baru terbuka setelah
            yang sebelumnya divalidasi.
          </p>
        </Reveal>

        <ol className="mt-10 grid gap-px bg-white/15 sm:mt-14 sm:grid-cols-2 lg:grid-cols-5">
          {processSteps.map((step, i) => (
            <Reveal
              key={step.step}
              as="li"
              delay={(i % 3) * 110}
              className="bg-primary-dark relative p-5 sm:p-6"
            >
              <span className="text-accent block text-3xl font-bold tabular-nums">{step.step}</span>
              <h3 className="mt-3 text-base font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/70">{step.description}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Galeri Dokumentasi                                                  */
/* ------------------------------------------------------------------ */
/**
 * Enam foto berurutan mengikuti tahapan sungguhan di sistem — bukti dari klaim
 * "terdokumentasi" yang diulang di beberapa bagian halaman ini. Urutannya sama
 * dengan `fulfilment_sequence()` di database, jadi yang dilihat pengunjung di
 * sini persis bentuk laporan yang nanti ia terima.
 *
 * ## Kalimat pengantarnya menyesuaikan isi fotonya
 *
 * Sampai foto pelaksanaan sungguhan tersedia, keenam slot ini diisi foto stok
 * sebagai penahan sementara. Karena itu kalimat "bukan foto ilustrasi" yang
 * dulu berdiri di sini **dicabut**: ia janji yang bisa diperiksa pengunjung,
 * dan yang menyalahi janji semacam itu bukan hanya keliru — ia merusak persis
 * kepercayaan yang hendak dibangun halaman ini.
 *
 * Yang tersisa tetap benar apa adanya: urutan tahapnya memang yang dipakai
 * sistem, dan pemesan memang menerima foto pelaksanaannya sendiri di laporan.
 * **Kembalikan kalimat aslinya begitu keenam foto asli masuk** —
 * `public/images/landing/README.md` memuat daftarnya.
 */
function GallerySection() {
  return (
    <Section id="galeri" index="04" eyebrow="Dokumentasi">
      <SectionIntro
        title="Lihat sendiri setiap tahapnya"
        lead="Inilah urutan tahap yang ditempuh setiap pesanan. Anda menerima foto pelaksanaan pesanan Anda sendiri di laporan akhir."
      />

      <div className="mt-10 grid gap-x-5 gap-y-7 sm:mt-12 sm:grid-cols-2 sm:gap-y-8 lg:grid-cols-3">
        {landingPhotos.gallery.map((photo, i) => (
          // Jeda dihitung per baris, bukan per foto: dengan enam foto, `i * 70`
          // membuat yang terakhir menunggu 350ms — sudah terlewat saat digulir.
          // `i % 3` menahan jeda maksimum di 140ms untuk semua ukuran layar.
          <Reveal
            key={photo.src}
            as="figure"
            delay={(i % 3) * 110}
            anim="scale"
            className="group/photo"
          >
            <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 transition-shadow group-hover/photo:shadow-sm">
              <SitePhoto
                src={photo.src}
                alt={photo.alt}
                width={800}
                height={600}
                sizes="(min-width: 1024px) 31vw, (min-width: 640px) 47vw, 100vw"
                className="h-full w-full object-cover transition-transform duration-700 group-hover/photo:scale-[1.04]"
              />
            </div>
            {/* Keterangan di bawah foto, bukan ditumpuk di atasnya lewat
                gradasi gelap — teks di atas foto selalu bergantung pada
                seterang apa foto yang nanti diunggah. */}
            <figcaption className="mt-3 flex items-start gap-3">
              <span className="text-primary text-xs font-bold tabular-nums">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-sm font-medium text-neutral-800">{photo.caption}</span>
            </figcaption>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Keunggulan                                                          */
/* ------------------------------------------------------------------ */
function FeaturesSection() {
  return (
    <Section bg="tinted" id="keunggulan" index="05" eyebrow="Kenapa Kami">
      <SectionIntro
        title="Ibadah yang bisa Anda telusuri"
        lead="Bukan sekadar jasa potong hewan — setiap tahapnya tercatat, tervalidasi, dan bisa Anda periksa kembali."
      />

      <div className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => (
          <Reveal
            key={f.title}
            delay={(i % 3) * 110}
            anim="scale"
            className="rounded-lg border border-neutral-200 bg-white p-5 transition-colors hover:border-neutral-300 sm:p-6"
          >
            <div className="flex items-center gap-2.5">
              <Icon name={f.icon} className="text-primary h-5 w-5 shrink-0" />
              <h3 className="text-base font-semibold text-neutral-900">{f.title}</h3>
            </div>
            <p className="mt-3 text-sm leading-6 text-neutral-600">{f.description}</p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */
function FaqSection() {
  return (
    <Section bg="grid" id="faq" index="06" eyebrow="FAQ">
      <SectionIntro
        title="Pertanyaan yang sering diajukan"
        lead="Belum menemukan jawabannya? Hubungi kami langsung via WhatsApp."
      />

      <Reveal className="mt-10 max-w-3xl divide-y divide-neutral-200 border-y border-neutral-200">
        {faqs.map((faq) => (
          <details
            key={faq.question}
            className="group open:bg-primary/3 -mx-3 rounded-lg px-3 py-4 transition-colors hover:bg-neutral-50 sm:py-5 [&_summary]:list-none"
          >
            <summary className="flex cursor-pointer items-start justify-between gap-4 text-left sm:gap-6">
              <span className="group-hover:text-primary group-open:text-primary text-[15px] font-medium text-neutral-900 transition-colors sm:text-base">
                {faq.question}
              </span>
              <span className="text-primary mt-0.5 flex size-7 shrink-0 items-center justify-center transition-transform duration-300 group-open:rotate-45">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
            </summary>
            {/* Jawaban ikut memudar masuk saat dibuka — memberi tahu bahwa isi
                baru muncul, bukan halaman yang meloncat. */}
            <p className="animate-in fade-in slide-in-from-top-1 mt-3 max-w-2xl text-sm leading-7 text-neutral-600 duration-[380ms] ease-out">
              {faq.answer}
            </p>
          </details>
        ))}
      </Reveal>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* CTA akhir                                                           */
/* ------------------------------------------------------------------ */
function CtaSection() {
  return (
    <section className="relative overflow-hidden border-t border-neutral-200 bg-neutral-50">
      <div
        aria-hidden
        className="bg-grid pointer-events-none absolute inset-0 z-0 [mask-image:radial-gradient(110%_90%_at_85%_100%,black,transparent_70%)]"
      />
      {/* Watermark Logo Transparan */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -bottom-10 z-0 opacity-[0.08] select-none"
      >
        <Image
          src="/images/logo_new.webp"
          alt=""
          width={440}
          height={440}
          className="rotate-12 object-contain"
        />
      </div>

      <Reveal className="relative z-10 mx-auto flex max-w-6xl flex-col gap-7 px-4 py-14 sm:gap-8 sm:px-6 sm:py-20 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
            Siap menunaikan ibadah Anda?
          </h2>
          <p className="mt-3 text-base leading-7 text-neutral-600">
            Tim kami membantu dari pemilihan paket sampai laporan pelaksanaan. Konsultasi gratis.
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
          <Link
            href="/checkout"
            className="bg-primary hover:bg-primary-dark active:bg-primary-dark inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow active:scale-[0.98]"
          >
            Pesan online sekarang
            <IconArrowRight className="h-4 w-4" />
          </Link>
          <a
            href={siteConfig.whatsapp.href(orderMessage())}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-6 py-3.5 text-sm font-semibold text-neutral-800 transition-all hover:border-neutral-400 active:scale-[0.98] active:bg-neutral-100"
          >
            <IconWhatsApp className="h-4 w-4" />
            Konsultasi via WhatsApp
          </a>
        </div>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
/**
 * Pembungkus section dengan penanda urutan bernomor.
 *
 * Nomornya bukan hiasan: halaman ini panjang, dan penanda urutan memberi
 * pembaca rasa posisi tanpa perlu menambahkan garis pemisah tebal atau
 * berganti-ganti warna latar antar-section.
 */
function Section({
  id,
  index,
  eyebrow,
  bg = 'plain',
  children,
}: {
  id: string;
  index: string;
  eyebrow: string;
  /**
   * Perlakuan latar.
   *
   * Halaman ini panjang, dan tujuh section putih berturut-turut terbaca sebagai
   * satu bentangan tanpa ujung. Tapi selang-seling putih/abu saja juga monoton —
   * ia jadi pola yang bisa ditebak setelah dua pergantian. Jadi ada tiga:
   *
   * `plain` — putih polos.
   * `tinted` — abu sangat tipis.
   * `grid` — putih dengan kisi yang menempati satu sudut saja, jadi batas
   *   sectionnya terasa tanpa pergantian warna sama sekali.
   */
  bg?: 'plain' | 'tinted' | 'grid';
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={`relative overflow-hidden border-b border-neutral-200 ${
        bg === 'tinted' ? 'bg-neutral-50/70' : 'bg-white'
      }`}
    >
      {bg === 'grid' && (
        <div
          aria-hidden
          className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(80%_70%_at_100%_0%,black,transparent_65%)]"
        />
      )}
      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <Reveal>
          <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.14em] text-neutral-500 uppercase">
            <span className="tabular-nums">{index}</span>
            {/* Garis penghubung antara nomor dan nama bagian. Menggantikan tanda
                hubung "—": bentuknya menuntun mata ke kanan, ke arah baca. */}
            <span aria-hidden className="bg-primary/30 h-px w-6 sm:w-10" />
            <span className="text-primary">{eyebrow}</span>
          </p>
        </Reveal>
        {children}
      </div>
    </section>
  );
}

function SectionIntro({ title, lead }: { title: string; lead: string }) {
  return (
    <Reveal delay={90} className="mt-4 max-w-2xl">
      <h2 className="text-[1.75rem] leading-tight font-bold tracking-tight text-neutral-900 sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-7 text-neutral-600">{lead}</p>
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/* JSON-LD (SEO/GEO — 27_PAGE_MENU)                                    */
/* ------------------------------------------------------------------ */
function JsonLd() {
  const data = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: siteConfig.name,
      url: siteConfig.url,
      description: siteConfig.description,
      slogan: siteConfig.tagline,
      sameAs: [siteConfig.instagram.url],
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        telephone: siteConfig.whatsapp.display,
        email: siteConfig.email,
        availableLanguage: ['id'],
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: siteConfig.name,
      url: siteConfig.url,
      inLanguage: 'id-ID',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    },
  ];

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
