import Link from 'next/link';
import type { Metadata } from 'next';
import {
  aqiqahPrograms,
  faqs,
  features,
  nasiBoxPackages,
  processSteps,
  services,
  siteConfig,
} from '@/lib/constants/site';
import { formatIDR } from '@/lib/format/currency';
import { Icon, IconArrowRight, IconCheck, IconWhatsApp } from '@/components/site/icons';

export const metadata: Metadata = {
  title: `${siteConfig.name} — ${siteConfig.tagline}`,
  description: siteConfig.description,
  alternates: { canonical: '/' },
};

const orderMessage = (paket?: string) =>
  `Halo Sukses Aqiqah, saya ingin memesan${paket ? ` paket ${paket}` : ' layanan'}.`;

export default function LandingPage() {
  return (
    <>
      <JsonLd />
      <Hero />
      <ServicesSection />
      <FeaturesSection />
      <PackagesSection />
      <ProcessSection />
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
    <section className="from-primary-light relative overflow-hidden bg-gradient-to-b via-white to-white">
      {/* Dekor berlapis: dua gumpalan warna + kisi titik tipis. Kisinya memberi
          tekstur pada latar yang tadinya rata, tanpa menambah beban gambar. */}
      <div
        aria-hidden
        className="bg-primary/15 pointer-events-none absolute -top-32 -right-24 h-96 w-96 rounded-full blur-3xl"
      />
      <div
        aria-hidden
        className="bg-accent/15 pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle,var(--color-primary)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_72%)] [background-size:28px_28px] opacity-[0.15]"
      />

      <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="border-primary/20 text-primary-dark inline-flex items-center gap-2 rounded-full border bg-white/80 px-4 py-1.5 text-xs font-semibold shadow-sm backdrop-blur">
            <span className="bg-accent h-1.5 w-1.5 animate-pulse rounded-full" />
            Aqiqah · Qurban · Sedekah Daging
          </span>

          <h1 className="mt-7 text-[2.5rem] leading-[1.1] font-bold tracking-tight text-neutral-900 sm:text-6xl md:text-7xl">
            Tunaikan Ibadah,
            <br />
            <span className="from-primary to-success bg-gradient-to-r bg-clip-text text-transparent">
              Tebarkan Manfaat
            </span>
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-neutral-600">
            Layanan Aqiqah, Qurban, dan Sedekah Daging yang syar’i dan amanah. Pantau setiap tahap
            secara real-time dan terima laporan pelaksanaan yang transparan — tanpa perlu bertanya.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {/* Pemesanan mandiri jadi aksi utama; WhatsApp tetap sejajar di
                sebelahnya untuk yang ingin bertanya lebih dulu. */}
            <Link
              href="/checkout"
              className="bg-primary shadow-primary/25 hover:bg-primary-dark group inline-flex w-full items-center justify-center gap-2 rounded-full px-8 py-4 text-base font-semibold text-white shadow-xl transition-all hover:shadow-2xl sm:w-auto"
            >
              Pesan Online Sekarang
              <IconArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href={siteConfig.whatsapp.href(orderMessage())}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:border-primary hover:text-primary inline-flex w-full items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white/80 px-8 py-4 text-base font-semibold text-neutral-800 backdrop-blur transition-colors sm:w-auto"
            >
              <IconWhatsApp className="h-5 w-5" />
              Tanya via WhatsApp
            </a>
          </div>

          <p className="mt-5 text-xs text-neutral-500">
            Tanpa perlu membuat akun · Pembayaran dikonfirmasi tim kami
          </p>

          {/* Stat strip */}
          <dl className="mx-auto mt-14 grid max-w-2xl grid-cols-3 gap-3 sm:gap-4">
            {[
              { value: '100%', label: 'Syar’i & tersertifikasi' },
              { value: 'Real-time', label: 'Pantau status order' },
              { value: '< 1 menit', label: 'Laporan otomatis' },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-white/70 bg-white/80 px-3 py-4 shadow-sm backdrop-blur transition-shadow hover:shadow-md"
              >
                <dt className="text-primary text-lg font-bold tracking-tight sm:text-2xl">
                  {s.value}
                </dt>
                <dd className="mt-1 text-xs leading-5 text-neutral-600 sm:text-sm">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Layanan                                                             */
/* ------------------------------------------------------------------ */
function ServicesSection() {
  return (
    <section id="layanan" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <SectionHeading
        eyebrow="Layanan Kami"
        title="Satu platform untuk tiga ibadah"
        subtitle="Dari niat hingga daging sampai ke penerima manfaat — semuanya terkelola rapi dan terdokumentasi."
      />
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {services.map((s) => (
          <div
            key={s.title}
            className="group hover:border-primary/30 hover:shadow-primary/5 rounded-2xl border border-neutral-200 bg-white p-7 transition-all hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="bg-primary-light text-primary group-hover:bg-primary inline-flex h-14 w-14 items-center justify-center rounded-2xl transition-colors group-hover:text-white">
              <Icon name={s.icon} className="h-7 w-7" />
            </div>
            <h3 className="mt-5 text-xl font-bold text-neutral-900">{s.title}</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-600">{s.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Keunggulan                                                          */
/* ------------------------------------------------------------------ */
function FeaturesSection() {
  return (
    <section id="keunggulan" className="bg-neutral-50 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Kenapa Sukses Aqiqah"
          title="Ibadah yang bisa Anda telusuri"
          subtitle="Bukan sekadar jasa potong hewan — kami mengubah proses manual menjadi pengalaman digital yang transparan dan dapat dipertanggungjawabkan."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="flex gap-4 rounded-2xl bg-white p-6 shadow-sm">
              <div className="bg-primary-light text-primary inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                <Icon name={f.icon} className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-neutral-900">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-neutral-600">{f.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Paket & Harga                                                       */
/* ------------------------------------------------------------------ */
function PackagesSection() {
  return (
    <section id="paket" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <SectionHeading
        eyebrow="Paket & Harga"
        title="Pilih paket sesuai kebutuhan"
        subtitle="Harga transparan, sudah termasuk pemotongan syar’i, masakan, dokumentasi, dan laporan pelaksanaan."
      />

      {/* Program Aqiqah */}
      <div className="mt-14 grid items-start gap-6 lg:grid-cols-3">
        {aqiqahPrograms.map((p) => (
          <div
            key={p.slug}
            className={`group relative flex flex-col rounded-3xl p-7 transition-all duration-300 ${
              p.popular
                ? 'ring-primary shadow-primary/15 bg-white shadow-2xl ring-2 lg:-translate-y-4'
                : 'hover:ring-primary/40 bg-white shadow-sm ring-1 ring-neutral-200 hover:-translate-y-1 hover:shadow-xl'
            }`}
          >
            {p.popular && (
              <span className="bg-accent absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-4 py-1.5 text-xs font-bold tracking-wide text-white shadow-lg">
                Paling Diminati
              </span>
            )}

            <h3 className="text-primary text-sm font-semibold tracking-wide uppercase">
              Aqiqah {p.name}
            </h3>

            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-4xl font-bold tracking-tight text-neutral-900">
                {formatIDR(p.price)}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-neutral-600">{p.tagline}</p>

            <ul className="mt-6 flex-1 space-y-3 border-t border-neutral-100 pt-6">
              {p.features.map((feat) => (
                <li key={feat} className="flex items-start gap-2.5 text-sm text-neutral-700">
                  <IconCheck className="text-success mt-0.5 h-4 w-4 shrink-0" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>

            {/* Aksi utama menuju form pemesanan mandiri, membawa slug paketnya
                supaya pengunjung tidak perlu memilih ulang di halaman sana. */}
            <Link
              href={`/checkout?paket=${p.slug}`}
              className={`mt-7 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-semibold transition-all ${
                p.popular
                  ? 'bg-primary hover:bg-primary-dark shadow-primary/25 text-white shadow-lg'
                  : 'hover:border-primary hover:text-primary border border-neutral-300 text-neutral-800'
              }`}
            >
              Pesan Paket {p.name}
              <IconArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>

            {/* Kanal lama dipertahankan sebagai jalur kedua — sebagian pemesan
                memang lebih nyaman bertanya dulu sebelum mengisi form. */}
            <a
              href={siteConfig.whatsapp.href(orderMessage(`Aqiqah ${p.name}`))}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary mt-3 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-neutral-500 transition-colors"
            >
              <IconWhatsApp className="h-3.5 w-3.5" />
              atau tanya via WhatsApp
            </a>
          </div>
        ))}
      </div>

      {/* Nasi Box Aqiqah — tambahan yang menempel pada paket ibadah, bukan
          pesanan berdiri sendiri. Karena itu jalurnya tetap WhatsApp; RPC
          `create_guest_order` memang menolak layanan bertipe `nasi_box`. */}
      <div className="mt-16 rounded-3xl border border-neutral-200 bg-gradient-to-br from-neutral-50 to-white p-7 sm:p-9">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-accent-dark text-xs font-bold tracking-wide uppercase">
              Tambahan
            </span>
            <h3 className="mt-1 text-xl font-bold text-neutral-900">Paket Nasi Box Aqiqah</h3>
            <p className="mt-1 max-w-xl text-sm leading-6 text-neutral-600">
              Berbagi kebahagiaan aqiqah dalam bentuk nasi box siap saji. Harga per porsi, dipesan
              bersama paket aqiqah Anda lewat tim kami.
            </p>
          </div>
          <a
            href={siteConfig.whatsapp.href(orderMessage('Nasi Box Aqiqah'))}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-primary hover:bg-primary-dark inline-flex items-center gap-2 self-start rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-colors sm:self-auto"
          >
            <IconWhatsApp className="h-4 w-4" />
            Tanya Nasi Box
          </a>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {nasiBoxPackages.map((box) => (
            <div
              key={box.slug}
              className={`rounded-2xl border bg-white p-4 text-center ${
                box.popular ? 'border-accent ring-accent/40 ring-1' : 'border-neutral-200'
              }`}
            >
              {box.popular && (
                <span className="text-accent-dark mb-1 inline-block text-[10px] font-bold tracking-wide uppercase">
                  Favorit
                </span>
              )}
              <p className="text-sm font-semibold text-neutral-900">{box.name}</p>
              <p className="text-primary mt-1 text-lg font-bold">{formatIDR(box.price)}</p>
              <p className="text-[11px] text-neutral-500">/ box</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Proses                                                              */
/* ------------------------------------------------------------------ */
function ProcessSection() {
  return (
    <section id="proses" className="bg-primary py-20 text-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-accent text-sm font-semibold tracking-wide uppercase">
            Alur Layanan
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Lima langkah, tersaji transparan
          </h2>
          <p className="mt-4 text-base leading-7 text-white/80">
            Dari pemesanan hingga laporan akhir, setiap tahap tercatat dan bisa Anda ikuti.
          </p>
        </div>

        <ol className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {processSteps.map((step) => (
            <li
              key={step.step}
              className="relative rounded-2xl bg-white/10 p-6 ring-1 ring-white/15 backdrop-blur"
            >
              <span className="text-accent text-3xl font-bold">{step.step}</span>
              <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-white/75">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */
function FaqSection() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <SectionHeading
        eyebrow="FAQ"
        title="Pertanyaan yang sering diajukan"
        subtitle="Belum menemukan jawaban? Hubungi kami langsung via WhatsApp."
      />
      <div className="mt-10 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white">
        {faqs.map((faq) => (
          <details key={faq.question} className="group px-6 py-5 [&_summary]:list-none">
            <summary className="flex cursor-pointer items-center justify-between gap-4 text-left">
              <span className="text-base font-semibold text-neutral-900">{faq.question}</span>
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-neutral-500 transition-transform group-open:rotate-45">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
            </summary>
            <p className="mt-3 text-sm leading-7 text-neutral-600">{faq.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* CTA akhir                                                           */
/* ------------------------------------------------------------------ */
function CtaSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl bg-neutral-900 px-6 py-14 text-center sm:px-12">
        <div
          aria-hidden
          className="bg-primary/30 pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full blur-3xl"
        />
        <div
          aria-hidden
          className="bg-accent/20 pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full blur-3xl"
        />
        <div className="relative mx-auto max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Siap menunaikan ibadah Anda?
          </h2>
          <p className="mt-4 text-base leading-7 text-white/75">
            Tim Sukses Aqiqah siap membantu dari pemilihan paket hingga laporan pelaksanaan.
            Konsultasikan kebutuhan Anda sekarang — gratis.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/checkout"
              className="bg-primary hover:bg-primary-dark group inline-flex w-full items-center justify-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold text-white shadow-lg transition-all sm:w-auto"
            >
              Pesan Online Sekarang
              <IconArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href={siteConfig.whatsapp.href(orderMessage())}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/25 px-7 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
            >
              <IconWhatsApp className="h-5 w-5" />
              Konsultasi via WhatsApp
            </a>
          </div>

          {/* Tautan dashboard turun jadi tautan teks: sasaran bagian ini
              pengunjung yang mau memesan, bukan staf yang mau masuk. */}
          <Link
            href="/login"
            className="mt-6 inline-block text-sm font-medium text-white/60 transition-colors hover:text-white"
          >
            Masuk ke Dashboard Staf
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="text-primary text-sm font-semibold tracking-wide uppercase">{eyebrow}</span>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-7 text-neutral-600">{subtitle}</p>
    </div>
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
