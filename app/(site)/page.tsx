import Link from 'next/link';
import type { Metadata } from 'next';
import { getBrand } from '@/lib/brand-server';
import type { Brand } from '@/lib/brand';
import {
  faqs,
  features,
  landingPhotos,
  processSteps,
  services,
  siteConfig,
  testimonials,
} from '@/lib/constants/site';
import { getLandingCatalogue } from '@/features/landing/catalogue';
import { buildPackageTabs, orderMessage } from '@/features/landing/package-cards';
import { Icon, IconCheck, IconWhatsApp } from '@/components/site/icons';
import { SitePhoto } from '@/components/site/site-photo';
import { Reveal } from '@/components/site/reveal';
import { PackageFilter } from '@/components/site/package-filter';

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();
  return {
    // `absolute`: judul ini sudah memuat nama situs, jadi `title.template` di
    // root layout tidak boleh menempelkannya sekali lagi.
    title: { absolute: `${brand.name}: ${siteConfig.tagline}` },
    description: siteConfig.description,
    alternates: { canonical: '/' },
  };
}

/**
 * Urutan section mengikuti pertanyaan pemesan: apa layanannya, berapa
 * harganya, bagaimana prosesnya, apa buktinya, lalu keraguan yang tersisa.
 * Komposisinya berganti tiap section (design.md §7: dua section berurutan
 * tidak boleh sama di lebih dari dua sumbu).
 */
export default async function LandingPage() {
  const [catalogue, brand] = await Promise.all([getLandingCatalogue(), getBrand()]);

  return (
    <>
      <JsonLd />
      <Hero brand={brand} />
      <ServicesSection />
      <PackagesSection catalogue={catalogue} brand={brand} />
      <ProcessSection />
      <GallerySection />
      <FeaturesSection />
      {testimonials.length > 0 && <TestimonialsSection />}
      <FaqSection brand={brand} />
      <CtaSection brand={brand} />
    </>
  );
}

/* Hero: teks kiri, foto kanan. Satu motif saja (kisi garis di pojok), tanpa
   watermark logo dan gradasi yang dulu menumpuk lima lapis. */
