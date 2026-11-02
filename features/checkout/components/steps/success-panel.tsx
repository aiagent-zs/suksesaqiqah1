'use client';

import Link from 'next/link';
import { CheckCircle2, CreditCard, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';

/**
 * Layar setelah pesanan tercatat, dipakai checkout aqiqah dan katering.
 *
 * Tombol WhatsApp jadi aksi utama: sampai worker pengirim ada, percakapan yang
 * dibuka pemesan sendiri adalah satu-satunya jalur yang pasti sampai ke admin.
 */
export function SuccessPanel({
  orderNumber,
  total,
  paymentUrl,
  waHref,
}: {
  orderNumber: string;
  total: number;
  /** Tautan Durianpay; kosong berarti pembayaran diurus admin lewat WhatsApp. */
  paymentUrl: string | null;
  waHref: string;
}) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 mx-auto mt-8 max-w-xl overflow-hidden rounded-lg border border-neutral-200 bg-white duration-500">
      <div className="border-b border-neutral-200 px-6 py-8 text-center sm:px-8">
        <span className="bg-primary-light inline-flex size-16 items-center justify-center rounded-full">
          <CheckCircle2 className="text-success size-9" />
        </span>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-neutral-900">
          Pesanan Anda sudah kami terima
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-neutral-600">
          {paymentUrl
            ? 'Halaman bayar Durianpay terbuka di tab baru. Simpan nomor pesanan di bawah: setelah membayar, statusnya bisa dicek di Lacak pesanan.'
            : 'Satu langkah lagi: kirim pesan ke admin lewat WhatsApp untuk mendapatkan rincian pembayaran. Ringkasan pesanan sudah kami tuliskan di pesannya.'}
        </p>
      </div>

      <dl className="grid gap-4 px-6 py-6 sm:grid-cols-2 sm:px-8">
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3.5">
          <dt className="text-ink-muted text-xs font-medium">
            Nomor pesanan (simpan untuk melacak)
          </dt>
          <dd className="mt-1 text-lg font-extrabold tracking-tight text-neutral-900 tabular-nums">
            {orderNumber}
          </dd>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3.5">
          <dt className="text-xs font-medium text-neutral-500">Total tagihan</dt>
          <dd className="text-primary mt-1 text-lg font-extrabold tracking-tight tabular-nums">
            {formatCurrency(total)}
          </dd>
        </div>
      </dl>

      <div className="space-y-2.5 border-t border-neutral-100 px-6 py-6 sm:px-8">
        {paymentUrl && (
          // Tab baru: payment link Durianpay selalu berakhir di halaman suksesnya
          // sendiri, tidak bisa diarahkan balik — panel ini tetap terbuka di tab asal.
          <a
            href={paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-lg w-full"
          >
            <CreditCard className="size-4 shrink-0" />
            Bayar Sekarang
          </a>
        )}
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className={cn('btn btn-lg w-full', paymentUrl ? 'btn-outline' : 'btn-primary')}
        >
          <MessageCircle className="size-4 shrink-0" />
          Lanjutkan ke WhatsApp Admin
        </a>
        <Link
          href={`/lacak?nomor=${encodeURIComponent(orderNumber)}`}
          className="btn btn-ghost btn-lg w-full"
        >
          Lacak pesanan ini
        </Link>
      </div>
    </div>
  );
}
