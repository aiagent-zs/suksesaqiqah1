import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { clientIpFrom } from '@/lib/security/rate-limit';
import { lookupOrder, type TrackingLookup } from '@/features/tracking/queries';
import { buildTimeline } from '@/features/tracking/timeline';
import { ORDER_STATUS_META, PAYMENT_STATUS_META } from '@/lib/constants/order';
import { formatDate } from '@/lib/format';
import { siteConfig } from '@/lib/constants/site';
import { getBrand } from '@/lib/brand-server';
import { IconCheck, IconWhatsApp } from '@/components/site/icons';

export const metadata: Metadata = {
  title: 'Lacak Pesanan',
  description: 'Lihat sampai mana pesanan aqiqah atau katering Anda dengan nomor pesanan.',
  alternates: { canonical: '/lacak' },
  // Hasilnya pribadi; tautan berisi nomor + 4 digit tidak boleh terindeks.
  robots: { index: false },
};

/**
 * Lacak pesanan untuk pemesan tamu.
 *
 * Form GET biasa, bukan komponen klien: halaman bekerja tanpa JavaScript, dan
 * hasil pencarian punya alamat sendiri sehingga bisa dibuka ulang.
 */
export default async function TrackPage({ searchParams }: PageProps<'/lacak'>) {
  const params = await searchParams;
  const nomor = typeof params.nomor === 'string' ? params.nomor.trim() : '';
  const hp = typeof params.hp === 'string' ? params.hp.trim() : '';
  const submitted = nomor !== '' || hp !== '';
  const validInput = nomor.length >= 4 && /^\d{4}$/.test(hp);

  const { name: brandName } = await getBrand();
  const result: TrackingLookup | null =
    submitted && validInput ? await lookupOrder(nomor, hp, clientIpFrom(await headers())) : null;

  return (
    <section className="bg-surface-muted border-line border-b">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-h1 text-ink font-bold tracking-tight">Lacak pesanan</h1>
        <p className="text-ink-muted mt-3 max-w-xl text-base leading-7">
          Masukkan nomor pesanan dari halaman konfirmasi atau pesan WhatsApp Anda, beserta 4 digit
          terakhir nomor HP yang dipakai saat memesan.
        </p>

        <form
          method="get"
          action="/lacak"
          className="border-line mt-8 grid gap-4 rounded-lg border bg-white p-5 sm:grid-cols-[1fr_10rem_auto] sm:items-end sm:p-6"
        >
          <div>
            <label htmlFor="nomor" className="text-ink text-sm font-semibold">
              Nomor pesanan
            </label>
            <input
              id="nomor"
              name="nomor"
              required
              defaultValue={nomor}
              placeholder="IA-202610-0001"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="field mt-1.5"
            />
          </div>
          <div>
            <label htmlFor="hp" className="text-ink text-sm font-semibold">
              4 digit akhir HP
            </label>
            <input
              id="hp"
              name="hp"
              required
              defaultValue={hp}
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              placeholder="1234"
              autoComplete="off"
              aria-describedby="hp-hint"
              className="field mt-1.5 tabular-nums"
            />
          </div>
          <button type="submit" className="btn btn-primary">
            Lacak
          </button>
          <p id="hp-hint" className="text-ink-muted text-xs sm:col-span-3">
            Contoh: nomor 0812-3456-7890 berarti 7890.
          </p>
        </form>

        <div aria-live="polite" className="mt-8">
          {submitted && !validInput && (
            <Notice tone="error">
              Periksa lagi isiannya: nomor pesanan wajib diisi, dan nomor HP harus tepat 4 angka.
            </Notice>
          )}
          {result?.kind === 'not_found' && (
            <Notice tone="error">
              Pesanan tidak ditemukan. Pastikan nomor pesanan dan 4 digit HP sama dengan yang
              dipakai saat memesan.
              <HelpLink nomor={nomor} brandName={brandName} />
            </Notice>
          )}
          {result?.kind === 'limited' && (
            <Notice tone="error">
              Terlalu banyak percobaan dari jaringan ini. Coba lagi dalam {result.minutes} menit.
              <HelpLink nomor={nomor} brandName={brandName} />
            </Notice>
          )}
          {result?.kind === 'error' && (
            <Notice tone="error">
              Data pesanan sedang tidak bisa dimuat. Coba beberapa saat lagi.
              <HelpLink nomor={nomor} brandName={brandName} />
            </Notice>
          )}
          {result?.kind === 'found' && <TrackingCard order={result.order} brandName={brandName} />}
        </div>
      </div>
    </section>
  );
}

