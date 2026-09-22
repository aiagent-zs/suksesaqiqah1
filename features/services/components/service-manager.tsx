'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, Info, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/format';
import { ServiceDialog } from './service-dialog';
import { ServiceDeleteDialog } from './service-delete-dialog';
import { TYPE_LABEL, TYPE_ORDER, isPerBoxType } from './service-form';
import type { ServiceRow } from '../queries';

/**
 * Daftar katalog paket — satu sumber untuk yang **ditagih** dan yang
 * **dipajang**.
 *
 * ## Cakupannya berubah 3 September
 *
 * Sebelumnya layar ini hanya menyentuh checkout: halaman depan memakai daftar
 * terpisah di `lib/constants/site.ts`, jadi mengubah harga di sini tidak
 * mengubah angka yang dibaca pengunjung. Dua daftar dijaga sinkron oleh tangan
 * — dan sudah pernah menyimpang: `paket-c-favorit` & `paket-e-premium` membawa
 * akhiran yang tidak pernah ada di katalog, tanpa satu pun galat, sebab
 * `?paket=` yang tak dikenal sengaja jatuh ke paket pertama.
 *
 * `20260903010000` memindahkan konten landing ke `services`, dan sejak itu
 * halaman depan membacanya lewat `features/landing/catalogue.ts`.
 *
 * ## Tampilannya dirapikan 22 September
 *
 * Tiga hal yang membuat layar ini sulit dibaca, dan cara masing-masing diatasi:
 *
 * 1. **Formulir mekar di dalam halaman** — mendorong daftar ke bawah layar.
 *    Sekarang dialog (`ServiceDialog`), untuk tambah maupun sunting.
 * 2. **Tombol "Hapus" berubah jadi "Yakin hapus?" di tempat yang sama** — klik
 *    kedua yang tidak disengaja langsung menghapus, dan tidak ada ruang
 *    menjelaskan akibatnya. Sekarang `AlertDialog`.
 * 3. **Tiap baris memuat lima keterangan tanpa hierarki** — nama, slug,
 *    tagline, pemakaian, modal mitra, semuanya berukuran hampir sama. Sekarang
 *    harga berdiri sebagai angka utama di kanan, dan keterangan pemakaian
 *    turun jadi baris tersendiri yang lebih redup.
 */
