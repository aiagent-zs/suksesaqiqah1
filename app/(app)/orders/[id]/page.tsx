import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarDays, MapPin, Receipt, User, UserCog } from 'lucide-react';
import { requireAuth } from '@/server/auth/session';
import { getOrderDetail, getOrderTimeline } from '@/features/orders/queries';
import { getTransitionOptions } from '@/features/orders/state-machine';
import { StatusActions } from '@/features/orders/components/status-actions';
import { StatusStepper } from '@/features/orders/components/status-stepper';
import { AnimalManager } from '@/features/orders/components/animal-manager';
import {
  OrderStatusBadge,
  PaymentStatusBadge,
  ScheduleStatusBadge,
} from '@/components/data/status-badge';
import { ORDER_STATUS_META } from '@/lib/constants/order';
import { formatCurrency, formatDate, formatDateTime, formatTime } from '@/lib/format';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Params = Promise<{ id: string }>;

export default async function OrderDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await requireAuth();

  const detail = await getOrderDetail(id);
  if (!detail) notFound();

  const { order, participant, branch, items, animals, schedule, guard, creatorName } = detail;
  const timeline = await getOrderTimeline(id);

  const role = session.profile?.role;
  const transitions = getTransitionOptions(order.status, role, guard);
  const canEditAnimals =
    role === 'manager_program' || role === 'admin_cabang' || role === 'petugas_lapangan';

  const outstanding = Number(order.total_amount) - Number(order.paid_amount);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Kembali ke daftar order
        </Link>
      </div>

      {/* --- Header --- */}
      <header className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight tabular-nums">
              {order.order_number}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Dibuat {formatDateTime(order.created_at)}
              {creatorName ? ` oleh ${creatorName}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.payment_status} />
          </div>
        </div>

        <div className="mt-5">
          <StatusStepper status={order.status} />
        </div>

        {order.status_reason && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <span className="font-medium">Alasan status terakhir:</span> {order.status_reason}
          </p>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* --- Item layanan --- */}
          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold">Item Layanan</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Layanan</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Harga Satuan</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="font-medium">{item.serviceName}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {item.serviceType.replace('_', ' ')}
                      </p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{item.qty}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(item.unit_price)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrency(item.qty * item.unit_price)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>

          {/* --- Hewan --- */}
          <AnimalManager orderId={order.id} animals={animals} canEdit={canEditAnimals} />

          {/* --- Riwayat --- */}
          <section className="rounded-2xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold">Riwayat</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Jejak audit perubahan order (docs/05 section 4.17)
              </p>
            </div>

            {timeline.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                Belum ada riwayat, atau role Anda tidak berhak melihat audit trail order ini.
              </p>
            ) : (
              <ol className="divide-y divide-border">
                {timeline.map((entry) => (
                  <li key={entry.id} className="flex gap-3 px-5 py-3.5">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        {entry.action === 'status_change' && entry.toStatus ? (
                          <>
                            Status berubah
                            {entry.fromStatus
                              ? ` dari ${ORDER_STATUS_META[entry.fromStatus as keyof typeof ORDER_STATUS_META]?.label ?? entry.fromStatus}`
                              : ''}{' '}
                            menjadi{' '}
                            <span className="font-medium">
                              {ORDER_STATUS_META[entry.toStatus as keyof typeof ORDER_STATUS_META]
                                ?.label ?? entry.toStatus}
                            </span>
                          </>
                        ) : entry.action === 'create' ? (
                          'Order dibuat'
                        ) : (
                          'Data order diperbarui'
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDateTime(entry.createdAt)} ·{' '}
                        {entry.actorName ?? 'Sistem'}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* --- Sidebar kanan --- */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-base font-semibold">Aksi Status</h2>
            <p className="mt-0.5 mb-4 text-sm text-muted-foreground">
              Transisi mengikuti state machine docs/08.
            </p>
            <StatusActions orderId={order.id} options={transitions} />
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-base font-semibold">Ringkasan</h2>
            <dl className="mt-4 space-y-3.5 text-sm">
              <div className="flex gap-3">
                <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <dt className="text-muted-foreground">Peserta</dt>
                  <dd className="font-medium">{participant?.name ?? '-'}</dd>
                  {participant?.phone && (
                    <dd className="text-xs text-muted-foreground tabular-nums">
                      {participant.phone}
                    </dd>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <dt className="text-muted-foreground">Cabang</dt>
                  <dd className="font-medium">
                    {branch ? `${branch.code} — ${branch.name}` : '-'}
                  </dd>
                </div>
              </div>

              <div className="flex gap-3">
                <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <dt className="text-muted-foreground">Jadwal</dt>
                  {schedule ? (
                    <>
                      <dd className="font-medium">
                        {formatDate(schedule.scheduled_date)}
                        {schedule.scheduled_time ? ` · ${formatTime(schedule.scheduled_time)}` : ''}
                      </dd>
                      <dd className="text-xs text-muted-foreground">
                        {schedule.locationName ?? 'Lokasi belum diisi'}
                      </dd>
                      <dd className="mt-1">
                        <ScheduleStatusBadge status={schedule.status} />
                      </dd>
                    </>
                  ) : (
                    <dd className="text-muted-foreground">Belum dijadwalkan</dd>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <UserCog className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <dt className="text-muted-foreground">PIC Lapangan</dt>
                  <dd className="font-medium">{schedule?.picName ?? 'Belum ditunjuk'}</dd>
                </div>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Receipt className="size-4 text-muted-foreground" />
              Pembayaran
            </h2>
            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total</dt>
                <dd className="font-medium tabular-nums">{formatCurrency(order.total_amount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Terbayar</dt>
                <dd className="font-medium tabular-nums text-emerald-700">
                  {formatCurrency(order.paid_amount)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2.5">
                <dt className="text-muted-foreground">Sisa</dt>
                <dd className="font-semibold tabular-nums">
                  {formatCurrency(Math.max(0, outstanding))}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              Gate DP saat ini: minimal {Math.round(guard.minDpRatio * 100)}% dari total agar order
              dapat dijadwalkan.
            </p>
          </section>

          {order.notes && (
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="text-base font-semibold">Catatan</h2>
              <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">{order.notes}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
