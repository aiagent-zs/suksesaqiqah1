'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Eye, Info, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Toast } from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/format';
import { deleteService } from '@/server/actions/services';
import { ServiceForm, TYPE_LABEL, TYPE_ORDER } from './service-form';
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
 * ## Menyunting pindah ke halaman sendiri
 *
 * Komponen ini kini **hanya daftar dan formulir tambah**. Menyunting dulu
 * membuka formulir di atas daftar — yang pada sepuluh paket berarti formulir
 * terbuka di luar layar: tombol ditekan, tidak ada yang tampak berubah, dan
 * tombolnya terbaca sebagai rusak. Sekarang tiap baris menuju
 * `/vendors/katalog/{id}`, mengikuti pola `/vendors/{id}` milik mitra.
 */
export function ServiceManager({ services }: { services: ServiceRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  /** Paket yang tombol hapusnya sudah ditekan sekali — menunggu penegasan. */
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const { toast, show, dismiss } = useToast();

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteService({ id });
      if (!result.ok) {
        setError(result.error.message);
        show('error', result.error.message);
        setConfirmDelete(null);
        return;
      }
      // Barisnya lenyap dari daftar sesudah ini; tanpa toast, hilangnya bisa
      // terbaca sebagai halaman yang keliru memuat ulang.
      show('success', 'Paket dihapus.');
      setConfirmDelete(null);
      router.refresh();
    });
  }

  const grouped = TYPE_ORDER.map((type) => ({
    type,
    rows: services.filter((s) => s.type === type),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="space-y-4">
      <Toast state={toast} onDismiss={dismiss} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Katalog Paket</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Nama, harga, dan tampilan paket di halaman depan
          </p>
        </div>
        <Button type="button" onClick={() => setShowForm((v) => !v)}>
          {showForm ? <X className="size-4" /> : <Plus className="size-4" />}
          {showForm ? 'Batal' : 'Tambah paket'}
        </Button>
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

      {error && (
        <p className="border-destructive/20 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-4 py-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {/* Formulir tambah tetap di sini, tidak ikut pindah ke halaman sendiri:
          paket baru belum punya id, jadi tidak ada URL yang bisa dituju — dan
          alasan kepindahan menyunting (formulir terbuka di luar layar) tidak
          berlaku di sini, sebab tombolnya berada tepat di atas formulirnya. */}
      {showForm && (
        <div className="border-border bg-card rounded-lg border p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold">Tambah paket baru</h3>
          <ServiceForm onCancel={() => setShowForm(false)} onSaved={() => setShowForm(false)} />
        </div>
      )}

      {grouped.map((group) => (
        <section key={group.type} className="space-y-2">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {TYPE_LABEL[group.type]}
          </h3>

          <div className="border-border bg-card divide-border divide-y rounded-lg border shadow-sm">
            {group.rows.map((s) => (
              <div key={s.id} className="flex flex-wrap items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/vendors/katalog/${s.id}`} className="font-medium hover:underline">
                      {s.name}
                    </Link>
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

                  <p className="text-muted-foreground mt-0.5 font-mono text-xs">{s.slug}</p>
                  {s.tagline && <p className="text-muted-foreground mt-1 text-sm">{s.tagline}</p>}

                  <p className="text-muted-foreground mt-1.5 text-xs">
                    {s.ordersUsing > 0
                      ? `Dipakai ${s.ordersUsing} order`
                      : 'Belum pernah dipakai order'}
                    {' · '}
                    {s.vendorsOffering > 0
                      ? `${s.vendorsOffering} mitra punya modal`
                      : 'Belum ada modal mitra'}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-semibold tabular-nums">{formatCurrency(s.price)}</p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <Link
                    href={`/vendors/katalog/${s.id}`}
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  >
                    <Eye className="size-3.5" />
                    Lihat
                  </Link>

                  <Link
                    href={`/vendors/katalog/${s.id}#data-paket`}
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  >
                    <Pencil className="size-3.5" />
                    Edit
                  </Link>

                  {/* Hapus hanya untuk paket yang belum pernah dipakai —
                      `order_items.service_id` di-`on delete restrict`, jadi
                      menawarkannya pada yang sudah dipakai berarti tombol yang
                      pasti ditolak. Aktif/non-aktif TIDAK di sini: ia butuh
                      konteks jumlah order yang baru terbaca di halaman detail,
                      sama seperti tombol serupa milik mitra. */}
                  {s.ordersUsing === 0 &&
                    (confirmDelete === s.id ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={pending}
                        onClick={() => remove(s.id)}
                      >
                        Yakin hapus?
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDelete(s.id)}
                      >
                        <Trash2 className="size-3.5" />
                        Hapus
                      </Button>
                    ))}
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
    </div>
  );
}
