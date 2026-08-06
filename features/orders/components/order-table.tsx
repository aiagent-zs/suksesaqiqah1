import Link from 'next/link';
import { CalendarDays, MapPin, PawPrint, User } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/data/status-badge';
import { formatCurrency, formatDate, formatRelative } from '@/lib/format';
import type { OrderListRow } from '../queries';

/** Tabel order untuk desktop (docs/14 section 6: tabel penuh di > 1024px). */
export function OrderTable({ rows }: { rows: OrderListRow[] }) {
  return (
    <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nomor Order</TableHead>
            <TableHead>Peserta</TableHead>
            <TableHead>Cabang</TableHead>
            <TableHead>Lokasi / PIC</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Pembayaran</TableHead>
            <TableHead className="text-right">Nilai</TableHead>
            <TableHead>Umur</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Link
                  href={`/orders/${row.id}`}
                  className="font-medium text-primary tabular-nums hover:underline"
                >
                  {row.order_number}
                </Link>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <PawPrint className="size-3" />
                  {row.animalsCount} ekor
                </p>
              </TableCell>
              <TableCell>
                <p className="font-medium">{row.participantName}</p>
                {row.participantPhone && (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {row.participantPhone}
                  </p>
                )}
              </TableCell>
              <TableCell>
                <span className="text-sm">{row.branchCode}</span>
              </TableCell>
              <TableCell>
                {row.locationName ? (
                  <>
                    <p className="text-sm">{row.locationName}</p>
                    <p className="text-xs text-muted-foreground">{row.picName ?? 'PIC belum ditunjuk'}</p>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">Belum dijadwalkan</span>
                )}
              </TableCell>
              <TableCell>
                <OrderStatusBadge status={row.status} />
              </TableCell>
              <TableCell>
                <PaymentStatusBadge status={row.payment_status} />
                {row.payment_status === 'partial' && (
                  <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    {formatCurrency(row.paid_amount)}
                  </p>
                )}
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatCurrency(row.total_amount)}
              </TableCell>
              <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                {formatRelative(row.created_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Kartu order untuk mobile/tablet (docs/14 section 5: OrderCard). */
export function OrderCardList({ rows }: { rows: OrderListRow[] }) {
  return (
    <div className="grid gap-3 lg:hidden">
      {rows.map((row) => (
        <Link
          key={row.id}
          href={`/orders/${row.id}`}
          className="block rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-primary tabular-nums">{row.order_number}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm">
                <User className="size-3.5 text-muted-foreground" />
                {row.participantName}
              </p>
            </div>
            <OrderStatusBadge status={row.status} />
          </div>

          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {row.locationName ?? 'Belum dijadwalkan'}
              {row.picName ? ` · ${row.picName}` : ''}
            </p>
            <p className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              {row.scheduledDate ? formatDate(row.scheduledDate) : formatRelative(row.created_at)}
            </p>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <PaymentStatusBadge status={row.payment_status} />
            <span className="font-semibold tabular-nums">{formatCurrency(row.total_amount)}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
