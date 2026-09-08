import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Bentuk `select` pada query pembayaran.
 *
 * ## Kenapa berkas ini ada
 *
 * `getOrderPayments` sempat menulis `verifier:profiles ( full_name )` tanpa
 * menyebut foreign key-nya. `payments` punya **dua** rujukan ke `profiles` —
 * `recorded_by` dan `verified_by` — sehingga PostgREST tidak tahu yang mana dan
 * menolak **seluruh permintaan** dengan `PGRST201` (HTTP 300).
 *
 * Yang membuatnya bertahan berhari-hari tanpa ketahuan: penangkap galat di
 * bawahnya sengaja luas, karena penolakan RLS bagi vendor memang harus terbaca
 * sebagai "tidak ada data yang boleh dilihat" — bukan kegagalan halaman. Galat
 * bentuk query ikut tertelan di situ dan tampil sebagai **panel kosong yang
 * meyakinkan**. Di layar: pembayaran tercatat, lalu hilang begitu halaman
 * dimuat ulang. Operator mengisinya lagi, dan yang tertinggal di database
 * empat baris untuk satu transfer yang sama.
 *
 * Diuji terhadap teks sumbernya, bukan lewat pemanggilan: query ini menuntut
 * Supabase sungguhan, sementara yang salah adalah **bentuk stringnya** — dan
 * itu terbaca langsung tanpa jaringan. Perilaku ujung-ke-ujungnya dijaga
 * `tests/integration`.
 */
const SOURCE = readFileSync(join(process.cwd(), 'features/payments/queries.ts'), 'utf8');

describe('join ke profiles menyebut foreign key-nya', () => {
  it('memakai payments_verified_by_fkey, bukan profiles polos', () => {
    expect(SOURCE).toContain('profiles!payments_verified_by_fkey');
  });

  it('tidak ada satu pun embed profiles tanpa fkey', () => {
    // `profiles(` atau `profiles (` tanpa `!` di depannya adalah bentuk ambigu
    // yang menolak seluruh query.
    const ambiguous = SOURCE.match(/:profiles\s*\(/g) ?? [];
    expect(ambiguous, `bentuk ambigu ditemukan: ${ambiguous.join(', ')}`).toEqual([]);
  });

  it('kolom verifier tetap diambil — bukan dibuang demi menghindari ambiguitas', () => {
    // Membuang join-nya juga "memperbaiki" galat, tapi menghapus nama
    // verifikator dari layar; yang benar adalah menyebut fkey-nya.
    expect(SOURCE).toContain('full_name');
  });
});

describe('galat bukan-RLS tidak ditelan diam-diam', () => {
  it('dicatat ke log server', () => {
    // Inilah yang membuat bug ini tidak terlihat: satu-satunya jejaknya adalah
    // panel kosong. Galat yang jelas bukan penolakan RLS kini meninggalkan
    // baris log.
    expect(SOURCE).toContain('console.error');
  });

  it('penolakan RLS tetap didiamkan', () => {
    // Vendor memang tidak berhak melihat pembayaran; mencatatnya sebagai galat
    // akan membanjiri log setiap kali vendor membuka order.
    expect(SOURCE).toContain("'42501'");
    expect(SOURCE).toContain("'PGRST301'");
  });
});
