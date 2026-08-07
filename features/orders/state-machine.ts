import type { Database } from '@/types/database';
import { ORDER_STATUS_META, type OrderStatus, type PaymentStatus } from '@/lib/constants/order';
import { missingDocumentationStages } from '@/features/documentation/review';

type UserRole = Database['public']['Enums']['user_role'];

/**
 * Konteks yang dibutuhkan untuk mengevaluasi precondition transisi.
 * Seluruh angkanya tersedia dari view v_order_progress + keberadaan schedules,
 * jadi satu query detail order sudah cukup untuk menghitung aksi yang tersedia.
 */
export type OrderGuardContext = {
  paymentStatus: PaymentStatus;
  totalAmount: number;
  paidAmount: number;
  /** Rasio DP minimum dari app_settings.min_dp_ratio (docs/08 section 2). */
  minDpRatio: number;
  hasCompleteSchedule: boolean;
  animalsTotal: number;
  animalsSlaughtered: number;
  animalsDistributed: number;
  distributionCount: number;
  docsApproved: number;
  /**
   * Dokumentasi ber-status `approved` per tahap — dasar kelengkapan minimum
   * docs/10 section 5 (dihitung per ORDER, bukan per hewan).
   */
  docsApprovedSlaughter: number;
  docsApprovedDistribution: number;
  reportSent: boolean;
};

export type TransitionRule = {
  to: OrderStatus;
  /** Role yang boleh memicu transisi ini (docs/07 section 4). */
  roles: UserRole[];
  /** Mengembalikan alasan penolakan, atau null bila precondition terpenuhi. */
  guard?: (ctx: OrderGuardContext) => string | null;
};

/** Terpenuhi bila lunas, atau DP >= min_dp_ratio (docs/08 section 2). */
export function paymentGatePassed(ctx: OrderGuardContext): boolean {
  if (ctx.paymentStatus === 'paid') return true;
  if (ctx.totalAmount <= 0) return false;
  return ctx.paidAmount >= ctx.totalAmount * ctx.minDpRatio;
}

const OPERATOR: UserRole[] = ['manager_program', 'admin_cabang'];
const FIELD: UserRole[] = ['manager_program', 'admin_cabang', 'petugas_lapangan'];

/**
 * State machine order — sumber kebenaran tunggal untuk transisi status.
 * Mengikuti diagram docs/08 section 2 beserta "Aturan transisi kunci"-nya.
 *
 * Catatan: `on_hold` pada docs hanya digambarkan dari new/paid/scheduled dan
 * kembali ke scheduled. Di sini penahanan diizinkan dari seluruh tahap aktif
 * (issue severity high bisa muncul kapan saja, docs/08 section 6) dan pemulihan
 * dikembalikan ke new/paid/scheduled — guard di bawah tetap mencegah lompatan
 * yang preconditionnya belum terpenuhi.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, TransitionRule[]> = {
  new: [
    {
      to: 'paid',
      roles: OPERATOR,
      guard: (ctx) =>
        paymentGatePassed(ctx)
          ? null
          : `Pembayaran belum memenuhi gate: butuh lunas atau DP minimal ${Math.round(ctx.minDpRatio * 100)}%.`,
    },
    { to: 'on_hold', roles: OPERATOR },
    { to: 'cancelled', roles: OPERATOR },
  ],

  paid: [
    {
      to: 'scheduled',
      roles: OPERATOR,
      guard: (ctx) => {
        if (!ctx.hasCompleteSchedule)
          return 'Jadwal belum lengkap: tanggal, lokasi, dan PIC wajib diisi.';
        if (!paymentGatePassed(ctx))
          return `Pembayaran belum memenuhi gate: butuh lunas atau DP minimal ${Math.round(ctx.minDpRatio * 100)}%.`;
        return null;
      },
    },
    { to: 'on_hold', roles: OPERATOR },
    { to: 'cancelled', roles: OPERATOR },
  ],

  scheduled: [
    {
      to: 'preparation',
      roles: FIELD,
      guard: (ctx) => (ctx.animalsTotal > 0 ? null : 'Order belum memiliki data hewan.'),
    },
    { to: 'on_hold', roles: OPERATOR },
  ],

  preparation: [
    {
      to: 'slaughtering',
      roles: FIELD,
      guard: (ctx) => (ctx.animalsTotal > 0 ? null : 'Order belum memiliki data hewan.'),
    },
    { to: 'on_hold', roles: OPERATOR },
  ],

  slaughtering: [
    {
      to: 'distribution',
      roles: FIELD,
      guard: (ctx) =>
        ctx.animalsSlaughtered > 0
          ? null
          : 'Belum ada hewan yang tercatat dipotong (slaughter_records).',
    },
    { to: 'on_hold', roles: OPERATOR },
  ],

  distribution: [
    {
      to: 'documentation',
      roles: FIELD,
      guard: (ctx) =>
        ctx.distributionCount > 0 ? null : 'Belum ada catatan distribusi pada order ini.',
    },
    { to: 'on_hold', roles: OPERATOR },
  ],

  documentation: [
    {
      to: 'reporting',
      roles: OPERATOR,
      guard: (ctx) => {
        // docs/10 section 5: minimum 1 bukti pemotongan DAN 1 bukti distribusi,
        // keduanya sudah tervalidasi penuh. "Ada satu dokumentasi apa pun"
        // tidak cukup — order bisa lolos tanpa bukti penyerahan sama sekali.
        const missing = missingDocumentationStages({
          approvedSlaughter: ctx.docsApprovedSlaughter,
          approvedDistribution: ctx.docsApprovedDistribution,
        });

        return missing.length === 0
          ? null
          : `Dokumentasi ${missing.join(' & ')} belum ada yang tervalidasi Admin Pusat.`;
      },
    },
    { to: 'on_hold', roles: OPERATOR },
  ],

  reporting: [
    {
      to: 'completed',
      roles: OPERATOR,
      guard: (ctx) => {
        if (ctx.paymentStatus !== 'paid')
          return 'Pelunasan penuh wajib sebelum order diselesaikan.';
        if (!ctx.reportSent) return 'Laporan belum ter-generate dan terkirim ke peserta.';
        return null;
      },
    },
    { to: 'on_hold', roles: OPERATOR },
  ],

  on_hold: [
    { to: 'new', roles: OPERATOR },
    {
      to: 'paid',
      roles: OPERATOR,
      guard: (ctx) =>
        paymentGatePassed(ctx) ? null : 'Pembayaran belum memenuhi gate untuk melanjutkan.',
    },
    {
      to: 'scheduled',
      roles: OPERATOR,
      guard: (ctx) =>
        ctx.hasCompleteSchedule
          ? null
          : 'Jadwal belum lengkap: tanggal, lokasi, dan PIC wajib diisi.',
    },
    { to: 'cancelled', roles: OPERATOR },
  ],

  completed: [],
  cancelled: [],
};

export type TransitionOption = {
  to: OrderStatus;
  label: string;
  allowed: boolean;
  /** Alasan tidak diizinkan — ditampilkan sebagai tooltip pada tombol nonaktif. */
  reason: string | null;
};

