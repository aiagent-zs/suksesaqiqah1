import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ShieldOff } from 'lucide-react';
import { requireAuth } from '@/server/auth/session';
import { canDo } from '@/server/auth/capabilities';
import { getServiceDetail } from '@/features/services/queries';
import { ServiceForm, TYPE_LABEL } from '@/features/services/components/service-form';
import { ServicePhotoField } from '@/features/services/components/service-photo-field';
import { ServiceDetailActions } from '@/features/services/components/service-detail-actions';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';

type Params = Promise<{ id: string }>;

export const metadata = { title: 'Detail Paket — Sukses Aqiqah' };

/**
 * Detail satu paket katalog — berhenti di superadmin, sama seperti daftarnya.
 *
 * ## Kenapa halaman ini ada
 *
 * Menyunting paket dulu hanya membuka formulir di **atas** daftar. Pada daftar
 * sepuluh paket itu berarti formulirnya terbuka di luar layar: tombol ditekan,
 * tidak ada yang tampak berubah, dan tombolnya terbaca sebagai rusak.
 *
 * Jalan keluarnya bukan menggulir otomatis. Halaman sendiri memberi tiga hal
 * yang tidak bisa diberikan formulir sisipan: URL yang bisa dibagikan dan
 * di-bookmark, tombol kembali peramban yang bekerja sebagaimana mestinya, dan
 * ruang untuk yang tidak muat di baris daftar — foto kartu, serta kaitan paket
 * ini ke order dan modal mitra.
 *
 * Rutenya bersarang di bawah `/vendors` mengikuti tempat katalognya tinggal,
 * jadi remah navigasinya jujur: katalog memang bagian dari master data mitra,
 * bukan halaman yang berdiri sendiri.
 */
export default async function ServiceDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_MASTER_DATA')) {
    return (
      <div className="border-border bg-card rounded-lg border p-10 text-center shadow-sm">
        <ShieldOff className="text-muted-foreground mx-auto size-8" />
        <h1 className="mt-3 text-lg font-semibold">Katalog paket dibatasi</h1>
        <p className="text-muted-foreground mx-auto mt-1.5 max-w-md text-sm">
          Hanya superadmin yang dapat mengubah nama, harga, dan deskripsi paket — harga di sini
          adalah harga yang ditagih ke pembeli saat memesan.
        </p>
      </div>
    );
  }

  const service = await getServiceDetail(id);
  if (!service) notFound();

  return (
    <div className="space-y-4">
      <Link
        href="/vendors?tab=katalog"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" />
        Kembali ke katalog
      </Link>

      <div className="border-border bg-card rounded-lg border p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{service.name}</h1>
              <Badge className="border-slate-200 bg-slate-50 text-slate-600">
                {TYPE_LABEL[service.type] ?? service.type}
              </Badge>
              {!service.isActive && (
                <Badge className="border-slate-200 bg-slate-100 text-slate-600">Non-aktif</Badge>
              )}
              {service.showOnLanding && (
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                  Di halaman depan
                </Badge>
              )}
              {service.isPopular && (
                <Badge className="border-amber-200 bg-amber-50 text-amber-800">Terpopuler</Badge>
              )}
            </div>

            <p className="text-muted-foreground mt-1.5 font-mono text-sm">{service.slug}</p>

            <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">
              {formatCurrency(service.price)}
            </p>

            <p className="text-muted-foreground mt-1.5 text-sm">
              {service.ordersUsing > 0
                ? `Dipakai ${service.ordersUsing} order`
                : 'Belum pernah dipakai order'}
              {' · '}
              {service.vendorsOffering > 0
                ? `${service.vendorsOffering} mitra punya modal`
                : 'Belum ada modal mitra'}
            </p>

            {/* Modal mitra kosong bukan sekadar data yang belum lengkap: KPI
                margin dihitung dari selisih harga jual dan modal, jadi selama
                kosong dashboard melaporkan margin sebesar seluruh nilai order. */}
            {service.vendorsOffering === 0 && service.isActive && (
              <p className="mt-1 text-sm text-amber-700">
                Tanpa modal mitra, margin paket ini terbaca sebesar seluruh nilai order.
              </p>
            )}
          </div>

          <ServiceDetailActions
            serviceId={service.id}
            isActive={service.isActive}
            showOnLanding={service.showOnLanding}
            ordersUsing={service.ordersUsing}
          />
        </div>
      </div>

      {/* Foto di luar formulir, dan itu disengaja: ia tersimpan seketika saat
          diunggah (berkasnya sudah masuk Storage), sementara medan lain baru
          tersimpan saat "Simpan perubahan" ditekan. Menaruhnya di dalam
          formulir membuat satu blok punya dua aturan penyimpanan yang berbeda
          tanpa ada yang memberi tahu. */}
      {service.showOnLanding && (
        <div className="border-border bg-card rounded-lg border p-5 shadow-sm">
          <ServicePhotoField
            serviceId={service.id}
            slug={service.slug}
            photoPath={service.photoPath}
            photoAlt={service.photoAlt}
            publicBase={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}
          />
        </div>
      )}

      <div id="data-paket" className="border-border bg-card rounded-lg border p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold">Data paket</h2>
        <ServiceForm service={service} />
      </div>
    </div>
  );
}
