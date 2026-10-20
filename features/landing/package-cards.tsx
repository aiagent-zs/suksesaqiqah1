import Link from 'next/link';
import type { ReactNode } from 'react';
import { siteConfig } from '@/lib/constants/site';
import type { LandingBox, getLandingCatalogue } from '@/features/landing/catalogue';
import { formatIDR } from '@/lib/format/currency';
import { IconArrowRight, IconCheck, IconWhatsApp } from '@/components/site/icons';
import { SitePhoto } from '@/components/site/site-photo';
import { Reveal } from '@/components/site/reveal';
import type { PackageTab } from '@/components/site/package-filter';

/*
 * Kartu paket dipakai bersama oleh landing (`/`, dibatasi beberapa kartu per
 * tab) dan `/paket` (seluruhnya). Dipindah dari `app/(site)/page.tsx` supaya
 * kedua halaman merender kartu yang persis sama.
 */

export const orderMessage = (paket?: string) =>
  `Halo Sukses Aqiqah, saya ingin memesan${paket ? ` paket ${paket}` : ' layanan'}.`;

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
 * Tautan ke `/paket` di bawah kisi yang terpotong. Hanya muncul kalau memang
 * ada kartu yang tidak tampil — tautan "lihat semua" yang membuka daftar sama
 * persis adalah klik yang sia-sia.
 */
function SeeAllLink({ tab, total, label }: { tab: string; total: number; label: string }) {
  return (
    <div className="mt-6 flex justify-center">
      <Link
        href={`/paket?jenis=${tab}`}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-5 text-sm font-semibold text-neutral-800 transition-all hover:border-neutral-400 hover:bg-neutral-50 active:scale-[0.98]"
      >
        Lihat semua {total} {label}
        <IconArrowRight className="h-4 w-4" />
      </Link>
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

/**
 * Tab paket untuk `PackageFilter`.
 *
 * `limit` memotong kartu per tab (landing memakai 3) dan menambahkan tautan ke
 * `/paket` untuk sisanya. Tanpa `limit`, seluruh kartu tampil.
 */
export function buildPackageTabs(
  { programs, boxes, catering }: Awaited<ReturnType<typeof getLandingCatalogue>>,
  limit?: number,
): PackageTab[] {
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
   * Yang masuk sini adalah yang bertanda `is_popular` **di katalog**, bukan
   * yang dipilih di kode: penandanya bisa disunting superadmin lewat halaman
   * katalog, jadi keputusan pemasarannya tetap di tangan pemilik usaha. Kalau
   * tak satu pun aqiqah ditandai, seluruh paket aqiqah ikut — lebih baik
   * daripada tab "Pilihan" yang kosong separuh.
   */
  const featured = aqiqahCards.filter((c) => c.popular);
  const featuredAqiqah = featured.length > 0 ? featured : aqiqahCards;
  // Katering populer didahulukan supaya potongan 3 kartu di landing tidak
  // diisi aqiqah seluruhnya.
  const pilihan = [
    ...featuredAqiqah,
    ...cateringCards.filter((c) => c.popular),
    ...cateringCards.filter((c) => !c.popular),
  ];

  const grid = (id: string, cards: PackageCardData[], label: string) => (
    <>
      <PackageGrid cards={limit ? cards.slice(0, limit) : cards} />
      {limit && cards.length > limit && (
        <SeeAllLink tab={id} total={cards.length} label={label} />
      )}
    </>
  );

  return [
    {
      id: 'pilihan',
      label: 'Pilihan',
      count: pilihan.length,
      content: (
        <>
          {grid('pilihan', pilihan, 'paket pilihan')}
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
          {grid('aqiqah', aqiqahCards, 'paket aqiqah')}
          {boxes.length > 0 && <NasiBoxNote boxes={boxes} />}
        </>
      ),
    },
    {
      id: 'katering',
      label: 'Katering',
      count: cateringCards.length,
      content: grid('katering', cateringCards, 'paket katering'),
    },
  ];
}
