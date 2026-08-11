import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarDays, MapPin, Receipt, User, UserCog } from 'lucide-react';
import { requireAuth, isSupervisor } from '@/server/auth/session';
import { canDo } from '@/server/auth/capabilities';
import { getOrderDetail, getOrderTimeline } from '@/features/orders/queries';
import { getTransitionOptions } from '@/features/orders/state-machine';
import { StatusActions } from '@/features/orders/components/status-actions';
import { StatusStepper } from '@/features/orders/components/status-stepper';
import { AnimalManager } from '@/features/orders/components/animal-manager';
import { PaymentManager } from '@/features/payments/components/payment-manager';
import { getOrderPayments } from '@/features/payments/queries';
import { ScheduleManager } from '@/features/schedules/components/schedule-manager';
import { getScheduleFormOptions } from '@/features/schedules/queries';
import { SlaughterManager } from '@/features/slaughter/components/slaughter-manager';
import { getOrderSlaughterRecords } from '@/features/slaughter/queries';
import { DistributionManager } from '@/features/distribution/components/distribution-manager';
import { getOrderDistributions } from '@/features/distribution/queries';
import { IssueManager } from '@/features/issues/components/issue-manager';
import { getOrderIssues } from '@/features/issues/queries';
import { DocumentationManager } from '@/features/documentation/components/documentation-manager';
import { getOrderDocumentations } from '@/features/documentation/queries';
import { reviewLevelFor, missingDocumentationStages } from '@/features/documentation/review';
import { ReportManager } from '@/features/reporting/components/report-manager';
import { getOrderReports } from '@/features/reporting/queries';
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

  const role = session.profile?.role;
  const canManageSchedule = canDo(role, 'MANAGE_SCHEDULE');

  const [
    timeline,
    payments,
    scheduleOptions,
    slaughterRecords,
    distributions,
    documentations,
    reports,
    issues,
  ] = await Promise.all([
    getOrderTimeline(id),
    getOrderPayments(id),
    // Daftar lokasi & petugas hanya dibutuhkan oleh yang berhak menyunting.
    canManageSchedule
      ? getScheduleFormOptions(order.branch_id)
      : Promise.resolve({ locations: [], pics: [] }),
    getOrderSlaughterRecords(id),
    getOrderDistributions(id),
    getOrderDocumentations(id),
    getOrderReports(id),
    getOrderIssues(id),
  ]);

  const transitions = getTransitionOptions(order.status, role, guard);
  // Sumber kebenaran sama dengan yang ditegakkan server action — daftar role
  // yang di-hardcode di sini akan menyimpang begitu CAPABILITIES berubah.
  const canEditAnimals = canDo(role, 'MANAGE_ANIMALS');
  const canRecordPayment = canDo(role, 'RECORD_PAYMENT');
  const canVerifyPayment = canDo(role, 'VERIFY_PAYMENT');
  const canRecordFieldWork = canDo(role, 'RECORD_FIELD_WORK');
  const canDeleteFieldRecord = canDo(role, 'DELETE_FIELD_RECORD');
  const canManageIssues = canDo(role, 'MANAGE_ISSUES');
  // Hanya hewan yang sudah dipotong yang bisa ditandai tersalurkan.
  const distributableAnimals = animals
    .filter((a) => a.status === 'slaughtered')
    .map((a) => ({ id: a.id, tagCode: a.tag_code, species: a.species }));
  // Petugas lapangan tidak pernah melihat data pembayaran (RLS `payments_select`),
  // jadi panelnya tidak dirender sama sekali untuk mereka.
  const showPayments = role !== 'petugas_lapangan';
  // Kelengkapan yang sama dengan gate `documentation → reporting` (docs/10 §5).
  const missingDoc = missingDocumentationStages({
    approvedSlaughter: documentations.approvedSlaughter,
    approvedDistribution: documentations.approvedDistribution,
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/orders"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" />
          Kembali ke daftar order
        </Link>
      </div>

      {/* --- Header --- */}
      <header className="border-border bg-card rounded-2xl border p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight tabular-nums">
              {order.order_number}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
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
          <section className="border-border bg-card overflow-hidden rounded-2xl border shadow-sm">
            <div className="border-border border-b px-5 py-4">
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
                      <p className="text-muted-foreground text-xs capitalize">
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

          {/* --- Jadwal & penugasan --- */}
          <ScheduleManager
            orderId={order.id}
            schedule={
              schedule
                ? {
                    locationId: schedule.location_id,
                    locationName: schedule.locationName,
                    locationAddress: schedule.locationAddress,
                    lat: schedule.lat,
                    lng: schedule.lng,
                    picUserId: schedule.pic_user_id,
                    picName: schedule.picName,
                    scheduledDate: schedule.scheduled_date,
                    scheduledTime: schedule.scheduled_time,
                    status: schedule.status,
                    notes: schedule.notes,
                  }
                : null
            }
            options={scheduleOptions}
            canEdit={canManageSchedule}
            role={role}
          />

          {/* --- Pembayaran --- */}
          {showPayments && (
            <PaymentManager
              orderId={order.id}
              orderNumber={order.order_number}
              branchCode={branch?.code ?? ''}
              summary={payments}
              totalAmount={Number(order.total_amount)}
              paidAmount={Number(order.paid_amount)}
              minDpRatio={guard.minDpRatio}
              canRecord={canRecordPayment}
              canVerify={canVerifyPayment}
            />
          )}

          {/* --- Hewan --- */}
          <AnimalManager
            orderId={order.id}
            animals={animals}
            canEdit={canEditAnimals}
            role={role}
          />

          {/* --- Pemotongan --- */}
          <SlaughterManager
            animals={animals.map((a) => ({
              id: a.id,
              tagCode: a.tag_code,
              species: a.species,
              status: a.status,
            }))}
            records={slaughterRecords}
            canRecord={canRecordFieldWork}
            canDelete={canDeleteFieldRecord}
          />

          {/* --- Distribusi --- */}
          <DistributionManager
            orderId={order.id}
            summary={distributions}
            availableAnimals={distributableAnimals}
            canRecord={canRecordFieldWork}
            canDelete={canDeleteFieldRecord}
          />

          {/* --- Kendala --- */}
          <IssueManager orderId={order.id} summary={issues} canManage={canManageIssues} />

          {/* --- Dokumentasi --- */}
          <DocumentationManager
            orderId={order.id}
            orderNumber={order.order_number}
            branchCode={branch?.code ?? ''}
            orderCreatedAt={order.created_at}
            summary={documentations}
            animals={animals.map((a) => ({ id: a.id, tagCode: a.tag_code }))}
            canUpload={canDo(role, 'UPLOAD_DOCUMENTATION')}
            canDelete={role === 'manager_program' || role === 'admin_cabang'}
            reviewLevel={reviewLevelFor(role, isSupervisor(session.profile))}
            currentUserId={session.id}
          />

          {/* --- Laporan --- */}
          <ReportManager
            orderId={order.id}
            publicToken={order.public_token}
            appUrl={process.env.NEXT_PUBLIC_APP_URL ?? ''}
            reports={reports}
            canGenerate={canDo(role, 'GENERATE_REPORT')}
            documentationReady={missingDoc.length === 0}
            missingDocumentation={missingDoc}
          />

          {/* --- Riwayat --- */}
          <section className="border-border bg-card rounded-2xl border shadow-sm">
            <div className="border-border border-b px-5 py-4">
              <h2 className="text-base font-semibold">Riwayat</h2>
              <p className="text-muted-foreground mt-0.5 text-sm">
                Jejak audit perubahan order (docs/05 section 4.17)
              </p>
            </div>

            {timeline.length === 0 ? (
              <p className="text-muted-foreground px-5 py-10 text-center text-sm">
                Belum ada riwayat, atau role Anda tidak berhak melihat audit trail order ini.
              </p>
            ) : (
              <ol className="divide-border divide-y">
                {timeline.map((entry) => (
                  <li key={entry.id} className="flex gap-3 px-5 py-3.5">
                    <span className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" />
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
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {formatDateTime(entry.createdAt)} · {entry.actorName ?? 'Sistem'}
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
          <section className="border-border bg-card rounded-2xl border p-5 shadow-sm">
            <h2 className="text-base font-semibold">Aksi Status</h2>
            <p className="text-muted-foreground mt-0.5 mb-4 text-sm">
              Transisi mengikuti state machine docs/08.
            </p>
            <StatusActions orderId={order.id} options={transitions} />
          </section>

          <section className="border-border bg-card rounded-2xl border p-5 shadow-sm">
            <h2 className="text-base font-semibold">Ringkasan</h2>
            <dl className="mt-4 space-y-3.5 text-sm">
              <div className="flex gap-3">
                <User className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div>
                  <dt className="text-muted-foreground">Peserta</dt>
                  <dd className="font-medium">{participant?.name ?? '-'}</dd>
                  {participant?.phone && (
                    <dd className="text-muted-foreground text-xs tabular-nums">
                      {participant.phone}
                    </dd>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div>
                  <dt className="text-muted-foreground">Cabang</dt>
                  <dd className="font-medium">
                    {branch ? `${branch.code} — ${branch.name}` : '-'}
                  </dd>
                </div>
              </div>

              <div className="flex gap-3">
                <CalendarDays className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div>
                  <dt className="text-muted-foreground">Jadwal</dt>
                  {schedule ? (
                    <>
                      <dd className="font-medium">
                        {formatDate(schedule.scheduled_date)}
                        {schedule.scheduled_time ? ` · ${formatTime(schedule.scheduled_time)}` : ''}
                      </dd>
                      <dd className="text-muted-foreground text-xs">
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
                <UserCog className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div>
                  <dt className="text-muted-foreground">PIC Lapangan</dt>
                  <dd className="font-medium">{schedule?.picName ?? 'Belum ditunjuk'}</dd>
                </div>
              </div>
            </dl>
          </section>

          {/* Angka pembayaran hidup di panel Pembayaran pada kolom utama —
              sengaja tidak diduplikasi di sini agar tidak ada dua sumber
              tampilan untuk nilai yang sama. */}
          {!showPayments && (
            <section className="border-border bg-card rounded-2xl border p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Receipt className="text-muted-foreground size-4" />
                Pembayaran
              </h2>
              <p className="text-muted-foreground mt-2 text-sm">
                Data pembayaran tidak termasuk cakupan akses Petugas Lapangan.
              </p>
            </section>
          )}

          {order.notes && (
            <section className="border-border bg-card rounded-2xl border p-5 shadow-sm">
              <h2 className="text-base font-semibold">Catatan</h2>
              <p className="text-muted-foreground mt-2 text-sm whitespace-pre-wrap">
                {order.notes}
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
