import { ORDER_STATUS_FLOW, type OrderStatus } from '@/lib/constants/order';
import { STAGE_META, stageSequence } from '@/features/stages/sequence';
import type { TrackingResult } from './queries';

export type TimelineStep = {
  key: string;
  label: string;
  hint: string;
  state: 'done' | 'current' | 'upcoming';
  at: string | null;
};

/**
 * Garis waktu yang dibaca pemesan: tahap administrasi, lalu tahap lapangan
 * dari `order_stage_events`, lalu laporan.
 *
 * Tahap lapangan baru punya baris setelah mitra ditugaskan. Sebelum itu
 * urutannya diambil dari `distribution_mode`, jadi pemesan sudah melihat
 * seluruh perjalanan pesanannya sejak hari pertama. Katering tidak punya
 * `sembelih` (tidak ada hewan), jadi tahap itu dibuang untuknya.
 *
 * `on_hold` dan `cancelled` ada di luar `ORDER_STATUS_FLOW`, jadi selesai
 * tidaknya tiap langkah diturunkan dari datanya (pembayaran, baris tahap),
 * bukan dari posisi status. Pesanan yang ditahan setelah lunas tetap
 * menampilkan "lunas".
 */
export function buildTimeline(order: TrackingResult): TimelineStep[] {
  const reached = (s: OrderStatus) =>
    ORDER_STATUS_FLOW.indexOf(order.status) >= ORDER_STATUS_FLOW.indexOf(s);
  const assigned = reached('assigned') || order.stages.length > 0;
  const paid = order.payment_status === 'paid' || reached('paid') || assigned;
  const byStage = new Map(order.stages.map((s) => [s.stage, s]));

  const items: (Omit<TimelineStep, 'state'> & { done: boolean })[] = [
    {
      key: 'new',
      label: 'Pesanan diterima',
      hint: 'Pesanan tercatat di sistem kami.',
      at: order.created_at,
      done: true,
    },
    {
      key: 'verified',
      label: 'Dikonfirmasi admin',
      hint: 'Tim kami memeriksa data pesanan Anda.',
      at: null,
      done: reached('verified') || paid,
    },
    {
      key: 'paid',
      label: 'Pembayaran lunas',
      hint: 'Pembayaran sudah kami terima.',
      at: null,
      done: paid,
    },
    {
      key: 'assigned',
      label: 'Mitra pelaksana ditetapkan',
      hint: 'Pesanan diserahkan ke dapur atau mitra lapangan.',
      at: null,
      done: assigned,
    },
    ...stageSequence(order.distribution_mode)
      .filter((s) => !(order.is_catering && s === 'sembelih'))
      .map((stage) => {
        const row = byStage.get(stage);
        return {
          key: stage,
          label: STAGE_META[stage].label,
          hint: STAGE_META[stage].hint,
          at: row?.done ? row.at : null,
          done: (row?.done ?? false) || reached('reporting'),
        };
      }),
    {
      key: 'report',
      label: 'Laporan pelaksanaan',
      hint: 'Foto dan bukti pelaksanaan bisa Anda buka lewat tautan laporan.',
      at: null,
      done: order.status === 'completed' || order.report_token !== null,
    },
  ];

  // Langkah aktif = yang pertama belum selesai. Pesanan dibatalkan atau
  // ditahan tidak punya langkah aktif: statusnya ditampilkan terpisah.
  const halted = order.status === 'cancelled' || order.status === 'on_hold';
  const firstOpen = items.findIndex((s) => !s.done);

  return items.map(({ done, ...s }, i) => ({
    ...s,
    state: done ? 'done' : !halted && i === firstOpen ? 'current' : 'upcoming',
  }));
}
