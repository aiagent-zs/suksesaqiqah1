'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CalendarDays, MapPin, Pencil, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScheduleStatusBadge } from '@/components/data/status-badge';
import { formatDate, formatTime } from '@/lib/format';
import type { ScheduleStatus } from '@/lib/constants/order';
import type { Database } from '@/types/database';
import { saveSchedule, updateScheduleStatus } from '@/server/actions/schedules';
import { getScheduleStatusOptions, missingScheduleParts } from '../status-machine';
import { googleMapsUrl } from '../maps';
import type { ScheduleFormOptions } from '../queries';

type UserRole = Database['public']['Enums']['user_role'];

export type CurrentSchedule = {
  locationId: string;
  locationName: string | null;
  locationAddress: string | null;
  lat: number | null;
  lng: number | null;
  picUserId: string | null;
  picName: string | null;
  scheduledDate: string;
  scheduledTime: string | null;
  status: ScheduleStatus;
  notes: string | null;
};

/**
 * Penetapan tanggal, lokasi, dan PIC satu order (`prd.md` FR-S1).
 *
 * Panel ini adalah satu-satunya jalan membuka transisi `paid → scheduled`:
 * guard state machine menuntut ketiganya terisi (docs/08 section 2), jadi
 * bagian yang masih kosong ditampilkan eksplisit alih-alih membiarkan operator
 * menebak kenapa tombol "Terjadwal" tetap nonaktif.
 */
export function ScheduleManager({
  orderId,
  schedule,
  options,
  canEdit,
  role,
}: {
  orderId: string;
  schedule: CurrentSchedule | null;
  options: ScheduleFormOptions;
  canEdit: boolean;
  role: UserRole | undefined;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    location_id: schedule?.locationId ?? '',
    pic_user_id: schedule?.picUserId ?? '',
    scheduled_date: schedule?.scheduledDate ?? '',
    scheduled_time: schedule?.scheduledTime?.slice(0, 5) ?? '',
    notes: schedule?.notes ?? '',
  });

  const missing = missingScheduleParts(
    schedule
      ? {
          scheduled_date: schedule.scheduledDate,
          location_id: schedule.locationId,
          pic_user_id: schedule.picUserId,
        }
      : null,
  );
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
  const noPics = options.pics.length === 0;

  return (
    <section className="border-border bg-card rounded-2xl border shadow-sm">
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-base font-semibold">Jadwal & Penugasan</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">Tanggal, lokasi, dan PIC lapangan</p>
        </div>

        <div className="flex items-center gap-2">
          {schedule && <ScheduleStatusBadge status={schedule.status} />}
          {canEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowForm((v) => !v)}
            >
              <Pencil className="size-3.5" />
              {schedule ? 'Ubah jadwal' : 'Atur jadwal'}
            </Button>
          )}
        </div>
      </div>

      {missing.length > 0 && (
        <p className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          Order belum dapat berstatus Terjadwal — {missing.join(', ')} belum diisi.
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
            <Label htmlFor="sch-location">Lokasi</Label>
            <Select
              id="sch-location"
              value={draft.location_id}
              disabled={noLocations}
              onChange={(e) => setDraft({ ...draft, location_id: e.target.value })}
              className="bg-card mt-1.5"
            >
              <option value="">Pilih lokasi</option>
              {options.locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
            {noLocations && (
              <p className="text-destructive mt-1 text-xs">
                Cabang ini belum punya lokasi. Minta Manager Program menambahkannya lebih dulu.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="sch-pic">PIC Lapangan</Label>
            <Select
              id="sch-pic"
              value={draft.pic_user_id}
              disabled={noPics}
              onChange={(e) => setDraft({ ...draft, pic_user_id: e.target.value })}
              className="bg-card mt-1.5"
            >
              <option value="">Belum ditunjuk</option>
              {options.pics.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            {noPics && <p className="text-destructive mt-1 text-xs">Belum ada vendor aktif.</p>}
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
              disabled={pending || !draft.scheduled_date || !draft.location_id}
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

      {schedule ? (
        <dl className="grid gap-4 px-5 py-4 sm:grid-cols-3">
          <div className="flex gap-3">
            <CalendarDays className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div>
              <dt className="text-muted-foreground text-xs">Waktu</dt>
              <dd className="font-medium">{formatDate(schedule.scheduledDate)}</dd>
              <dd className="text-muted-foreground text-xs">
                {schedule.scheduledTime ? formatTime(schedule.scheduledTime) : 'Jam belum diatur'}
              </dd>
            </div>
          </div>

          <div className="flex gap-3">
            <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <dt className="text-muted-foreground text-xs">Lokasi</dt>
              <dd className="font-medium">{schedule.locationName ?? '-'}</dd>
              {schedule.locationAddress && (
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
            <UserCog className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div>
              <dt className="text-muted-foreground text-xs">PIC Lapangan</dt>
              <dd className="font-medium">{schedule.picName ?? 'Belum ditunjuk'}</dd>
              {canEdit && (
                <dd className="mt-2">
                  <Select
                    aria-label="Ubah status jadwal"
                    value={schedule.status}
                    disabled={pending}
                    onChange={(e) =>
                      run(() =>
                        updateScheduleStatus({
                          order_id: orderId,
                          status: e.target.value as ScheduleStatus,
                        }),
                      )
                    }
                    className="w-44"
                  >
                    {getScheduleStatusOptions(schedule.status, role).map((option) => (
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
                </dd>
              )}
            </div>
          </div>

          {schedule.notes && (
            <div className="sm:col-span-3">
              <dt className="text-muted-foreground text-xs">Catatan</dt>
              <dd className="mt-0.5 text-sm whitespace-pre-wrap">{schedule.notes}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="text-muted-foreground px-5 py-10 text-center text-sm">
          Order ini belum dijadwalkan.
        </p>
      )}
    </section>
  );
}