/**
 * Daftar transisi dari sebuah status, lengkap dengan status boleh/tidaknya.
 * Transisi yang role-nya tidak berhak sama sekali tidak dikembalikan
 * (tombolnya tidak perlu muncul), sedangkan yang gagal precondition tetap
 * dikembalikan sebagai disabled + alasan agar operator tahu apa yang kurang.
 */
export function getTransitionOptions(
  from: OrderStatus,
  role: UserRole | undefined,
  ctx: OrderGuardContext,
): TransitionOption[] {
  if (!role) return [];

  return ORDER_TRANSITIONS[from]
    .filter((rule) => rule.roles.includes(role))
    .map((rule) => {
      const reason = rule.guard ? rule.guard(ctx) : null;
      return {
        to: rule.to,
        label: ORDER_STATUS_META[rule.to].label,
        allowed: reason === null,
        reason,
      };
    });
}

export type TransitionCheck =
  { ok: true } | { ok: false; code: 'FORBIDDEN' | 'CONFLICT'; message: string };

/**
 * Validasi satu transisi. Dipakai server action sebelum melakukan UPDATE.
 * `FORBIDDEN` = role tidak berhak; `CONFLICT` = precondition belum terpenuhi
 * (mengikuti kode error docs/16 section 1).
 */
export function checkTransition(
  from: OrderStatus,
  to: OrderStatus,
  role: UserRole | undefined,
  ctx: OrderGuardContext,
): TransitionCheck {
  const rule = ORDER_TRANSITIONS[from].find((r) => r.to === to);

  if (!rule) {
    return {
      ok: false,
      code: 'CONFLICT',
      message: `Transisi ${ORDER_STATUS_META[from].label} → ${ORDER_STATUS_META[to].label} tidak diizinkan.`,
    };
  }

  if (!role || !rule.roles.includes(role)) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: 'Role Anda tidak berhak melakukan transisi status ini.',
    };
  }

  const reason = rule.guard ? rule.guard(ctx) : null;
  if (reason) return { ok: false, code: 'CONFLICT', message: reason };

  return { ok: true };
}

/** Posisi status pada rangkaian utama; -1 untuk on_hold/cancelled. */
export function statusStepIndex(status: OrderStatus): number {
  return [
    'new',
    'paid',
    'scheduled',
    'preparation',
    'slaughtering',
    'distribution',
    'documentation',
    'reporting',
    'completed',
  ].indexOf(status);
}
