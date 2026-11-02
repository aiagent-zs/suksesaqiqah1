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
import { STAGE_META, STAGE_SEQUENCE } from '@/features/stages/sequence';
import { getLandingCatalogue } from '@/features/landing/catalogue';
import { buildPackageTabs, orderMessage } from '@/features/landing/package-cards';
import { IconWhatsApp } from '@/components/site/icons';
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
 * harganya, bagaimana prosesnya dan apa buktinya, lalu keraguan yang tersisa.
 * Komposisinya berganti tiap section (design.md §7: dua section berurutan
 * tidak boleh sama di lebih dari dua sumbu). Proses dan galeri dilebur jadi
 * satu catatan pelaksanaan (2 November): foto adalah bukti tiap langkah, jadi
 * memisahkannya membuat pengunjung mencocokkan sendiri.
 */
export default async function LandingPage() {
  const [catalogue, brand] = await Promise.all([getLandingCatalogue(), getBrand()]);
  const faqList = faqs(brand.name);

  return (
    <>
      <JsonLd faqList={faqList} />
      <Hero brand={brand} />
      <ServicesSection />
      <PackagesSection catalogue={catalogue} brand={brand} />
      <LedgerSection />
      <FeaturesSection />
      {testimonials.length > 0 && <TestimonialsSection />}
      <FaqSection brand={brand} faqList={faqList} />
      <CtaSection brand={brand} />
    </>
  );
}

/* Hero: teks kiri, foto kanan, tetap putih (latar hijau tua ditolak pemilik).
   Kisi garis pindah ke belakang kolom foto dan bingkai fotonya menempel ke sel
   56px, jadi motifnya terbaca sebagai halaman bergaris, bukan noda di pojok. */
