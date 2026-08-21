import Link from 'next/link';
import type { Metadata } from 'next';
import {
  aqiqahPrograms,
  faqs,
  features,
  landingPhotos,
  nasiBoxPackages,
  processSteps,
  services,
  siteConfig,
} from '@/lib/constants/site';
import { formatIDR } from '@/lib/format/currency';
import { Icon, IconArrowRight, IconCheck, IconWhatsApp } from '@/components/site/icons';
import { SitePhoto } from '@/components/site/SitePhoto';
import { Reveal } from '@/components/site/Reveal';

export const metadata: Metadata = {
  title: `${siteConfig.name} — ${siteConfig.tagline}`,
  description: siteConfig.description,
  alternates: { canonical: '/' },
};

const orderMessage = (paket?: string) =>
  `Halo Sukses Aqiqah, saya ingin memesan${paket ? ` paket ${paket}` : ' layanan'}.`;

/**
 * Landing page.
 *
 * **Arah desain: editorial, bukan dekoratif** (`design.md §1` — *clarity over
 * decoration*). Yang sengaja TIDAK dipakai di halaman ini, karena semuanya
 * menarik perhatian ke dirinya sendiri alih-alih ke isinya:
 *
 * - teks bergradasi (`bg-clip-text`) — menurunkan keterbacaan judul;
 * - gumpalan blur dekoratif — beban render tanpa makna;
 * - `shadow-xl`/`2xl` bertumpuk — `design.md §4` meminta "shadow halus";
 * - `rounded-3xl` dan tombol pil — `design.md §4` menetapkan radius 8–12px;
 * - `hover:-translate-y` pada tiap kartu — gerakan yang tidak menyampaikan apa pun.
 *
 * Penggantinya: hierarki tipografi yang tegas, garis rambut sebagai pemisah,
 * rata kiri, dan satu warna aksen yang dipakai hemat. Bentuk ini juga lebih
 * jujur pada produknya — yang dijual adalah dokumentasi dan keterlacakan, dan
 * tampilan dokumenter menyampaikan itu lebih baik daripada tampilan promosi.
 *
 * **Animasi** mengikuti aturan yang sama: satu gerakan saja (naik 10px sambil
 * memudar masuk) lewat `<Reveal>`, dipakai pada blok besar — bukan pada setiap
 * elemen. Jeda antar-anggota satu kelompok ditahan di bawah 200ms supaya
 * pengunjung yang menggulir cepat tidak melewati elemen sebelum ia tampil.
 * Seluruhnya mati sendiri saat pengguna memilih "kurangi gerakan" di setelan
 * sistem (lihat `app/globals.css`).
 */
