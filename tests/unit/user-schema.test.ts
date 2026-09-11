/**
 * Skema pengelolaan akun.
 *
 * Dua kaidah dijaga di sini karena keduanya cerminan constraint database, dan
 * pelanggarannya baru terasa jauh dari tempat kesalahannya: vendor tanpa mitra
 * jadi akun yang hidup tapi buta (`can_read_order` tidak punya pembanding), dan
 * staf yang merangkap vendor bisa memvalidasi pekerjaannya sendiri.
 *
 * `updateUserSchema` **tidak mengenal sandi sama sekali** — perbedaan yang
 * disengaja dengan `createUserSchema`. Superadmin dulu bisa menyetel sandi
 * orang lain dari formulir sunting, dan itu berarti sandi seseorang lahir di
 * tangan orang lain lalu disampaikan lewat WhatsApp atau lisan: tidak pernah
 * benar-benar rahasia, dan tidak bisa dibedakan dari sandi yang bocor.
 *
 * Penggantinya dua, dan pada keduanya yang menentukan sandi barunya adalah
 * pemilik akun: `/profil` untuk yang ingat sandi lamanya, dan tautan atur ulang
 * lewat email untuk yang lupa.
 */
import { describe, expect, it } from 'vitest';
import { createUserSchema, deleteUserSchema, updateUserSchema } from '@/features/users/schema';

const UUID = '11111111-1111-4111-8111-111111111111';

const STAF = {
  user_id: UUID,
  email: 'Rani@Contoh.test',
  full_name: 'Rani',
  role: 'admin' as const,
  password: '',
};

describe('updateUserSchema', () => {
  it('menerima penyuntingan tanpa menyinggung sandi', () => {
    expect(updateUserSchema.safeParse(STAF).success).toBe(true);
    expect(updateUserSchema.safeParse({ ...STAF, password: undefined }).success).toBe(true);
  });

  it('tidak pernah meneruskan sandi, bahkan bila dikirim', () => {
    // Bukan sekadar "tidak divalidasi": medannya memang tidak ada, jadi
    // permintaan yang menyelipkannya — dari klien lama atau dari luar aplikasi
    // — tetap tidak bisa menyetel sandi siapa pun.
    const parsed = updateUserSchema.parse({ ...STAF, password: 'sandiBaruRahasia' });
    expect(parsed).not.toHaveProperty('password');
  });

  it('menormalkan email ke huruf kecil', () => {
    // `profiles.email` unik dan Supabase menyimpan email huruf kecil; tanpa ini
    // "Rani@" dan "rani@" tampak dua akun berbeda di layar tapi bentrok di
    // indeks unik.
    const parsed = updateUserSchema.parse(STAF);
    expect(parsed.email).toBe('rani@contoh.test');
  });

  it('menuntut mitra untuk peran vendor', () => {
    const tanpaMitra = { ...STAF, role: 'vendor' as const };
    expect(updateUserSchema.safeParse(tanpaMitra).success).toBe(false);
    expect(updateUserSchema.safeParse({ ...tanpaMitra, vendor_id: UUID }).success).toBe(true);
  });

  it('menolak staf yang ditautkan ke mitra', () => {
    expect(updateUserSchema.safeParse({ ...STAF, vendor_id: UUID }).success).toBe(false);
  });

  it('menolak id yang bukan uuid', () => {
    expect(updateUserSchema.safeParse({ ...STAF, user_id: 'bukan-uuid' }).success).toBe(false);
  });
});

describe('createUserSchema', () => {
  it('tetap menuntut sandi awal', () => {
    // Perbedaan yang disengaja dengan updateUserSchema: akun baru tanpa sandi
    // tidak bisa dipakai siapa pun.
    const tanpaId = { ...STAF, user_id: undefined };
    expect(createUserSchema.safeParse(tanpaId).success).toBe(false);
    expect(createUserSchema.safeParse({ ...tanpaId, password: 'cukuppanjang' }).success).toBe(true);
  });
});

describe('deleteUserSchema', () => {
  it('hanya menerima uuid', () => {
    expect(deleteUserSchema.safeParse({ user_id: UUID }).success).toBe(true);
    expect(deleteUserSchema.safeParse({ user_id: '' }).success).toBe(false);
  });
});
