'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CalendarDays, MapPin, Pencil, Plus, Store, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatDate, formatTime } from '@/lib/format';
import { assignVendor, saveSchedule } from '@/server/actions/schedules';
import { googleMapsUrl } from '../maps';
import { LocationDialog } from './location-dialog';
import { LocationDeleteDialog } from './location-delete-dialog';
import type { LocationOption, ScheduleFormOptions, VendorOption } from '../queries';

export type CurrentSchedule = {
  locationId: string | null;
  locationName: string | null;
  locationAddress: string | null;
  lat: number | null;
  lng: number | null;
  scheduledDate: string;
  scheduledTime: string | null;
  notes: string | null;
};

export type AssignedVendor = {
  id: string;
  name: string;
  phone: string | null;
};

/**
 * Jadwal & penugasan mitra satu order.
 *
 * Dua aksi yang sengaja dipisah, meski tampil dalam satu panel:
 *
 * - **Jadwal** menetapkan kapan dan di mana. Boleh disimpan bertahap; lokasi
 *   sering baru pasti setelah mitranya menyanggupi.
 * - **Penugasan mitra** adalah satu-satunya hal yang membuat vendor bisa
 *   melihat order ini sama sekali, dan yang menerbitkan daftar tahap kerjanya.
 *   Karena itu ia berdiri sendiri, dengan konfirmasi tersendiri.
 */
