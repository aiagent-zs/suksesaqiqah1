'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AnimalStatusBadge } from '@/components/data/status-badge';
import { addAnimal, deleteAnimal, updateAnimalStatus } from '@/server/actions/orders';
import {
  ANIMAL_SPECIES_LABEL,
  type AnimalSpecies,
  type AnimalStatus,
} from '@/lib/constants/order';
import { getAnimalStatusOptions } from '../animal-state-machine';
import type { Database } from '@/types/database';

type Animal = Database['public']['Tables']['animals']['Row'];
type UserRole = Database['public']['Enums']['user_role'];

/**
 * Pengelolaan hewan per order — "1 order banyak hewan" (docs/05 section 4.8).
 * Status hewan dapat dinaikkan langsung di sini; pencatatan detail pemotongan
 * & distribusi menyusul pada modul Slaughter/Distribution.
 */
export function AnimalManager({
  orderId,
  animals,
  canEdit,
  role,
}: {
  orderId: string;
  animals: Animal[];
  canEdit: boolean;
  /** Menentukan opsi status yang boleh ditawarkan; server memvalidasi ulang. */
  role: UserRole | undefined;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    species: 'kambing' as AnimalSpecies,
    tag_code: '',
    weight_kg: '',
    on_behalf_of: '',
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

  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold">Hewan</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {animals.length} ekor terdaftar pada order ini
          </p>
        </div>
        {canEdit && (
          <Button type="button" variant="outline" size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="size-3.5" />
            Tambah hewan
          </Button>
        )}
      </div>

      {error && (
        <p className="flex items-start gap-2 border-b border-destructive/20 bg-destructive/5 px-5 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {showForm && canEdit && (
        <div className="grid gap-3 border-b border-border bg-muted/30 p-4 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          <div>
            <Label htmlFor="new-species">Jenis</Label>
            <Select
              id="new-species"
              value={draft.species}
              onChange={(e) => setDraft({ ...draft, species: e.target.value as AnimalSpecies })}
              className="mt-1.5 bg-card"
            >
              {(Object.keys(ANIMAL_SPECIES_LABEL) as AnimalSpecies[]).map((s) => (
                <option key={s} value={s}>
                  {ANIMAL_SPECIES_LABEL[s]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="new-tag">Kode hewan</Label>
            <Input
              id="new-tag"
              value={draft.tag_code}
              placeholder="BDG-K-004"
              onChange={(e) => setDraft({ ...draft, tag_code: e.target.value })}
              className="mt-1.5 bg-card"
            />
          </div>
          <div>
            <Label htmlFor="new-weight">Berat (kg)</Label>
            <Input
              id="new-weight"
              type="number"
              step="0.1"
              min={0}
              value={draft.weight_kg}
              onChange={(e) => setDraft({ ...draft, weight_kg: e.target.value })}
              className="mt-1.5 bg-card tabular-nums"
            />
          </div>
          <div>
            <Label htmlFor="new-obo">Atas nama</Label>
            <Input
              id="new-obo"
              value={draft.on_behalf_of}
              onChange={(e) => setDraft({ ...draft, on_behalf_of: e.target.value })}
              className="mt-1.5 bg-card"
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const result = await addAnimal({
                    order_id: orderId,
                    species: draft.species,
                    tag_code: draft.tag_code,
                    weight_kg: draft.weight_kg ? Number(draft.weight_kg) : undefined,
                    on_behalf_of: draft.on_behalf_of,
                  });
                  if (result.ok) {
                    setDraft({ species: 'kambing', tag_code: '', weight_kg: '', on_behalf_of: '' });
                    setShowForm(false);
                  }
                  return result;
                })
              }
            >
              Simpan
            </Button>
          </div>
        </div>
      )}

      {animals.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">
          Belum ada hewan pada order ini.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {animals.map((animal) => (
            <li key={animal.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <div className="min-w-40 flex-1">
                <p className="font-medium">
                  {animal.tag_code ?? 'Tanpa kode'}{' '}
                  <span className="font-normal text-muted-foreground">
                    · {ANIMAL_SPECIES_LABEL[animal.species]}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {animal.on_behalf_of ? `Atas nama ${animal.on_behalf_of}` : 'Atas nama belum diisi'}
                  {animal.weight_kg ? ` · ${animal.weight_kg} kg` : ''}
                </p>
              </div>

              <AnimalStatusBadge status={animal.status} />

              {canEdit && (
                <div className="flex items-center gap-2">
                  <Select
                    aria-label={`Ubah status ${animal.tag_code ?? 'hewan'}`}
                    value={animal.status}
                    disabled={pending}
                    onChange={(e) =>
                      run(() =>
                        updateAnimalStatus({
                          animal_id: animal.id,
                          status: e.target.value as AnimalStatus,
                        }),
                      )
                    }
                    className="w-40"
                  >
                    {getAnimalStatusOptions(animal.status, role).map((option) => (
                      <option
                        key={option.status}
                        value={option.status}
                        disabled={!option.allowed}
                        title={option.reason ?? undefined}
                      >
                        {option.label}
                      </option>
                    ))}
                  </Select>

                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    aria-label={`Hapus ${animal.tag_code ?? 'hewan'}`}
                    disabled={pending || animal.status !== 'registered'}
                    title={
                      animal.status !== 'registered'
                        ? 'Hewan yang sudah diproses tidak dapat dihapus'
                        : undefined
                    }
                    onClick={() => run(() => deleteAnimal({ animal_id: animal.id }))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
