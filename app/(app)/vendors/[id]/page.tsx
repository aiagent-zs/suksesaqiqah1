import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, MapPin, Phone, ShieldOff, UserX } from 'lucide-react';
import { requireAuth } from '@/server/auth/session';
import { canDo } from '@/server/auth/capabilities';
import {
  getServiceOptions,
  getVendorCoverage,
  getVendorDetail,
  getVendorServices,
  listProvinces,
} from '@/features/vendors/queries';
import { VendorEditForm } from '@/features/vendors/components/vendor-edit-form';
import { VendorServicePanel } from '@/features/vendors/components/vendor-service-panel';
import { VendorCoveragePanel } from '@/features/vendors/components/vendor-coverage-panel';
import { VendorActiveToggle } from '@/features/vendors/components/vendor-active-toggle';
import { Badge } from '@/components/ui/badge';
import { DISTRIBUTION_MODE_LABEL } from '@/features/stages/sequence';

type Params = Promise<{ id: string }>;

export const metadata = { title: 'Detail Mitra — Sukses Aqiqah' };

/**
 * Detail satu mitra — berhenti di superadmin, sama seperti daftarnya.
 *
 * Halaman inilah yang selama ini tidak pernah ada. Akibatnya tiga server action
 * yang sudah ditulis lengkap (`updateVendor`, `saveVendorService`,
 * `deleteVendorService`) tidak punya satu pun pemanggil, dan
 * `revalidatePath('/vendors/{id}')` di dalamnya menunjuk rute yang tidak ada.
 */
export default async function VendorDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_VENDORS')) {
    return (
      <div className="border-border bg-card rounded-lg border p-10 text-center shadow-sm">
        <ShieldOff className="text-muted-foreground mx-auto size-8" />
        <h1 className="mt-3 text-lg font-semibold">Detail mitra dibatasi</h1>
        <p className="text-muted-foreground mx-auto mt-1.5 max-w-md text-sm">
          Hanya superadmin yang dapat menyunting mitra dan mengatur harga modalnya.
        </p>
      </div>
    );
  }

  const vendor = await getVendorDetail(id);
  if (!vendor) notFound();

  const [services, options, coverage, provinces] = await Promise.all([
    getVendorServices(id),
    getServiceOptions(),
    getVendorCoverage(id),
    listProvinces(),
  ]);

  return (
    <div className="space-y-4">
      <Link
        href="/vendors"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" />
        Kembali ke daftar mitra
      </Link>

      <div className="border-border bg-card rounded-lg border p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{vendor.name}</h1>
              <span className="text-muted-foreground text-xs tabular-nums">{vendor.code}</span>
              {!vendor.isActive && (
                <Badge className="border-slate-200 bg-slate-100 text-slate-600">Non-aktif</Badge>
              )}
              {vendor.serviceModes.map((m) => (
                <Badge key={m} className="border-slate-200 bg-slate-50 text-slate-600">
                  {DISTRIBUTION_MODE_LABEL[m]}
                </Badge>
              ))}
            </div>

            <p className="text-muted-foreground mt-1.5 flex items-center gap-1.5 text-sm">
              <Phone className="size-3.5" />
              {vendor.phone}
              {vendor.ownerName ? ` · ${vendor.ownerName}` : ''}
            </p>

            {vendor.address && (
              <p className="text-muted-foreground mt-0.5 flex items-start gap-1.5 text-sm">
                <MapPin className="mt-0.5 size-3.5 shrink-0" />
                {vendor.address}
              </p>
            )}

            {vendor.accountEmail ? (
              <p className="text-muted-foreground mt-0.5 text-sm">
                Akun: {vendor.accountEmail}
                {vendor.accountActive === false ? ' (non-aktif)' : ''}
              </p>
            ) : (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-amber-700">
                <UserX className="size-3.5" />
                Belum punya akun login — buatkan di menu Pengguna.
              </p>
            )}

            {vendor.ordersOpen > 0 && (
              <p className="text-muted-foreground mt-0.5 text-sm">
                {vendor.ordersOpen} order berjalan
              </p>
            )}
          </div>

          <VendorActiveToggle
            vendorId={vendor.id}
            isActive={vendor.isActive}
            ordersOpen={vendor.ordersOpen}
          />
        </div>
      </div>

      <VendorEditForm vendor={vendor} provinces={provinces} />

      <VendorServicePanel vendorId={vendor.id} rows={services} options={options} />

      <VendorCoveragePanel vendorId={vendor.id} rows={coverage} provinces={provinces} />
    </div>
  );
}
