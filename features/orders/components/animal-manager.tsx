'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ConfirmModal, Modal } from '@/components/ui/modal';
import { addAnimal, deleteAnimal } from '@/server/actions/orders';
import { ANIMAL_SPECIES_LABEL, type AnimalSpecies } from '@/lib/constants/order';
import type { Database } from '@/types/database';

type Animal = Database['public']['Tables']['animals']['Row'];
/**
 * Pendaftaran hewan per order — "1 order banyak hewan" (docs/05 section 4.8).
 *
 * Panel ini **hanya mendaftarkan** ekornya; kemajuan pelaksanaan dilaporkan di
 * panel Tahap dan dibaca dari sana. Dropdown status yang dulu ada di sini
 * adalah sumber kebenaran kedua yang tidak tersambung ke rantai tahap — ia bisa
 * diklik "terdistribusi" tanpa satu pun bukti, atau tertinggal nol padahal
 * seluruh tahap sudah tervalidasi, dan kedua angka itu tercetak di laporan yang
 * dikirim ke pemesan. Kolomnya dibuang di `20260827010000`.
 */
export function AnimalManager({
  orderId,
  animals,
  canEdit,
}: {
  orderId: string;
  animals: Animal[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Hewan yang tombol hapusnya ditekan — dialog penegasannya milik baris ini. */
  const [removing, setRemoving] = useState<Animal | null>(null);
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

  const EMPTY_DRAFT = {
    species: 'kambing' as AnimalSpecies,
    tag_code: '',
    weight_kg: '',
    on_behalf_of: '',
  };

  return (
    // Judul & hitungan ekornya kini dipegang `PhaseSection` di halaman detail
    // order — dua judul bertumpuk hanya membuang tinggi layar.
    <div>
      {canEdit && (
        <div className="border-border flex justify-end border-b px-5 py-3">
          {/* Modal, bukan formulir yang mekar di dalam panel: panel ini berada
              di tengah halaman detail order yang memuat sembilan panel lain,
              dan formulir empat kolom yang terbuka di sini menggeser semuanya
              ke bawah — termasuk panel Tahap yang justru sedang dibandingkan
              operator. */}
          <Modal
            open={showForm}
            onOpenChange={(next) => {
              setShowForm(next);
              // Dikosongkan saat dibuka, bukan saat ditutup: ketikan yang
              // diurungkan tidak boleh muncul lagi sebagai data tersimpan.
              if (next) setDraft(EMPTY_DRAFT);
            }}
            trigger={
              <Button type="button" variant="outline" size="sm">
                <Plus className="size-3.5" />
                Tambah hewan
              </Button>
            }
            title="Tambah hewan"
            description="Hanya pendaftaran ekornya. Kemajuan pelaksanaan dilaporkan di panel Tahap."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="new-species">Jenis</Label>
                <Select
                  id="new-species"
                  value={draft.species}
                  onChange={(e) => setDraft({ ...draft, species: e.target.value as AnimalSpecies })}
                  className="mt-1.5"
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
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="new-weight">Berat (kg)</Label>
                <NumberInput
                  id="new-weight"
                  step="0.1"
                  min={0}
                  value={draft.weight_kg}
                  onChange={(e) => setDraft({ ...draft, weight_kg: e.target.value })}
                  className="mt-1.5 tabular-nums"
                />
              </div>

              <div>
                <Label htmlFor="new-obo">Atas nama</Label>
                <Input
                  id="new-obo"
                  value={draft.on_behalf_of}
                  onChange={(e) => setDraft({ ...draft, on_behalf_of: e.target.value })}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setShowForm(false)}
              >
                Batal
              </Button>
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
                    if (result.ok) setShowForm(false);
                    return result;
                  })
                }
              >
                {pending ? 'Menyimpan…' : 'Simpan'}
              </Button>
            </div>
          </Modal>
        </div>
      )}

      {error && (
        <p className="border-destructive/20 bg-destructive/5 text-destructive flex items-start gap-2 border-b px-5 py-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {animals.length === 0 ? (
        <p className="text-muted-foreground px-5 py-10 text-center text-sm">
          Belum ada hewan pada order ini.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {animals.map((animal) => (
            <li key={animal.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <div className="min-w-40 flex-1">
                <p className="font-medium">
                  {animal.tag_code ?? 'Tanpa kode'}{' '}
                  <span className="text-muted-foreground font-normal">
                    · {ANIMAL_SPECIES_LABEL[animal.species]}
                  </span>
                </p>
                <p className="text-muted-foreground text-xs">
                  {animal.on_behalf_of
                    ? `Atas nama ${animal.on_behalf_of}`
                    : 'Atas nama belum diisi'}
                  {animal.weight_kg ? ` · ${animal.weight_kg} kg` : ''}
                </p>
              </div>

              {/* Dulu menghapus **seketika** saat ditekan, tanpa penegasan apa
                  pun — satu salah-klik pada ikon kecil di daftar dan ekornya
                  hilang. `enforce_animal_delete` memang menahannya begitu
                  tahapnya berjalan, tetapi sebelum itu tidak ada yang
                  menghalangi, dan menambah ulang berarti mengetik kembali kode
                  serta beratnya. */}
              {canEdit && (
                <ConfirmModal
                  open={removing?.id === animal.id}
                  onOpenChange={(next) => {
                    setRemoving(next ? animal : null);
                    if (next) setError(null);
                  }}
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Hapus ${animal.tag_code ?? 'hewan'}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  }
                  title={`Hapus ${animal.tag_code ?? 'hewan tanpa kode'}?`}
                  description="Ekor ini hilang dari order, beserta kode dan beratnya."
                  hint="Kalau tahapnya sudah dilaporkan, database akan menolak — jejak pelaksanaannya tidak boleh kehilangan hewannya."
                  error={error}
                  confirmLabel="Ya, hapus"
                  pending={pending}
                  onConfirm={() =>
                    run(async () => {
                      const result = await deleteAnimal({ animal_id: animal.id });
                      if (result.ok) setRemoving(null);
                      return result;
                    })
                  }
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
