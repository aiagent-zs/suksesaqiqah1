'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { createOrder } from '@/server/actions/orders';
import { formatCurrency } from '@/lib/format';
import { ANIMAL_SPECIES_LABEL, type AnimalSpecies } from '@/lib/constants/order';

type Service = { id: string; name: string; type: string; price: number; slug: string };
type Participant = { id: string; name: string; phone: string | null };

type ItemRow = {
  key: number;
  service_id: string;
  qty: number;
  unit_price: number;
  on_behalf_of: string;
};
type AnimalRow = {
  key: number;
  species: AnimalSpecies;
  tag_code: string;
  weight_kg: string;
  on_behalf_of: string;
};

let rowSeq = 0;
const nextKey = () => ++rowSeq;

export function OrderForm({
  services,
  participants,
}: {
  services: Service[];
  participants: Participant[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [participantMode, setParticipantMode] = useState<'new' | 'existing'>('new');
  const [participantId, setParticipantId] = useState('');
  const [participant, setParticipant] = useState({ name: '', phone: '', email: '', address: '' });
  const [notes, setNotes] = useState('');

  const [items, setItems] = useState<ItemRow[]>([
    { key: nextKey(), service_id: '', qty: 1, unit_price: 0, on_behalf_of: '' },
  ]);
  const [animals, setAnimals] = useState<AnimalRow[]>([]);

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const total = useMemo(
    () => items.reduce((sum, i) => sum + (Number(i.qty) || 0) * (Number(i.unit_price) || 0), 0),
    [items],
  );

  function updateItem(key: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function pickService(key: number, serviceId: string) {
    const service = services.find((s) => s.id === serviceId);
    // Harga selalu mengikuti katalog. Nilai ini hanya untuk pratinjau total —
    // server menimpanya lagi dari tabel `services` saat order dibuat.
    updateItem(key, {
      service_id: serviceId,
      unit_price: service ? Number(service.price) : 0,
    });
  }

  function submit() {
    setFormError(null);
    setFieldErrors({});

    const payload = {
      participant:
        participantMode === 'existing'
          ? { mode: 'existing' as const, participant_id: participantId }
          : { mode: 'new' as const, ...participant },
      items: items.map((i) => ({
        service_id: i.service_id,
        qty: Number(i.qty),
        unit_price: Number(i.unit_price),
        on_behalf_of: i.on_behalf_of,
      })),
      animals: animals.map((a) => ({
        species: a.species,
        tag_code: a.tag_code,
        weight_kg: a.weight_kg ? Number(a.weight_kg) : undefined,
        on_behalf_of: a.on_behalf_of,
      })),
      notes,
    };

    startTransition(async () => {
      const result = await createOrder(payload);
      if (result.ok) {
        router.push(`/orders/${result.data.id}`);
        router.refresh();
        return;
      }
      setFormError(result.error.message);
      setFieldErrors(result.error.fields ?? {});
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-6"
    >
      {formError && (
        <div className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-xl border p-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">{formError}</p>
            {Object.entries(fieldErrors).length > 0 && (
              <ul className="mt-1 list-inside list-disc text-xs">
                {Object.entries(fieldErrors).map(([field, message]) => (
                  <li key={field}>
                    {field}: {message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* --- Peserta --- */}
      <section className="border-border bg-card rounded-lg border p-5 shadow-sm">
        <h2 className="text-base font-semibold">Peserta</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="participant-mode">Data peserta</Label>
            <Select
              id="participant-mode"
              value={participantMode}
              onChange={(e) => setParticipantMode(e.target.value as 'new' | 'existing')}
              className="mt-1.5"
            >
              <option value="new">Peserta baru</option>
              <option value="existing">Peserta yang sudah ada</option>
            </Select>
          </div>
        </div>

        {participantMode === 'existing' ? (
          <div className="mt-4">
            <Label htmlFor="participant-id">Pilih peserta</Label>
            <Select
              id="participant-id"
              value={participantId}
              onChange={(e) => setParticipantId(e.target.value)}
              className="mt-1.5"
            >
              <option value="">— pilih peserta —</option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.phone ? ` (${p.phone})` : ''}
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="p-name">Nama peserta</Label>
              <Input
                id="p-name"
                value={participant.name}
                onChange={(e) => setParticipant({ ...participant, name: e.target.value })}
                placeholder="Keluarga Bapak Ahmad"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="p-phone">Nomor WhatsApp</Label>
              <Input
                id="p-phone"
                value={participant.phone}
                onChange={(e) => setParticipant({ ...participant, phone: e.target.value })}
                placeholder="6281234567890"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="p-email">Email</Label>
              <Input
                id="p-email"
                type="email"
                value={participant.email}
                onChange={(e) => setParticipant({ ...participant, email: e.target.value })}
                placeholder="peserta@email.com"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="p-address">Alamat</Label>
              <Input
                id="p-address"
                value={participant.address}
                onChange={(e) => setParticipant({ ...participant, address: e.target.value })}
                className="mt-1.5"
              />
            </div>
          </div>
        )}
      </section>

      {/* --- Item layanan --- */}
      <section className="border-border bg-card rounded-lg border p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Item Layanan</h2>
            <p id="price-note" className="text-muted-foreground mt-0.5 text-sm">
              Minimal satu item. Harga mengikuti katalog layanan dan tidak dapat diubah dari form
              ini.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setItems((prev) => [
                ...prev,
                { key: nextKey(), service_id: '', qty: 1, unit_price: 0, on_behalf_of: '' },
              ])
            }
          >
            <Plus className="size-3.5" />
            Tambah item
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {items.map((item, index) => (
            <div
              key={item.key}
              className="border-border grid gap-3 rounded-xl border p-3 sm:grid-cols-[2fr_80px_1fr_1fr_auto]"
            >
              <div>
                <Label htmlFor={`svc-${item.key}`}>Layanan</Label>
                <Select
                  id={`svc-${item.key}`}
                  value={item.service_id}
                  onChange={(e) => pickService(item.key, e.target.value)}
                  className="mt-1.5"
                >
                  <option value="">— pilih layanan —</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({formatCurrency(s.price)})
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor={`qty-${item.key}`}>Qty</Label>
                <Input
                  id={`qty-${item.key}`}
                  type="number"
                  min={1}
                  value={item.qty}
                  onChange={(e) => updateItem(item.key, { qty: Number(e.target.value) })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor={`price-${item.key}`}>Harga satuan</Label>
                <Input
                  id={`price-${item.key}`}
                  readOnly
                  aria-describedby="price-note"
                  value={item.service_id ? formatCurrency(item.unit_price) : '—'}
                  className="bg-muted text-muted-foreground mt-1.5 tabular-nums"
                />
              </div>
              <div>
                <Label htmlFor={`obo-${item.key}`}>Atas nama</Label>
                <Input
                  id={`obo-${item.key}`}
                  value={item.on_behalf_of}
                  onChange={(e) => updateItem(item.key, { on_behalf_of: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  disabled={items.length === 1}
                  aria-label={`Hapus item ${index + 1}`}
                  onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="border-border mt-4 flex items-center justify-end gap-3 border-t pt-4">
          <span className="text-muted-foreground text-sm">Total order</span>
          <span className="text-lg font-semibold tabular-nums">{formatCurrency(total)}</span>
        </div>
      </section>

      {/* --- Hewan (1 order banyak hewan) --- */}
      <section className="border-border bg-card rounded-lg border p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Hewan</h2>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Satu order bisa mencakup banyak ekor. Boleh dikosongkan dulu dan ditambah dari halaman
              detail.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setAnimals((prev) => [
                ...prev,
                {
                  key: nextKey(),
                  species: 'kambing',
                  tag_code: '',
                  weight_kg: '',
                  on_behalf_of: '',
                },
              ])
            }
          >
            <Plus className="size-3.5" />
            Tambah hewan
          </Button>
        </div>

        {animals.length === 0 ? (
          <p className="border-border text-muted-foreground mt-4 rounded-xl border border-dashed px-4 py-6 text-center text-sm">
            Belum ada hewan ditambahkan.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {animals.map((animal, index) => (
              <div
                key={animal.key}
                className="border-border grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]"
              >
                <div>
                  <Label htmlFor={`sp-${animal.key}`}>Jenis</Label>
                  <Select
                    id={`sp-${animal.key}`}
                    value={animal.species}
                    onChange={(e) =>
                      setAnimals((prev) =>
                        prev.map((a) =>
                          a.key === animal.key
                            ? { ...a, species: e.target.value as AnimalSpecies }
                            : a,
                        ),
                      )
                    }
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
                  <Label htmlFor={`tag-${animal.key}`}>Kode hewan</Label>
                  <Input
                    id={`tag-${animal.key}`}
                    value={animal.tag_code}
                    placeholder="BDG-K-001"
                    onChange={(e) =>
                      setAnimals((prev) =>
                        prev.map((a) =>
                          a.key === animal.key ? { ...a, tag_code: e.target.value } : a,
                        ),
                      )
                    }
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor={`w-${animal.key}`}>Berat (kg)</Label>
                  <Input
                    id={`w-${animal.key}`}
                    type="number"
                    step="0.1"
                    min={0}
                    value={animal.weight_kg}
                    onChange={(e) =>
                      setAnimals((prev) =>
                        prev.map((a) =>
                          a.key === animal.key ? { ...a, weight_kg: e.target.value } : a,
                        ),
                      )
                    }
                    className="mt-1.5 tabular-nums"
                  />
                </div>
                <div>
                  <Label htmlFor={`aobo-${animal.key}`}>Atas nama</Label>
                  <Input
                    id={`aobo-${animal.key}`}
                    value={animal.on_behalf_of}
                    onChange={(e) =>
                      setAnimals((prev) =>
                        prev.map((a) =>
                          a.key === animal.key ? { ...a, on_behalf_of: e.target.value } : a,
                        ),
                      )
                    }
                    className="mt-1.5"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    aria-label={`Hapus hewan ${index + 1}`}
                    onClick={() => setAnimals((prev) => prev.filter((a) => a.key !== animal.key))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* --- Catatan --- */}
      <section className="border-border bg-card rounded-lg border p-5 shadow-sm">
        <Label htmlFor="notes">Catatan</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Permintaan khusus, preferensi waktu, dsb."
          className="mt-1.5"
        />
      </section>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>
          Batal
        </Button>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Menyimpan…' : 'Simpan Order'}
        </Button>
      </div>
    </form>
  );
}
