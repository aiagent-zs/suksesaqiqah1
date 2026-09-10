import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarDays, MapPin, Receipt, User, UserCog } from 'lucide-react';
import { requireAuth } from '@/server/auth/session';
import { canDo } from '@/server/auth/capabilities';
import { getOrderDetail, getOrderTimeline } from '@/features/orders/queries';
import { getTransitionOptions } from '@/features/orders/state-machine';
import { deriveNextStep, isPanelRelevant } from '@/features/orders/next-step';
import { NextStepCard } from '@/features/orders/components/next-step-card';
import { PhaseSection } from '@/features/orders/components/phase-section';
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
import { getOrderDocumentations } from '@/features/documentation/queries';
import { ReportManager } from '@/features/reporting/components/report-manager';
import { CertificatePanel } from '@/features/reporting/components/certificate-panel';
import { getOrderReports } from '@/features/reporting/queries';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/data/status-badge';
import { DOC_STAGE_LABEL, ORDER_STATUS_META, type DocStage } from '@/lib/constants/order';
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
  /**
   * Angka uang berhenti di staf.
   *
   * `orders_select` memakai `can_read_order`, jadi mitra memang membaca baris
   * ordernya termasuk `total_amount` — RLS tidak bisa menahan satu kolom. Yang
   * menahannya di layar adalah kapabilitas ini.
   */
  const canSeeFinance = canDo(role, 'VIEW_ORDER_FINANCE');
  /** Jejak audit adalah keputusan internal; `audit_logs_select` menuntut staf. */
  const canSeeAudit = canDo(role, 'VIEW_FULL_AUDIT');
  /**
   * Tautan `/r/{token}` membuka identitas & alamat pemesan tanpa login, dan
   * mengirim laporan ke peserta adalah urusan kami dengan pembeli. Sengaja
   * diikat ke GENERATE_REPORT: yang membuat laporan adalah yang membagikannya.
   */
  const canShareReport = canDo(role, 'GENERATE_REPORT');

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
    // Ditolak RLS bagi mitra dan mengembalikan array kosong; dilewati supaya
    // tidak ada perjalanan bolak-balik untuk panel yang tidak dirender.
    canSeeAudit ? getOrderTimeline(id) : Promise.resolve([]),
    getOrderPayments(id),
    // Daftar lokasi hanya dibutuhkan oleh yang berhak menyunting.
    canManageSchedule ? getScheduleFormOptions() : Promise.resolve({ locations: [] }),
    canManageSchedule ? getVendorOptions() : Promise.resolve([]),
    getOrderStages(id),
    getOrderDocumentations(id),
    canShareReport ? getOrderReports(id) : Promise.resolve([]),
    getOrderIssues(id),
  ]);

  const transitions = getTransitionOptions(order.status, role, guard);
  // "Apa yang harus dikerjakan sekarang", diturunkan dari state machine yang
  // sama dengan yang ditegakkan server action — jadi layar tidak pernah
  // menjanjikan sesuatu yang lalu ditolak tombolnya.
  const nextStep = deriveNextStep(order.status, role, guard);
  const relevant = (panel: Parameters<typeof isPanelRelevant>[1]) =>
    isPanelRelevant(order.status, panel);
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
  const showPayments = canSeeFinance;
  // Tahap yang buktinya belum lengkap — dihitung database dari
  // `stage_requirements` menurut cara penyaluran order.
  const missingDoc = guard.missingDocStages;
  // Nama pada "atas nama" tiap hewan, tanpa duplikat: aqiqah anak laki-laki
  // memakai dua kambing atas nama anak yang sama, dan sertifikatnya satu.
  const childNames = [
    ...new Set(animals.map((a) => a.on_behalf_of).filter((n): n is string => Boolean(n))),
  ];

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
      <header className="border-border bg-card rounded-lg border p-5 shadow-sm">
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

      {/* Satu jawaban untuk pertanyaan yang selalu ditanyakan saat halaman ini
          dibuka: sekarang giliran siapa, mengisi apa, di panel mana. */}
      <NextStepCard step={nextStep} />

      {/* --- Order tamu ---
          Di luar grid dan tepat di bawah header: selama belum diverifikasi,
          panel ini yang menjelaskan kenapa aksi status tidak bergerak.

          Berhenti di yang berhak memverifikasi. Isinya data pemesan — tempat
          & tanggal lahir anak, lembaga penerima, kode referal — dan mitra tidak
          bisa memverifikasi apa pun di sini, jadi bagi mereka panel ini murni
          keterbukaan tanpa guna. Alamat pengiriman tetap sampai ke mitra lewat
          panel Tahap, di mana ia memang dibutuhkan untuk mengantar. */}
      {isGuestOrder && canDo(role, 'VERIFY_GUEST_ORDER') && (
        <GuestOrderPanel
          orderId={order.id}
          canVerify
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
          <section className="border-border bg-card overflow-hidden rounded-lg border shadow-sm">
            <div className="border-border border-b px-5 py-4">
              <h2 className="text-base font-semibold">Item Layanan</h2>
            </div>
            {/* Harga tidak dirender untuk mitra — bukan disembunyikan lewat
                CSS. Angka yang ada di HTML tetap terbaca lewat "view source",
                jadi yang dipotong adalah datanya, bukan tampilannya. Mitra
                dibayar lewat `vendor_services.vendor_price`; harga jual ke
                pembeli adalah angka yang menentukan margin, dan tabel
                `vendor_services` sendiri ditutup `is_staff()` justru untuk itu. */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Layanan</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  {canSeeFinance && (
                    <>
                      <TableHead className="text-right">Harga Satuan</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </>
                  )}
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
                    {canSeeFinance && (
                      <>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(item.unit_price)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCurrency(item.qty * item.unit_price)}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>

          {/* --- Pembayaran ---
              Naik ke atas Jadwal: gate DP menahan `verified → paid`, jadi
              inilah yang lebih dulu dikerjakan dalam urutan sungguhannya. */}
          {showPayments && (
            <PhaseSection
              id="pembayaran"
              title="Pembayaran"
              active={relevant('pembayaran')}
              complete={guard.paidAmount >= guard.totalAmount * guard.minDpRatio}
              summary={
                payments.pendingCount > 0
                  ? `${payments.payments.length} catatan · ${payments.pendingCount} menunggu verifikasi`
                  : `${payments.payments.length} catatan · terverifikasi ${formatCurrency(payments.verifiedTotal)} dari ${formatCurrency(order.total_amount)}`
              }
            >
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
            </PhaseSection>
          )}

          {/* --- Jadwal & penugasan --- */}
          <PhaseSection
            id="jadwal"
            title="Jadwal & Mitra"
            active={relevant('jadwal')}
            complete={Boolean(vendor)}
            summary={
              vendor
                ? `${vendor.name}${schedule ? ` · ${formatDate(schedule.scheduled_date)}` : ''}`
                : 'Mitra pelaksana belum ditetapkan'
            }
          >
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
              // Cerminan RLS `locations_delete`: menghapus lokasi memutus jejak
              // ke mana order lama dilaksanakan, jadi berhenti di superadmin.
              canDeleteLocation={role === 'superadmin'}
            />
          </PhaseSection>

          {/* --- Hewan --- */}
          <PhaseSection
            id="hewan"
            title="Hewan"
            active={relevant('hewan')}
            complete={animals.length > 0}
            summary={
              animals.length === 0
                ? 'Belum ada hewan terdaftar'
                : `${animals.length} ekor terdaftar`
            }
          >
            <AnimalManager orderId={order.id} animals={animals} canEdit={canEditAnimals} />
          </PhaseSection>

          {/* --- Tahap pelaksanaan --- */}
          {/* Bukti kini hidup di dalam tiap tahap, jadi kelengkapannya ikut
              diringkas di sini — panel Dokumentasi yang dulu memuat kalimat
              ini sudah tidak ada. */}
          <PhaseSection
            id="tahap"
            title="Tahap Pelaksanaan"
            active={relevant('tahap')}
            complete={
              guard.stagesTotal > 0 &&
              guard.stagesValidated >= guard.stagesTotal &&
              missingDoc.length === 0
            }
            summary={
              guard.stagesTotal === 0
                ? 'Daftar tahap terbit setelah mitra ditetapkan'
                : `${guard.stagesValidated} dari ${guard.stagesTotal} tahap tervalidasi · ${
                    missingDoc.length === 0
                      ? 'bukti lengkap'
                      : `bukti kurang: ${missingDoc.map((s) => DOC_STAGE_LABEL[s as DocStage] ?? s).join(', ')}`
                  }`
            }
          >
            <StagePanel
              stages={stages}
              docs={documentations.rows}
              canReport={canReportStageWork}
              canValidate={canValidateStage}
              canUpload={canDo(role, 'UPLOAD_DOCUMENTATION')}
              currentUserId={session.id}
              orderNumber={order.order_number}
              orderCreatedAt={order.created_at}
              deliveryAddress={order.delivery_address}
            />
          </PhaseSection>

          {/* --- Kendala --- */}
          <IssueListPanel orderId={order.id} summary={issues} canManage={canManageIssues} />

          {/* Panel Dokumentasi yang berdiri sendiri dihapus 8 September: bukti
              kini menempel pada baris tahapnya di panel di atas. Sebelumnya
              mitra melapor di satu panel lalu mengunggah fotonya di panel lain,
              dan admin memutuskan keduanya di dua layar berbeda. */}

          {/* --- Laporan ---
              Seluruh panelnya berhenti di yang berhak membuat laporan. Laporan
              peserta adalah urusan kami dengan pembeli; mitra mengerjakan
              pelaksanaannya, bukan penyampaiannya. Menyembunyikan tautannya
              saja tidak cukup — daftar versi pun bukan miliknya. */}
          {canShareReport && (
            <PhaseSection
              id="laporan"
              title="Laporan Peserta"
              active={relevant('laporan')}
              complete={guard.reportSent}
              summary={
                reports.length === 0
                  ? 'Belum pernah dibuat'
                  : guard.reportSent
                    ? `${reports.length} versi · sudah dikirim ke peserta`
                    : `${reports.length} versi · belum ditandai terkirim`
              }
            >
              <ReportManager
                orderId={order.id}
                publicToken={order.public_token}
                appUrl={process.env.NEXT_PUBLIC_APP_URL ?? ''}
                reports={reports}
                canGenerate={canShareReport}
                canShare={canShareReport}
                documentationReady={missingDoc.length === 0}
                missingDocumentation={missingDoc}
              />
            </PhaseSection>
          )}

          {/* --- Sertifikat aqiqah ------------------------------------------
              Panel sendiri, bukan bagian panel Laporan: sertifikat sudah benar
              isinya sejak hari penyembelihan dan keluarga memintanya saat itu
              juga, sementara laporan menunggu seluruh tahap tervalidasi. Yang
              sama tetap ikut sebagai halaman lanjutan di PDF laporan.

              Qurban tidak menerbitkan sertifikat aqiqah — panelnya
              disembunyikan, bukan ditampilkan kosong. */}
          {canShareReport && childNames.length > 0 && (
            <PhaseSection
              id="sertifikat"
              title="Sertifikat Aqiqah"
              active={false}
              complete={Boolean(order.child_photo_path)}
              summary={
                childNames.length === 1
                  ? `Untuk ${childNames[0]}`
                  : `${childNames.length} lembar · ${childNames.join(', ')}`
              }
            >
              <CertificatePanel
                orderId={order.id}
                orderNumber={order.order_number}
                orderCreatedAt={order.created_at}
                childPhotoPath={order.child_photo_path}
                childNames={childNames}
                canManage={canShareReport}
              />
            </PhaseSection>
          )}

          {/* --- Riwayat ---
              Berhenti di staf, sejalan dengan `audit_logs_select`. Sebelumnya
              panelnya tetap dirender untuk mitra dan selalu kosong, dengan
              kalimat yang menawarkan dua kemungkinan sekaligus ("belum ada
              riwayat, atau tidak berhak") — pembacanya tidak pernah tahu yang
              mana. Tidak merendernya lebih jujur daripada kosong yang ambigu. */}
          {canSeeAudit && (
            <section className="border-border bg-card rounded-lg border shadow-sm">
              <div className="border-border border-b px-5 py-4">
                <h2 className="text-base font-semibold">Riwayat</h2>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  Catatan setiap perubahan pada order ini, beserta pelakunya.
                </p>
              </div>

              {timeline.length === 0 ? (
                <p className="text-muted-foreground px-5 py-10 text-center text-sm">
                  Belum ada riwayat pada order ini.
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
          )}
        </div>

        {/* --- Sidebar kanan --- */}
        <div className="space-y-6">
          <section className="border-border bg-card rounded-lg border p-5 shadow-sm">
            <h2 className="text-base font-semibold">Aksi Status</h2>
            <p className="text-muted-foreground mt-0.5 mb-4 text-sm">
              Pindahkan order ke tahap berikutnya. Tombol yang belum bisa ditekan menyebutkan apa
              yang kurang.
            </p>
            <StatusActions orderId={order.id} options={transitions} />
          </section>

          <section className="border-border bg-card rounded-lg border p-5 shadow-sm">
            <h2 className="text-base font-semibold">Ringkasan</h2>
            <dl className="mt-4 space-y-3.5 text-sm">
              {/* Kontak pemesan tertutup `participants_select` yang menuntut
                  `is_staff()`, jadi bagi mitra `participant` memang sudah null
                  di sini. Yang diperbaiki bukan aksesnya — melainkan barisnya
                  yang dulu terbaca "-", seolah datanya kosong padahal ia
                  memang bukan haknya. */}
              <div className="flex gap-3">
                <User className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div>
                  <dt className="text-muted-foreground">Peserta</dt>
                  {participant ? (
                    <>
                      <dd className="font-medium">{participant.name}</dd>
                      {participant.phone && (
                        <dd className="text-muted-foreground text-xs tabular-nums">
                          {participant.phone}
                        </dd>
                      )}
                    </>
                  ) : (
                    <dd className="text-muted-foreground text-xs">
                      Tidak termasuk cakupan akses Anda
                    </dd>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div>
                  <dt className="text-muted-foreground">Cabang</dt>
                  <dd className="font-medium">{vendor ? vendor.name : 'Belum ditugaskan'}</dd>
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
                      <dd className="mt-1"></dd>
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
            <section className="border-border bg-card rounded-lg border p-5 shadow-sm">
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
            <section className="border-border bg-card rounded-lg border p-5 shadow-sm">
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
