'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CalendarDays, MapPin, Pencil, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatDate, formatTime } from '@/lib/format';
import { assignVendor, saveSchedule } from '@/server/actions/schedules';
import { googleMapsUrl } from '../maps';
import type { ScheduleFormOptions, VendorOption } from '../queries';

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
}: {
  orderId: string;
  schedule: CurrentSchedule | null;
  vendor: AssignedVendor | null;
  options: ScheduleFormOptions;
  vendors: VendorOption[];
  canEdit: boolean;
  canAssign: boolean;
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

  const noLocations = options.locations.length === 0;
  const noVendors = vendors.length === 0;

  return (
    <section className="border-border bg-card rounded-lg border shadow-sm">
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-base font-semibold">Jadwal & Mitra</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Tanggal, lokasi, dan mitra pelaksana
          </p>
        </div>

        {canEdit && (
          <Button type="button" variant="outline" size="sm" onClick={() => setShowForm((v) => !v)}>
            <Pencil className="size-3.5" />
            {schedule ? 'Ubah jadwal' : 'Atur jadwal'}
          </Button>
        )}
      </div>

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
              {options.locations.map((l) => (
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
    </section>
  );
}
