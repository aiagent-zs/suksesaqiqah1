import { ShieldOff } from 'lucide-react';
import { requireAuth } from '@/server/auth/session';
import { canDo } from '@/server/auth/capabilities';
import { listVendors } from '@/features/vendors/queries';
import { VendorManager } from '@/features/vendors/components/vendor-manager';

export const metadata = { title: 'Mitra — Sukses Aqiqah' };

/**
 * Master mitra pelaksana — berhenti di superadmin.
 *
 * Alasannya bukan sekadar kerapian: daftar modal per mitra (`vendor_services`)
 * adalah angka yang menentukan margin tiap order, dan siapa pun yang bisa
 * mengubahnya bisa membuat order tampak untung padahal rugi.
 */
export default async function VendorsPage() {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_VENDORS')) {
    return (
      <div className="border-border bg-card rounded-2xl border p-10 text-center shadow-sm">
        <ShieldOff className="text-muted-foreground mx-auto size-8" />
        <h1 className="mt-3 text-lg font-semibold">Master mitra dibatasi</h1>
        <p className="text-muted-foreground mx-auto mt-1.5 max-w-md text-sm">
          Hanya superadmin yang dapat mendaftarkan mitra dan mengatur harga modalnya. Admin tetap
          bisa menugaskan mitra ke order dari halaman detail order.
        </p>
      </div>
    );
  }

  const vendors = await listVendors();

  return <VendorManager vendors={vendors} />;
}
