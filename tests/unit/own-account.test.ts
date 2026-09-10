import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { changeOwnEmailSchema, changeOwnPasswordSchema } from '@/features/users/schema';

/**
 * Mengurus akun sendiri: ganti sandi, ganti email.
 *
 * ## Kenapa berkas ini ada
 *
 * Sampai halaman profil ada, satu-satunya cara mengganti sandi adalah meminta
 * superadmin melakukannya lewat `/users` — yang berarti sandi baru seseorang
 * lewat tangan orang lain. Mitra paling terdampak: mereka tidak punya akses ke
 * halaman itu sama sekali.
 *
 * Dua hal yang dijaga, dan yang kedua jauh lebih mahal kalau salah:
 *
 *   1. **Sandi lama wajib.** `supabase.auth.updateUser()` menerima sesi hidup
 *      tanpa menanyakan apa pun, jadi tanpa pemeriksaan ini laptop yang
 *      ditinggal terbuka sebentar cukup untuk mengganti sandi dan email
 *      pemiliknya — mengunci dia keluar dari akunnya sendiri, permanen.
 *   2. **Role dan status tidak ikut.** RLS memutuskan akses dari
 *      `profiles.role`; membiarkannya ditulis sendiri sama dengan membiarkan
 *      orang menulis izinnya sendiri. Mitra tinggal menaikkan diri jadi
 *      superadmin, dan seluruh margin serta data pemesan terbuka.
 */
const ACTION = readFileSync('server/actions/account.ts', 'utf8');
const PAGE = readFileSync('app/(app)/profil/page.tsx', 'utf8');

describe('sandi lama wajib', () => {
  it('schema menuntutnya', () => {
    const r = changeOwnPasswordSchema.safeParse({
      current_password: '',
      new_password: 'rahasia123',
      confirm_password: 'rahasia123',
    });
    expect(r.success).toBe(false);
  });

  it('ganti email pun menuntutnya', () => {
    // Email adalah identitas login sekaligus alamat pemulihan akun: yang
    // berhasil mengubahnya diam-diam bisa mengambil alih akun itu lewat "lupa
    // sandi" kapan pun kemudian.
    const r = changeOwnEmailSchema.safeParse({ new_email: 'a@b.com', current_password: '' });
    expect(r.success).toBe(false);
  });

  it('server benar-benar memverifikasinya, bukan sekadar menerimanya', () => {
    // Diperiksa bahwa **hasilnya dipakai**, bukan sekadar bahwa fungsinya
    // dipanggil: `verifyPassword` yang isinya `return true` tetap memuat kata
    // "signInWithPassword" di badannya dan akan lolos pemeriksaan sesederhana
    // itu — celah yang tertangkap saat menguji tes ini terhadap regresi.
    const verify = ACTION.slice(
      ACTION.indexOf('async function verifyPassword'),
      ACTION.indexOf('export async function changeOwnPassword'),
    );
    expect(verify).toMatch(/const \{ error \}[\s\S]{0,120}signInWithPassword/);
    expect(verify).toMatch(/return !error/);

    // Dan dipakai di kedua aksi, bukan salah satu.
    expect(ACTION.match(/await verifyPassword\(/g)?.length).toBe(2);
  });

  it('verifikasinya tidak merusak sesi yang sedang berjalan', () => {
    // Klien server biasa menulis cookie sesi; memakainya untuk memeriksa sandi
    // akan menimpa sesi pemanggil — dan saat sandinya ternyata salah, ia
    // justru terlempar keluar.
    const verify = ACTION.slice(
      ACTION.indexOf('async function verifyPassword'),
      ACTION.indexOf('export async function changeOwnPassword'),
    );
    expect(verify).toContain('persistSession: false');
  });
});

describe('aturan sandi baru', () => {
  it('minimal 8 karakter', () => {
    const r = changeOwnPasswordSchema.safeParse({
      current_password: 'lama',
      new_password: 'pendek',
      confirm_password: 'pendek',
    });
    expect(r.success).toBe(false);
  });

  it('ulangannya harus sama', () => {
    const r = changeOwnPasswordSchema.safeParse({
      current_password: 'lama',
      new_password: 'rahasia123',
      confirm_password: 'rahasia124',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path).toContain('confirm_password');
    }
  });

  it('menolak sandi baru yang sama dengan yang lama', () => {
    // "Diganti" jadi sandi yang sama membuat orang mengira dirinya sudah aman
    // padahal tidak ada yang berubah.
    const r = changeOwnPasswordSchema.safeParse({
      current_password: 'rahasia123',
      new_password: 'rahasia123',
      confirm_password: 'rahasia123',
    });
    expect(r.success).toBe(false);
  });

  it('menerima yang memenuhi semuanya', () => {
    const r = changeOwnPasswordSchema.safeParse({
      current_password: 'lamaSekali',
      new_password: 'rahasia123',
      confirm_password: 'rahasia123',
    });
    expect(r.success).toBe(true);
  });
});

describe('role & status tidak bisa diubah sendiri', () => {
  it('schema profil tidak mengenal role sama sekali', () => {
    // Bukan sekadar diabaikan — medannya memang tidak ada, jadi tidak ada
    // jalan masuk yang bisa terlewat kalau kelak schema-nya diperluas.
    const parsed = changeOwnPasswordSchema.safeParse({
      current_password: 'lama',
      new_password: 'rahasia123',
      confirm_password: 'rahasia123',
      role: 'superadmin',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).not.toHaveProperty('role');
  });

  it('aksinya tidak pernah menyentuh tabel profiles', () => {
    // Satu-satunya tulisan yang sah dari halaman ini adalah ke `auth`.
    // `profiles.email` diselaraskan trigger `on_auth_user_email_changed`,
    // sesudah alamat barunya terbukti bisa dijangkau.
    expect(ACTION).not.toMatch(/\.from\('profiles'\)[\s\S]{0,120}\.update\(/);
    expect(ACTION).not.toContain('role:');
  });

  it('halaman mengatakannya terang-terangan', () => {
    // Orang yang mencari cara mengubah rolenya lebih baik menemukan jawabannya
    // di sini daripada mencarinya di setiap halaman.
    expect(PAGE).toMatch(/hanya dapat diubah superadmin/);
  });
});

describe('ganti email tidak berpindah seketika', () => {
  it('mengembalikan alamat tujuan konfirmasi, bukan mengaku tersimpan', () => {
    // Mengatakan "tersimpan" membuat orang mengira sudah bisa masuk dengan
    // alamat baru, lalu gagal tanpa tahu sebabnya.
    expect(ACTION).toMatch(/data:\s*\{\s*sentTo:/);
  });

  it('menolak email yang sama dengan yang sekarang', () => {
    const emailBlock = ACTION.slice(ACTION.indexOf('export async function changeOwnEmail'));
    expect(emailBlock).toMatch(/new_email === email\.toLowerCase\(\)/);
  });
});
