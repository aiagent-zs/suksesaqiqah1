import Link from 'next/link';
import type { ReactNode } from 'react';
import { siteConfig } from '@/lib/constants/site';
import type { LandingBox, getLandingCatalogue } from '@/features/landing/catalogue';
import { formatIDR } from '@/lib/format/currency';
import { IconCheck, IconWhatsApp } from '@/components/site/icons';
import { SitePhoto } from '@/components/site/site-photo';
import { Reveal } from '@/components/site/reveal';
import type { PackageTab } from '@/components/site/package-filter';

/*
 * Kartu paket dipakai bersama oleh landing (`/`, dibatasi beberapa kartu per
 * tab) dan `/paket` (seluruhnya). Dipindah dari `app/(site)/page.tsx` supaya
 * kedua halaman merender kartu yang persis sama.
 */

export const orderMessage = (brandName: string, paket?: string) =>
  `Halo ${brandName}, saya ingin memesan${paket ? ` paket ${paket}` : ' layanan'}.`;

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
      className={`border-line relative flex flex-col overflow-hidden rounded-lg border bg-white ${
        data.popular ? 'ring-primary ring-2' : ''
      }`}
    >
      {/* Paket tanpa foto merender kartu tanpa blok gambar sama sekali, bukan
          placeholder: `SitePhoto` menampilkan kotak bertuliskan path berkas
          yang ditunggu — petunjuk kerja yang berguna bagi yang menyiapkan
          foto, tapi tidak ada artinya bagi pengunjung. Sejak fotonya bisa
          diunggah lewat aplikasi, paket baru memang wajar belum punya foto. */}
      {data.photo && (
        <div className="bg-surface-muted aspect-[3/2] overflow-hidden">
          <SitePhoto
            src={data.photo.src}
            alt={data.photo.alt}
            width={600}
            height={400}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {/* Label jenis menggantikan judul blok yang dulu memisahkan
                ketiganya. Ia mengerjakan hal yang sama — memberi tahu ini
                layanan apa — tanpa memecah halaman jadi tiga bagian. */}
            <p className="text-primary text-xs font-semibold">{data.kind}</p>
            <h3 className="text-ink mt-1 text-lg font-semibold">{data.title}</h3>
          </div>

          {/* Penanda populer jadi label teks kecil, bukan pita mengambang yang
              menggeser tata letak kartunya. */}
          {data.popular && (
            <span className="bg-accent text-ink shrink-0 rounded px-2 py-0.5 text-xs font-semibold">
              {data.popularLabel}
            </span>
          )}
        </div>

        <p className="text-ink mt-3 text-3xl font-bold tracking-tight tabular-nums">
          {formatIDR(data.price)}
          <span className="text-ink-muted ml-1 text-sm font-normal">/{data.unit}</span>
        </p>
        {data.tagline && <p className="text-ink-muted mt-2 text-sm leading-6">{data.tagline}</p>}

        {/* Empat isi pertama selalu terlihat supaya kartu sebaris bisa
            dibandingkan sekilas; sisanya di balik "Lihat detail", bukan
            dibuang, karena itu yang membedakan paket satu dengan lainnya. */}
        {data.features.length > 0 && (
          <div className="border-line mt-5 flex-1 border-t pt-5">
            <FeatureList items={data.features.slice(0, 4)} />
            {data.features.length > 4 && (
              <details className="group mt-2">
                <summary className="text-primary flex min-h-11 cursor-pointer list-none items-center text-sm font-semibold underline-offset-2 hover:underline">
                  <span className="group-open:hidden">
                    Lihat detail ({data.features.length - 4} lainnya)
                  </span>
                  <span className="hidden group-open:inline">Sembunyikan detail</span>
                </summary>
                <FeatureList items={data.features.slice(4)} />
              </details>
            )}
          </div>
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

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((feat) => (
        <li key={feat} className="text-ink flex items-start gap-2.5 text-sm">
          <IconCheck className="text-primary mt-[3px] size-3.5 shrink-0" />
          <span className="leading-6">{feat}</span>
        </li>
      ))}
    </ul>
  );
}

/** Kisi tunggal untuk seluruh kartu paket, apa pun jenisnya. */
function PackageGrid({ cards }: { cards: PackageCardData[] }) {
  return (
    <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
      <Link href={`/paket?jenis=${tab}`} className="btn btn-outline">
        Lihat semua {total} {label}
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
function NasiBoxNote({ boxes, brandName }: { boxes: LandingBox[]; brandName: string }) {
  return (
    <Reveal anim="scale" className="border-line mt-6 rounded-lg border bg-white p-5 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl">
          <h3 className="text-ink text-base font-semibold">
            Nasi box aqiqah <span className="text-ink-muted font-normal">(tambahan opsional)</span>
          </h3>
          <p className="text-ink-muted mt-1.5 text-sm leading-6">
            Berbagi kebahagiaan aqiqah dalam bentuk nasi box siap saji. Harga per porsi, dipesan{' '}
            <strong>bersama paket aqiqah</strong> lewat tim kami.
          </p>
        </div>
        <a
          href={siteConfig.whatsapp.href(orderMessage(brandName, 'Nasi Box Aqiqah'))}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline shrink-0"
        >
          <IconWhatsApp className="h-4 w-4" />
          Tanya nasi box
        </a>
      </div>

      {/* Lauknya dipisah koma, bukan daftar bertitik: pembeda antar paket
          adalah panjang rangkaiannya, dan itu paling cepat terbaca kalau
          kelimanya bisa dibandingkan sekilas. */}
      <ul className="border-line mt-6 grid gap-3 border-t pt-6 sm:mt-7 sm:grid-cols-2 lg:grid-cols-3">
        {boxes.map((box) => (
          <li
            key={box.slug}
            className={`rounded-lg border p-4 ${
              box.popular ? 'border-primary/40 bg-primary-light' : 'border-line'
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="text-ink text-sm font-semibold">
                {box.name}
                {box.popular && (
                  <span className="bg-primary ml-2 rounded px-1.5 py-0.5 text-xs font-semibold text-white">
                    Favorit
                  </span>
                )}
              </h4>
              <p className="text-ink text-sm font-semibold tabular-nums">{formatIDR(box.price)}</p>
            </div>
            <p className="text-ink-muted mt-1.5 text-sm leading-6">{box.items.join(', ')}</p>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}

export type PackageSort = 'rekomendasi' | 'termurah' | 'termahal';

/**
 * Tab paket untuk `PackageFilter`.
 *
 * `limit` memotong kartu per tab (landing memakai 3) dan menambahkan tautan ke
 * `/paket` untuk sisanya. Tanpa `limit`, seluruh kartu tampil.
 */
export function buildPackageTabs(
  { programs, boxes, catering }: Awaited<ReturnType<typeof getLandingCatalogue>>,
  limit?: number,
  sort: PackageSort = 'rekomendasi',
  brandName = 'Sukses Aqiqah',
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
        className={`btn w-full ${p.popular ? 'btn-primary' : 'btn-outline'}`}
      >
        Pilih paket {p.name}
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
        className={`btn w-full ${c.popular ? 'btn-primary' : 'btn-outline'}`}
      >
        Pilih {c.name}
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

  // `rekomendasi` = urutan katalog apa adanya (diatur pemilik usaha).
  const sorted = (cards: PackageCardData[]) =>
    sort === 'rekomendasi'
      ? cards
      : [...cards].sort((a, b) => (sort === 'termurah' ? a.price - b.price : b.price - a.price));

  const grid = (id: string, cards: PackageCardData[], label: string) => (
    <>
      <PackageGrid cards={limit ? sorted(cards).slice(0, limit) : sorted(cards)} />
      {limit && cards.length > limit && <SeeAllLink tab={id} total={cards.length} label={label} />}
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
          {boxes.length > 0 && <NasiBoxNote boxes={boxes} brandName={brandName} />}
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
          {boxes.length > 0 && <NasiBoxNote boxes={boxes} brandName={brandName} />}
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
