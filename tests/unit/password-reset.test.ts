import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  requestPasswordResetSchema,
  resetPasswordSchema,
  updateUserSchema,
} from '@/features/users/schema';

/**
 * Atur ulang kata sandi — pengganti medan sandi di formulir sunting akun.
 *
 * ## Kenapa berkas ini ada
 *
 * Superadmin dulu bisa menyetel sandi orang lain langsung dari `/users`.
 * Masalahnya bukan kewenangan, melainkan **di mana sandi itu lahir**: ia
 * diketik orang lain lalu disampaikan lewat WhatsApp atau lisan. Sandi seperti
 * itu tidak pernah benar-benar rahasia, dan tidak bisa dibedakan dari sandi
 * yang bocor — pemiliknya tidak punya cara membuktikan bahwa hanya dia yang
 * tahu.
 *
 * Penggantinya dua jalan, dan **keduanya dikerjakan pemilik akun sendiri**:
 *
 *   - **`/profil`** untuk yang ingat sandi lamanya.
 *   - **`/lupa-sandi`** untuk yang lupa — halaman tersendiri, ditautkan dari
 *     halaman masuk.
 *
 * Superadmin tidak punya jalur apa pun ke kredensial orang lain — bahkan tidak
 * mengirimkan tautannya. Satu jalur saja sudah cukup untuk membuat orang
 * bertanya "siapa lagi yang bisa mengubah sandi saya"; menutup semuanya membuat
 * jawabannya sederhana: tidak ada.
 */
const AUTH = readFileSync('server/actions/auth.ts', 'utf8');
const USERS = readFileSync('server/actions/users.ts', 'utf8');
const CALLBACK = readFileSync('app/auth/callback/route.ts', 'utf8');
const DIALOG = readFileSync('features/users/components/user-dialog.tsx', 'utf8');
const LOGIN = readFileSync('app/(auth)/login/page.tsx', 'utf8');
const LUPA_FORM = readFileSync('app/(auth)/lupa-sandi/forgot-password-form.tsx', 'utf8');

const UUID = '11111111-1111-4111-8111-111111111111';

