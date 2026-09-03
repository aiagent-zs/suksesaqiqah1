import Link from 'next/link';
import type { Metadata } from 'next';
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
  type LandingProgram,
} from '@/features/landing/catalogue';
import { formatIDR } from '@/lib/format/currency';
import { Icon, IconArrowRight, IconCheck, IconWhatsApp } from '@/components/site/icons';
import { SitePhoto } from '@/components/site/site-photo';
import { Reveal } from '@/components/site/reveal';

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
 * **Animasi** mengikuti aturan yang sama: satu gerakan saja (naik 16px sambil
 * memudar masuk) lewat `<Reveal>`, dipakai pada blok besar — bukan pada setiap
 * elemen. Durasi & easing-nya diatur terpusat di `app/globals.css`; yang
 * ditentukan di sini hanya urutan tampilnya lewat `delay`.
 *
 * Jeda antar-anggota satu kelompok 110ms — cukup lebar untuk terbaca berurutan
 * pada gerakan sepanjang 0,85 detik, tapi tetap ditahan agar totalnya tidak
 * melebihi ~330ms per kelompok. Pemicunya sendiri sudah dimajukan lewat
 * `rootMargin`, jadi jeda itu terbayar sebelum elemennya terlihat.
 *
 * Seluruhnya mati sendiri saat pengguna memilih "kurangi gerakan" di setelan
 * sistem (lihat `app/globals.css`).
 */
