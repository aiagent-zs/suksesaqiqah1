import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Bucket yang menimpa berkas wajib punya policy UPDATE.
 *
 * ## Kenapa berkas ini ada
 *
 * `upsert: true` di Supabase Storage bukan INSERT — ia UPDATE terhadap baris
 * `storage.objects` yang sudah ada. Bucket yang hanya punya policy SELECT dan
 * INSERT menerima unggahan **pertama** lalu menolak setiap penimpaan, dan
 * penolakannya hanya berbunyi "new row violates row-level security policy":
 * kalimat yang tidak menyebut bucket, tidak menyebut operasi, dan sama sekali
 * tidak mengarah ke policy yang hilang.
 *
 * Itu yang terjadi pada bucket `reports` di produksi. PDF versi 1 sebuah order
 * terunggah 2,5 MB, tetapi barisnya tidak pernah masuk tabel `reports` karena
 * aksinya berhenti di unggah. Percobaan berikutnya menghitung `nextVersion`
 * dari tabel yang kosong — jadi selalu v1, path yang sama, ditolak lagi. Order
 * yang pekerjaannya sudah lengkap terkunci permanen di "Gagal menyimpan PDF
 * laporan".
 *
 * Dibuktikan terhadap produksi sebagai superadmin sungguhan:
 *
 *     POST x-upsert ke path baru       -> 200
 *     POST x-upsert ke path yang ada   -> 403 "new row violates RLS policy"
 *
 * Yang dijaga di sini pasangannya, bukan kejadiannya: **tiap `upsert: true`
 * pada sebuah bucket menuntut policy UPDATE untuk bucket itu.** Bug seperti ini
 * tidak muncul saat ditulis — ia menunggu sampai ada yang mengunggah dua kali,
 * dan saat itu terjadi pesannya tidak menolong siapa pun.
 */
const MIGRATIONS = 'supabase/migrations';

/** Semua isi berkas migration, digabung — policy bisa lahir di migration mana pun. */
function allMigrationSql(): string {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
    .join('\n');
}

/** Setiap berkas `.ts`/`.tsx` di bawah sebuah direktori. */
function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, found);
    else if (/\.tsx?$/.test(entry.name)) found.push(full.replace(/\\/g, '/'));
  }
  return found;
}

/**
 * Bucket yang di-`upsert` di kode aplikasi.
 *
 * Dibaca dari `.from('<bucket>')` yang panggilan `.upload(...)`-nya membawa
 * `upsert: true` — bukan daftar yang ditulis tangan, supaya bucket baru ikut
 * terjaring tanpa ada yang perlu ingat memperbarui berkas ini.
 */
function bucketsUpsertedInCode(): string[] {
  const buckets = new Set<string>();

  for (const file of ['server', 'features', 'app'].flatMap((d) => sourceFiles(d))) {
    const src = readFileSync(file, 'utf8');
    // `.from('reports')` … `.upload(path, body, { …, upsert: true })`
    for (const m of src.matchAll(
      /\.from\(\s*['"]([a-z0-9-]+)['"]\s*\)[\s\S]{0,400}?\.upload\([\s\S]{0,300}?upsert:\s*true/g,
    )) {
      buckets.add(m[1]);
    }
  }

  return [...buckets].sort();
}

describe('penemuannya sendiri harus bekerja', () => {
  it('menemukan bucket yang memang di-upsert', () => {
    // Kalau regex-nya patah, tes di bawah hijau tanpa menjaga apa pun.
    expect(bucketsUpsertedInCode()).toContain('reports');
  });

  it('membaca migration dalam jumlah yang masuk akal', () => {
    expect(allMigrationSql().length).toBeGreaterThan(10_000);
  });
});

describe('tiap bucket yang di-upsert punya policy UPDATE', () => {
  const sql = allMigrationSql();

  it.each(bucketsUpsertedInCode())('bucket %s', (bucket) => {
    // Policy UPDATE mana pun yang menyebut bucket ini. Namanya tidak diikat —
    // yang penting operasinya ada, bukan bagaimana ia dinamai.
    const hasUpdatePolicy = new RegExp(
      `create policy[\\s\\S]{0,200}?for update[\\s\\S]{0,400}?bucket_id\\s*=\\s*'${bucket}'`,
    ).test(sql);

    expect(
      hasUpdatePolicy,
      `Bucket '${bucket}' diunggah dengan upsert:true tapi tidak punya policy UPDATE. ` +
        `Unggahan pertama akan lolos, penimpaan berikutnya ditolak RLS dengan pesan ` +
        `"new row violates row-level security policy" yang tidak menyebut sebabnya.`,
    ).toBe(true);
  });
});

describe('policy UPDATE reports tidak lebih longgar dari INSERT-nya', () => {
  it('keduanya menuntut is_staff()', () => {
    // Menaikkannya ke superadmin membuat admin bisa membuat v1 tapi tidak bisa
    // mengulanginya saat render pertama menghasilkan berkas yang keliru;
    // menurunkannya membuka bucket laporan ke mitra.
    const sql = allMigrationSql();
    const update = sql.match(/create policy storage_reports_update[\s\S]*?;/)?.[0];

    expect(update).toBeDefined();
    expect(update).toContain('is_staff()');
    expect(update).not.toContain('is_superadmin()');
  });
});
