import Link from 'next/link';
import { CalendarDays, MapPin, PawPrint, Phone, User } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { OrderStatusBadge } from '@/components/data/status-badge';
import { formatDate, formatTime } from '@/lib/format';
import { googleMapsUrl } from '../maps';
import type { ScheduleRow } from '../queries';

/** Tabel jadwal untuk desktop — per lokasi & per petugas (`prd.md` FR-S2). */
export function ScheduleTable({ rows }: { rows: ScheduleRow[] }) {
  return (
    <div className="border-border bg-card hidden overflow-hidden rounded-2xl border shadow-sm lg:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Waktu</TableHead>
            <TableHead>Order</TableHead>
            <TableHead>Peserta</TableHead>
            <TableHead>Lokasi</TableHead>
            <TableHead>Mitra</TableHead>
            
            <TableHead>Status Order</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const mapsUrl = googleMapsUrl(row.lat, row.lng);
            return (
              <TableRow key={row.orderId}>
                <TableCell className="whitespace-nowrap">
                  <p className="font-medium">{formatDate(row.scheduledDate)}</p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {row.scheduledTime ? formatTime(row.scheduledTime) : 'Jam belum diatur'}
                  </p>
                </TableCell>

                <TableCell>
                  <Link
                    href={`/orders/${row.orderId}`}
                    className="text-primary font-medium tabular-nums hover:underline"
                  >
                    {row.orderNumber}
                  </Link>
                  <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
                    <PawPrint className="size-3" />
                    {row.animalsCount} ekor
                  </p>
                </TableCell>

                <TableCell>
                  <p className="font-medium">{row.participantName}</p>
                </TableCell>

                <TableCell>
                  <p className="text-sm">{row.locationName}</p>
                  {mapsUrl ? (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary text-xs hover:underline"
                    >
                      Buka di Maps
                    </a>
                  ) : (
                    row.locationAddress && (
                      <p className="text-muted-foreground max-w-56 truncate text-xs">
                        {row.locationAddress}
                      </p>
                    )
                  )}
                </TableCell>

                <TableCell>
                  {row.vendorName ? (
                    <>
                      <p className="text-sm">{row.vendorName}</p>
                      {row.vendorPhone && (
                        <p className="text-muted-foreground text-xs tabular-nums">{row.vendorPhone}</p>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground text-xs">Belum ditunjuk</span>
                  )}
                </TableCell>

                <TableCell>
                </TableCell>

                <TableCell>
                  <OrderStatusBadge status={row.orderStatus} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/** Versi kartu untuk mobile — dipakai petugas di lapangan (docs/14 section 5). */
export function ScheduleCardList({ rows }: { rows: ScheduleRow[] }) {
  return (
    <div className="grid gap-3 lg:hidden">
      {rows.map((row) => {
        const mapsUrl = googleMapsUrl(row.lat, row.lng);
        return (
          <div key={row.orderId} className="border-border bg-card rounded-2xl border p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/orders/${row.orderId}`}
                  className="text-primary font-semibold tabular-nums hover:underline"
                >
                  {row.orderNumber}
                </Link>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm">
                  <User className="text-muted-foreground size-3.5 shrink-0" />
                  {row.participantName}
                </p>
              </div>
            </div>

            <div className="text-muted-foreground mt-3 space-y-1 text-xs">
              <p className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5 shrink-0" />
                {formatDate(row.scheduledDate)}
                {row.scheduledTime ? ` · ${formatTime(row.scheduledTime)}` : ''}
              </p>
              <p className="flex items-center gap-1.5">
                <MapPin className="size-3.5 shrink-0" />
                {row.locationName}
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    · Maps
                  </a>
                )}
              </p>
              <p className="flex items-center gap-1.5">
                <Phone className="size-3.5 shrink-0" />
                {row.vendorName ?? 'Mitra belum ditugaskan'}
                {row.vendorPhone ? ` · ${row.vendorPhone}` : ''}
              </p>
              <p className="flex items-center gap-1.5">
                <PawPrint className="size-3.5 shrink-0" />
                {row.animalsCount} ekor
              </p>
            </div>

            <div className="border-border mt-3 border-t pt-3">
              <OrderStatusBadge status={row.orderStatus} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