export function ServiceManager({
  services,
  publicBase,
}: {
  services: ServiceRow[];
  /** `NEXT_PUBLIC_SUPABASE_URL` dari server; diteruskan ke unggahan foto. */
  publicBase: string;
}) {
  /**
   * Penyaring nama & slug.
   *
   * Sepuluh paket masih terbaca sekaligus, tetapi katalog yang bertambah
   * katering (dan kelak paket musiman) tidak. Disaring di klien, bukan lewat
   * query: seluruh daftarnya sudah ada di memori, dan perjalanan ke server
   * untuk memfilter sepuluh baris hanya menambah jeda.
   */
  const [query, setQuery] = useState('');

  const term = query.trim().toLowerCase();
  const filtered = term
    ? services.filter(
        (s) => s.name.toLowerCase().includes(term) || s.slug.toLowerCase().includes(term),
      )
    : services;

  const grouped = TYPE_ORDER.map((type) => ({
    type,
    rows: filtered.filter((s) => s.type === type),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Katalog Paket</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {services.length} paket · nama, harga, dan tampilannya di halaman depan
          </p>
        </div>

        <ServiceDialog
          publicBase={publicBase}
          trigger={
            <Button type="button">
              <Plus className="size-4" />
              Tambah paket
            </Button>
          }
        />
      </div>

      {/* Yang dulu berdiri di sini adalah peringatan bahwa landing memakai
          daftar terpisah di `lib/constants/site.ts`. Sejak `20260903010000`
          itu tidak lagi benar — halaman depan membaca tabel ini. Diganti
          keterangan cakupan, sebab yang perlu diketahui operator justru
          kebalikannya: perubahan di sini langsung terlihat pengunjung. */}
      <p className="text-muted-foreground flex items-start gap-2 rounded-lg border px-4 py-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          Perubahan tersimpan langsung terlihat di <strong>halaman depan</strong> dan{' '}
          <strong>checkout</strong>. Harga order yang sudah berjalan tidak ikut berubah — harganya
          sudah tersalin saat order dibuat.
        </span>
      </p>

      {services.length > 6 && (
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama atau slug paket…"
            className="pl-9"
            aria-label="Cari paket"
          />
        </div>
      )}

      {grouped.map((group) => (
        <section key={group.type} className="space-y-2">
          <div className="flex items-baseline gap-2">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {TYPE_LABEL[group.type]}
            </h3>
            <span className="text-muted-foreground/70 text-xs tabular-nums">
              {group.rows.length}
            </span>
          </div>

          <div className="border-border bg-card divide-border divide-y rounded-lg border shadow-sm">
            {group.rows.map((s) => (
              <div
                key={s.id}
                className="hover:bg-muted/40 flex flex-wrap items-center gap-x-4 gap-y-2 p-4 transition-colors"
              >
                {/* --- Identitas --- */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/vendors/katalog/${s.id}`}
                      className="font-medium hover:underline"
                    >
                      {s.name}
                    </Link>

                    {/* Non-aktif didahulukan: ia mengubah arti seluruh baris,
                        sedangkan dua penanda lain hanya menambah keterangan. */}
                    {!s.isActive && (
                      <Badge className="border-slate-200 bg-slate-100 text-slate-600">
                        Non-aktif
                      </Badge>
                    )}
                    {s.showOnLanding && (
                      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                        Di halaman depan
                      </Badge>
                    )}
                    {s.isPopular && (
                      <Badge className="border-amber-200 bg-amber-50 text-amber-800">
                        Terpopuler
                      </Badge>
                    )}
                  </div>

                  <p className="text-muted-foreground/80 mt-0.5 font-mono text-xs">{s.slug}</p>

                  {s.tagline && (
                    <p className="text-muted-foreground mt-1 line-clamp-1 text-sm">{s.tagline}</p>
                  )}

                  {/* Dua fakta yang menentukan apakah paket ini bisa dihapus
                      dan apakah ia benar-benar bisa dikerjakan mitra. Dibuat
                      paling redup: ia jawaban atas pertanyaan yang baru muncul
                      setelah operator menemukan barisnya. */}
                  <p className="text-muted-foreground/70 mt-1.5 text-xs">
                    {s.ordersUsing > 0
                      ? `${s.ordersUsing} order memakainya`
                      : 'Belum dipakai order'}
                    {' · '}
                    {s.vendorsOffering > 0 ? (
                      `${s.vendorsOffering} mitra punya modal`
                    ) : (
                      // Tanpa modal mitra, paket ini bisa dipesan tetapi
                      // marginnya tidak terhitung — layak ditandai, bukan
                      // disebut datar seperti fakta lain.
                      <span className="text-amber-700">Belum ada modal mitra</span>
                    )}
                  </p>
                </div>

                {/* --- Harga: angka utama baris ini --- */}
                <div className="text-right">
                  <p className="text-base font-semibold tabular-nums">
                    {formatCurrency(s.price)}
                  </p>
                  <p className="text-muted-foreground/70 text-xs">
                    per {isPerBoxType(s.type) ? 'box' : 'ekor'}
                  </p>
                </div>

                {/* --- Aksi ---
                    Ketiganya berlabel teks, bukan ikon telanjang: ikon sendiri
                    menuntut operator menebak, dan itu kebalikan dari yang
                    diminta. Ikonnya tetap ada sebagai tanda kedua — warna &
                    posisi saja tidak cukup membedakan aksi yang merusak. */}
                <div className="flex shrink-0 items-center gap-1.5">
                  {/* Tautan sungguhan, bukan handler: klik-tengah dan "buka di
                      tab baru" harus bekerja, dan halaman detail memuat hal-hal
                      yang tidak masuk dialog — foto, kaitan ke order & mitra,
                      tombol aktif/non-aktif. */}
                  <Link
                    href={`/vendors/katalog/${s.id}`}
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  >
                    <Eye className="size-3.5" />
                    Lihat
                  </Link>

                  {/* Dulu tautan ke `#data-paket` di halaman detail. Dialog
                      lebih tepat untuk perbaikan cepat (salah harga, salah
                      nama): operator tidak kehilangan tempatnya di daftar, dan
                      tidak perlu menempuh dua perpindahan halaman untuk
                      mengubah satu angka. Halaman detail tetap ada lewat
                      "Lihat" untuk yang butuh lebih dari itu. */}
                  <ServiceDialog
                    service={s}
                    publicBase={publicBase}
                    trigger={
                      <Button type="button" variant="outline" size="sm">
                        <Pencil className="size-3.5" />
                        Edit
                      </Button>
                    }
                  />

                  {/* Hapus hanya untuk paket yang belum pernah dipakai —
                      `order_items.service_id` di-`on delete restrict`, jadi
                      menawarkannya pada yang sudah dipakai berarti tombol yang
                      pasti ditolak. Aktif/non-aktif TIDAK di sini: ia butuh
                      konteks jumlah order yang baru terbaca di halaman detail,
                      sama seperti tombol serupa milik mitra. */}
                  {s.ordersUsing === 0 && (
                    <ServiceDeleteDialog
                      service={s}
                      trigger={
                        <Button type="button" variant="ghost" size="sm">
                          <Trash2 className="size-3.5" />
                          Hapus
                        </Button>
                      }
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {services.length === 0 && (
        <p className="border-border text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
          Belum ada paket di katalog.
        </p>
      )}

      {services.length > 0 && filtered.length === 0 && (
        <p className="border-border text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
          Tidak ada paket yang cocok dengan “{query}”.
        </p>
      )}
    </div>
  );
}