describe('sandi tidak lagi disetel dari halaman pengguna', () => {
  it('schema sunting tidak mengenal medan sandi', () => {
    // Penjagaan paling menentukan, dan satu-satunya yang berlaku juga bagi
    // permintaan yang tidak lewat formulir kita: medannya memang tidak ada,
    // jadi yang menyelipkannya tetap tidak bisa menyetel sandi siapa pun.
    const parsed = updateUserSchema.parse({
      user_id: UUID,
      email: 'rani@contoh.test',
      full_name: 'Rani',
      role: 'admin' as const,
      password: 'sandiBaruRahasia',
    });
    expect(parsed).not.toHaveProperty('password');
  });

  it('formulir sunting tidak merender medan sandi', () => {
    // `!isEdit` — medannya hanya ada saat membuat akun baru.
    expect(DIALOG).toMatch(/\{!isEdit && \(/);
  });

  it('penyuntingan tidak mengirim sandi ke server', () => {
    // Payload-nya disusun eksplisit, bukan `{ ...draft }` yang ikut membawa
    // `password` dari state formulir.
    const submit = DIALOG.slice(DIALOG.indexOf('function submit'), DIALOG.indexOf('const fieldId'));
    expect(submit).not.toMatch(/updateUser\(\{\s*\.\.\.draft/);
  });

  it('tidak ada satu pun aksi yang menyetel sandi orang lain', () => {
    // Penjagaan paling luas: bukan "tombolnya dibuang", melainkan tidak ada
    // jalur apa pun di `users.ts` yang menyentuh kredensial akun lain.
    expect(USERS).not.toContain('resetPasswordForEmail');
    expect(USERS).not.toContain('sendPasswordReset');
  });

  it('updateUser tidak punya jalur menulis sandi ke auth', () => {
    const block = USERS.slice(
      USERS.indexOf('export async function updateUser'),
      USERS.indexOf('export async function setUserActive'),
    );
    expect(block).not.toContain('password');
  });
});

describe('halaman lupa sandi berdiri sendiri', () => {
  it('halaman masuk hanya menautkannya, tidak memuat formulirnya', () => {
    // Dua kotak email pada satu layar membuat orang ragu yang mana harus
    // diisi — dan yang mencarinya justru orang yang sudah gagal masuk
    // beberapa kali.
    expect(LOGIN).toMatch(/href="\/lupa-sandi"/);
    expect(LOGIN).not.toContain('requestPasswordReset');
  });

  it('formulirnya hidup di halamannya sendiri', () => {
    expect(LUPA_FORM).toContain('requestPasswordReset');
  });

  it('formulirnya diganti pesan sesudah terkirim', () => {
    // Kotak yang masih menganga mengundang percobaan kedua yang hanya akan
    // menabrak batas pengiriman.
    expect(LUPA_FORM).toMatch(/if \(sent\) \{/);
  });
});

describe('permintaan tautan atur ulang', () => {
  it('menuntut email yang berbentuk email', () => {
    expect(requestPasswordResetSchema.safeParse({ email: 'a@b.test' }).success).toBe(true);
    expect(requestPasswordResetSchema.safeParse({ email: 'bukan-email' }).success).toBe(false);
  });

  it('menormalkan ke huruf kecil', () => {
    expect(requestPasswordResetSchema.parse({ email: 'Rani@Contoh.Test' }).email).toBe(
      'rani@contoh.test',
    );
  });

  it('tidak membocorkan ada-tidaknya akun', () => {
    // Pesan yang membedakan "terdaftar" dari "tidak" mengubah halaman masuk
    // jadi alat pemeriksa: siapa pun bisa mencoba satu per satu email dan
    // mengetahui mana yang punya akun di sini.
    const block = AUTH.slice(AUTH.indexOf('export async function requestPasswordReset'));
    expect(block).toMatch(/Kalau email itu terdaftar/);
    // Galat selain batas pengiriman dicatat ke log, bukan dikembalikan.
    expect(block).toMatch(/console\.error/);
  });

  it('batas pengiriman tetap disampaikan', () => {
    // Itu keadaan sementara yang bisa ditindaklanjuti ("tunggu sebentar"),
    // bukan petunjuk ada-tidaknya akun.
    const block = AUTH.slice(AUTH.indexOf('export async function requestPasswordReset'));
    expect(block).toMatch(/rate_limited/);
  });
});

describe('menyetel sandi baru', () => {
  it('tidak menuntut sandi lama', () => {
    // Justru yang lupa sandinyalah yang memakai ini.
    const r = resetPasswordSchema.safeParse({
      new_password: 'rahasia123',
      confirm_password: 'rahasia123',
    });
    expect(r.success).toBe(true);
  });

  it('menuntut minimal 8 karakter', () => {
    expect(
      resetPasswordSchema.safeParse({ new_password: 'pendek', confirm_password: 'pendek' }).success,
    ).toBe(false);
  });

  it('ulangannya harus sama', () => {
    const r = resetPasswordSchema.safeParse({
      new_password: 'rahasia123',
      confirm_password: 'rahasia124',
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toContain('confirm_password');
  });

  it('menolak bila tautannya tidak menghasilkan sesi', () => {
    // Tanpa pemeriksaan ini, `updateUser` akan mengubah sandi siapa pun yang
    // kebetulan sedang masuk di peramban itu — bukan pemilik tautannya.
    const block = AUTH.slice(AUTH.indexOf('export async function resetPassword'));
    expect(block).toMatch(/getUser\(\)/);
    expect(block).toMatch(/if \(!auth\.user\)/);
  });
});

describe('callback penukar tautan', () => {
  it('hanya menerima tujuan yang relatif', () => {
    // Tanpa penjagaan ini, tautan yang disusun orang lain bisa memakai callback
    // ini untuk melempar korbannya ke situs luar dengan sesi yang baru saja
    // terbentuk.
    expect(CALLBACK).toMatch(/\^\\\/\(\?!\\\/\)/);
  });

  it('tautan atur ulang lewat callback, bukan langsung ke halamannya', () => {
    // Tautannya membawa `code` yang harus ditukar jadi sesi lebih dulu.
    // Hanya `auth.ts` yang menerbitkannya — `users.ts` tidak lagi punya jalur
    // apa pun ke kredensial orang lain.
    expect(AUTH).toMatch(/auth\/callback\?next=\/atur-sandi/);
  });
});
