/**
 * Sambungan ke Postgres **lokal** untuk tes integrasi.
 *
 * Kenapa perlu ada lapisan ini, padahal unit test tidak butuh database:
 * empat trigger dan dua RPC di skema ini punya perilaku yang **hanya muncul di
 * database**. `enforce_stage_order` menolak lompat tahap, `generate_stage_checklist`
 * menerbitkan daftar tahap, `get_public_report` menyusun payload JSON — tidak
 * satu pun bisa dijalankan oleh Vitest sendiri.
 *
 * Dua bug 21 Agustus (blok `progress` hilang, `branch_name` tidak pernah sampai)
 * lolos dari `tsc` **dan** 364 unit test justru karena tidak ada tes yang pernah
 * memanggil database sungguhan. RPC-nya bertipe `Returns: Json`, jadi
 * `as unknown as RpcPayload` melewati pemeriksaan apa pun.
 *
 * ## Sengaja memakai `postgres.js`, bukan supabase-js
 *
 * Tes ini perlu melakukan hal yang tidak bisa dilakukan lewat REST: menyisipkan
 * baris `auth.users`, menyetel `request.jwt.claims` untuk menyamar sebagai role
 * tertentu, dan menangkap SQLSTATE persis dari `raise exception`. PostgREST
 * membungkus galat dan menyembunyikan `errcode` — padahal itulah yang diuji.
 *
 * ## Pengaman: HANYA lokal
 *
 * `assertLocal()` menolak URL apa pun yang bukan 127.0.0.1/localhost. Tes ini
 * MENULIS dan MENGHAPUS baris; menjalankannya terhadap cloud akan merusak data
 * sungguhan. Pengaman ini bukan formalitas — `.env.local` di repo ini justru
 * menunjuk ke cloud, jadi tanpa penjagaan ini kesalahan itu mudah terjadi.
 */
import postgres from 'postgres';

/** URL Postgres lokal baku dari `supabase start`. */
const LOCAL_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

/**
 * Tolak apa pun yang bukan localhost.
 *
 * Diperiksa terhadap host hasil parse, bukan pencarian substring: string
 * `postgres://user@evil.test/db?host=127.0.0.1` memuat "127.0.0.1" tetapi
 * tersambung ke tempat lain.
 */
function assertLocal(url: string): void {
  const host = new URL(url).hostname;
  if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') {
    throw new Error(
      `Tes integrasi menolak berjalan di host non-lokal: ${host}. ` +
        'Tes ini menulis & menghapus baris — jangan pernah diarahkan ke cloud.',
    );
  }
}

const url = process.env.TEST_DB_URL ?? LOCAL_DB_URL;
assertLocal(url);

export const sql = postgres(url, {
  // Tes berjalan berurutan; satu koneksi menghindari kejutan urutan transaksi.
  max: 1,
  // Vitest tidak akan keluar kalau ada koneksi menggantung.
  idle_timeout: 2,
  onnotice: () => {},
});

/**
 * Apakah database lokal hidup dan skemanya sudah ter-migrate.
 *
 * Dipakai `beforeAll` untuk memberi pesan yang berguna ketika `supabase start`
 * belum dijalankan — jauh lebih baik daripada ECONNREFUSED mentah.
 */
export async function isReady(): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const [row] = await sql<{ present: boolean }[]>`
      select count(*) = 1 as present
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'fulfilment_sequence'
    `;
    if (!row?.present) {
      return { ok: false, reason: 'Skema belum ter-migrate — jalankan `npm run db:reset`.' };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      reason: `Postgres lokal tidak menjawab (${message}). Jalankan \`npm run db:start\`.`,
    };
  }
}

