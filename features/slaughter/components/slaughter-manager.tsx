'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AnimalStatusBadge } from '@/components/data/status-badge';
import { formatDateTime } from '@/lib/format';
import { ANIMAL_SPECIES_LABEL, type AnimalStatus } from '@/lib/constants/order';
import { deleteSlaughter, recordSlaughter } from '@/server/actions/slaughter';
import type { SlaughterRecordRow } from '../queries';

export type SlaughterAnimal = {
  id: string;
  tagCode: string | null;
  species: keyof typeof ANIMAL_SPECIES_LABEL;
  status: AnimalStatus;
};

/**
 * Pencatatan pemotongan per hewan (`prd.md` FR-SL1).
 *
 * Mencatat di sini sekaligus menaikkan status hewan ke Dipotong — itulah yang
 * menggerakkan Progres Potong di dashboard dan membuka transisi
 * `slaughtering → distribution`.
 */
export function SlaughterManager({
  animals,
  records,
  canRecord,
  canDelete,
}: {
  animals: SlaughterAnimal[];
  records: SlaughterRecordRow[];
  canRecord: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [draft, setDraft] = useState({ performed_at: '', notes: '' });

  const recordedAnimalIds = new Set(records.map((r) => r.animalId));
  const pendingAnimals = animals.filter((a) => !recordedAnimalIds.has(a.id));

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

  return (
    <section className="border-border bg-card rounded-2xl border shadow-sm">
      <div className="border-border border-b px-5 py-4">
        <h2 className="text-base font-semibold">Pemotongan</h2>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {records.length} dari {animals.length} ekor tercatat dipotong
        </p>
      </div>

      {error && (
        <p className="border-destructive/20 bg-destructive/5 text-destructive flex items-start gap-2 border-b px-5 py-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {canRecord && pendingAnimals.length > 0 && (
        <div className="border-border bg-muted/30 border-b px-5 py-4">
          <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
            Belum dicatat
          </p>
          <ul className="space-y-2">
            {pendingAnimals.map((animal) => (
              <li key={animal.id}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex-1 text-sm">
                    {animal.tagCode ?? 'Tanpa kode'}
                    <span className="text-muted-foreground">
                      {' · '}
                      {ANIMAL_SPECIES_LABEL[animal.species]}
                    </span>
                  </span>
                  <AnimalStatusBadge status={animal.status} />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => {
                      setOpenFor(openFor === animal.id ? null : animal.id);
                      setDraft({ performed_at: '', notes: '' });
                    }}
                  >
                    <Check className="size-3.5" />
                    Catat potong
                  </Button>
                </div>

                {openFor === animal.id && (
                  <div className="border-border bg-card mt-2 grid gap-3 rounded-xl border p-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor={`sl-at-${animal.id}`}>Waktu pemotongan</Label>
                      <Input
                        id={`sl-at-${animal.id}`}
                        type="datetime-local"
                        value={draft.performed_at}
                        onChange={(e) => setDraft({ ...draft, performed_at: e.target.value })}
                        className="mt-1.5"
                      />
                      <p className="text-muted-foreground mt-1 text-xs">
                        Kosongkan untuk memakai waktu sekarang.
                      </p>
                    </div>

                    <div>
                      <Label htmlFor={`sl-note-${animal.id}`}>Catatan</Label>
                      <Textarea
                        id={`sl-note-${animal.id}`}
                        rows={2}
                        value={draft.notes}
                        placeholder="Mis. disaksikan peserta"
                        onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                        className="mt-1.5"
                      />
                    </div>

                    <div className="flex items-center gap-2 sm:col-span-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          run(async () => {
                            const result = await recordSlaughter({
                              animal_id: animal.id,
                              performed_at: draft.performed_at,
                              notes: draft.notes,
                            });
                            if (result.ok) setOpenFor(null);
                            return result;
                          })
                        }
                      >
                        Simpan catatan
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => setOpenFor(null)}
                      >
                        Batal
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {records.length === 0 ? (
        <p className="text-muted-foreground px-5 py-10 text-center text-sm">
          Belum ada catatan pemotongan pada order ini.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {records.map((record) => (
            <li key={record.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <div className="min-w-40 flex-1">
                <p className="font-medium">
                  {record.animalTag ?? 'Tanpa kode'}
                  <span className="text-muted-foreground font-normal">
                    {' · '}
                    {ANIMAL_SPECIES_LABEL[record.animalSpecies]}
                  </span>
                </p>
                <p className="text-muted-foreground text-xs">
                  {formatDateTime(record.performedAt)}
                  {record.performerName ? ` · ${record.performerName}` : ''}
                </p>
                {record.notes && <p className="mt-1 text-xs">{record.notes}</p>}
              </div>

              {canDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  aria-label={`Hapus catatan pemotongan ${record.animalTag ?? ''}`}
                  disabled={pending}
                  onClick={() => run(() => deleteSlaughter({ id: record.id }))}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
