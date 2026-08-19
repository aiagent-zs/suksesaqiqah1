import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireRole } from '@/server/auth/session';
import { getOrderFormOptions } from '@/features/orders/queries';
import { OrderForm } from '@/features/orders/components/order-form';

export const metadata = { title: 'Order Baru — Sukses Aqiqah' };

export default async function NewOrderPage() {
  // Membuat order adalah pekerjaan sisi kami, bukan vendor.
  await requireRole(['superadmin', 'admin']);
  const { services, participants } = await getOrderFormOptions();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/orders"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" />
          Kembali ke daftar order
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Order Baru</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Nomor order dibuat otomatis dengan format IA-YYYYMM-#### setelah disimpan.
        </p>
      </div>

      <OrderForm services={services} participants={participants} />
    </div>
  );
}
