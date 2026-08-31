import type { Database } from '@/types/database';
import { ORDER_STATUS_META, type OrderStatus, type PaymentStatus } from '@/lib/constants/order';

type UserRole = Database['public']['Enums']['user_role'];

/**
 * Konteks untuk mengevaluasi precondition transisi.
 *
 * Seluruh angkanya tersedia dari `v_order_progress`, jadi satu query detail
 * order sudah cukup untuk menghitung aksi yang tersedia.
 */
export type OrderGuardContext = {
  paymentStatus: PaymentStatus;
  totalAmount: number;
  paidAmount: number;
  /** Rasio DP minimum dari `app_settings.min_dp_ratio`. */
  minDpRatio: number;
  /** Order dari checkout publik yang belum diverifikasi admin. */
  isGuestOrder: boolean;
  guestVerified: boolean;
  /** Mitra pelaksana sudah ditetapkan. */
  hasVendor: boolean;
  hasSchedule: boolean;
  animalsTotal: number;
  /** Dari `v_order_stages`. */
  stagesTotal: number;
  stagesValidated: number;
  stagesRejected: number;
  /**
   * Tahap yang buktinya masih kurang, dihitung database dari
   * `stage_requirements` menurut mode order. Kosong = lengkap.
   */
  missingDocStages: string[];
  reportSent: boolean;
};

export type TransitionRule = {
  to: OrderStatus;
  /** Role yang boleh memicu transisi ini. */
  roles: UserRole[];
  /** Mengembalikan alasan penolakan, atau null bila precondition terpenuhi. */
  guard?: (ctx: OrderGuardContext) => string | null;
};

/** Terpenuhi bila lunas, atau DP >= min_dp_ratio. */
export function paymentGatePassed(ctx: OrderGuardContext): boolean {
  if (ctx.paymentStatus === 'paid') return true;
  if (ctx.totalAmount <= 0) return false;
  return ctx.paidAmount >= ctx.totalAmount * ctx.minDpRatio;
}

/** Yang mengurus order dari sisi kami: verifikasi, pembayaran, penugasan. */
const OPERATOR: UserRole[] = ['superadmin', 'admin'];
/** Tahap yang dijalankan di lapangan — mitra ikut menggerakkannya. */
const FIELD: UserRole[] = ['superadmin', 'admin', 'vendor'];

/**
 * State machine order — sumber kebenaran tunggal untuk transisi status.
 *
 * Rangkaiannya kini **administratif saja**. Pekerjaan lapangan yang bercabang
 * menurut cara penyaluran hidup di `order_stage_events`, bukan di sini: sebuah
 * status tidak bisa bercabang, dan tahap `salur` sah terjadi berkali-kali dalam
 * satu order sementara status tidak bisa berulang.
 *
 * Jadi `in_progress` berarti "mitra sedang mengerjakan tahap-tahapnya", dan
 * rincian sejauh mana dibaca dari `v_order_stages`.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, TransitionRule[]> = {
  new: [
    {
      to: 'verified',
      roles: OPERATOR,
      guard: (ctx) =>
        !ctx.isGuestOrder || ctx.guestVerified
          ? null
          : 'Order tamu harus diverifikasi lebih dulu di panel verifikasi.',
    },
    { to: 'on_hold', roles: OPERATOR },
    { to: 'cancelled', roles: OPERATOR },
  ],

  verified: [
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
      to: 'assigned',
      roles: OPERATOR,
      guard: (ctx) => {
        if (!ctx.hasVendor) return 'Mitra pelaksana belum ditetapkan.';
        if (ctx.animalsTotal <= 0) return 'Order belum memiliki data hewan.';
        if (!paymentGatePassed(ctx))
          return `Pembayaran belum memenuhi gate: butuh lunas atau DP minimal ${Math.round(ctx.minDpRatio * 100)}%.`;
        return null;
      },
    },
    { to: 'on_hold', roles: OPERATOR },
    { to: 'cancelled', roles: OPERATOR },
  ],

  assigned: [
    {
      to: 'in_progress',
      roles: FIELD,
      guard: (ctx) =>
        ctx.stagesTotal > 0
          ? null
          : 'Daftar tahap belum terbit — periksa cara penyaluran dan data hewan.',
    },
    { to: 'on_hold', roles: OPERATOR },
  ],

  in_progress: [
    {
      to: 'validation',
      roles: FIELD,
      guard: (ctx) => {
        if (ctx.stagesTotal === 0) return 'Daftar tahap belum terbit.';
        if (ctx.stagesValidated < ctx.stagesTotal) {
          const sisa = ctx.stagesTotal - ctx.stagesValidated;
          return `Masih ada ${sisa} tahap yang belum tervalidasi.`;
        }
        return null;
      },
    },
    { to: 'on_hold', roles: OPERATOR },
  ],

  validation: [
    {
      to: 'reporting',
      roles: OPERATOR,
      guard: (ctx) =>
        ctx.missingDocStages.length === 0
          ? null
          : `Bukti belum lengkap pada tahap: ${ctx.missingDocStages.join(', ')}.`,
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
    { to: 'verified', roles: OPERATOR },
    {
      to: 'paid',
      roles: OPERATOR,
      guard: (ctx) =>
        paymentGatePassed(ctx) ? null : 'Pembayaran belum memenuhi gate untuk melanjutkan.',
    },
    {
      to: 'assigned',
      roles: OPERATOR,
      guard: (ctx) => (ctx.hasVendor ? null : 'Mitra pelaksana belum ditetapkan.'),
    },
    { to: 'in_progress', roles: OPERATOR },
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
 *
 * Transisi yang role-nya tidak berhak sama sekali tidak dikembalikan (tombolnya
 * tidak perlu muncul), sedangkan yang gagal precondition tetap dikembalikan
 * sebagai disabled + alasan agar operator tahu apa yang kurang.
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
 * `FORBIDDEN` = role tidak berhak; `CONFLICT` = precondition belum terpenuhi.
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

/** Posisi status dalam rangkaian, untuk stepper. -1 bila di luar rangkaian. */
export function statusStepIndex(status: OrderStatus): number {
  return [
    'new',
    'verified',
    'paid',
    'assigned',
    'in_progress',
    'validation',
    'reporting',
    'completed',
  ].indexOf(status);
}
