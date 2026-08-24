import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  FileCheck2,
  MessageCircle,
  PackagePlus,
  Truck,
  XCircle,
} from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AlertItem } from '../queries';

/**
 * Ikon per jenis peristiwa.
 *
 * Bentuk sebagai penanda kedua di samping teks: daftar yang seluruh barisnya
 * seragam menuntut dibaca satu per satu, sementara ikon membuat jenisnya
 * terbaca sekilas.
 */
const TEMPLATE_ICON: Record<string, typeof BellRing> = {
  documentation_uploaded: FileCheck2,
  documentation_rejected: XCircle,
  report_ready: MessageCircle,
  issue_high: AlertTriangle,
  guest_order_new: PackagePlus,
  delivery_pending: Truck,
};

/** Peristiwa yang menuntut perhatian lebih, ditandai warna. */
const URGENT = new Set(['issue_high', 'documentation_rejected']);

/**
 * Panel "Perlu Tindakan" di dashboard (`docs/12` bagian 2 — Dashboard Alert).
 *
 * **Sumbernya outbox, bukan query terpisah per jenis.** Sebelum ini setiap
 * pertanyaan "ada bukti baru?", "ada order tamu?" dijawab dengan kartu KPI-nya
 * sendiri — yang menjawab *berapa*, bukan *yang mana*. Outbox menyimpan
 * peristiwanya satu per satu, jadi panel ini bisa membawa admin langsung ke
 * barisnya.
 *
 * **Tombol WhatsApp hanya muncul bila ada yang bisa dikirim.** Pengiriman
 * otomatis belum ada (Tahap 8 belum selesai), jadi untuk sekarang admin
 * menekannya sendiri — tapi pesannya dirakit server dan nomornya sudah
 * dinormalkan, jadi tidak ada lagi yang mengetik ulang.
 */
export function AlertPanel({ alerts }: { alerts: AlertItem[] }) {
  if (alerts.length === 0) {
    return (
      <section className="border-border bg-card rounded-lg border p-5">
        <div className="flex items-center gap-2.5">
          <BellRing className="text-muted-foreground size-4" />
          <h2 className="text-sm font-semibold">Perlu Tindakan</h2>
        </div>
        <p className="text-muted-foreground mt-2 text-sm">
          Tidak ada yang menunggu. Bukti baru, order tamu, dan kendala berat akan muncul di sini.
        </p>
      </section>
    );
  }

  return (
    <section className="border-border bg-card rounded-lg border">
      <div className="border-border flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <BellRing className="text-primary size-4" />
          <h2 className="text-sm font-semibold">Perlu Tindakan</h2>
          <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-bold tabular-nums">
            {alerts.length}
          </span>
        </div>
      </div>

      <ul className="divide-border divide-y">
        {alerts.map((alert) => {
          const Icon = TEMPLATE_ICON[alert.template] ?? BellRing;
          const urgent = URGENT.has(alert.template);

          return (
            <li key={alert.id} className="flex items-start gap-3 px-5 py-3.5">
              <span
                className={cn(
                  'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
                  urgent ? 'bg-red-50 text-red-600' : 'bg-muted text-muted-foreground',
                )}
              >
                <Icon className="size-4" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{alert.title}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {alert.orderNumber ? (
                    <span className="font-medium tabular-nums">{alert.orderNumber}</span>
                  ) : null}
                  {alert.detail ? <span> · {alert.detail}</span> : null}
                  <span> · {formatDateTime(alert.createdAt)}</span>
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {alert.waHref ? (
                  <a
                    href={alert.waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
                  >
                    <MessageCircle className="size-3.5" />
                    Kirim WA
                  </a>
                ) : null}
                {alert.href ? (
                  <Link
                    href={alert.href}
                    className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-8 items-center justify-center rounded-md transition-colors"
                    aria-label={`Buka ${alert.title}`}
                  >
                    <ArrowRight className="size-4" />
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}