import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireRole } from '@/server/auth/session';
import { getOrderFormOptions } from '@/features/orders/queries';
import { OrderForm } from '@/features/orders/components/order-form';

export const metadata = { title: 'Order Baru — Sukses Aqiqah' };

export default async function NewOrderPage() {
  // docs/15 section 2: /orders/new hanya untuk Admin Cabang (Manager ikut karena
  // punya kapabilitas kelola order lintas cabang, docs/07 section 3).
  const session = await requireRole(['admin_cabang', 'manager_program']);
  const { branches, services, participants } = await getOrderFormOptions();

  const isBranchAdmin = session.profile?.role === 'admin_cabang';
  const branchOptions = isBranchAdmin
    ? branches.filter((b) => b.id === session.profile?.branch_id)
    : branches;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Kembali ke daftar order
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Order Baru</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Nomor order dibuat otomatis dengan format IA-YYYYMM-#### setelah disimpan.
        </p>
      </div>

      <OrderForm
        branches={branchOptions}
        services={services}
        participants={participants}
        defaultBranchId={session.profile?.branch_id ?? null}
        lockBranch={isBranchAdmin}
      />
    </div>
  );
}
