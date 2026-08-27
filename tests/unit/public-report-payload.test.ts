import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Payload `get_public_report` hidup di dua tempat: `jsonb_build_object` di
 * migration, dan tipe `RpcPayload` di `server/services/public-report.ts` yang
 * membacanya. Keduanya harus menyebut key yang sama.
 *
 * Tes ini ada karena kembaran itu pernah menyimpang diam-diam. Desain ulang
 * skema (20260820001100) menyusun ulang payload dan menghapus key `progress`,
 * sementara pembacanya tetap mengambilnya lewat `p.progress?.x ?? 0`. Tidak ada
 * yang gagal: tiga kartu "Status Pelaksanaan" di /r/{token} dan blok progres di
 * PDF sekadar mencetak `0/0` selama berhari-hari.
 *
 * Typecheck tidak bisa menangkapnya — RPC ini dideklarasikan `Returns: Json` di
 * `types/database.ts`, jadi `as unknown as RpcPayload` melewati pemeriksaan apa
 * pun. Selama bentuknya hanya diikat oleh cast, tes semacam inilah satu-satunya
 * yang menahannya.
 *
 * Berkas migration-nya dibaca langsung, bukan disalin ke dalam tes: tes yang
 * membandingkan salinan dengan salinan tidak membuktikan apa pun.
 */
describe('payload get_public_report sama antara SQL dan TypeScript', () => {
  const migrationsDir = join(process.cwd(), 'supabase/migrations');

  /**
   * Definisi fungsi yang benar-benar berlaku adalah yang **terakhir** —
   * `create or replace` di migration yang lebih baru menimpa yang lama. Mencari
   * kemunculan pertama akan menguji versi yang sudah pensiun.
   *
   * Direktorinya dipindai, bukan didaftar. Versi sebelumnya menyebut dua nama
   * berkas secara harfiah, dan daftar semacam itu diam-diam basi begitu ada
   * migration ketiga yang me-`replace` fungsi ini — tesnya tetap hijau sambil
   * memeriksa definisi yang sudah tidak berlaku, persis kekeliruan yang
   * diperingatkan komentar di atas. Nama migration berawalan timestamp, jadi
   * urutan leksikografis = urutan jalan.
   */
  const sql = (() => {
    const last = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => readFileSync(join(migrationsDir, f), 'utf8'))
      .filter((body) => body.includes('function public.get_public_report'))
      .pop();
    if (!last) throw new Error('Definisi get_public_report tidak ditemukan di migration mana pun.');
    return last;
  })();

  /** Isi `jsonb_build_object(...)` milik fungsi ini, dari `select` sampai `into v_result`. */
  const body = (() => {
    const start = sql.indexOf('function public.get_public_report');
    const open = sql.indexOf('select jsonb_build_object(', start);
    const close = sql.indexOf('into v_result', open);
    if (open === -1 || close === -1) throw new Error('Blok jsonb_build_object tidak ditemukan.');
    return sql.slice(open, close);
  })();

  /** Key tingkat pertama: `'nama',` yang berdiri di awal baris. */
  function topLevelKeys(): string[] {
    return body
      .split('\n')
      .map((l) => l.trim())
      .map((l) => /^'([a-z_]+)',/.exec(l)?.[1])
      .filter((k): k is string => Boolean(k));
  }

  /** Key di dalam satu sub-objek, dikenali dari nama key induknya. */
  function nestedKeys(parent: string): string[] {
    const at = body.indexOf(`'${parent}', (`);
    if (at === -1) throw new Error(`Key '${parent}' tidak ada di payload.`);
    const chunk = body.slice(at, body.indexOf('\n    )', at));
    return [...chunk.matchAll(/'([a-z_]+)',\s/g)].map((m) => m[1]).filter((k) => k !== parent);
  }

  const keys = topLevelKeys();

  // Setiap field yang dibaca `RpcPayload`. Menambah field di sana tanpa
  // menambahkannya di sini akan lolos — tapi menghapusnya dari SQL tidak.
  it.each([
    'order_number',
    'status',
    'created_at',
    'participant_name',
    'vendor_name',
    'child_birth_place',
    'child_birth_date',
    'services',
    'animals',
    'progress',
    'stages',
    'schedule',
    'documentations',
    'report',
  ])('payload memuat key %s', (key) => {
    expect(keys).toContain(key);
  });

  it('blok progress memuat kelima angka yang dirender halaman & PDF', () => {
    // Kelimanya dipakai langsung di app/r/[token]/page.tsx dan features/reporting/pdf.tsx.
    expect(nestedKeys('progress')).toEqual([
      'animals_total',
      'animals_slaughtered',
      'animals_distributed',
      'stages_total',
      'stages_validated',
    ]);
  });

  it('tidak lagi memakai penamaan cabang yang sudah pensiun', () => {
    // `branches` dibuang di 20260820000200. Kalau nama ini muncul lagi, pembaca
    // di TypeScript dan payload-nya sedang menyimpang untuk kedua kalinya.
    expect(keys).not.toContain('branch_name');
    expect(keys).not.toContain('branch_id');
  });

  it('kontak peserta tidak pernah ikut dalam payload publik', () => {
    // Halaman ini dibagikan lewat tautan; yang boleh terbaca hanya pelaksanaan
    // ibadahnya, bukan cara menghubungi pemesannya (docs/11 section 6).
    for (const forbidden of ['participant_phone', 'participant_email', 'delivery_address']) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it('hanya bukti & tahap yang sudah tervalidasi yang boleh tampil', () => {
    expect(body).toContain("dc.status = 'approved'");
    expect(body).toContain("e.status = 'validated'");
  });
});
