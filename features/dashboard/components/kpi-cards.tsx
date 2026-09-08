import Link from 'next/link';
import { AlertTriangle, ArrowRight, Globe, PauseCircle, ShoppingBag } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { KpiSummary } from '../summary';
import { formatCurrency, formatCurrencyCompact } from '@/lib/format';

/**
 * Satu angka uang di dalam pita ringkasan.
 *
 * Ditulis ringkas (`Rp1,8 jt`) dengan nilai penuh di `title`: angka penuh
 * menyentuh 17 karakter begitu masuk miliaran, membungkus jadi dua baris, dan
 * menaikkan tinggi kartunya sendiri — satu baris KPI jadi tidak sejajar. Yang
 * hilang cuma ketelitian yang memang tidak dibaca sekilas.
 */
function MoneyFigure({
  label,
  value,
  hint,
  lead,
}: {
  label: string;
  value: number;
  hint?: string;
  /** Angka utama pita ini — satu saja, dan ia yang dibaca lebih dulu. */
  lead?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p
        // Tanpa `tabular-nums`: angka besar yang berdiri sendiri jadi terlihat
        // renggang kalau tiap digit dipaksa selebar "0". Itu untuk kolom angka
        // yang harus lurus ke bawah, bukan untuk figur tunggal.
        className={cn(
          'mt-1 font-semibold tracking-tight',
          lead ? 'text-3xl md:text-4xl' : 'text-2xl',
        )}
        title={formatCurrency(value)}
      >
        {formatCurrencyCompact(value)}
      </p>
      {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
    </div>
  );
}

type Tone = 'amber' | 'red' | 'orange' | 'blue';

const TONE: Record<Tone, string> = {
  amber: 'border-amber-200 bg-amber-50/60 text-amber-900',
  red: 'border-red-200 bg-red-50/60 text-red-900',
  orange: 'border-orange-200 bg-orange-50/60 text-orange-900',
  blue: 'border-blue-200 bg-blue-50/60 text-blue-900',
};

/**
 * Kartu hitungan operasional.
 *
 * Warnanya **menyatakan keadaan, bukan menandai kartu**: abu selama nol, dan
 * baru menyala begitu ada yang menunggu. Versi sebelumnya memberi tiap kartu
 * garis aksen dengan warna berbeda-beda — sembilan warna yang tidak berarti
 * apa-apa, sehingga tidak ada satu pun yang menonjol saat memang ada yang
 * mendesak.
 */
function CountCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  /** Warna saat nilainya > 0. Nol selalu netral. */
  tone: Tone;
  href?: string;
}) {
  const active = value > 0;

  const body = (
    <div
      className={cn(
        'h-full rounded-xl border p-4 transition-shadow',
        active ? TONE[tone] : 'border-border bg-card',
        href && 'hover:shadow-sm',
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn('size-4 shrink-0', active ? 'opacity-70' : 'text-muted-foreground')} />
        <p className={cn('truncate text-sm', !active && 'text-muted-foreground')}>{label}</p>
      </div>

      <p className={cn('mt-2 text-2xl font-semibold', !active && 'text-muted-foreground')}>
        {value.toLocaleString('id-ID')}
      </p>

      <p className={cn('mt-1 text-xs', active ? 'opacity-70' : 'text-muted-foreground')}>{hint}</p>
    </div>
  );

  return href ? (
    <Link href={href} className="block focus-visible:outline-none">
      {body}
    </Link>
  ) : (
    body
  );
}

function pct(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

/**
 * Ringkasan KPI dashboard (docs/09 section 2 & section 3).
 *
 * Dua kelompok, bukan sembilan kartu sederajat:
 *
 *   1. **Pita keuangan** — tagihan, modal, margin. Ketiganya satu kartu karena
 *      hubungannya aritmetika (tagihan − modal = margin); dipecah jadi tiga
 *      kartu terpisah, hubungan itu hilang dan pembacanya harus mengurangkan
 *      sendiri. Tagihan yang memimpin, sisanya lebih kecil.
 *   2. **Yang menunggu** — hitungan yang bisa ditindaklanjuti, semuanya
 *      bertaut ke daftar ordernya. Kartunya abu selama nol dan baru berwarna
 *      begitu ada isinya.
 *
 * Angka konteks (total order, mitra aktif) turun jadi satu baris kaki di pita
 * keuangan: keduanya menjelaskan angka di atasnya, bukan menuntut tindakan.
 *
 * `pendingGuestOrders` datang terpisah dari `summary`: `v_vendor_kpi` tidak
 * punya dimensi asal order, jadi angkanya dihitung query tersendiri di halaman.
 * `null` berarti role ini tidak berhak memverifikasi order tamu — kartunya
 * tidak dirender sama sekali, bukan ditampilkan bernilai nol.
 */
export function KpiCards({
  summary,
  pendingGuestOrders,
  canSeeFinance = true,
}: {
  summary: KpiSummary;
  pendingGuestOrders: number | null;
  /**
   * Pita keuangan berhenti di staf.
   *
   * `v_vendor_kpi` merakit ulang angka yang justru sengaja ditutup di tempat
   * lain: `vendor_services` dikunci `is_staff()` supaya harga modal — dan
   * karenanya margin — tidak terbaca mitra, tetapi view ini menyandingkan
   * `revenue_total` dengan `vendor_cost_total` dan menyajikan selisihnya.
   * Mitra yang membuka dashboardnya sendiri melihat berapa yang kami ambil
   * dari pekerjaannya.
   */
  canSeeFinance?: boolean;
}) {
  const waiting = [
    pendingGuestOrders !== null && {
      key: 'guest',
      label: 'Order tamu baru',
      value: pendingGuestOrders,
      hint: 'Dari checkout publik, belum diverifikasi',
      icon: Globe,
      tone: 'amber' as const,
      href: '/orders?source=guest_pending',
    },
    {
      key: 'open',
      label: 'Order tertunda',
      value: summary.ordersOpen,
      hint: 'Belum selesai / belum dibatalkan',
      icon: ShoppingBag,
      tone: 'blue' as const,
      href: '/orders',
    },
    {
      key: 'rejected',
      label: 'Laporan ditolak',
      value: summary.ordersWithRejection,
      hint: 'Bukti tahap yang pernah ditolak',
      icon: AlertTriangle,
      tone: 'red' as const,
      href: '/validation',
    },
    {
      key: 'hold',
      label: 'Order ditahan',
      value: summary.ordersOnHold,
      hint: 'Berstatus on hold',
      icon: PauseCircle,
      tone: 'orange' as const,
      href: '/orders?status=on_hold',
    },
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    value: number;
    hint: string;
    icon: LucideIcon;
    tone: Tone;
    href: string;
  }>;

  const cycleHint =
    summary.avgCycleHours === null
      ? 'belum ada siklus tercatat'
      : `rata-rata ${Math.round(summary.avgCycleHours)} jam per order`;

  return (
    <div className="space-y-5">
      <section className="border-border bg-card rounded-xl border p-5 shadow-sm md:p-6">
        {canSeeFinance ? (
          <>
            <div className="grid gap-5 sm:grid-cols-3 sm:gap-6">
              <MoneyFigure
                label="Tagihan masuk"
                value={summary.revenueTotal}
                hint={`${summary.ordersTotal.toLocaleString('id-ID')} order`}
                lead
              />
              <MoneyFigure label="Modal ke mitra" value={summary.vendorCostTotal} />
              <MoneyFigure
                label="Margin"
                value={summary.marginTotal}
                hint={`${pct(summary.marginPct)} dari tagihan`}
              />
            </div>

            {/* Meter margin: bidangnya terisi sejauh persentase margin, jalurnya
                langkah lebih terang dari ramp yang sama supaya keadaannya terbaca
                di seluruh lebar bar — bukan cuma di bagian yang terisi. */}
            <div
              className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-emerald-100"
              role="progressbar"
              aria-valuenow={Math.round(summary.marginPct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Margin terhadap tagihan"
            >
              <div
                className="h-full rounded-full bg-emerald-600"
                style={{ width: `${Math.min(100, Math.max(0, summary.marginPct))}%` }}
              />
            </div>
          </>
        ) : (
          // Mitra melihat volume kerjanya, bukan uangnya. Angka yang sama
          // (`ordersTotal`, `ordersCompleted`) tetap dipakai — yang dicabut
          // hanya rupiahnya.
          <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
            <div className="min-w-0">
              <p className="text-muted-foreground text-sm">Order ditugaskan</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
                {summary.ordersTotal.toLocaleString('id-ID')}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">{cycleHint}</p>
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground text-sm">Selesai</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">
                {summary.ordersCompleted.toLocaleString('id-ID')}
              </p>
            </div>
          </div>
        )}

        {canSeeFinance && (
          <div className="border-border text-muted-foreground mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-4 text-xs">
            <span>
              <strong className="text-foreground font-semibold">
                {summary.ordersCompleted.toLocaleString('id-ID')}
              </strong>{' '}
              dari {summary.ordersTotal.toLocaleString('id-ID')} order selesai
            </span>
            <span aria-hidden>·</span>
            <Link href="/vendors" className="hover:text-foreground inline-flex items-center gap-1">
              <strong className="text-foreground font-semibold">
                {summary.activeVendors.toLocaleString('id-ID')}
              </strong>{' '}
              mitra aktif
              <ArrowRight className="size-3" />
            </Link>
            <span aria-hidden>·</span>
            <span>{cycleHint}</span>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-muted-foreground mb-2.5 text-sm font-medium">Yang menunggu</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {waiting.map((item) => (
            <CountCard
              key={item.key}
              label={item.label}
              value={item.value}
              hint={item.hint}
              icon={item.icon}
              tone={item.tone}
              href={item.href}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
