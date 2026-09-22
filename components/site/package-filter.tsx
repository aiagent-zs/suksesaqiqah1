'use client';

import { useState, type ReactNode } from 'react';

/**
 * Penyaring jenis paket di halaman depan.
 *
 * ## Kenapa menerima blok yang sudah dirender, bukan datanya
 *
 * Kartu paket memakai `SitePhoto`, dan komponen itu **server-only** — ia
 * memeriksa keberadaan berkas lewat `node:fs` sebelum memutuskan merender
 * `next/image` atau kotak penanda. Jadi kartunya harus tetap dirakit di server.
 *
 * Yang dikerjakan komponen ini hanya menyembunyikan dan memperlihatkan blok
 * yang sudah jadi. Konsekuensinya bagus: halaman depan **tetap prerender
 * statis**, dan seluruh kartu ada di HTML sejak awal — jadi mesin pencari
 * membacanya semua, bukan hanya yang kebetulan terpilih.
 *
 * ## Kenapa `hidden`, bukan render ulang
 *
 * Menukar isi berarti kartu dibongkar-pasang tiap kali tab diganti: foto
 * dimuat ulang, animasi `Reveal` menyala lagi, dan tinggi halaman melompat.
 * Dengan `hidden` semuanya tetap terpasang — hanya terlihat atau tidak.
 *
 * Trade-off yang diterima: HTML awalnya memuat seluruh kartu. Pada sepuluh
 * paket itu ongkos yang kecil, dan ia yang justru membuat SEO tetap utuh.
 */

export type PackageTab = {
  id: string;
  label: string;
  /** Jumlah paket di tab ini — ditampilkan sebagai angka kecil. */
  count: number;
  content: ReactNode;
};

export function PackageFilter({
  tabs,
  /** Tab yang terbuka saat halaman dimuat. */
  defaultTab,
}: {
  tabs: PackageTab[];
  defaultTab: string;
}) {
  // Tab kosong tidak ditawarkan: "Katering (0)" yang diklik lalu memperlihatkan
  // ruang kosong lebih buruk daripada tidak ada tabnya sama sekali.
  const shown = tabs.filter((t) => t.count > 0);

  const [active, setActive] = useState(
    // Tab bawaan bisa saja kosong — misal katering belum dipasarkan. Jatuh ke
    // tab pertama yang benar-benar berisi, bukan memperlihatkan halaman hampa.
    () => shown.find((t) => t.id === defaultTab)?.id ?? shown[0]?.id ?? '',
  );

  if (shown.length === 0) return null;

  // Satu jenis saja berarti tidak ada yang perlu disaring — tabnya jadi hiasan
  // yang menuntut klik tanpa menawarkan pilihan.
  const single = shown.length === 1;

  return (
    <div>
      {!single && (
        <div
          role="tablist"
          aria-label="Saring jenis paket"
          className="mt-10 flex flex-wrap gap-2 sm:mt-12"
        >
          {shown.map((tab) => {
            const on = tab.id === active;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={on}
                aria-controls={`panel-${tab.id}`}
                onClick={() => setActive(tab.id)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-all active:scale-[0.98] ${
                  on
                    ? 'bg-primary text-white shadow-sm'
                    : 'border border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50'
                }`}
              >
                {tab.label}
                {/* Angkanya bukan hiasan: ia menjawab "ada berapa" sebelum
                    pengunjung menekan tabnya. */}
                <span className={`text-xs tabular-nums ${on ? 'opacity-80' : 'text-neutral-500'}`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {shown.map((tab) => (
        <div
          key={tab.id}
          id={`panel-${tab.id}`}
          role={single ? undefined : 'tabpanel'}
          aria-labelledby={single ? undefined : `tab-${tab.id}`}
          // `hidden` lewat atribut, bukan `display:none` di kelas: atributnya
          // ikut dibaca pembaca layar dan pencarian dalam halaman (Ctrl+F),
          // sehingga isi yang tersembunyi benar-benar tersembunyi — bukan hanya
          // tidak terlihat.
          hidden={!single && tab.id !== active}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