export default async function LandingPage() {
  // Katalog dibaca sekali di sini lalu diturunkan, bukan diambil di dalam
  // `PackagesSection`: paket aqiqah dan nasi box datang dari satu query yang
  // sama, dan memanggilnya dua kali berarti dua perjalanan untuk satu jawaban.
  const { programs, boxes } = await getLandingCatalogue();

  return (
    <>
      <JsonLd />
      <Hero />
      <ServicesSection />
      <PackagesSection programs={programs} boxes={boxes} />
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
      {/* Latar bertekstur. Tiga lapis, dan ketiganya punya alasan:

          1. Kisi besar 56px — rujukan ke kertas bergaris; halaman ini menjual
             pencatatan, jadi teksturnya ikut mengatakan itu.
          2. Kisi halus 14px yang hanya menempati sudut kiri atas — kepadatan
             yang berubah mencegah latar terbaca sebagai satu raster datar.
          3. Sapuan hijau sangat tipis dari kiri atas, arah yang sama dengan
             arah baca.

          Semuanya gradient CSS: nol permintaan jaringan. `-z-10` +
          `aria-hidden` — murni latar, tidak pernah menghalangi klik maupun
          terbaca pembaca layar. */}
      <div
        aria-hidden
        className="bg-grid pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(120%_90%_at_15%_0%,black,transparent_70%)]"
      />
      <div
        aria-hidden
        className="bg-grid-fine pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(45%_55%_at_8%_5%,black,transparent)]"
      />
      <div
        aria-hidden
        className="from-primary/6 pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br via-transparent to-transparent"
      />

      <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-8 pb-14 sm:gap-12 sm:px-6 sm:pt-12 sm:pb-20 lg:grid-cols-[1fr_0.85fr] lg:items-end lg:gap-16 lg:pt-14 lg:pb-24">
        {/* Hero tampil bertahap saat halaman dibuka: label → judul → paragraf →
            tombol → fakta. Jeda 90ms antar-baris — cukup untuk terbaca sebagai
            urutan, dan berhenti di 360ms supaya isi terpenting halaman ini
            tidak membuat pengunjung menunggu. */}
        <div>
          <Reveal>
            <p className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
              Layanan Aqiqah · Zakat Sukses
            </p>
          </Reveal>

          {/* Ukuran & bobot yang membangun hierarki, bukan gradasi warna.
              `text-[2rem]` di ponsel: `text-4xl` membuat "tebarkan manfaat."
              pecah jadi tiga baris pada lebar 360px. */}
          <Reveal delay={90}>
            <h1 className="mt-3.5 text-[2rem] leading-[1.1] font-bold tracking-tight text-neutral-900 sm:mt-4 sm:text-5xl lg:text-6xl">
              Tunaikan ibadah,
              <br />
              {/* Penekanan lewat warna teksnya sendiri — hijau brand, warna yang
                  memang berarti sesuatu di sistem ini. Sebelumnya frasa ini
                  diberi garis bawah oranye yang digambar saat tampil: pola
                  landing-page generik, dan `accent` dipakai untuk sorotan KPI,
                  bukan untuk menghias judul. */}
              <span className="text-primary">tebarkan manfaat.</span>
            </h1>
          </Reveal>

          <Reveal delay={180}>
            <p className="mt-5 max-w-xl text-base leading-7 text-neutral-600 sm:mt-6 sm:text-lg sm:leading-8">
              Aqiqah yang dikerjakan sesuai syariat dan dicatat di setiap tahapnya. Anda memantau
              prosesnya, lalu menerima laporan pelaksanaan berisi bukti — tanpa perlu bertanya.
            </p>
          </Reveal>

          {/* Tombol selebar layar di ponsel — target sentuh besar
              (`design.md §6`: "aksi 1-tap"). */}
          <Reveal delay={270}>
            <div className="mt-8 flex flex-col gap-3 sm:mt-9 sm:flex-row">
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
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 px-6 py-3.5 text-sm font-semibold text-neutral-800 transition-all hover:border-neutral-400 hover:bg-neutral-50 active:scale-[0.98] active:bg-neutral-100"
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
          <Reveal delay={360}>
            <dl className="mt-9 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 sm:gap-4">
              {[
                { value: 'Tanpa akun', label: 'Pesan langsung di web' },
                { value: 'Tiap tahap', label: 'Divalidasi sebelum lanjut' },
                { value: 'Link laporan', label: 'Dibuka tanpa login' },
              ].map((s) => (
                // Garis aksen kiri + latar tipis: cukup untuk memisahkan ketiga
                // fakta ini dari paragraf di atasnya, tanpa jadi tiga kartu
                // melayang yang menuntut perhatian sebesar CTA di sebelahnya.
                <div key={s.value} className="border-primary/40 border-l-2 py-0.5 pl-3">
                  <dt className="font-semibold text-neutral-900">{s.value}</dt>
                  <dd className="mt-0.5 text-xs leading-5 text-neutral-500">{s.label}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>

        {/* Foto dalam bingkai datar bergaris rambut — tanpa bayangan tebal,
            tanpa sudut membulat besar. */}
        <Reveal as="figure" delay={180} anim="scale" className="group/hero relative lg:pb-1">
          {/* Bidang warna di belakang foto, digeser sedikit — memberi kedalaman
              tanpa `shadow-2xl`. `design.md §4` meminta "shadow halus", dan
              lapisan seperti ini menempuhnya lewat bentuk, bukan lewat blur. */}
          <div
            aria-hidden
            className="bg-primary/10 pointer-events-none absolute -inset-x-2 top-3 -bottom-2 -z-10 rounded-lg"
          />
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 shadow-sm">
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
      <SectionIntro
        title="Pilih cara aqiqah Anda ditunaikan"
        lead="Keduanya menempuh proses yang sama sampai daging siap; yang berbeda hanya ke mana ia berakhir."
      />

      <div className="mt-10 grid gap-4 sm:mt-12 md:grid-cols-3">
        {services.map((s, i) => (
          // Kartu bergaris rambut dengan aksen atas yang melebar saat dituju.
          // Sebelumnya ketiganya cuma dipisah garis pembagi — benar secara spec,
          // tapi tidak memberi tanda sama sekali mana yang sedang di bawah
          // kursor pada grid tiga kolom.
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
function PackagesSection({ programs, boxes }: { programs: LandingProgram[]; boxes: LandingBox[] }) {
  // Katalog kosong berarti database tak terjangkau (query-nya mengembalikan
  // daftar kosong alih-alih melempar). Section-nya disembunyikan seluruhnya:
  // judul "Harga sudah termasuk seluruh prosesnya" di atas ruang kosong
  // terbaca sebagai halaman rusak, sementara tanpanya halaman tetap utuh —
  // hero, proses, galeri, dan jalan menghubungi lewat WhatsApp semuanya tetap
  // ada.
  if (programs.length === 0 && boxes.length === 0) return null;

  return (
    <Section bg="tinted" id="paket" index="02" eyebrow="Paket & Harga">
      <SectionIntro
        title="Harga sudah termasuk seluruh prosesnya"
        lead="Pemotongan syar’i, pemasakan, dokumentasi, dan laporan pelaksanaan — tidak ada biaya yang menyusul di belakang."
      />

      <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200 sm:mt-12 lg:grid-cols-3">
        {programs.map((p, i) => (
          <Reveal
            key={p.slug}
            as="article"
            delay={i * 110}
            anim="scale"
            className={`group/card relative flex flex-col bg-white transition-shadow hover:shadow-sm ${
              p.popular ? 'ring-primary/40 z-10 ring-2' : ''
            }`}
          >
            {/* Paket tanpa foto merender kartu tanpa blok gambar sama sekali,
                bukan placeholder: `SitePhoto` menampilkan kotak bertuliskan
                path berkas yang ditunggu — petunjuk kerja yang berguna bagi
                yang menyiapkan foto, tapi tidak ada artinya bagi pengunjung.
                Sejak fotonya bisa diunggah lewat aplikasi, paket baru memang
                wajar belum punya foto untuk sementara. */}
            {p.photo && (
              <div className="overflow-hidden bg-neutral-100">
                <SitePhoto
                  src={p.photo.src}
                  alt={p.photo.alt}
                  width={600}
                  height={400}
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-[1.03]"
                />
              </div>
            )}

            <div className="flex flex-1 flex-col p-6">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-base font-semibold text-neutral-900">Aqiqah {p.name}</h3>
                {/* Penanda "paling diminati" jadi label teks kecil, bukan pita
                    mengambang yang menggeser tata letak kartunya. */}
                {p.popular && (
                  <span className="bg-accent shrink-0 rounded px-2 py-0.5 text-[10px] font-bold tracking-wide text-neutral-900 uppercase">
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
                className={`mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold transition-all active:scale-[0.98] ${
                  p.popular
                    ? 'bg-primary hover:bg-primary-dark text-white shadow-sm hover:shadow'
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
      <Reveal
        anim="scale"
        className="mt-10 rounded-lg border border-neutral-200 bg-white p-5 sm:mt-12 sm:p-8"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xl">
            <h3 className="text-base font-semibold text-neutral-900">
              Nasi box aqiqah{' '}
              <span className="font-normal text-neutral-500">— tambahan opsional</span>
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
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-800 transition-all hover:border-neutral-400 hover:bg-neutral-50 active:scale-[0.98]"
          >
            <IconWhatsApp className="h-4 w-4" />
            Tanya nasi box
          </a>
        </div>

        {/* Dulu hanya nama + harga berdampingan. Deretan "Paket A … Paket E"
            tidak memberi tahu apa pun tentang bedanya, sehingga selisih
            Rp21.000 ke Rp70.000 terbaca sebagai angka tanpa alasan — dan yang
            bertanya lewat WhatsApp menanyakan hal yang sama berulang kali.
            Isinya sendiri sudah tercatat di `services.meta->items` sejak awal;
            di sini ia akhirnya terbaca pengunjung. */}
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

              {/* Lauknya dipisah koma, bukan daftar bertitik: pembeda antar
                  paket adalah panjang rangkaiannya, dan itu paling cepat
                  terbaca kalau kelimanya bisa dibandingkan sekilas. */}
              <p className="mt-1.5 text-xs leading-5 text-neutral-600">{box.items.join(', ')}</p>
            </li>
          ))}
        </ul>
      </Reveal>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Proses                                                              */
/* ------------------------------------------------------------------ */
function ProcessSection() {
  return (
    <section id="proses" className="bg-primary-dark relative overflow-hidden text-white">
      {/* Pola titik terang di atas hijau tua. Memberi tekstur pada satu-satunya
          bidang warna penuh di halaman ini, yang tanpa itu terbaca sebagai
          blok datar sebesar layar. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle,white_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.07]"
      />
      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
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
            // Lima langkah — dibatasi `i % 3` seperti kelompok lain, jadi jeda
            // terbesarnya 220ms, bukan 440ms. Tanpa batas ini langkah terakhir
            // baru muncul hampir setengah detik sesudah yang pertama, dan pada
            // layar lebar kelimanya berjajar sehingga perbedaannya kentara
            // sebagai "menunggu", bukan sebagai urutan.
            <Reveal
              key={step.step}
              as="li"
              delay={(i % 3) * 110}
              className="bg-primary-dark relative p-5 sm:p-6"
            >
              <span className="text-accent block text-3xl font-bold tabular-nums">{step.step}</span>
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
            <div className="relative overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 transition-shadow group-hover/photo:shadow-sm">
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
      {/* Tekstur yang sama dengan hero, dibalik arahnya — halaman berakhir
          seperti ia dimulai. */}
      <div
        aria-hidden
        className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(110%_90%_at_85%_100%,black,transparent_70%)]"
      />
      <Reveal className="relative mx-auto flex max-w-6xl flex-col gap-7 px-4 py-14 sm:gap-8 sm:px-6 sm:py-20 lg:flex-row lg:items-center lg:justify-between">
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
