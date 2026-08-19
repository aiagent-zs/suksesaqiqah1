import type { Database } from '@/types/database';
import { SCHEDULE_STATUS_META, type ScheduleStatus } from '@/lib/constants/order';

type UserRole = Database['public']['Enums']['user_role'];

/** Urutan pelaksanaan jadwal (docs/05 section 4.10). */
export const SCHEDULE_STATUS_FLOW: ScheduleStatus[] = ['planned', 'ongoing', 'done'];

/**
 * Role yang boleh menulis `schedules` — disamakan dengan kebijakan RLS
 * `schedules_write`. Vendor sengaja tidak termasuk: merekalah yang ditugaskan
 * lewat jadwal, jadi menulis jadwal berarti bisa menugaskan diri sendiri ke
 * order mana pun — dan `can_read_order` memberi akses justru lewat situ.
 */
export const SCHEDULE_WRITE_ROLES: UserRole[] = ['superadmin', 'admin'];

export function scheduleStatusIndex(status: ScheduleStatus): number {
  return SCHEDULE_STATUS_FLOW.indexOf(status);
}

/**
 * Apakah jadwal sudah lengkap untuk melepas transisi `paid → scheduled`?
 *
 * Aturannya berasal dari docs/08 section 2 ("butuh `schedules` lengkap: tanggal,
 * lokasi, PIC") dan dipakai dua arah: `getOrderDetail` menghitung
 * `guard.hasCompleteSchedule` dengannya, dan panel jadwal memakainya untuk
 * memberi tahu operator apa yang masih kurang. Satu fungsi supaya keduanya
 * tidak pernah menjawab berbeda.
 */
export function isScheduleComplete(
  schedule: {
    scheduled_date?: string | null;
    location_id?: string | null;
    pic_user_id?: string | null;
  } | null,
): boolean {
  if (!schedule) return false;
  return Boolean(schedule.scheduled_date && schedule.location_id && schedule.pic_user_id);
}

/** Bagian jadwal yang masih kosong — untuk pesan "apa yang kurang" di UI. */
export function missingScheduleParts(
  schedule: {
    scheduled_date?: string | null;
    location_id?: string | null;
    pic_user_id?: string | null;
  } | null,
): string[] {
  if (!schedule) return ['tanggal', 'lokasi', 'PIC'];

  const missing: string[] = [];
  if (!schedule.scheduled_date) missing.push('tanggal');
  if (!schedule.location_id) missing.push('lokasi');
  if (!schedule.pic_user_id) missing.push('PIC');
  return missing;
}

export type ScheduleTransitionCheck =
  { ok: true } | { ok: false; code: 'FORBIDDEN' | 'CONFLICT'; message: string };

/**
 * Validasi perubahan status pelaksanaan jadwal.
 *
 * Satu langkah pada satu waktu, dua arah. Berbeda dari status hewan, mundur
 * tidak dibatasi role khusus: tidak ada KPI atau guard transisi order yang
 * dihitung dari `schedules.status`, jadi mengoreksinya tidak menghapus bukti
 * pelaksanaan apa pun.
 */
export function checkScheduleTransition(
  from: ScheduleStatus,
  to: ScheduleStatus,
  role: UserRole | undefined,
): ScheduleTransitionCheck {
  if (!role || !SCHEDULE_WRITE_ROLES.includes(role)) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: 'Hanya admin atau superadmin yang dapat mengubah jadwal.',
    };
  }

  if (from === to) {
    return {
      ok: false,
      code: 'CONFLICT',
      message: `Jadwal sudah berstatus ${SCHEDULE_STATUS_META[to].label}.`,
    };
  }

  const step = scheduleStatusIndex(to) - scheduleStatusIndex(from);

  if (Math.abs(step) > 1) {
    return {
      ok: false,
      code: 'CONFLICT',
      message: 'Status jadwal hanya dapat berpindah satu tahap pada satu waktu.',
    };
  }

  return { ok: true };
}

export type ScheduleStatusOption = {
  status: ScheduleStatus;
  label: string;
  allowed: boolean;
  reason: string | null;
};

/** Seluruh status beserta boleh/tidaknya, untuk merender dropdown di UI. */
export function getScheduleStatusOptions(
  from: ScheduleStatus,
  role: UserRole | undefined,
): ScheduleStatusOption[] {
  return SCHEDULE_STATUS_FLOW.map((status) => {
    if (status === from) {
      return { status, label: SCHEDULE_STATUS_META[status].label, allowed: true, reason: null };
    }

    const check = checkScheduleTransition(from, status, role);
    return {
      status,
      label: SCHEDULE_STATUS_META[status].label,
      allowed: check.ok,
      reason: check.ok ? null : check.message,
    };
  });
}
