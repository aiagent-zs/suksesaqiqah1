import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime } from '@/lib/format';

// Server produksi berjalan di UTC; teksnya harus tetap jam WIB.
describe('format tanggal selalu WIB', () => {
  it('timestamptz dicetak dalam jam WIB', () => {
    expect(formatDateTime('2026-06-12T00:30:00Z')).toBe('12 Jun 2026, 07:30');
    expect(formatDate('2026-06-12T20:00:00Z')).toBe('13 Jun 2026');
  });

  it('tanggal kalender tidak digeser', () => {
    expect(formatDate('2026-06-12')).toBe('12 Jun 2026');
  });
});

describe('formatRelative', () => {
  it('membulatkan ke satuan terbesar yang muat', async () => {
    const { formatRelative } = await import('@/lib/format');
    const ago = (ms: number) => new Date(Date.now() - ms);
    expect(formatRelative(ago(30e3))).toBe('30 detik lalu');
    expect(formatRelative(ago(90e3))).toBe('2 menit lalu');
    expect(formatRelative(ago(5 * 3600e3))).toBe('5 jam lalu');
    expect(formatRelative(ago(3 * 864e5))).toBe('3 hari lalu');
    expect(formatRelative(ago(40 * 864e5))).toBe('1 bulan lalu');
    expect(formatRelative(ago(400 * 864e5))).toBe('1 tahun lalu');
  });

  it('Agustus tetap "Agt"', () => {
    expect(formatDate('2026-08-17')).toBe('17 Agt 2026');
  });
});
