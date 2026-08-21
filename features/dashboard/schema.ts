import { z } from 'zod';

/**
 * Filter dashboard (docs/09 section 3 & section 7).
 *
 * Sama seperti `orderFilterSchema`, seluruh isinya datang dari query string yang
 * bisa disunting siapa saja — jadi setiap field memakai `.catch()` agar nilai
 * ngawur jatuh ke default alih-alih menggagalkan render seluruh dashboard.
 *
 * Catatan cakupan: filter periode belum ada di sini. `v_branch_kpi` adalah
 * agregat tanpa dimensi tanggal, jadi menambah periode berarti mengubah view
 * (migration) — dan schema satu pintu di Bani (TEAM_PLAN section 1.2).
 *
 * Filter cabang dicabut bersama tabelnya — lihat catatan di `orderFilterSchema`.
 */
export const dashboardFilterSchema = z.object({
  status: z
    .enum([
      'new',
      'verified',
      'paid',
      'assigned',
      'in_progress',
      'validation',
      'reporting',
      'on_hold',
    ])
    .optional()
    .catch(undefined),
  severity: z.enum(['low', 'medium', 'high']).optional().catch(undefined),
  /**
   * `1` = hanya tampilkan order yang punya kendala terbuka.
   * Sengaja enum literal, bukan `z.coerce.boolean()`: `?issues_only=0` akan
   * dibaca sebagai true oleh coerce karena "0" adalah string non-kosong.
   */
  issues_only: z.literal('1').optional().catch(undefined),
  page: z.coerce.number().int().min(1).default(1).catch(1),
  page_size: z.coerce.number().int().min(5).max(100).default(20).catch(20),
});

export type DashboardFilterInput = z.infer<typeof dashboardFilterSchema>;
