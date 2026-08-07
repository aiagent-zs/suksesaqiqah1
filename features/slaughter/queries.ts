import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { AnimalSpecies } from '@/lib/constants/order';

export type SlaughterRecordRow = {
  id: string;
  animalId: string;
  animalTag: string | null;
  animalSpecies: AnimalSpecies;
  performedAt: string;
  performerName: string | null;
  notes: string | null;
};

/**
 * Catatan pemotongan satu order (`prd.md` FR-SL1).
 *
 * `slaughter_records` bertaut ke `animals`, bukan langsung ke `orders`, jadi
 * penyaringan per order dilakukan lewat join — sama seperti kebijakan RLS-nya.
 */
export async function getOrderSlaughterRecords(orderId: string): Promise<SlaughterRecordRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('slaughter_records')
    .select(
      'id, performed_at, notes, animal:animals!inner ( id, tag_code, species, order_id ), performer:profiles ( full_name )',
    )
    .eq('animal.order_id', orderId)
    .order('performed_at', { ascending: false });

  if (error) return [];

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    performed_at: string;
    notes: string | null;
    animal: { id: string; tag_code: string | null; species: AnimalSpecies } | null;
    performer: { full_name: string | null } | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    animalId: r.animal?.id ?? '',
    animalTag: r.animal?.tag_code ?? null,
    animalSpecies: (r.animal?.species ?? 'kambing') as AnimalSpecies,
    performedAt: r.performed_at,
    performerName: r.performer?.full_name ?? null,
    notes: r.notes,
  }));
}
