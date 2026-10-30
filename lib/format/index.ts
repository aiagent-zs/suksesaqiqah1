import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = typeof value === 'string' ? parseISO(value) : value;
  return Number.isNaN(d.getTime()) ? null : d;
}

const wibParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
});

/**
 * Jam dinding WIB sebagai `Date` lokal, untuk diformat `date-fns`.
 *
 * Server (UTC) dan peramban (WIB) harus mencetak teks yang sama, atau React
 * melaporkan hydration mismatch dan jamnya selisih 7 jam. Tanggal kalender
 * murni (`2026-06-12`) tidak punya jam, jadi tidak dikonversi.
 */
function toWib(value: string | Date | null | undefined): Date | null {
  const d = toDate(value);
  if (!d || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))) return d;
  const p = Object.fromEntries(wibParts.formatToParts(d).map((x) => [x.type, Number(x.value)]));
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute);
}

/** Rp1.750.000 — tanpa desimal, sesuai tampilan harga program (docs/28). */
export function formatCurrency(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0);
  if (!Number.isFinite(n)) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Rp1,8 jt — bentuk ringkas untuk kartu KPI.
 *
 * Angka penuh sudah tidak muat di kartu begitu nilainya menyentuh miliaran:
 * "Rp1.750.000.000" membungkus jadi dua baris dan mendorong tinggi kartu,
 * sehingga satu baris KPI jadi tidak rata. Yang hilang cuma ketelitian yang
 * memang tidak dibaca sekilas — nilai persisnya tetap ada di halaman order.
 */
export function formatCurrencyCompact(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0);
  if (!Number.isFinite(n)) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    notation: 'compact',
    compactDisplay: 'short',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(n);
}

/** 12 Jun 2026 */
export function formatDate(value: string | Date | null | undefined): string {
  const d = toWib(value);
  return d ? format(d, 'd MMM yyyy', { locale: localeId }) : '-';
}

/** 12 Jun 2026, 07:30 */
export function formatDateTime(value: string | Date | null | undefined): string {
  const d = toWib(value);
  return d ? format(d, 'd MMM yyyy, HH:mm', { locale: localeId }) : '-';
}

/** 07:30 — kolom `time` dari Postgres datang sebagai "07:30:00". */
export function formatTime(value: string | null | undefined): string {
  if (!value) return '-';
  return value.slice(0, 5);
}

/** "3 hari lalu" — umur order pada tabel litmus test. */
export function formatRelative(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return '-';
  return `${formatDistanceToNowStrict(d, { locale: localeId })} lalu`;
}
