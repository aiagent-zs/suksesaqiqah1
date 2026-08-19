import type { Database } from '@/types/database';
import { ANIMAL_STATUS_META, type AnimalStatus } from '@/lib/constants/order';

type UserRole = Database['public']['Enums']['user_role'];

/**
 * Urutan status hewan (docs/05 section 4.8) — bukan alfabetis.
 *
 * Status hewan bukan sekadar label: `v_order_progress` menghitung
 * `animals_slaughtered` dan `animals_distributed` dari kolom ini, dan angka
 * itulah yang dipakai guard transisi order (`slaughtering → distribution`).
 * Tanpa urutan yang ditegakkan, satu hewan bisa dilompatkan langsung ke
 * `distributed` dan mendorong seluruh order maju tanpa pemotongan pernah
 * benar-benar tercatat.
 */
export const ANIMAL_STATUS_FLOW: AnimalStatus[] = [
  'registered',
  'prepared',
  'slaughtered',
  'distributed',
];

/**
 * Role yang boleh mengoreksi status hewan mundur.
 *
 * Maju adalah pencatatan lapangan biasa; mundur berarti membatalkan bukti
 * pelaksanaan yang sudah terhitung di KPI, jadi dibatasi ke superadmin sebagai
 * jalur koreksi yang dapat dipertanggungjawabkan.
 */
const ROLLBACK_ROLES: UserRole[] = ['superadmin'];

export function animalStatusIndex(status: AnimalStatus): number {
  return ANIMAL_STATUS_FLOW.indexOf(status);
}

export type AnimalTransitionCheck =
  { ok: true } | { ok: false; code: 'FORBIDDEN' | 'CONFLICT'; message: string };

/**
 * Validasi satu perubahan status hewan.
 *
 * Aturannya sengaja ketat: satu langkah pada satu waktu. Maju melompat ditolak
 * karena tahap yang dilewati tidak akan pernah punya catatan; mundur dibatasi
 * role karena menghapus bukti yang sudah dihitung.
 */
export function checkAnimalTransition(
  from: AnimalStatus,
  to: AnimalStatus,
  role: UserRole | undefined,
): AnimalTransitionCheck {
  if (from === to) {
    return {
      ok: false,
      code: 'CONFLICT',
      message: `Hewan sudah berstatus ${ANIMAL_STATUS_META[to].label}.`,
    };
  }

  const fromIndex = animalStatusIndex(from);
  const toIndex = animalStatusIndex(to);
  const step = toIndex - fromIndex;

  if (step > 1) {
    const skipped = ANIMAL_STATUS_FLOW.slice(fromIndex + 1, toIndex)
      .map((status) => ANIMAL_STATUS_META[status].label)
      .join(', ');

    return {
      ok: false,
      code: 'CONFLICT',
      message: `Tahap ${skipped} tidak boleh dilewati. Catat status hewan satu tahap pada satu waktu.`,
    };
  }

  if (step < 0) {
    if (!role || !ROLLBACK_ROLES.includes(role)) {
      return {
        ok: false,
        code: 'FORBIDDEN',
        message: 'Hanya Manager Program yang dapat mengembalikan status hewan ke tahap sebelumnya.',
      };
    }

    if (step < -1) {
      return {
        ok: false,
        code: 'CONFLICT',
        message: 'Koreksi status hewan hanya dapat dilakukan satu tahap pada satu waktu.',
      };
    }
  }

  return { ok: true };
}

export type AnimalStatusOption = {
  status: AnimalStatus;
  label: string;
  allowed: boolean;
  /** Alasan tidak diizinkan — ditampilkan sebagai tooltip pada opsi nonaktif. */
  reason: string | null;
};

/** Seluruh status beserta boleh/tidaknya, untuk merender dropdown di UI. */
export function getAnimalStatusOptions(
  from: AnimalStatus,
  role: UserRole | undefined,
): AnimalStatusOption[] {
  return ANIMAL_STATUS_FLOW.map((status) => {
    if (status === from) {
      return { status, label: ANIMAL_STATUS_META[status].label, allowed: true, reason: null };
    }

    const check = checkAnimalTransition(from, status, role);
    return {
      status,
      label: ANIMAL_STATUS_META[status].label,
      allowed: check.ok,
      reason: check.ok ? null : check.message,
    };
  });
}
