'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';
import { deleteVendorService, saveVendorService } from '@/server/actions/vendors';
import type { VendorServiceRow } from '../queries';

type ServiceOption = { id: string; name: string; type: string; price: number };

/**
 * Daftar modal per paket untuk satu mitra.
 *
 * Panel inilah yang membuat KPI margin punya masukan. `v_vendor_kpi.margin_total`
 * dihitung dari `order_items.vendor_unit_price`, yang jatuhnya dari tabel ini —
 * dan sampai layar ini ada, tabelnya **tidak pernah bisa diisi dari aplikasi**.
 * Akibatnya modal terbaca nol dan dashboard melaporkan margin sebesar seluruh
 * nilai order.
 *
 * Angka di sini internal: pembeli tetap melihat `services.price`. Itu sebabnya
 * kewenangannya berhenti di superadmin — siapa pun yang bisa menurunkannya bisa
 * membuat order tampak untung padahal rugi.
 */
export function VendorServicePanel({
  vendorId,
  rows,
  options,
}: {
  vendorId: string;
  rows: VendorServiceRow[];
  options: ServiceOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [serviceId, setServiceId] = useState('');
  const [price, setPrice] = useState('');

  function run(fn: () => Promise<{ ok: boolean; error?: { message: string } }>, done?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error?.message ?? 'Terjadi kesalahan.');
        return;
      }
      done?.();
      router.refresh();
    });
  }

  // Paket yang modalnya sudah tercatat tidak ditawarkan lagi: upsert-nya memang
  // akan menimpa, tapi menawarkannya sebagai "tambah" menyesatkan — suntingan
  // tempatnya di baris yang sudah ada.
  const taken = new Set(rows.map((r) => r.serviceId));
  const available = options.filter((o) => !taken.has(o.id));

  const selected = options.find((o) => o.id === serviceId) ?? null;
  const previewMargin = selected && price ? selected.price - Number(price) : null;

  return (
    <section className="border-border bg-card rounded-lg border shadow-sm">
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-base font-semibold">Modal per paket</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Harga yang dibayarkan ke mitra. Selisihnya terhadap harga jual adalah margin order.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={available.length === 0}
          title={available.length === 0 ? 'Seluruh paket sudah punya modal' : undefined}
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus className="size-3.5" />
          Tambah paket
        </Button>
      </div>

      {error && (
        <p className="border-destructive/20 bg-destructive/5 text-destructive mx-5 mt-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {showForm && (
        <div className="border-border bg-muted/30 grid gap-3 border-b p-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="vs-service">Paket</Label>
            <Select
              id="vs-service"
              value={serviceId}
              disabled={pending}
              onChange={(e) => setServiceId(e.target.value)}
              className="mt-1.5"
            >
              <option value="">Pilih paket</option>
              {available.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} — jual {formatCurrency(o.price)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="vs-price">Harga modal</Label>
            <Input
              id="vs-price"
              type="number"
              inputMode="numeric"
              value={price}
              disabled={pending}
              placeholder="2325000"
              onChange={(e) => setPrice(e.target.value)}
              className="mt-1.5"
            />
            {/* Margin dihitung di layar sebelum disimpan: modal yang keliru
                ketik satu digit paling gampang tertangkap di sini. */}
            {previewMargin !== null && (
              <p
                className={`mt-1 text-xs ${previewMargin < 0 ? 'text-destructive' : 'text-muted-foreground'}`}
              >
                Margin {formatCurrency(previewMargin)}
                {previewMargin < 0 ? ' — modal melebihi harga jual' : ''}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 sm:col-span-2">
            <Button
              type="button"
              size="sm"
              disabled={pending || !serviceId || price === ''}
              onClick={() =>
                run(
                  () =>
                    saveVendorService({
                      vendor_id: vendorId,
                      service_id: serviceId,
                      vendor_price: Number(price),
                      is_offered: true,
                    }),
                  () => {
                    setShowForm(false);
                    setServiceId('');
                    setPrice('');
                  },
                )
              }
            >
              Simpan
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setShowForm(false)}
            >
              Batal
            </Button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-muted-foreground px-5 py-10 text-center text-sm">
          Belum ada modal tercatat. Selama kosong, margin order mitra ini terbaca sebesar seluruh
          nilai order.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <div className="min-w-40 flex-1">
                <p className="font-medium">
                  {r.serviceName}
                  {!r.isOffered && (
                    <Badge className="ml-2 border-slate-200 bg-slate-100 text-slate-600">
                      Tidak ditawarkan
                    </Badge>
                  )}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Jual {formatCurrency(r.price)} · Modal {formatCurrency(r.vendorPrice)}
                </p>
              </div>

              <p
                className={`text-sm font-medium tabular-nums ${r.margin < 0 ? 'text-destructive' : ''}`}
              >
                {formatCurrency(r.margin)}
              </p>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      saveVendorService({
                        vendor_id: vendorId,
                        service_id: r.serviceId,
                        vendor_price: r.vendorPrice,
                        is_offered: !r.isOffered,
                      }),
                    )
                  }
                >
                  {r.isOffered ? 'Hentikan' : 'Tawarkan'}
                </Button>

                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  aria-label={`Hapus modal ${r.serviceName}`}
                  disabled={pending}
                  onClick={() => run(() => deleteVendorService({ id: r.id }))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
