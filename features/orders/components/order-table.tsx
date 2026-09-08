import Link from 'next/link';
import { CalendarDays, Globe, MapPin, PawPrint, User } from 'lucide-react';
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

/**
 * Penanda order dari checkout publik (`prd.md` FR-C2).
 *
 * Order tamu hanya bertanda `created_by is null` di database. Tanpa penanda di
 * daftar, pesanan yang masuk dari internet tidak bisa dibedakan dari order yang
 * dibuat staf — dan yang belum diverifikasi bisa mengendap tanpa ada yang tahu.
 */
function GuestBadge({ verifiedAt }: { verifiedAt: string | null }) {
  const pending = verifiedAt === null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        pending
          ? 'border-amber-300 bg-amber-50 text-amber-800'
          : 'border-slate-200 bg-slate-50 text-slate-600'
      }`}
      title={
        pending ? 'Order publik yang belum diverifikasi admin' : 'Order publik, sudah diverifikasi'
      }
    >
      <Globe className="size-3" aria-hidden="true" />
      {pending ? 'Tamu · perlu verifikasi' : 'Tamu'}
    </span>
  );
}

/**
 * Tabel order untuk desktop (docs/14 section 6: tabel penuh di > 1024px).
 *
 * `canSeeFinance` memotong tiga kolom sekaligus — Peserta, Pembayaran, dan
 * Nilai. Kolomnya **tidak dirender**, bukan disembunyikan lewat CSS: angka yang
 * ada di HTML tetap terbaca lewat "view source". Nama peserta sebenarnya sudah
 * null lewat RLS untuk mitra, tetapi kolomnya tetap tampil berisi "-" di setiap
 * baris — kolom kosong yang tidak menerangkan apa pun lebih baik dibuang.
 */
export function OrderTable({
  rows,
  canSeeFinance = true,
}: {
  rows: OrderListRow[];
  canSeeFinance?: boolean;
}) {
  return (
    <div className="border-border bg-card hidden overflow-hidden rounded-lg border shadow-sm lg:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nomor Order</TableHead>
            {canSeeFinance && <TableHead>Peserta</TableHead>}
            <TableHead>Lokasi / PIC</TableHead>
            <TableHead>Status</TableHead>
            {canSeeFinance && (
              <>
                <TableHead>Pembayaran</TableHead>
                <TableHead className="text-right">Nilai</TableHead>
              </>
            )}
            <TableHead>Umur</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Link
                  href={`/orders/${row.id}`}
                  className="text-primary font-medium tabular-nums hover:underline"
                >
                  {row.order_number}
                </Link>
                <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
                  <PawPrint className="size-3" />
                  {row.animalsCount} ekor
                </p>
                {row.isGuest && (
                  <p className="mt-1">
                    <GuestBadge verifiedAt={row.guestVerifiedAt} />
                  </p>
                )}
              </TableCell>
              {canSeeFinance && (
                <TableCell>
                  <p className="font-medium">{row.participantName}</p>
                  {row.participantPhone && (
                    <p className="text-muted-foreground text-xs tabular-nums">
                      {row.participantPhone}
                    </p>
                  )}
                </TableCell>
              )}
              <TableCell>
                {row.locationName ? (
                  <>
                    <p className="text-sm">{row.locationName}</p>
                    <p className="text-muted-foreground text-xs">
                      {row.picName ?? 'PIC belum ditunjuk'}
                    </p>
                  </>
                ) : (
                  <span className="text-muted-foreground text-xs">Belum dijadwalkan</span>
                )}
              </TableCell>
              <TableCell>
                <OrderStatusBadge status={row.status} />
              </TableCell>
              {canSeeFinance && (
                <>
                  <TableCell>
                    <PaymentStatusBadge status={row.payment_status} />
                    {row.payment_status === 'partial' && (
                      <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                        {formatCurrency(row.paid_amount)}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(row.total_amount)}
                  </TableCell>
                </>
              )}
              <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                {formatRelative(row.created_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Kartu order untuk mobile/tablet (docs/14 section 5: OrderCard).
 *
 * `canSeeFinance` menahan hal yang sama dengan versi tabelnya — nama peserta
 * dan angka uang. Mitra membaca daftar ini dari lapangan lewat ponsel, jadi
 * batasnya harus sama persis di kedua breakpoint.
 */
export function OrderCardList({
  rows,
  canSeeFinance = true,
}: {
  rows: OrderListRow[];
  canSeeFinance?: boolean;
}) {
  return (
    <div className="grid gap-3 lg:hidden">
      {rows.map((row) => (
        <Link
          key={row.id}
          href={`/orders/${row.id}`}
          className="border-border bg-card hover:border-primary/40 block rounded-lg border p-4 shadow-sm transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-primary font-semibold tabular-nums">{row.order_number}</p>
              {canSeeFinance && (
                <p className="mt-0.5 flex items-center gap-1.5 text-sm">
                  <User className="text-muted-foreground size-3.5" />
                  {row.participantName}
                </p>
              )}
              {row.isGuest && (
                <p className="mt-1.5">
                  <GuestBadge verifiedAt={row.guestVerifiedAt} />
                </p>
              )}
            </div>
            <OrderStatusBadge status={row.status} />
          </div>

          <div className="text-muted-foreground mt-3 space-y-1 text-xs">
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

          {canSeeFinance && (
            <div className="border-border mt-3 flex items-center justify-between border-t pt-3">
              <PaymentStatusBadge status={row.payment_status} />
              <span className="font-semibold tabular-nums">{formatCurrency(row.total_amount)}</span>
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}
