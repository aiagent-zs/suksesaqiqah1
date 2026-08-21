import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarDays, MapPin, Receipt, User, UserCog } from 'lucide-react';
import { requireAuth } from '@/server/auth/session';
import { canDo } from '@/server/auth/capabilities';
import { getOrderDetail, getOrderTimeline } from '@/features/orders/queries';
import { getTransitionOptions } from '@/features/orders/state-machine';
import { StatusActions } from '@/features/orders/components/status-actions';
import { StatusStepper } from '@/features/orders/components/status-stepper';
import { AnimalManager } from '@/features/orders/components/animal-manager';
import { GuestOrderPanel } from '@/features/orders/components/guest-order-panel';
import { PaymentManager } from '@/features/payments/components/payment-manager';
import { getOrderPayments } from '@/features/payments/queries';
import { ScheduleManager } from '@/features/schedules/components/schedule-manager';
import { getScheduleFormOptions, getVendorOptions } from '@/features/schedules/queries';
import { StagePanel } from '@/features/stages/components/stage-panel';
import { getOrderStages } from '@/features/stages/queries';
import { IssueListPanel } from '@/features/issues/components/issue-list-panel';
import { getOrderIssues } from '@/features/issues/queries';
import { DocumentationManager } from '@/features/documentation/components/documentation-manager';
import { getOrderDocumentations } from '@/features/documentation/queries';
import {
  canValidateDocumentation,
} from '@/features/documentation/review';
import { ReportManager } from '@/features/reporting/components/report-manager';
import { getOrderReports } from '@/features/reporting/queries';
import {
  OrderStatusBadge,
  PaymentStatusBadge,
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

  const { order, participant, vendor, items, animals, schedule, guard, creatorName } = detail;

  // Order tamu: `created_by is null` adalah penanda yang ditulis
  // `create_guest_order` untuk pesanan yang masuk dari halaman publik.
  const isGuestOrder = order.created_by === null;

  const role = session.profile?.role;
  const canManageSchedule = canDo(role, 'MANAGE_SCHEDULE');

  const [
    timeline,
    payments,
    scheduleOptions,
    vendorOptions,
    stages,
    documentations,
    reports,
    issues,
  ] = await Promise.all([
    getOrderTimeline(id),
    getOrderPayments(id),
    // Daftar lokasi hanya dibutuhkan oleh yang berhak menyunting.
    canManageSchedule ? getScheduleFormOptions() : Promise.resolve({ locations: [] }),
    canManageSchedule ? getVendorOptions() : Promise.resolve([]),
    getOrderStages(id),
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
  const canReportStageWork = canDo(role, 'REPORT_STAGE');
  const canValidateStage = canDo(role, 'VALIDATE_STAGE_REPORT');
  const canManageIssues = canDo(role, 'MANAGE_ISSUES');
  // Vendor tidak pernah melihat data pembayaran (RLS `payments_select`) — uang
  // mengalir antara pembeli dan kami, bukan antara pembeli dan vendor. Panelnya
  // karena itu tidak dirender sama sekali untuk mereka.
  const showPayments = role !== 'vendor';
  // Tahap yang buktinya belum lengkap — dihitung database dari
  // `stage_requirements` menurut cara penyaluran order.
  const missingDoc = guard.missingDocStages;

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
              {creatorName ? ` oleh ${creatorName}` : isGuestOrder ? ' lewat checkout publik' : ''}
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

      {/* --- Order tamu ---
          Di luar grid dan tepat di bawah header: selama belum diverifikasi,
          panel ini yang menjelaskan kenapa aksi status tidak bergerak. */}
      {isGuestOrder && (
        <GuestOrderPanel
          orderId={order.id}
          canVerify={canDo(role, 'VERIFY_GUEST_ORDER')}
          info={{
            orderNumber: order.order_number,
            participantName: participant?.name ?? null,
            participantPhone: participant?.phone ?? null,
            aqiqahFor: order.aqiqah_for,
            childBirthPlace: order.child_birth_place,
            childBirthDate: order.child_birth_date,
            requestedDate: order.requested_date,
            requestedTime: order.requested_time,
            distributionMode: order.distribution_mode,
            deliveryAddress: order.delivery_address,
            recipientInstitution: order.recipient_institution,
            referralCode: order.referral_code,
            verifiedAt: order.guest_verified_at,
            verifierName: detail.guestVerifierName,
          }}
        />
      )}

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
                    scheduledDate: schedule.scheduled_date,
                    scheduledTime: schedule.scheduled_time,
                    notes: schedule.notes,
                  }
                : null
            }
            vendor={vendor ? { id: vendor.id, name: vendor.name, phone: vendor.phone } : null}
            vendors={vendorOptions}
            options={scheduleOptions}
            canEdit={canManageSchedule}
            canAssign={canDo(role, 'ASSIGN_VENDOR')}
          />

          {/* --- Pembayaran --- */}
          {showPayments && (
            <PaymentManager
              orderId={order.id}
              orderNumber={order.order_number}
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

          {/* --- Tahap pelaksanaan --- */}
          <StagePanel
            stages={stages}
            canReport={canReportStageWork}
            canValidate={canValidateStage}
            deliveryAddress={order.delivery_address}
          />

          {/* --- Kendala --- */}
          <IssueListPanel orderId={order.id} summary={issues} canManage={canManageIssues} />

          {/* --- Dokumentasi --- */}
          <DocumentationManager
            orderId={order.id}
            orderNumber={order.order_number}
            orderCreatedAt={order.created_at}
            summary={documentations}
            missingDocStages={missingDoc}
            animals={animals.map((a) => ({ id: a.id, tagCode: a.tag_code }))}
            canUpload={canDo(role, 'UPLOAD_DOCUMENTATION')}
            canDelete={role === 'superadmin' || role === 'admin'}
            canValidate={canValidateDocumentation(role)}
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
                    {vendor ? vendor.name : 'Belum ditugaskan'}
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
                  <dt className="text-muted-foreground">Mitra pelaksana</dt>
                  <dd className="font-medium">{vendor?.name ?? 'Belum ditugaskan'}</dd>
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
                Data pembayaran tidak termasuk cakupan akses vendor.
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
