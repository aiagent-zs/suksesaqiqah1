'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CheckCircle2, CreditCard, Loader2, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import { channelFromPath, channelHref } from '@/lib/brand';
import { getPaymentStatus } from '@/server/actions/payment-status';

/** Jeda antar-pertanyaan saat tab terlihat. */
const POLL_MS = 5_000;
/** Berhenti bertanya sesudah ini; pemesan masih punya tombol Lacak. */
const POLL_MAX_MS = 30 * 60 * 1000;

/**
 * Layar setelah pesanan tercatat, dipakai checkout aqiqah dan katering.
 *
 * Halaman bayar Durianpay terbuka di tab baru dan berakhir di halaman
 * suksesnya sendiri tanpa jalan kembali (payment link tidak menerima URL
 * redirect). Jadi tab inilah yang memberi tahu pemesan: ia menanyakan status
 * tiap beberapa detik, dan langsung saat pemesan kembali ke tab ini, lalu
 * berganti begitu webhook mencatat pembayarannya lunas.
 */
export function SuccessPanel({
  orderNumber,
  total,
  paymentUrl,
  phone,
  waHref,
}: {
  orderNumber: string;
  total: number;
  /** Tautan Durianpay; kosong berarti pembayaran diurus admin lewat WhatsApp. */
  paymentUrl: string | null;
  /** Nomor HP pemesan; 4 digit akhirnya kunci yang sama dengan halaman Lacak. */
  phone: string;
  waHref: string;
}) {
  const [paid, setPaid] = useState(false);
  const channel = channelFromPath(usePathname() ?? '/');
  const phoneLast4 = phone.replace(/\D/g, '').slice(-4);

  useEffect(() => {
    if (!paymentUrl || paid) return;
    const startedAt = Date.now();
    let busy = false;

    async function check() {
      if (busy || document.visibilityState !== 'visible') return;
      if (Date.now() - startedAt > POLL_MAX_MS) return;
      busy = true;
      try {
        if ((await getPaymentStatus(orderNumber, phoneLast4)) === 'paid') setPaid(true);
      } catch {
        // Jaringan putus sesaat: pertanyaan berikutnya mencoba lagi.
      } finally {
        busy = false;
      }
    }

    const timer = setInterval(check, POLL_MS);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [orderNumber, phoneLast4, paymentUrl, paid]);

  const lacakHref = channelHref(channel, `/lacak?nomor=${encodeURIComponent(orderNumber)}`);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 mx-auto mt-8 max-w-xl overflow-hidden rounded-lg border border-neutral-200 bg-white duration-500">
      <div className="border-b border-neutral-200 px-6 py-8 text-center sm:px-8" aria-live="polite">
        <span className="bg-primary-light inline-flex size-16 items-center justify-center rounded-full">
          <CheckCircle2 className="text-success size-9" />
        </span>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-neutral-900">
          {paid ? 'Pembayaran Anda sudah kami terima' : 'Pesanan Anda sudah kami terima'}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-neutral-600">
          {paid
            ? 'Terima kasih. Tim kami akan mengonfirmasi jadwalnya lewat WhatsApp. Perkembangan pesanan bisa Anda pantau di Lacak pesanan.'
            : paymentUrl
              ? 'Bayar lewat tombol di bawah. Halaman bayar terbuka di tab baru; setelah selesai, kembali ke tab ini dan halaman ini akan berubah sendiri.'
              : 'Satu langkah lagi: kirim pesan ke admin lewat WhatsApp untuk mendapatkan rincian pembayaran. Ringkasan pesanan sudah kami tuliskan di pesannya.'}
        </p>
        {paymentUrl && !paid && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-neutral-600">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Menunggu pembayaran
          </p>
        )}
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
          <dt className="text-xs font-medium text-neutral-500">
            {paid ? 'Sudah dibayar' : 'Total tagihan'}
          </dt>
          <dd className="text-primary mt-1 text-lg font-extrabold tracking-tight tabular-nums">
            {formatCurrency(total)}
          </dd>
        </div>
      </dl>

      <div className="space-y-2.5 border-t border-neutral-100 px-6 py-6 sm:px-8">
        {paid ? (
          <Link href={lacakHref} className="btn btn-primary btn-lg w-full">
            Lacak pesanan ini
          </Link>
        ) : (
          paymentUrl && (
            <a
              href={paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-lg w-full"
            >
              <CreditCard className="size-4 shrink-0" />
              Bayar Sekarang
            </a>
          )
        )}
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className={cn('btn btn-lg w-full', paymentUrl || paid ? 'btn-outline' : 'btn-primary')}
        >
          <MessageCircle className="size-4 shrink-0" />
          {paid ? 'Chat Admin' : 'Lanjutkan ke WhatsApp Admin'}
        </a>
        {!paid && (
          <Link href={lacakHref} className="btn btn-ghost btn-lg w-full">
            Lacak pesanan ini
          </Link>
        )}
      </div>
    </div>
  );
}