function Hero({ brand }: { brand: Brand }) {
  // Nama tahap persis seperti di Lacak Pesanan (`STAGE_META`), urutan `kirim`.
  const slip = STAGE_SEQUENCE.kirim.map((s) => STAGE_META[s].label);

  return (
    <section className="border-line relative overflow-hidden border-b bg-white">
      {/* Kisi hanya di separuh kanan desktop (di belakang foto): teks tetap di
          atas putih polos supaya kontrasnya tidak bergantung pada garis. */}
      <div
        aria-hidden
        className="bg-grid pointer-events-none absolute inset-y-0 right-0 hidden w-[48%] bg-[position:0_0] lg:block"
      />
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pt-8 pb-14 sm:px-6 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-24">
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
              penerima manfaat. Setiap tahap dicatat dan bisa Anda lacak sendiri, tanpa membuat
              akun.
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
        </div>

        <Reveal
          as="figure"
          delay={180}
          anim="scale"
          className="relative w-full max-w-md lg:max-w-none"
        >
          {/* Bidang hijau digeser tepat satu sel kisi (56px) di desktop, jadi
              tepinya jatuh di garis kisi: kedalaman lewat bentuk (design.md §4). */}
          <div
            aria-hidden
            className="bg-primary-light absolute top-4 right-0 -bottom-3 left-4 rounded-lg lg:top-14 lg:-right-14 lg:-bottom-14 lg:left-14"
          />
          <div className="border-line relative aspect-3/2 overflow-hidden rounded-lg border bg-white">
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

          {/* Slip: contoh tampilan Lacak Pesanan, ditandai sebagai contoh (R-38),
              bukan status pesanan sungguhan. Timeline titik-dan-garis, bukan
              tabel bergaris: lima baris tabel menutupi separuh foto dan terbaca
              seperti formulir. Titiknya menandai status nyata (selesai, berjalan,
              menunggu), tanpa denyut. Ponsel: di bawah foto, hanya menindih
              tepinya. Desktop: kartu sempit di pojok kiri bawah. */}
          <figcaption className="border-line relative mx-4 -mt-8 rounded-lg border bg-white px-4 py-3.5 shadow-sm sm:mr-auto sm:ml-8 sm:w-60 lg:absolute lg:-bottom-8 lg:-left-8 lg:m-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-ink text-sm font-semibold">Lacak pesanan</p>
              <span className="bg-surface-muted text-ink-muted rounded px-1.5 py-0.5 text-[11px]">
                Contoh
              </span>
            </div>
            <ol className="mt-3">
              {slip.map((label, i) => {
                const state = i < 2 ? 'done' : i === 2 ? 'current' : 'todo';
                return (
                  <li key={label} className="relative flex items-center gap-3 pb-2.5 last:pb-0">
                    {/* Garis penghubung ke titik berikutnya; hijau bila tahap ini sudah lewat. */}
                    {i < slip.length - 1 && (
                      <span
                        aria-hidden
                        className={`absolute top-3.5 left-[5px] h-full w-0.5 ${state === 'done' ? 'bg-primary' : 'bg-line'}`}
                      />
                    )}
                    <span
                      aria-hidden
                      className={`relative size-3 shrink-0 rounded-full ${
                        state === 'done'
                          ? 'bg-primary'
                          : state === 'current'
                            ? 'border-primary border-2 bg-white'
                            : 'border-line border-2 bg-white'
                      }`}
                    />
                    <span
                      className={`flex-1 text-sm ${
                        state === 'todo' ? 'text-ink-muted' : 'text-ink font-medium'
                      }`}
                    >
                      {label}
                      <span className="sr-only">
                        {state === 'done' ? ', selesai' : state === 'current' ? ', berjalan' : ''}
                      </span>
                    </span>
                    {state === 'current' && (
                      <span aria-hidden className="text-primary text-xs font-semibold">
                        Berjalan
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </figcaption>
        </Reveal>
      </div>
    </section>
  );
}

/* Layanan: prosesnya sama, hanya tujuannya beda. Jadi dua foto besar
   menggantung di bawah satu garis bersama yang menamai bagian yang sama;
   nasi box pindah ke catatan tambahan di section paket. */
function ServicesSection() {
  const ways = services.filter((s) => !('addOn' in s));
  return (
    <section id="layanan" className="border-line border-b bg-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <SectionLabel index="01" center>
            Layanan
          </SectionLabel>
          <h2 className="text-h2 text-ink mt-3 font-bold tracking-tight">
            Pilih cara aqiqah Anda ditunaikan
          </h2>
        </Reveal>

        {/* Garis bersama: satu bagian yang sama untuk semua pesanan, lalu
            bercabang. Garis vertikal kecil adalah cabangnya. */}
        <Reveal className="mt-10 sm:mt-12">
          <div className="relative">
            <p className="border-primary/40 text-ink relative border-t pt-3 text-center text-sm font-semibold sm:text-base">
              Disembelih dan dimasak sama untuk semua pesanan.{' '}
              <span className="text-ink-muted font-normal">Yang berbeda hanya ke mana ia berakhir.</span>
            </p>
            <span aria-hidden className="bg-primary/40 absolute top-full left-1/4 hidden h-8 w-px md:block" />
            <span aria-hidden className="bg-primary/40 absolute top-full left-3/4 hidden h-8 w-px md:block" />
          </div>
        </Reveal>

        <ul className="mt-8 grid gap-10 md:grid-cols-2 md:gap-6 lg:gap-10">
          {ways.map((s, i) => (
            <Reveal key={s.title} as="li" delay={i * 90} className="min-w-0">
              <div className="border-line bg-surface-muted aspect-4/3 overflow-hidden rounded-lg border">
                <SitePhoto
                  src={s.photo.src}
                  alt={s.photo.alt}
                  width={1200}
                  height={800}
                  sizes="(min-width: 768px) 46vw, 100vw"
                  className="h-full w-full object-cover"
                />
              </div>
              <h3 className="text-h3 text-ink mt-5 font-semibold">{s.title}</h3>
              <p className="text-ink-muted mt-2 max-w-lg text-base leading-7">{s.description}</p>
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
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-20">
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
        {/* Tab bawaan Aqiqah: ketiga paketnya punya foto, jadi kisi pertama
            yang dilihat pengunjung memperlihatkan masakannya, bukan teks saja. */}
        <PackageFilter
          tabs={buildPackageTabs(catalogue, 3, undefined, brand.name)}
          defaultTab="aqiqah"
        />
      </div>
    </section>
  );
}

/**
 * Foto tiap langkah. Enam foto galeri dipetakan ke lima langkah sesuai
 * isinya; keterangan dan urutannya tetap dari `landingPhotos.gallery`.
 * Pemesanan dan pembayaran tidak punya foto lapangan, jadi tidak diberi.
 */
const LEDGER_PHOTOS: Record<string, number[]> = {
  '03': [0, 1, 2, 3],
  '04': [4, 5],
};

/* Catatan pelaksanaan: judul di kolom samping yang menempel, langkah sebagai
   baris bergaris dengan nomor di margin kiri seperti kertas bergaris. Latar
   terang: satu-satunya pita gelap di halaman ini kini footer. */
function LedgerSection() {
  const gallery = landingPhotos.gallery;
  return (
    <section id="proses" className="border-line border-b bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 sm:py-20 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
        <Reveal className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="text-h2 text-ink font-bold tracking-tight">
            Catatan pelaksanaan setiap pesanan
          </h2>
          <p className="text-ink-muted mt-4 text-base leading-7">
            Setiap langkah punya penanggung jawab dan bukti. Tahap berikutnya baru dibuka setelah
            tahap sebelumnya divalidasi. Foto pesanan Anda sendiri dikirim di laporan akhir.
          </p>
          <Link href="/lacak" className="btn btn-outline mt-6">
            Lacak pesanan Anda
          </Link>
        </Reveal>

        <ol className="border-line border-t">
          {processSteps.map((step) => {
            const photos = (LEDGER_PHOTOS[step.step] ?? []).map((i) => ({ ...gallery[i], n: i + 1 }));
            return (
              <Reveal
                key={step.step}
                as="li"
                className="border-line grid grid-cols-[2.5rem_1fr] gap-x-4 border-b py-6 sm:grid-cols-[3rem_1fr]"
              >
                {/* Margin kertas bergaris: nomor di kiri garis vertikal tipis. */}
                <span className="border-primary/30 text-primary border-r pr-3 text-right text-sm font-bold tabular-nums">
                  {step.step}
                </span>
                <div className="min-w-0">
                  <h3 className="text-ink text-lg font-semibold">{step.title}</h3>
                  <p className="text-ink-muted mt-1 text-sm leading-6">{step.record}</p>
                  {photos.length > 0 && (
                    // Ukuran berselang antar-langkah: Produksi empat foto kecil
                    // berderet (urutan kerjanya), Pengiriman dua foto besar,
                    // supaya enam foto tidak terbaca enam blok kembar.
                    <ul
                      className={`mt-4 grid grid-cols-2 gap-3 ${photos.length > 2 ? 'sm:grid-cols-4' : 'sm:gap-4'}`}
                    >
                      {photos.map((p) => (
                        <li key={p.src}>
                          <figure>
                            <div className="border-line bg-surface-muted aspect-4/3 overflow-hidden rounded-lg border">
                              <SitePhoto
                                src={p.src}
                                alt={p.alt}
                                width={800}
                                height={600}
                                sizes={photos.length > 2 ? '(min-width: 1024px) 13vw, 45vw' : '(min-width: 1024px) 26vw, 45vw'}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <figcaption className="text-ink mt-1.5 flex gap-1.5 text-xs leading-5">
                              <span className="text-primary font-bold tabular-nums">
                                {String(p.n).padStart(2, '0')}
                              </span>
                              {p.caption}
                            </figcaption>
                          </figure>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Reveal>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/* Kenapa kami: satu kalimat panjang sebagai titik fokus, tiga klaim di satu
   baris bergaris. Tanpa ikon dan kartu: klaim pendek tidak butuh bingkai. */
function FeaturesSection() {
  return (
    <section id="keunggulan" className="bg-surface-muted border-line border-b">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-24">
        <Reveal>
          <h2 className="text-ink-muted text-sm font-semibold">Kenapa kami</h2>
          <p className="text-ink mt-4 max-w-3xl text-2xl leading-snug font-semibold text-balance lg:text-3xl">
            Ibadah yang bisa Anda telusuri: dari hewan yang diperiksa sebelum disembelih sampai
            daging yang sampai ke penerima, <span className="text-primary">setiap tahapnya punya bukti</span>.
          </p>
        </Reveal>
        <Reveal delay={90}>
          <dl className="border-line divide-line mt-10 grid divide-y border-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {features.map((f) => (
              <div key={f.title} className="py-5 sm:px-6 sm:first:pl-0 sm:last:pr-0">
                <dt className="text-ink text-base font-semibold">{f.title}</dt>
                <dd className="text-ink-muted mt-1.5 text-sm leading-6">{f.description}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}

/**
 * Testimoni. Hanya dirender bila `testimonials` di `lib/constants/site.ts`
 * berisi ulasan asli. Ulasan pertama jadi sorotan besar; sisanya baris tenang
 * di dalam kartu yang sama, bukan kisi yang menyisakan kolom kosong. Fotonya
 * tidak ditampilkan: adegan Rumah Tahfizh yang sama sudah tampil di Layanan
 * dan catatan pelaksanaan, dan yang ketiga kali tidak menambah bukti.
 */
function TestimonialsSection() {
  const [featured, ...rest] = testimonials;
  return (
    // Latar hijau muda: membedakan suara pemesan dari klaim kami sendiri di
    // section sebelum dan sesudahnya, yang berlatar abu dan putih.
    <section id="testimoni" className="bg-primary-light border-line border-b">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-20">
        <Reveal as="figure" className="border-line rounded-lg border bg-white p-6 sm:p-10">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-primary text-sm font-semibold">Kata pemesan</h2>
            {featured.rating && <Stars rating={featured.rating} />}
          </div>
          <blockquote className="text-ink mt-5 text-xl leading-relaxed font-semibold text-balance sm:text-2xl lg:text-[1.75rem] lg:leading-snug">
            “{featured.quote}”
          </blockquote>
          <TestimonialAuthor t={featured} />

          {rest.map((t, i) => (
            <figure
              key={`${t.name}-${i}`}
              className="border-line mt-6 border-t pt-5 sm:flex sm:items-baseline sm:justify-between sm:gap-6"
            >
              <blockquote className="text-ink text-base leading-7">“{t.quote}”</blockquote>
              <figcaption className="text-ink-muted mt-1 shrink-0 text-sm sm:mt-0">
                <span className="text-ink font-semibold">{t.name}</span>
                {t.city && `, ${t.city}`}
                {t.service && ` · ${t.service}`}
              </figcaption>
            </figure>
          ))}
        </Reveal>
        <p className="text-ink-muted mt-4 text-center text-sm">
          Ditulis oleh pemesan, ditampilkan dengan izin mereka.
        </p>
      </div>
    </section>
  );
}

/** Bintang dari pemesan. Emas tua: rating adalah nilai KPI dari pemesan sendiri. */
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
    <figcaption className="mt-6 flex items-center gap-3">
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
function FaqSection({
  brand,
  faqList,
}: {
  brand: Brand;
  faqList: ReturnType<typeof faqs>;
}) {
  return (
    <section id="faq" className="border-line border-b bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <Reveal>
          <SectionLabel index="03">Pertanyaan umum</SectionLabel>
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
          {faqList.map((faq) => (
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

/* CTA: kartu terbelah. Foto masakan utuh di satu sisi (dulu tertutup lapisan
   hijau 90% sampai tak terlihat), teks dan tombol di hijau muda berkisi di
   sisi lain. Terang, sejalan dengan seluruh halaman. */
function CtaSection({ brand }: { brand: Brand }) {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16">
        <Reveal className="border-line grid overflow-hidden rounded-lg border md:grid-cols-[0.9fr_1.1fr]">
          <div className="bg-surface-muted aspect-3/2 md:aspect-auto">
            <SitePhoto
              src="images/landing/masak.webp"
              alt="Daging aqiqah dimasak dalam wajan besar"
              width={1200}
              height={800}
              sizes="(min-width: 768px) 45vw, 100vw"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="bg-primary-light relative px-6 py-10 sm:px-10 sm:py-14">
            <div aria-hidden className="bg-grid pointer-events-none absolute inset-0" />
            <div className="relative">
              <p className="text-primary text-sm font-semibold">Konsultasi gratis</p>
              <h2 className="text-h2 text-ink mt-3 font-bold tracking-tight">
                Siap menunaikan aqiqah?
              </h2>
              {/* `text-ink`, bukan `ink-muted`: abu di atas hijau muda hanya 4,33:1. */}
              <p className="text-ink mt-3 max-w-md text-base leading-7">
                Tim kami membantu dari memilih paket sampai laporan pelaksanaan.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/paket" className="btn btn-primary btn-lg">
                  Lihat paket aqiqah
                </Link>
                <a
                  href={siteConfig.whatsapp.href(orderMessage(brand.name))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-lg"
                >
                  <IconWhatsApp className="size-5" />
                  Konsultasi WhatsApp
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** Nomor urut section: rujukan ke halaman buku catatan (motif design.md §0). */
function SectionLabel({
  index,
  center = false,
  children,
}: {
  index: string;
  center?: boolean;
  children: React.ReactNode;
}) {
  return (
    <p
      className={`text-primary flex items-center gap-3 text-sm font-semibold ${center ? 'justify-center' : ''}`}
    >
      <span className="tabular-nums">{index}</span>
      <span aria-hidden className="bg-primary/40 h-px w-8" />
      <span>{children}</span>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* JSON-LD (SEO/GEO, 27_PAGE_MENU)                                     */
/* ------------------------------------------------------------------ */
function JsonLd({ faqList }: { faqList: ReturnType<typeof faqs> }) {
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
      // Teks yang sama dengan yang dirender, sudah memuat nama merek kanal.
      mainEntity: faqList.map((faq) => ({
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
