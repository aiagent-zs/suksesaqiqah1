'use client';

import { createClient } from '@/lib/supabase/client';
import type { RegionOption } from './queries';

/**
 * Ambil wilayah satu tingkat di bawah `parentCode`.
 *
 * Langsung dari peramban ke Supabase, bukan lewat Server Action: `regions`
 * memang terbuka untuk `anon` (`regions_public_select`), isinya daftar wilayah
 * administratif yang tidak menyimpan apa pun milik siapa pun. Melewatkannya
 * lewat server hanya menambah satu lompatan tanpa menambah satu pun jaminan.
 *
 * Jumlahnya selalu kecil — 38 provinsi, ±13 kabupaten/kota per provinsi, ±14
 * kecamatan per kabupaten, ±11 kelurahan per kecamatan — jadi satu permintaan
 * per pilihan tidak perlu di-page.
 */
export async function fetchRegionChildren(parentCode: string): Promise<RegionOption[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('regions')
    .select('code, name')
    .eq('parent_code', parentCode)
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ code: r.code, name: r.name }));
}
