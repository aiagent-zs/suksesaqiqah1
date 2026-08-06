import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = typeof value === 'string' ? parseISO(value) : value;
  return Number.isNaN(d.getTime()) ? null : d;
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

/** 12 Jun 2026 */
export function formatDate(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, 'd MMM yyyy', { locale: localeId }) : '-';
}

/** 12 Jun 2026, 07:30 */
export function formatDateTime(value: string | Date | null | undefined): string {
  const d = toDate(value);
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
