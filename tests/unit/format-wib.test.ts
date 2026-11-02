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