/**
 * Jalankan `fn` dalam transaksi yang **selalu** dibatalkan.
 *
 * Ini yang membuat tes bisa menulis sebebasnya tanpa mengotori database:
 * setiap kasus melihat skema+seed yang sama persis, dan tidak ada urutan
 * eksekusi yang bisa membuat satu tes menjatuhkan tes lain. Pola ini juga
 * satu-satunya cara menguji `raise exception` tanpa harus membersihkan
 * baris setengah jadi sesudahnya.
 *
 * `postgres.js` membatalkan transaksi bila callback melempar, jadi galat
 * sengaja (`ROLLBACK_SENTINEL`) dipakai untuk memaksa rollback pada jalur
 * sukses juga.
 */
const ROLLBACK_SENTINEL = Symbol('rollback');

export async function inRollback<T>(fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  let captured: T;
  try {
    await sql.begin(async (tx) => {
      captured = await fn(tx);
      throw ROLLBACK_SENTINEL;
    });
  } catch (error) {
    if (error !== ROLLBACK_SENTINEL) throw error;
  }
  return captured!;
}

/**
 * Samar sebagai pengguna tertentu di dalam transaksi.
 *
 * RLS dan `auth.uid()` membaca `request.jwt.claims`. `set local` membuat
 * penyamaran ini luruh sendiri saat transaksi berakhir, jadi tidak ada
 * kebocoran identitas antar tes.
 *
 * `role` di sini adalah role Postgres (`authenticated`/`anon`), berbeda dari
 * role aplikasi (`superadmin`/`admin`/`vendor`) yang dibaca dari `profiles`.
 */
export async function actAs(
  tx: postgres.TransactionSql,
  userId: string | null,
  pgRole: 'authenticated' | 'anon' = 'authenticated',
): Promise<void> {
  const claims = userId ? JSON.stringify({ sub: userId, role: pgRole }) : JSON.stringify({});
  await tx`select set_config('request.jwt.claims', ${claims}, true)`;
  await tx`select set_config('role', ${pgRole}, true)`;
}

/** Kembali ke hak penuh (melewati RLS) untuk penyiapan data. */
export async function actAsOwner(tx: postgres.TransactionSql): Promise<void> {
  await tx`select set_config('request.jwt.claims', '', true)`;
  await tx`select set_config('role', 'postgres', true)`;
}

/**
 * Tangkap SQLSTATE + pesan dari sebuah operasi yang diharapkan gagal.
 *
 * Menegaskan `errcode`, bukan hanya "melempar": trigger di skema ini memilih
 * kode secara sengaja (`check_violation` untuk urutan tahap,
 * `insufficient_privilege` untuk pemisahan tugas). Tes yang cuma menuntut
 * "ada galat" akan tetap hijau kalau kelak gagalnya karena kolom salah nama.
 */
export async function expectFailure(
  operation: () => Promise<unknown>,
): Promise<{ code: string; message: string }> {
  try {
    await operation();
  } catch (error) {
    const e = error as { code?: string; message?: string };
    return { code: e.code ?? '', message: e.message ?? '' };
  }
  throw new Error('Operasi ini seharusnya gagal, tetapi berhasil.');
}

/**
 * Seperti `expectFailure`, tetapi transaksinya tetap bisa dipakai sesudahnya.
 *
 * Di Postgres, galat apa pun **membatalkan seluruh transaksi**: perintah
 * berikutnya akan ditolak dengan "current transaction is aborted". Savepoint
 * membatasi kerusakan itu pada satu perintah, sehingga satu tes bisa memeriksa
 * penolakan **lalu** memeriksa jalur yang berhasil — misalnya "tanpa alasan
 * ditolak, dengan alasan diterima" — tanpa perlu dipecah jadi dua tes yang
 * masing-masing menyiapkan ulang seluruh ordernya.
 */
export async function expectFailureInSavepoint(
  tx: postgres.TransactionSql,
  operation: (sp: postgres.TransactionSql) => Promise<unknown>,
): Promise<{ code: string; message: string }> {
  try {
    await tx.savepoint(async (sp) => {
      await operation(sp);
    });
  } catch (error) {
    const e = error as { code?: string; message?: string };
    return { code: e.code ?? '', message: e.message ?? '' };
  }
  throw new Error('Operasi ini seharusnya gagal, tetapi berhasil.');
}