export default function LandingPage() {
  return (
    <>
      <JsonLd />
      <Hero />
      <ServicesSection />
      <PackagesSection />
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
    <section className="border-b border-neutral-200">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:gap-12 sm:px-6 sm:py-20 lg:grid-cols-[1fr_0.85fr] lg:items-end lg:gap-16 lg:py-24">
        {/* Hero tampil bertahap saat halaman dibuka: label → judul → paragraf →
            tombol → fakta. Jeda 60ms antar-baris cukup untuk terbaca berurutan
            tanpa membuat pengunjung menunggu. */}
        <div>
          <Reveal>
            <p className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
              Layanan Aqiqah · Zakat Sukses
            </p>
          </Reveal>

          {/* Ukuran & bobot yang membangun hierarki, bukan gradasi warna.
              `text-[2rem]` di ponsel: `text-4xl` membuat "tebarkan manfaat."
              pecah jadi tiga baris pada lebar 360px. */}
          <Reveal delay={60}>
            <h1 className="mt-5 text-[2rem] leading-[1.1] font-bold tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl">
              Tunaikan ibadah,
              <br />
              tebarkan manfaat.
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <p className="mt-5 max-w-xl text-base leading-7 text-neutral-600 sm:mt-6 sm:text-lg sm:leading-8">
              Aqiqah yang dikerjakan sesuai syariat dan dicatat di setiap tahapnya. Anda memantau
              prosesnya, lalu menerima laporan pelaksanaan berisi bukti — tanpa perlu bertanya.
            </p>
          </Reveal>

          {/* Tombol selebar layar di ponsel — target sentuh besar
              (`design.md §6`: "aksi 1-tap"). */}
          <Reveal delay={180}>
            <div className="mt-8 flex flex-col gap-3 sm:mt-9 sm:flex-row">
              <Link
                href="/checkout"
                className="bg-primary hover:bg-primary-dark active:bg-primary-dark inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-sm font-semibold text-white transition-colors"
              >
                Pesan online sekarang
                <IconArrowRight className="h-4 w-4" />
              </Link>
              <a
                href={siteConfig.whatsapp.href(orderMessage())}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 px-6 py-3.5 text-sm font-semibold text-neutral-800 transition-colors hover:border-neutral-400 hover:bg-neutral-50 active:bg-neutral-100"
              >
                <IconWhatsApp className="h-4 w-4" />
                Tanya via WhatsApp
              </a>
            </div>
          </Reveal>

          {/* Fakta dipisah garis, bukan dibungkus tiga kartu. Isinya sama, tapi
              tidak menuntut perhatian sebesar kartu. Di ponsel dibuat dua kolom
              agar tidak jadi tiga baris penuh yang mendorong foto terlalu jauh
              ke bawah. */}
          <Reveal delay={240}>
            <dl className="mt-9 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-neutral-200 pt-6 text-sm sm:flex sm:flex-wrap sm:gap-x-8">
              {[
                { value: 'Tanpa akun', label: 'Pesan langsung di web' },
                { value: 'Tiap tahap', label: 'Divalidasi sebelum lanjut' },
                { value: 'Link laporan', label: 'Dibuka tanpa login' },
              ].map((s) => (
                <div key={s.value}>
                  <dt className="font-semibold text-neutral-900">{s.value}</dt>
                  <dd className="mt-0.5 text-neutral-500">{s.label}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>

        {/* Foto dalam bingkai datar bergaris rambut — tanpa bayangan tebal,
            tanpa sudut membulat besar. */}
        <Reveal as="figure" delay={120} className="lg:pb-1">
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100">
            <SitePhoto
              src={landingPhotos.hero.src}
              alt={landingPhotos.hero.alt}
              width={landingPhotos.hero.width}
              height={landingPhotos.hero.height}
              priority
              sizes="(min-width: 1024px) 42vw, 100vw"
              className="h-full w-full object-cover"
            />
          </div>
          <figcaption className="mt-3 flex items-start gap-2 text-xs leading-5 text-neutral-500">
            <IconCheck className="text-primary mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Setiap foto pada laporan Anda melewati validasi tim sebelum tahap berikutnya dibuka.
            </span>
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
    <Section id="layanan" index="01" eyebrow="Layanan">
      <SectionIntro
        title="Pilih cara aqiqah Anda ditunaikan"
        lead="Keduanya menempuh proses yang sama sampai daging siap; yang berbeda hanya ke mana ia berakhir."
      />

      {/* Dibagi garis, bukan dijadikan tiga kartu melayang. */}
      <div className="mt-10 grid divide-y divide-neutral-200 border-y border-neutral-200 sm:mt-12 md:grid-cols-3 md:divide-x md:divide-y-0">
        {services.map((s, i) => (
          <Reveal
            key={s.title}
            delay={i * 70}
            className="px-0 py-7 sm:py-8 md:px-7 md:first:pl-0 md:last:pr-0"
          >
            <Icon name={s.icon} className="text-primary h-7 w-7" />
            <h3 className="mt-4 text-lg font-semibold text-neutral-900 sm:mt-5">{s.title}</h3>
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
function PackagesSection() {
  return (
    <Section id="paket" index="02" eyebrow="Paket & Harga">
      <SectionIntro
        title="Harga sudah termasuk seluruh prosesnya"
        lead="Pemotongan syar’i, pemasakan, dokumentasi, dan laporan pelaksanaan — tidak ada biaya yang menyusul di belakang."
      />

      <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200 sm:mt-12 lg:grid-cols-3">
        {aqiqahPrograms.map((p, i) => (
          <Reveal key={p.slug} as="article" delay={i * 70} className="flex flex-col bg-white">
            <div className="overflow-hidden bg-neutral-100">
              <SitePhoto
                src={p.photo.src}
                alt={p.photo.alt}
                width={600}
                height={400}
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="h-full w-full object-cover"
              />
            </div>

            <div className="flex flex-1 flex-col p-6">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-base font-semibold text-neutral-900">Aqiqah {p.name}</h3>
                {/* Penanda "paling diminati" jadi label teks kecil, bukan pita
                    mengambang yang menggeser tata letak kartunya. */}
                {p.popular && (
                  <span className="border-primary/30 text-primary shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                    Terpopuler
                  </span>
                )}
              </div>

              <p className="mt-3 text-3xl font-bold tracking-tight text-neutral-900 tabular-nums">
                {formatIDR(p.price)}
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-600">{p.tagline}</p>

              <ul className="mt-6 flex-1 space-y-2.5 border-t border-neutral-100 pt-5">
                {p.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5 text-sm text-neutral-700">
                    <IconCheck className="text-primary mt-[3px] h-3.5 w-3.5 shrink-0" />
                    <span className="leading-6">{feat}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={`/checkout?paket=${p.slug}`}
                className={`mt-6 inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-colors ${
                  p.popular
                    ? 'bg-primary hover:bg-primary-dark text-white'
                    : 'border border-neutral-300 text-neutral-800 hover:border-neutral-400 hover:bg-neutral-50'
                }`}
              >
                Pesan paket {p.name}
                <IconArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        ))}
      </div>

      {/* Nasi Box — tambahan yang menempel pada paket ibadah, bukan pesanan
          berdiri sendiri. Jalurnya tetap WhatsApp: RPC `create_guest_order`
          memang menolak layanan bertipe `nasi_box`. */}
      <Reveal className="mt-10 rounded-lg border border-neutral-200 p-5 sm:mt-12 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xl">
            <h3 className="text-base font-semibold text-neutral-900">
              Nasi box aqiqah{' '}
              <span className="font-normal text-neutral-400">— tambahan opsional</span>
            </h3>
            <p className="mt-1.5 text-sm leading-6 text-neutral-600">
              Berbagi kebahagiaan aqiqah dalam bentuk nasi box siap saji. Harga per porsi, dipesan
              bersama paket aqiqah lewat tim kami.
            </p>
          </div>
          <a
            href={siteConfig.whatsapp.href(orderMessage('Nasi Box Aqiqah'))}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-800 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
          >
            <IconWhatsApp className="h-4 w-4" />
            Tanya nasi box
          </a>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3.5 border-t border-neutral-100 pt-6 sm:mt-7 sm:grid-cols-3 lg:grid-cols-5">
          {nasiBoxPackages.map((box) => (
            <div key={box.slug} className="flex items-baseline justify-between gap-2">
              <dt className="text-sm text-neutral-600">{box.name}</dt>
              <dd className="text-sm font-semibold text-neutral-900 tabular-nums">
                {formatIDR(box.price)}
              </dd>
            </div>
          ))}
        </dl>
      </Reveal>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Proses                                                              */
/* ------------------------------------------------------------------ */
function ProcessSection() {
  return (
    <section id="proses" className="bg-primary-dark text-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
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

        {/* Nomor besar sebagai penanda urutan — tidak perlu gelembung
            mengambang di sudut kartu. */}
        <ol className="mt-10 grid gap-px bg-white/15 sm:mt-14 sm:grid-cols-2 lg:grid-cols-5">
          {processSteps.map((step, i) => (
            <Reveal key={step.step} as="li" delay={i * 60} className="bg-primary-dark p-5 sm:p-6">
              <span className="text-accent block text-2xl font-bold tabular-nums">{step.step}</span>
              <h3 className="mt-3 text-base font-semibold">{step.title}</h3>
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
 */
function GallerySection() {
  return (
    <Section id="galeri" index="04" eyebrow="Dokumentasi">
      <SectionIntro
        title="Lihat sendiri setiap tahapnya"
        lead="Foto di bawah adalah tahapan yang sama persis dengan yang Anda terima di laporan pelaksanaan — bukan foto ilustrasi."
      />

      <div className="mt-10 grid gap-x-5 gap-y-7 sm:mt-12 sm:grid-cols-2 sm:gap-y-8 lg:grid-cols-3">
        {landingPhotos.gallery.map((photo, i) => (
          // Jeda dihitung per baris, bukan per foto: dengan enam foto, `i * 70`
          // membuat yang terakhir menunggu 350ms — sudah terlewat saat digulir.
          // `i % 3` menahan jeda maksimum di 140ms untuk semua ukuran layar.
          <Reveal key={photo.src} as="figure" delay={(i % 3) * 70}>
            <div className="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100">
              <SitePhoto
                src={photo.src}
                alt={photo.alt}
                width={800}
                height={600}
                sizes="(min-width: 1024px) 31vw, (min-width: 640px) 47vw, 100vw"
                className="h-full w-full object-cover"
              />
            </div>
            {/* Keterangan di bawah foto, bukan ditumpuk di atasnya lewat
                gradasi gelap — teks di atas foto selalu bergantung pada
                seterang apa foto yang nanti diunggah. */}
            <figcaption className="mt-3 flex gap-3">
              <span className="text-xs font-semibold text-neutral-400 tabular-nums">
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
    <Section id="keunggulan" index="05" eyebrow="Kenapa Kami">
      <SectionIntro
        title="Ibadah yang bisa Anda telusuri"
        lead="Bukan sekadar jasa potong hewan — setiap tahapnya tercatat, tervalidasi, dan bisa Anda periksa kembali."
      />

      <div className="mt-10 grid gap-x-10 gap-y-7 sm:mt-12 sm:grid-cols-2 sm:gap-y-9 lg:grid-cols-3">
        {features.map((f, i) => (
          <Reveal key={f.title} delay={(i % 3) * 70} className="border-t border-neutral-200 pt-5">
            <div className="flex items-center gap-2.5">
              <Icon name={f.icon} className="text-primary h-5 w-5 shrink-0" />
              <h3 className="text-base font-semibold text-neutral-900">{f.title}</h3>
            </div>
            <p className="mt-2.5 text-sm leading-6 text-neutral-600">{f.description}</p>
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
    <Section id="faq" index="06" eyebrow="FAQ">
      <SectionIntro
        title="Pertanyaan yang sering diajukan"
        lead="Belum menemukan jawabannya? Hubungi kami langsung via WhatsApp."
      />

      <Reveal className="mt-10 max-w-3xl divide-y divide-neutral-200 border-y border-neutral-200">
        {faqs.map((faq) => (
          <details key={faq.question} className="group py-4 sm:py-5 [&_summary]:list-none">
            <summary className="flex cursor-pointer items-start justify-between gap-4 text-left sm:gap-6">
              <span className="group-hover:text-primary text-[15px] font-medium text-neutral-900 transition-colors sm:text-base">
                {faq.question}
              </span>
              <span className="mt-1 shrink-0 text-neutral-400 transition-transform group-open:rotate-45">
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
            <p className="animate-in fade-in slide-in-from-top-1 mt-3 max-w-2xl text-sm leading-7 text-neutral-600 duration-300">
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
    <section className="border-t border-neutral-200 bg-neutral-50">
      <Reveal className="mx-auto flex max-w-6xl flex-col gap-7 px-4 py-14 sm:gap-8 sm:px-6 sm:py-20 lg:flex-row lg:items-center lg:justify-between">
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
            className="bg-primary hover:bg-primary-dark active:bg-primary-dark inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-sm font-semibold text-white transition-colors"
          >
            Pesan online sekarang
            <IconArrowRight className="h-4 w-4" />
          </Link>
          <a
            href={siteConfig.whatsapp.href(orderMessage())}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-6 py-3.5 text-sm font-semibold text-neutral-800 transition-colors hover:border-neutral-400 active:bg-neutral-100"
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
  children,
}: {
  id: string;
  index: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-b border-neutral-200">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <Reveal>
          <p className="text-xs font-semibold tracking-[0.14em] text-neutral-400 uppercase">
            {index} — <span className="text-primary">{eyebrow}</span>
          </p>
        </Reveal>
        {children}
      </div>
    </section>
  );
}

function SectionIntro({ title, lead }: { title: string; lead: string }) {
  return (
    <Reveal delay={60} className="mt-4 max-w-2xl">
      <h2 className="text-[1.75rem] leading-tight font-bold tracking-tight text-neutral-900 sm:text-4xl">
        {title}
      </h2>
      <p className="mt-3.5 text-base leading-7 text-neutral-600 sm:mt-4">{lead}</p>
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