function Hero({ brand }: { brand: Brand }) {
  return (
    <section className="border-line relative overflow-hidden border-b bg-white">
      <div
        aria-hidden
        className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(70%_80%_at_0%_0%,black,transparent_70%)]"
      />
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-20">
        <div className="min-w-0">
          <Reveal>
            <p className="text-primary text-sm font-semibold">Layanan aqiqah dari Zakat Sukses</p>
          </Reveal>
          <Reveal delay={90}>
            <h1 className="text-display text-ink mt-2 font-bold tracking-tight text-balance">
              Aqiqah lebih mudah, tenang, dan <span className="text-primary">terpercaya</span>
            </h1>
          </Reveal>
          <Reveal delay={180}>
            <p className="text-ink-muted mt-5 max-w-xl text-base leading-7 sm:text-lg sm:leading-8">
              Penyembelihan sesuai syariat, dimasak, lalu diantar ke rumah atau disalurkan ke
              penerima manfaat. Setiap tahap dicatat dan bisa Anda lacak sendiri.
            </p>
          </Reveal>
          <Reveal delay={270}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/paket" className="btn btn-primary btn-lg">
                Lihat paket aqiqah
              </Link>
              <a
                href={siteConfig.whatsapp.href(
                  `Halo ${brand.name}, saya ingin konsultasi soal paket aqiqah.`,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-lg"
              >
                <IconWhatsApp className="size-5" />
                Konsultasi WhatsApp
              </a>
            </div>
          </Reveal>
          <Reveal delay={360}>
            <ul className="text-ink mt-8 grid grid-cols-3 gap-x-1 gap-y-2 text-[11px] leading-tight sm:gap-x-6 sm:text-sm sm:leading-normal">
              {['Pesan tanpa membuat akun', 'Tiap tahap divalidasi tim', 'Laporan berisi foto'].map(
                (t) => (
                  <li key={t} className="flex min-w-0 items-start gap-0.5 sm:gap-2">
                    <IconCheck className="text-primary mt-0.5 size-2.5 shrink-0 sm:size-4" />
                    {t}
                  </li>
                ),
              )}
            </ul>
          </Reveal>
        </div>

        <Reveal
          as="figure"
          delay={180}
          anim="scale"
          className="relative mx-auto w-full max-w-md lg:max-w-none"
        >
          {/* Bidang hijau yang digeser: kedalaman lewat bentuk, bukan bayangan (design.md §4).
              Di ponsel ia hanya turun ke bawah, tidak menjorok ke kanan: gutter
              16px tidak cukup menampungnya, dan tepi layar memotongnya. */}
          <div
            aria-hidden
            className="bg-primary-light absolute top-4 right-0 -bottom-3 left-4 rounded-lg sm:top-6 sm:-right-3 sm:left-6"
          />
          <div className="border-line relative aspect-[3/2] overflow-hidden rounded-lg border bg-white">
            <SitePhoto
              src={landingPhotos.hero.src}
              alt={landingPhotos.hero.alt}
              width={landingPhotos.hero.width}
              height={landingPhotos.hero.height}
              priority
              sizes="(min-width: 1024px) 45vw, (min-width: 640px) 28rem, 100vw"
              className="h-full w-full object-cover"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* Layanan: judul berdampingan dengan daftar, bukan judul + kisi kartu.
   Daftar karena ketiganya pilihan setara yang dibaca berurutan. */
function ServicesSection() {
  return (
    <section id="layanan" className="border-line border-b bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <Reveal className="lg:sticky lg:top-24 lg:self-start">
          <SectionLabel index="01">Layanan</SectionLabel>
          <h2 className="text-h2 text-ink mt-3 font-bold tracking-tight">
            Pilih cara aqiqah Anda ditunaikan
          </h2>
          <p className="text-ink-muted mt-4 text-base leading-7">
            Prosesnya sama sampai daging siap. Yang berbeda hanya ke mana ia berakhir.
          </p>
        </Reveal>
        <ul className="divide-line border-line divide-y border-y">
          {services.map((s, i) => (
            <Reveal key={s.title} as="li" delay={i * 90} className="flex gap-5 py-6 sm:py-7">
              <Icon name={s.icon} className="text-primary size-8 shrink-0" />
              <div className="min-w-0">
                <h3 className="text-h3 text-ink font-semibold">{s.title}</h3>
                <p className="text-ink-muted mt-2 text-base leading-7">{s.description}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

function PackagesSection({
  catalogue,
  brand,
}: {
  catalogue: Awaited<ReturnType<typeof getLandingCatalogue>>;
  brand: Brand;
}) {
  const { programs, boxes, catering } = catalogue;
  // Katalog kosong berarti database tak terjangkau. Section disembunyikan:
  // judul harga di atas ruang kosong terbaca sebagai halaman rusak.
  if (programs.length === 0 && boxes.length === 0 && catering.length === 0) return null;

  return (
    <section id="paket" className="bg-surface-muted border-line border-b">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <Reveal className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <SectionLabel index="02">Paket & harga</SectionLabel>
            <h2 className="text-h2 text-ink mt-3 font-bold tracking-tight">
              Harga sudah termasuk seluruh prosesnya
            </h2>
            <p className="text-ink-muted mt-4 text-base leading-7">
              Penyembelihan, pemasakan, dokumentasi, dan laporan pelaksanaan. Tidak ada biaya yang
              menyusul.
            </p>
          </div>
          <Link href="/paket" className="btn btn-outline shrink-0">
            Bandingkan semua paket
          </Link>
        </Reveal>
        <PackageFilter
          tabs={buildPackageTabs(catalogue, 3, undefined, brand.name)}
          defaultTab="pilihan"
        />
      </div>
    </section>
  );
}

/* Proses: satu-satunya section gelap, karena ia inti janji halaman ini.
   Horizontal di desktop, vertikal bergaris di ponsel. */
function ProcessSection() {
  return (
    <section id="proses" className="bg-primary-dark text-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <Reveal className="max-w-2xl">
          <p className="text-accent text-sm font-semibold tabular-nums">03 · Alur layanan</p>
          <h2 className="text-h2 mt-3 font-bold tracking-tight">Lima langkah, semuanya tercatat</h2>
          <p className="mt-4 text-base leading-7 text-white/85">
            Setiap langkah punya penanggung jawab dan bukti. Tahap berikutnya baru dibuka setelah
            tahap sebelumnya divalidasi.
          </p>
        </Reveal>
        <ol className="mt-12 grid lg:grid-cols-5 lg:gap-6">
          {processSteps.map((step, i) => (
            <Reveal
              key={step.step}
              as="li"
              delay={i * 80}
              className="relative flex gap-4 pb-8 last:pb-0 lg:block lg:pb-0"
            >
              {/* Garis penghubung: vertikal di ponsel, horizontal di desktop. */}
              {i < processSteps.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-10 bottom-0 left-5 w-px bg-white/25 lg:top-5 lg:right-[-1.5rem] lg:bottom-auto lg:left-12 lg:h-px lg:w-auto"
                />
              )}
              <span className="bg-accent text-ink relative flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums">
                {step.step}
              </span>
              <div className="min-w-0 lg:mt-5">
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/85">{step.description}</p>
              </div>
            </Reveal>
          ))}
        </ol>
        <Reveal className="mt-12">
          <Link href="/lacak" className="btn btn-secondary">
            Lacak pesanan Anda
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

/* Galeri: kisi foto bernomor, keterangan di bawah foto (bukan di atasnya,
   karena teks di atas foto bergantung pada seterang apa fotonya). */
function GallerySection() {
  return (
    <section id="galeri" className="border-line border-b bg-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <Reveal className="max-w-2xl">
          <SectionLabel index="04">Dokumentasi</SectionLabel>
          <h2 className="text-h2 text-ink mt-3 font-bold tracking-tight">
            Urutan tahap yang ditempuh setiap pesanan
          </h2>
          <p className="text-ink-muted mt-4 text-base leading-7">
            Foto pelaksanaan pesanan Anda sendiri dikirim di laporan akhir.
          </p>
        </Reveal>
        <div className="mt-10 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {landingPhotos.gallery.map((photo, i) => (
            <Reveal key={photo.src} as="figure" delay={(i % 3) * 90} anim="scale">
              <div className="border-line bg-surface-muted aspect-4/3 overflow-hidden rounded-lg border">
                <SitePhoto
                  src={photo.src}
                  alt={photo.alt}
                  width={800}
                  height={600}
                  sizes="(min-width: 1024px) 31vw, (min-width: 640px) 47vw, 100vw"
                  className="h-full w-full object-cover"
                />
              </div>
              <figcaption className="mt-3 flex items-baseline gap-3">
                <span className="text-primary text-sm font-bold tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-ink text-sm font-medium">{photo.caption}</span>
              </figcaption>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* Keunggulan: kolom teks bergaris atas, tanpa kartu. Isinya klaim pendek, dan
   kartu berikon seragam hanya menambah bingkai tanpa menambah isi. */
function FeaturesSection() {
  return (
    <section id="keunggulan" className="bg-surface-muted border-line border-b">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <Reveal className="max-w-2xl">
          <SectionLabel index="05">Kenapa kami</SectionLabel>
          <h2 className="text-h2 text-ink mt-3 font-bold tracking-tight">
            Ibadah yang bisa Anda telusuri
          </h2>
        </Reveal>
        <dl className="mt-10 grid gap-x-12 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal
              key={f.title}
              delay={(i % 3) * 80}
              className="border-primary/30 border-t-2 pt-5"
            >
              <dt className="text-ink flex items-center gap-2.5 text-base font-semibold">
                <Icon name={f.icon} className="text-primary size-5 shrink-0" />
                {f.title}
              </dt>
              <dd className="text-ink-muted mt-2 text-sm leading-6">{f.description}</dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}

/**
 * Testimoni. Hanya dirender bila `testimonials` di `lib/constants/site.ts`
 * berisi ulasan asli. Ulasan pertama jadi sorotan besar, sisanya berjajar
 * di bawahnya. Statis, bukan carousel: semua ulasan terbaca tanpa menunggu.
 */
function TestimonialsSection() {
  const [featured, ...rest] = testimonials;
  return (
    // Latar hijau muda: membedakan suara pemesan dari klaim kami sendiri di
    // section sebelum dan sesudahnya, yang berlatar abu dan putih.
    <section id="testimoni" className="bg-primary-light border-line border-b">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <Reveal className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <SectionLabel index="06">Kata pemesan</SectionLabel>
            <h2 className="text-h2 text-ink mt-3 font-bold tracking-tight">
              Dari keluarga yang sudah memesan
            </h2>
            <p className="text-ink-muted mt-4 text-base leading-7">
              Ditulis oleh pemesan, ditampilkan dengan izin mereka.
            </p>
          </div>
        </Reveal>

        <Reveal
          as="figure"
          anim="scale"
          className={`border-line mt-10 grid overflow-hidden rounded-lg border bg-white ${featured.photo ? 'lg:grid-cols-[0.9fr_1.1fr]' : ''}`}
        >
          {featured.photo && (
            <div className="bg-surface-muted aspect-4/3 lg:aspect-auto">
              <SitePhoto
                src={featured.photo.src}
                alt={featured.photo.alt}
                width={800}
                height={600}
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <div className="flex flex-col p-6 sm:p-10">
            <div className="flex items-center justify-between gap-4">
              <span aria-hidden className="text-primary text-7xl leading-[0.6] font-bold">
                “
              </span>
              {featured.rating && <Stars rating={featured.rating} />}
            </div>
            <blockquote className="text-ink mt-6 flex-1 text-xl leading-relaxed font-semibold text-balance sm:text-2xl lg:text-[1.75rem] lg:leading-snug">
              {featured.quote}
            </blockquote>
            <TestimonialAuthor t={featured} />
          </div>
        </Reveal>

        {rest.length > 0 && (
          <ul className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {rest.map((t, i) => (
              <Reveal
                key={`${t.name}-${i}`}
                as="li"
                delay={(i % 3) * 80}
                className="border-line flex flex-col overflow-hidden rounded-lg border bg-white"
              >
                <figure className="flex flex-1 flex-col">
                  {t.photo && (
                    <div className="bg-surface-muted aspect-4/3">
                      <SitePhoto
                        src={t.photo.src}
                        alt={t.photo.alt}
                        width={800}
                        height={600}
                        sizes="(min-width: 1024px) 31vw, (min-width: 768px) 47vw, 100vw"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-6">
                    {t.rating && <Stars rating={t.rating} />}
                    <blockquote
                      className={`text-ink flex-1 text-base leading-7 ${t.rating ? 'mt-3' : ''}`}
                    >
                      “{t.quote}”
                    </blockquote>
                    <TestimonialAuthor t={t} />
                  </div>
                </figure>
              </Reveal>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Bintang dari pemesan. Warna aksen emas: satu-satunya tempatnya di section ini. */
function Stars({ rating }: { rating: number }) {
  return (
    <span role="img" aria-label={`Rating ${rating} dari 5`} className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          viewBox="0 0 20 20"
          aria-hidden
          className={`size-5 ${n <= rating ? 'text-accent-dark' : 'text-line'}`}
          fill="currentColor"
        >
          <path d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 14.9l-5.3 2.7 1-5.8L1.5 7.7l5.9-.9z" />
        </svg>
      ))}
    </span>
  );
}

/** Inisial + nama, kota, lalu layanan dan tanggal pesanan. */
function TestimonialAuthor({ t }: { t: (typeof testimonials)[number] }) {
  const detail = [t.service, t.date].filter(Boolean).join(' · ');
  return (
    <figcaption className="border-line mt-6 flex items-center gap-3 border-t pt-5">
      <span
        aria-hidden
        className="bg-primary flex size-11 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
      >
        {t.name.charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0 text-sm leading-5">
        <span className="text-ink block font-semibold">
          {t.name}
          {t.city && <span className="text-ink-muted font-normal">, {t.city}</span>}
        </span>
        {detail && <span className="text-primary block font-medium">{detail}</span>}
      </span>
    </figcaption>
  );
}

/* FAQ: judul di kiri, akordeon di kanan. `<details>` bawaan: dibuka dengan
   Enter/Spasi, terbaca screen reader, dan jalan tanpa JavaScript. */
function FaqSection({ brand }: { brand: Brand }) {
  return (
    <section id="faq" className="border-line border-b bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <Reveal>
          <SectionLabel index={testimonials.length > 0 ? '07' : '06'}>Pertanyaan umum</SectionLabel>
          <h2 className="text-h2 text-ink mt-3 font-bold tracking-tight">Yang sering ditanyakan</h2>
          <p className="text-ink-muted mt-4 text-base leading-7">
            Belum menemukan jawabannya?{' '}
            <a
              href={siteConfig.whatsapp.href(`Halo ${brand.name}, saya ingin bertanya.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-semibold underline underline-offset-2"
            >
              Tanya lewat WhatsApp
            </a>
            .
          </p>
        </Reveal>
        <Reveal className="divide-line border-line divide-y border-y">
          {faqs.map((faq) => (
            <details key={faq.question} className="group [&_summary]:list-none">
              <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-4 py-4 text-left">
                <span className="text-ink group-open:text-primary text-base font-semibold">
                  {faq.question}
                </span>
                <svg
                  viewBox="0 0 24 24"
                  className="text-primary size-5 shrink-0 transition-transform duration-300 group-open:rotate-45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </summary>
              <p className="text-ink-muted max-w-2xl pb-5 text-base leading-7">{faq.answer}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

function CtaSection({ brand }: { brand: Brand }) {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16">
        <Reveal className="bg-primary flex flex-col gap-6 rounded-lg px-6 py-10 text-white sm:px-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <h2 className="text-h3 font-bold">Siap menunaikan aqiqah?</h2>
            <p className="mt-2 text-base leading-7 text-white/85">
              Tim kami membantu dari memilih paket sampai laporan pelaksanaan. Konsultasi gratis.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <Link href="/paket" className="btn btn-secondary btn-lg">
              Lihat paket aqiqah
            </Link>
            <a
              href={siteConfig.whatsapp.href(orderMessage(brand.name))}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-lg border border-white/70 text-white hover:bg-white/10"
            >
              <IconWhatsApp className="size-5" />
              Konsultasi WhatsApp
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** Nomor urut section: rujukan ke halaman buku catatan (motif design.md §0). */
function SectionLabel({ index, children }: { index: string; children: React.ReactNode }) {
  return (
    <p className="text-primary flex items-center gap-3 text-sm font-semibold">
      <span className="tabular-nums">{index}</span>
      <span aria-hidden className="bg-primary/40 h-px w-8" />
      <span>{children}</span>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* JSON-LD (SEO/GEO, 27_PAGE_MENU)                                     */
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
