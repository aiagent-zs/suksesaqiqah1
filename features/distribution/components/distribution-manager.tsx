'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, MapPin, Package, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDateTime } from '@/lib/format';
import { ANIMAL_SPECIES_LABEL } from '@/lib/constants/order';
import { googleMapsUrl } from '@/features/schedules/maps';
import { deleteDistribution, recordDistribution } from '@/server/actions/distribution';
import type { DistributionSummary } from '../queries';

export type DistributableAnimal = {
  id: string;
  tagCode: string | null;
  species: keyof typeof ANIMAL_SPECIES_LABEL;
};

/**
 * Pencatatan penyaluran daging (`prd.md` FR-SL2).
 *
 * Hewan yang dicentang ikut naik ke status Terdistribusi. Itu bukan pemanis:
 * Progres Distribusi di dashboard dihitung dari `animals.status`, bukan dari
 * banyaknya baris distribusi — tanpa mencentang, angkanya tetap nol meski
 * penyalurannya tercatat.
 */
export function DistributionManager({
  orderId,
  summary,
  availableAnimals,
  canRecord,
  canDelete,
}: {
  orderId: string;
  summary: DistributionSummary;
  availableAnimals: DistributableAnimal[];
  canRecord: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState({
    recipient_name: '',
    recipient_area: '',
    packages_count: '',
    distributed_at: '',
    lat: '',
    lng: '',
  });

  function run(fn: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error?.message ?? 'Terjadi kesalahan.');
        return;
      }
      router.refresh();
    });
  }

  function resetForm() {
    setDraft({
      recipient_name: '',
      recipient_area: '',
      packages_count: '',
      distributed_at: '',
      lat: '',
      lng: '',
    });
    setSelected([]);
    setShowForm(false);
  }

  return (
    <section className="border-border bg-card rounded-2xl border shadow-sm">
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-base font-semibold">Distribusi</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {summary.rows.length} penyaluran · {summary.totalPackages} paket
          </p>
        </div>

        {canRecord && (
          <Button type="button" variant="outline" size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="size-3.5" />
            Catat distribusi
          </Button>
        )}
      </div>

      {error && (
        <p className="border-destructive/20 bg-destructive/5 text-destructive flex items-start gap-2 border-b px-5 py-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {showForm && canRecord && (
        <div className="border-border bg-muted/30 grid gap-3 border-b p-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="dist-recipient">Penerima</Label>
            <Input
              id="dist-recipient"
              value={draft.recipient_name}
              placeholder="Mis. Panti Asuhan Al-Amin"
              onChange={(e) => setDraft({ ...draft, recipient_name: e.target.value })}
              className="bg-card mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="dist-area">Area</Label>
            <Input
              id="dist-area"
              value={draft.recipient_area}
              placeholder="Mis. Kel. Cibadak"
              onChange={(e) => setDraft({ ...draft, recipient_area: e.target.value })}
              className="bg-card mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="dist-packages">Jumlah paket</Label>
            <Input
              id="dist-packages"
              type="number"
              min={0}
              step="1"
              inputMode="numeric"
              value={draft.packages_count}
              onChange={(e) => setDraft({ ...draft, packages_count: e.target.value })}
              className="bg-card mt-1.5 tabular-nums"
            />
          </div>

          <div>
            <Label htmlFor="dist-at">Waktu distribusi</Label>
            <Input
              id="dist-at"
              type="datetime-local"
              value={draft.distributed_at}
              onChange={(e) => setDraft({ ...draft, distributed_at: e.target.value })}
              className="bg-card mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="dist-lat">Lintang (opsional)</Label>
            <Input
              id="dist-lat"
              value={draft.lat}
              placeholder="-6.914744"
              onChange={(e) => setDraft({ ...draft, lat: e.target.value })}
              className="bg-card mt-1.5 tabular-nums"
            />
          </div>

          <div>
            <Label htmlFor="dist-lng">Bujur (opsional)</Label>
            <Input
              id="dist-lng"
              value={draft.lng}
              placeholder="107.609810"
              onChange={(e) => setDraft({ ...draft, lng: e.target.value })}
              className="bg-card mt-1.5 tabular-nums"
            />
          </div>

          {availableAnimals.length > 0 && (
            <fieldset className="sm:col-span-2">
              <legend className="text-sm text-slate-700">Hewan yang tercakup penyaluran ini</legend>
              <p className="text-muted-foreground mt-0.5 mb-2 text-xs">
                Mencentang menaikkan statusnya ke Terdistribusi — inilah yang menggerakkan Progres
                Distribusi di dashboard.
              </p>
              <div className="flex flex-wrap gap-3">
                {availableAnimals.map((animal) => (
                  <label
                    key={animal.id}
                    className="border-border bg-card flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(animal.id)}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked
                            ? [...prev, animal.id]
                            : prev.filter((id) => id !== animal.id),
                        )
                      }
                      className="border-border accent-primary size-4 rounded"
                    />
                    {animal.tagCode ?? 'Tanpa kode'}
                    <span className="text-muted-foreground text-xs">
                      {ANIMAL_SPECIES_LABEL[animal.species]}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="flex items-center gap-2 sm:col-span-2">
            <Button
              type="button"
              disabled={pending || draft.packages_count === ''}
              onClick={() =>
                run(async () => {
                  const result = await recordDistribution({
                    order_id: orderId,
                    recipient_name: draft.recipient_name,
                    recipient_area: draft.recipient_area,
                    packages_count: draft.packages_count,
                    distributed_at: draft.distributed_at,
                    ...(draft.lat ? { lat: draft.lat } : {}),
                    ...(draft.lng ? { lng: draft.lng } : {}),
                    ...(selected.length > 0 ? { animal_ids: selected } : {}),
                  });
                  if (result.ok) resetForm();
                  return result;
                })
              }
            >
              Simpan distribusi
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={resetForm}>
              Batal
            </Button>
          </div>
        </div>
      )}

      {summary.rows.length === 0 ? (
        <p className="text-muted-foreground px-5 py-10 text-center text-sm">
          Belum ada catatan distribusi pada order ini.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {summary.rows.map((row) => {
            const mapsUrl = googleMapsUrl(row.lat, row.lng);
            return (
              <li key={row.id} className="flex flex-wrap items-start gap-3 px-5 py-4">
                <div className="min-w-40 flex-1">
                  <p className="font-medium">{row.recipientName ?? 'Penerima tidak dicatat'}</p>
                  <p className="text-muted-foreground text-xs">
                    {row.recipientArea ?? 'Area tidak dicatat'}
                    {' · '}
                    {formatDateTime(row.distributedAt)}
                    {row.distributorName ? ` · ${row.distributorName}` : ''}
                  </p>
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary mt-1 inline-flex items-center gap-1 text-xs hover:underline"
                    >
                      <MapPin className="size-3" />
                      Buka titik di Maps
                    </a>
                  )}
                </div>

                <span className="inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums">
                  <Package className="text-muted-foreground size-3.5" />
                  {row.packagesCount} paket
                </span>

                {canDelete && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    aria-label="Hapus catatan distribusi"
                    disabled={pending}
                    onClick={() => run(() => deleteDistribution({ id: row.id }))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
