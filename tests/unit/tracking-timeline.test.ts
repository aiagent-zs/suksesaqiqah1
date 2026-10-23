import { describe, expect, it } from 'vitest';
import { buildTimeline } from '@/features/tracking/timeline';
import type { TrackingResult } from '@/features/tracking/queries';

const base: TrackingResult = {
  order_number: 'IA-202610-0001',
  status: 'new',
  payment_status: 'unpaid',
  created_at: '2026-10-01T00:00:00Z',
  requested_date: null,
  distribution_mode: 'kirim',
  is_catering: false,
  report_token: null,
  services: [],
  stages: [],
};

const states = (o: TrackingResult) => buildTimeline(o).map((s) => `${s.key}:${s.state}`);

describe('buildTimeline', () => {
  it('pesanan baru: hanya "diterima" selesai, konfirmasi admin yang aktif', () => {
    expect(states(base).slice(0, 3)).toEqual(['new:done', 'verified:current', 'paid:upcoming']);
  });

  it('seluruh tahap lapangan terlihat sejak awal, mengikuti cara penyaluran', () => {
    const keys = buildTimeline(base).map((s) => s.key);
    expect(keys).toEqual([
      'new',
      'verified',
      'paid',
      'assigned',
      'persiapan',
      'sembelih',
      'masak',
      'kirim',
      'terkirim',
      'report',
    ]);
  });

  it('katering tidak menampilkan tahap sembelih', () => {
    const keys = buildTimeline({ ...base, is_catering: true }).map((s) => s.key);
    expect(keys).not.toContain('sembelih');
  });

  it('tahap lapangan selesai hanya bila tervalidasi', () => {
    const order: TrackingResult = {
      ...base,
      status: 'in_progress',
      payment_status: 'paid',
      stages: [
        { stage: 'persiapan', done: true, started: true, at: '2026-10-02T00:00:00Z' },
        { stage: 'sembelih', done: false, started: true, at: null },
      ],
    };
    expect(states(order)).toContain('persiapan:done');
    expect(states(order)).toContain('sembelih:current');
  });

  it('pesanan ditahan setelah lunas tetap menampilkan lunas, tanpa langkah aktif', () => {
    const order: TrackingResult = { ...base, status: 'on_hold', payment_status: 'paid' };
    const s = states(order);
    expect(s).toContain('paid:done');
    expect(s.some((x) => x.endsWith(':current'))).toBe(false);
  });

  it('pesanan selesai: semua langkah selesai', () => {
    const order: TrackingResult = {
      ...base,
      status: 'completed',
      payment_status: 'paid',
      report_token: 'x'.repeat(32),
    };
    expect(buildTimeline(order).every((s) => s.state === 'done')).toBe(true);
  });
});
