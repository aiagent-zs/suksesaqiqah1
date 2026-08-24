import Link from 'next/link';
import { AlertTriangle, CalendarDays, MapPin, PawPrint, User } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { OrderStatusBadge } from '@/components/data/status-badge';
import { ISSUE_SEVERITY_META } from '@/lib/constants/order';
import { formatDate } from '@/lib/format';
import type { OpenOrderRow } from '../queries';
import { STAGE_META } from '@/features/stages/sequence';
import { DISTRIBUTION_MODE_LABEL } from '@/lib/constants/order';

/** Umur order yang dianggap perlu perhatian pada tampilan litmus test. */
const AGE_WARNING_DAYS = 7;

function AgeLabel({ days }: { days: number }) {
  return (
    <span
      className={
        days >= AGE_WARNING_DAYS
          ? 'text-destructive font-medium tabular-nums'
          : 'text-muted-foreground tabular-nums'
      }
    >
      {days} hari
    </span>
  );
}

function IssueCell({ row }: { row: OpenOrderRow }) {
  if (row.openIssues === 0 || !row.maxSeverity) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const meta = ISSUE_SEVERITY_META[row.maxSeverity];
  return (
    <div className="flex items-start gap-1.5">
      <AlertTriangle className="text-destructive mt-0.5 size-3.5 shrink-0" />
      <div className="min-w-0">
        <Badge className={meta.className}>{meta.label}</Badge>
        <p className="text-muted-foreground mt-0.5 max-w-[16rem] truncate text-xs">
          {row.latestIssueTitle ?? `${row.openIssues} kendala terbuka`}
        </p>
      </div>
    </div>
  );
}

/**
 * Tabel "Order Belum Selesai" — jawaban litmus test dalam satu layar:
 * berapa order, di lokasi mana, siapa PIC-nya, apa kendalanya (docs/09 section 3).
 */
export function OpenOrdersTable({ rows }: { rows: OpenOrderRow[] }) {
  return (
    <div className="border-border bg-card hidden overflow-hidden rounded-lg border shadow-sm lg:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nomor Order</TableHead>
            <TableHead>Peserta</TableHead>
            <TableHead>Lokasi</TableHead>
            <TableHead>Mitra</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Progres</TableHead>
            <TableHead>Kendala</TableHead>
            <TableHead>Umur</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.orderId}>
              <TableCell>
                <Link
                  href={`/orders/${row.orderId}`}
                  className="text-primary font-medium tabular-nums hover:underline"
                >
                  {row.orderNumber}
                </Link>
                {row.distributionMode && (
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {DISTRIBUTION_MODE_LABEL[row.distributionMode]}
                  </p>
                )}
              </TableCell>

              <TableCell>
                <p className="font-medium">{row.participantName}</p>
              </TableCell>

              <TableCell>
                {row.locationName ? (
                  <>
                    <p className="text-sm">{row.locationName}</p>
                    {row.scheduledDate && (
                      <p className="text-muted-foreground text-xs">
                        {formatDate(row.scheduledDate)}
                      </p>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground text-xs">Belum dijadwalkan</span>
                )}
              </TableCell>

              <TableCell>
                {row.vendorName ? (
                  <>
                    <p className="text-sm">{row.vendorName}</p>
                    {row.vendorPhone && (
                      <p className="text-muted-foreground text-xs tabular-nums">
                        {row.vendorPhone}
                      </p>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground text-xs">Belum ditugaskan</span>
                )}
              </TableCell>

              <TableCell>
                <OrderStatusBadge status={row.status} />
              </TableCell>

              <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                <p className="flex items-center gap-1">
                  <PawPrint className="size-3" />
                  {row.currentStage ? STAGE_META[row.currentStage].label : 'Seluruh tahap selesai'}
                </p>
                <p className="mt-0.5">
                  {Math.round(row.pctStage)}% tahap
                  {row.stagesRejected > 0 ? ` · ${row.stagesRejected} ditolak` : ''}
                </p>
              </TableCell>

              <TableCell>
                <IssueCell row={row} />
              </TableCell>

              <TableCell className="whitespace-nowrap">
                <AgeLabel days={row.ageDays} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Versi kartu untuk mobile/tablet (docs/14 section 5). */
export function OpenOrdersCardList({ rows }: { rows: OpenOrderRow[] }) {
  return (
    <div className="grid gap-3 lg:hidden">
      {rows.map((row) => (
        <Link
          key={row.orderId}
          href={`/orders/${row.orderId}`}
          className="border-border bg-card hover:border-primary/40 block rounded-lg border p-4 shadow-sm transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-primary font-semibold tabular-nums">{row.orderNumber}</p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm">
                <User className="text-muted-foreground size-3.5 shrink-0" />
                {row.participantName}
              </p>
            </div>
            <OrderStatusBadge status={row.status} />
          </div>

          <div className="text-muted-foreground mt-3 space-y-1 text-xs">
            <p className="flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" />
              {row.locationName ?? 'Belum dijadwalkan'}
              {row.vendorName ? ` · ${row.vendorName}` : ' · Mitra belum ditugaskan'}
            </p>
            <p className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5 shrink-0" />
              {row.scheduledDate ? formatDate(row.scheduledDate) : 'Tanggal belum diatur'}
              {' · '}
              <AgeLabel days={row.ageDays} />
            </p>
            <p className="flex items-center gap-1.5">
              <PawPrint className="size-3.5 shrink-0" />
              {row.animalsSlaughtered}/{row.animalsTotal} dipotong · Dok.{' '}
              {Math.round(row.pctDocumentation)}%
            </p>
          </div>

          {row.openIssues > 0 && row.maxSeverity && (
            <div className="border-border mt-3 flex items-center gap-2 border-t pt-3">
              <AlertTriangle className="text-destructive size-3.5 shrink-0" />
              <Badge className={ISSUE_SEVERITY_META[row.maxSeverity].className}>
                {ISSUE_SEVERITY_META[row.maxSeverity].label}
              </Badge>
              <span className="text-muted-foreground truncate text-xs">
                {row.latestIssueTitle ?? `${row.openIssues} kendala terbuka`}
              </span>
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}