function TrackingCard({
  order,
  brandName,
}: {
  order: Extract<TrackingLookup, { kind: 'found' }>['order'];
  brandName: string;
}) {
  const steps = buildTimeline(order);
  const halted = order.status === 'cancelled' || order.status === 'on_hold';

  return (
    <article className="border-line rounded-lg border bg-white">
      <header className="border-line flex flex-wrap items-start justify-between gap-4 border-b p-5 sm:p-6">
        <div className="min-w-0">
          <p className="text-ink-muted text-xs font-medium">Nomor pesanan</p>
          <p className="text-ink mt-0.5 text-lg font-bold break-all tabular-nums">
            {order.order_number}
          </p>
          <p className="text-ink-muted mt-1 text-sm">
            {order.services.map((s) => `${s.name} × ${s.qty}`).join(', ') || 'Pesanan'}
            {' · '}dipesan {formatDate(order.created_at)}
          </p>
        </div>
        <dl className="flex gap-2 text-xs font-semibold">
          <div className={`rounded border px-2 py-1 ${ORDER_STATUS_META[order.status].className}`}>
            <dt className="sr-only">Status</dt>
            <dd>{ORDER_STATUS_META[order.status].label}</dd>
          </div>
          <div
            className={`rounded border px-2 py-1 ${PAYMENT_STATUS_META[order.payment_status].className}`}
          >
            <dt className="sr-only">Pembayaran</dt>
            <dd>{PAYMENT_STATUS_META[order.payment_status].label}</dd>
          </div>
        </dl>
      </header>

      {halted && (
        <p className="border-line border-b bg-amber-50 px-5 py-3 text-sm text-amber-900 sm:px-6">
          {order.status === 'cancelled'
            ? 'Pesanan ini dibatalkan. Hubungi kami bila ada pertanyaan.'
            : 'Pesanan ini sedang ditahan sementara. Tim kami akan menghubungi Anda.'}
        </p>
      )}

      <ol className="p-5 sm:p-6">
        {steps.map((step, i) => (
          <li key={step.key} className="relative flex gap-4 pb-6 last:pb-0">
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={`absolute top-7 bottom-0 left-[13px] w-0.5 ${
                  step.state === 'done' ? 'bg-primary' : 'bg-line'
                }`}
              />
            )}
            <span
              aria-hidden
              className={`relative flex size-7 shrink-0 items-center justify-center rounded-full border-2 ${
                step.state === 'done'
                  ? 'border-primary bg-primary text-white'
                  : step.state === 'current'
                    ? 'border-primary bg-white'
                    : 'border-line bg-white'
              }`}
            >
              {step.state === 'done' && <IconCheck className="size-3.5" />}
              {step.state === 'current' && <span className="bg-primary size-2.5 rounded-full" />}
            </span>
            <div className="min-w-0 pt-0.5">
              <p
                className={`text-sm font-semibold ${step.state === 'upcoming' ? 'text-ink-muted' : 'text-ink'}`}
              >
                {step.label}
                <span className="sr-only">
                  {step.state === 'done'
                    ? ', selesai'
                    : step.state === 'current'
                      ? ', sedang berjalan'
                      : ', belum'}
                </span>
              </p>
              <p className="text-ink-muted mt-0.5 text-sm leading-6">
                {step.state === 'current' ? `Sedang berjalan. ${step.hint}` : step.hint}
              </p>
              {step.at && <p className="text-ink-muted mt-0.5 text-xs">{formatDate(step.at)}</p>}
            </div>
          </li>
        ))}
      </ol>

      <footer className="border-line flex flex-col gap-2 border-t p-5 sm:flex-row sm:p-6">
        {order.report_token && (
          <Link href={`/r/${order.report_token}`} className="btn btn-primary">
            Buka laporan pelaksanaan
          </Link>
        )}
        <a
          href={siteConfig.whatsapp.href(
            `Halo ${brandName}, saya ingin menanyakan pesanan ${order.order_number}.`,
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline"
        >
          <IconWhatsApp className="size-4" />
          Tanya pesanan ini
        </a>
      </footer>
    </article>
  );
}

function Notice({ tone, children }: { tone: 'error'; children: React.ReactNode }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900"
    >
      {children}
    </div>
  );
}

function HelpLink({ nomor, brandName }: { nomor: string; brandName: string }) {
  return (
    <a
      href={siteConfig.whatsapp.href(
        `Halo ${brandName}, saya ingin melacak pesanan${nomor ? ` ${nomor}` : ''}.`,
      )}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block w-fit font-semibold underline underline-offset-2"
    >
      Tanya lewat WhatsApp
    </a>
  );
}