export function ScheduleManager({
  orderId,
  schedule,
  vendor,
  options,
  vendors,
  canEdit,
  canAssign,
  canDeleteLocation = false,
}: {
  orderId: string;
  schedule: CurrentSchedule | null;
  vendor: AssignedVendor | null;
  options: ScheduleFormOptions;
  vendors: VendorOption[];
  canEdit: boolean;
  canAssign: boolean;
  /**
   * Menghapus lokasi berhenti di superadmin, sejalan dengan RLS
   * `locations_delete`. Diturunkan dari halaman, bukan ditebak di sini —
   * komponen klien tidak punya sesi untuk ditanyai.
   */
  canDeleteLocation?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    location_id: schedule?.locationId ?? '',
    scheduled_date: schedule?.scheduledDate ?? '',
    scheduled_time: schedule?.scheduledTime?.slice(0, 5) ?? '',
    notes: schedule?.notes ?? '',
  });
  const [vendorDraft, setVendorDraft] = useState(vendor?.id ?? '');
  /** Pemilih lokasi di ringkasan — terpisah dari `draft` milik form penuh. */
  const [locationDraft, setLocationDraft] = useState(schedule?.locationId ?? '');
  /**
   * Lokasi yang baru saja didaftarkan, disimpan sampai `router.refresh()`
   * membawanya turun sebagai props.
   *
   * Tanpa ini `<select>` sempat memegang nilai yang option-nya belum ada —
   * `options.locations` datang dari server dan baru terisi sesudah refresh
   * selesai. Peramban lalu menampilkan opsi pertama, jadi tempat yang barusan
   * dibuat terbaca "Belum ditentukan" selama sekejap: persis tampilan gagal,
   * pada aksi yang sebenarnya berhasil.
   */
  const [justCreated, setJustCreated] = useState<LocationOption[]>([]);

  /**
   * Lokasi yang benar-benar bisa dipakai order ini.
   *
   * `saveSchedule` menolak lokasi milik mitra lain, jadi menawarkannya di sini
   * hanya menghasilkan penolakan sesudah ditekan. Lokasi tanpa pemilik
   * (`vendorId === null`) terbuka untuk siapa pun — masjid, panti, dan tempat
   * salur lain memang tidak dimiliki mitra mana pun.
   *
   * Yang sedang terpasang selalu ikut, sekalipun order ini kemudian dipindah ke
   * mitra lain: tanpa itu, lokasinya lenyap dari daftar dan `Select` jatuh ke
   * "Belum ditentukan" — terbaca seolah lokasinya sudah dihapus.
   */
  const selectableLocations = [
    // Yang baru dibuat ikut lebih dulu, tapi berhenti muncul begitu server
    // mengirimkannya — kalau tidak, ia terdaftar dua kali setelah refresh.
    ...justCreated.filter((c) => !options.locations.some((l) => l.id === c.id)),
    ...options.locations,
  ].filter(
    (l) => l.id === schedule?.locationId || !l.vendorId || !vendor?.id || l.vendorId === vendor.id,
  );

  /** Lokasi yang sedang dipilih di dropdown — sasaran tombol Ubah & Hapus. */
  const selectedLocation = selectableLocations.find((l) => l.id === locationDraft) ?? null;

  const mapsUrl = schedule ? googleMapsUrl(schedule.lat, schedule.lng) : null;

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

  // Dihitung dari daftar yang benar-benar bisa dipilih, bukan seluruh isi
  // tabel: order yang mitranya memiliki semua lokasi orang lain tetap tidak
  // punya satu pun pilihan, dan pesannya harus mengatakan itu.
  const noLocations = selectableLocations.length === 0;
  const noVendors = vendors.length === 0;

  return (
    // Judul & ringkasannya dipegang `PhaseSection` di halaman detail order.
    <div>
      {canEdit && (
        <div className="border-border flex justify-end border-b px-5 py-3">
          <Button type="button" variant="outline" size="sm" onClick={() => setShowForm((v) => !v)}>
            <Pencil className="size-3.5" />
            {schedule ? 'Ubah jadwal' : 'Atur jadwal'}
          </Button>
        </div>
      )}

      {!vendor && (
        <p className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          Mitra belum ditugaskan — daftar tahap kerja baru terbit setelah mitra ditetapkan.
        </p>
      )}

      {error && (
        <p className="border-destructive/20 bg-destructive/5 text-destructive flex items-start gap-2 border-b px-5 py-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {showForm && canEdit && (
        <div className="border-border bg-muted/30 grid gap-3 border-b p-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="sch-date">Tanggal pelaksanaan</Label>
            <Input
              id="sch-date"
              type="date"
              value={draft.scheduled_date}
              onChange={(e) => setDraft({ ...draft, scheduled_date: e.target.value })}
              className="bg-card mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="sch-time">Jam (opsional)</Label>
            <Input
              id="sch-time"
              type="time"
              value={draft.scheduled_time}
              onChange={(e) => setDraft({ ...draft, scheduled_time: e.target.value })}
              className="bg-card mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="sch-location">Lokasi (opsional)</Label>
            <Select
              id="sch-location"
              value={draft.location_id}
              disabled={noLocations}
              onChange={(e) => setDraft({ ...draft, location_id: e.target.value })}
              className="bg-card mt-1.5"
            >
              <option value="">Belum ditentukan</option>
              {/* Daftar yang sama dengan pemilih di ringkasan — dua aturan
                  berbeda untuk hal yang sama pasti menyimpang cepat atau
                  lambat. */}
              {selectableLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
            {noLocations && (
              <p className="text-muted-foreground mt-1 text-xs">
                Belum ada lokasi terdaftar. Superadmin dapat menambahkannya di master data.
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="sch-notes">Catatan jadwal</Label>
            <Textarea
              id="sch-notes"
              rows={2}
              value={draft.notes}
              placeholder="Mis. akses masuk lewat gerbang belakang"
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              className="bg-card mt-1.5"
            />
          </div>

          <div className="flex items-center gap-2 sm:col-span-2">
            <Button
              type="button"
              disabled={pending || !draft.scheduled_date}
              onClick={() =>
                run(async () => {
                  const result = await saveSchedule({ order_id: orderId, ...draft });
                  if (result.ok) setShowForm(false);
                  return result;
                })
              }
            >
              Simpan jadwal
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setShowForm(false)}
            >
              Batal
            </Button>
          </div>
        </div>
      )}

      <dl className="grid gap-4 px-5 py-4 sm:grid-cols-3">
        <div className="flex gap-3">
          <CalendarDays className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          <div>
            <dt className="text-muted-foreground text-xs">Waktu</dt>
            {schedule ? (
              <>
                <dd className="font-medium">{formatDate(schedule.scheduledDate)}</dd>
                <dd className="text-muted-foreground text-xs">
                  {schedule.scheduledTime ? formatTime(schedule.scheduledTime) : 'Jam belum diatur'}
                </dd>
              </>
            ) : (
              <dd className="text-muted-foreground text-sm">Belum dijadwalkan</dd>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <dt className="text-muted-foreground text-xs">Lokasi</dt>
            <dd className="font-medium">{schedule?.locationName ?? 'Belum ditentukan'}</dd>
            {schedule?.locationAddress && (
              <dd className="text-muted-foreground text-xs">{schedule.locationAddress}</dd>
            )}
            {mapsUrl && (
              <dd className="mt-1">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary text-xs hover:underline"
                >
                  Buka di Google Maps
                </a>
              </dd>
            )}

            {/* Pemilih lokasi langsung di ringkasan, sejajar dengan pemilih
                mitra di sebelahnya. Sebelum ini mengganti lokasi menuntut
                membuka "Ubah jadwal" — form yang menampilkan tanggal, jam,
                dan catatan sekaligus — padahal tanggalnya sudah benar dan
                yang berubah cuma tempatnya. Ketimpangannya juga terbaca:
                mitra bisa dipindah dari sini, lokasi tidak.

                Tanggal ikut dikirim karena `saveSchedule` menyimpan satu baris
                utuh; mengirim lokasi saja akan mengosongkan tanggalnya. */}
            {canEdit && schedule && (
              <dd className="mt-2 space-y-2">
                <Select
                  aria-label="Pilih lokasi pelaksanaan"
                  value={locationDraft}
                  disabled={pending || noLocations}
                  onChange={(e) => setLocationDraft(e.target.value)}
                  className="w-full"
                >
                  <option value="">Belum ditentukan</option>
                  {selectableLocations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending || locationDraft === (schedule.locationId ?? '')}
                    onClick={() =>
                      run(() =>
                        saveSchedule({
                          order_id: orderId,
                          location_id: locationDraft,
                          scheduled_date: schedule.scheduledDate,
                          scheduled_time: schedule.scheduledTime?.slice(0, 5) ?? '',
                          notes: schedule.notes ?? '',
                        }),
                      )
                    }
                  >
                    Pindahkan ke lokasi ini
                  </Button>

                  {/* Menambah & menyunting tempat dari sini, bukan dari halaman
                      master data tersendiri: lokasi salur berganti hampir tiap
                      order, dan yang tahu alamatnya adalah admin yang sedang
                      menjadwalkan. Selama pintunya tidak ada, yang terjadi bukan
                      "minta tolong superadmin" melainkan alamat ditulis di kolom
                      catatan — di luar jangkauan laporan dan tidak bisa dipakai
                      ulang order berikutnya. */}
                  <LocationDialog
                    onSaved={(saved) => {
                      // Disimpan sementara sampai `router.refresh()` membawanya
                      // turun sebagai props, lalu langsung dipasang: yang baru
                      // mendaftarkan tempat hampir pasti ingin memakainya
                      // sekarang.
                      setJustCreated((prev) => [
                        ...prev,
                        {
                          id: saved.id,
                          name: saved.name,
                          address: saved.address,
                          lat: null,
                          lng: null,
                          vendorId: null,
                        },
                      ]);
                      setLocationDraft(saved.id);
                    }}
                    trigger={
                      <Button type="button" size="sm" variant="ghost" disabled={pending}>
                        <Plus className="size-3.5" />
                        Tambah lokasi
                      </Button>
                    }
                  />

                  {/* Menyunting yang sedang dipilih, bukan yang sedang
                      terpasang: salah ketik paling sering ketahuan justru saat
                      tempatnya dipilih untuk order berikutnya. */}
                  {selectedLocation && (
                    <LocationDialog
                      location={selectedLocation}
                      onSaved={(saved) =>
                        // Perubahan nama ikut disimpan sementara supaya
                        // labelnya tidak melompat balik ke nama lama sampai
                        // refresh selesai.
                        setJustCreated((prev) => [
                          ...prev.filter((l) => l.id !== saved.id),
                          { ...selectedLocation, name: saved.name, address: saved.address },
                        ])
                      }
                      trigger={
                        <Button type="button" size="sm" variant="ghost" disabled={pending}>
                          <Pencil className="size-3.5" />
                          Ubah lokasi
                        </Button>
                      }
                    />
                  )}

                  {canDeleteLocation && selectedLocation && (
                    <LocationDeleteDialog
                      location={selectedLocation}
                      onDeleted={() => setLocationDraft('')}
                      trigger={
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={pending}
                          aria-label={`Hapus lokasi ${selectedLocation.name}`}
                        >
                          <Trash2 className="size-3.5" />
                          Hapus
                        </Button>
                      }
                    />
                  )}
                </div>

                {noLocations && (
                  <p className="text-muted-foreground text-xs">
                    Belum ada lokasi terdaftar — tambahkan lewat “Tambah lokasi”.
                  </p>
                )}
              </dd>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <Store className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <dt className="text-muted-foreground text-xs">Mitra pelaksana</dt>
            <dd className="font-medium">{vendor?.name ?? 'Belum ditugaskan'}</dd>
            {vendor?.phone && (
              <dd className="text-muted-foreground text-xs tabular-nums">{vendor.phone}</dd>
            )}

            {canAssign && (
              <dd className="mt-2 space-y-2">
                <Select
                  aria-label="Pilih mitra pelaksana"
                  value={vendorDraft}
                  disabled={pending || noVendors}
                  onChange={(e) => setVendorDraft(e.target.value)}
                  className="w-full"
                >
                  <option value="">Pilih mitra</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending || !vendorDraft || vendorDraft === vendor?.id}
                  onClick={() =>
                    run(() => assignVendor({ order_id: orderId, vendor_id: vendorDraft }))
                  }
                >
                  {vendor ? 'Pindahkan ke mitra ini' : 'Tugaskan mitra'}
                </Button>
                {noVendors && (
                  <p className="text-destructive text-xs">Belum ada mitra aktif terdaftar.</p>
                )}
              </dd>
            )}
          </div>
        </div>

        {schedule?.notes && (
          <div className="sm:col-span-3">
            <dt className="text-muted-foreground text-xs">Catatan</dt>
            <dd className="mt-0.5 text-sm whitespace-pre-wrap">{schedule.notes}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
