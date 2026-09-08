'use client';

import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@base-ui/react/dialog';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createLocation, updateLocation } from '@/server/actions/schedules';
import type { LocationOption } from '../queries';

type Draft = { name: string; address: string };

function toDraft(location?: LocationOption): Draft {
  return { name: location?.name ?? '', address: location?.address ?? '' };
}

/**
 * Form lokasi dalam dialog — dipakai untuk **membuat** tempat baru dan
 * **menyunting** yang sudah ada.
 *
 * Satu komponen karena medannya identik: nama dan alamat, keduanya wajib.
 * Memisahkannya jadi dua berkas berarti dua salinan validasi yang bisa berbeda
 * diam-diam.
 *
 * **Alamat wajib**, meski kolomnya nullable di database. Lokasi tanpa alamat
 * tidak bisa dituju siapa pun — mitra yang berangkat ke sana perlu tahu
 * jalannya, dan alamat itu ikut tercetak di laporan peserta. Nama saja
 * ("Masjid Al-Ikhlas") ada puluhan di satu kota. Kolomnya dibiarkan nullable
 * karena tiga baris seed lama memang lahir tanpa alamat; yang dijaga di sini
 * baris baru, bukan yang sudah terlanjur ada.
 *
 * Dialog, bukan form inline: form yang mekar di dalam panel jadwal mendorong
 * seluruh isi di bawahnya, sehingga bagian yang sedang dibaca operator
 * berpindah tempat.
 */
export function LocationDialog({
  location,
  onSaved,
  trigger,
}: {
  /** Diisi = mode sunting. Dikosongkan = mode buat baru. */
  location?: LocationOption;
  /**
   * Dipanggil sesudah tersimpan. Dipakai pemanggil untuk langsung memasang
   * tempat yang baru dibuat sebagai pilihan — yang mendaftarkannya hampir pasti
   * ingin memakainya sekarang, bukan mencarinya lagi di daftar.
   */
  onSaved?: (saved: { id: string; name: string; address: string }) => void;
  /** Elemen pemicu; base-ui menyatukan propsnya lewat `render`. */
  trigger: ReactElement;
}) {
  const router = useRouter();
  const isEdit = Boolean(location);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(location));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    // Disegarkan saat dibuka, bukan saat ditutup: kalau penyuntingan dibatalkan
    // lalu dibuka lagi, yang tampil harus data tersimpan — bukan sisa ketikan
    // yang sudah diurungkan.
    if (next) {
      setDraft(toDraft(location));
      setError(null);
    }
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = location
        ? await updateLocation({ ...draft, id: location.id })
        : await createLocation(draft);

      if (!result.ok) {
        setError(result.error?.message ?? 'Terjadi kesalahan.');
        return;
      }

      onSaved?.({
        id: location?.id ?? (result.data as { id: string }).id,
        name: draft.name.trim(),
        address: draft.address.trim(),
      });
      setOpen(false);
      router.refresh();
    });
  }

  const fieldId = location ? `loc-${location.id}` : 'loc-new';

  // Ambangnya cerminan `createLocationSchema`; kalau menyimpang, tombolnya
  // menyala untuk isian yang pasti ditolak server.
  const canSubmit = !pending && draft.name.trim().length >= 3 && draft.address.trim().length >= 10;

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger render={trigger} />

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />

        <Dialog.Popup className="border-border bg-card fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border p-5 shadow-lg transition-all duration-150 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <Dialog.Title className="text-base font-semibold">
            {isEdit ? 'Ubah lokasi' : 'Tambah lokasi'}
          </Dialog.Title>
          <Dialog.Description className="text-muted-foreground mt-0.5 text-sm">
            {isEdit
              ? 'Perubahan berlaku untuk seluruh order yang memakai lokasi ini.'
              : 'Tempat yang disimpan di sini bisa dipakai order mana pun.'}
          </Dialog.Description>

          {error && (
            <p className="border-destructive/20 bg-destructive/5 text-destructive mt-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}

          <form
            className="mt-4 grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div>
              <Label htmlFor={`${fieldId}-name`}>Nama tempat</Label>
              <Input
                id={`${fieldId}-name`}
                value={draft.name}
                autoFocus
                placeholder="Mis. Masjid Al-Ikhlas Depok"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor={`${fieldId}-address`}>Alamat lengkap</Label>
              <Textarea
                id={`${fieldId}-address`}
                rows={3}
                value={draft.address}
                placeholder="Jl. Margonda Raya No. 10, RT 03/RW 05, Kemiri Muka, Beji, Depok"
                onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                className="mt-1.5"
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Wajib diisi — alamat ini yang dipakai mitra untuk berangkat, dan ikut tercetak di
                laporan peserta.
              </p>
            </div>

            <div className="mt-1 flex items-center justify-end gap-2">
              <Dialog.Close
                render={
                  <Button type="button" variant="outline" disabled={pending}>
                    Batal
                  </Button>
                }
              />
              <Button type="submit" disabled={!canSubmit}>
                {isEdit ? 'Simpan perubahan' : 'Simpan lokasi'}
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
