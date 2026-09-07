/**
 * Skema pengelolaan akun.
 *
 * Dua kaidah dijaga di sini karena keduanya cerminan constraint database, dan
 * pelanggarannya baru terasa jauh dari tempat kesalahannya: vendor tanpa mitra
 * jadi akun yang hidup tapi buta (`can_read_order` tidak punya pembanding), dan
 * staf yang merangkap vendor bisa memvalidasi pekerjaannya sendiri.
 *
 * `updateUserSchema` menambah satu kaidah yang tidak ada di `createUserSchema`:
 * sandi opsional. Mengharuskan sandi baru setiap kali seseorang membetulkan
 * nomor telepon justru mendorong sandi yang gampang ditebak.
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
  it('menerima penyuntingan tanpa sandi baru', () => {
    expect(updateUserSchema.safeParse(STAF).success).toBe(true);
    expect(updateUserSchema.safeParse({ ...STAF, password: undefined }).success).toBe(true);
  });

  it('menolak sandi baru yang terlalu pendek', () => {
    // Kosong berarti "tidak diubah"; terisi berarti benar-benar dipakai, jadi
    // ambang 8 karakter tetap berlaku begitu kolomnya disentuh.
    expect(updateUserSchema.safeParse({ ...STAF, password: 'pendek' }).success).toBe(false);
    expect(updateUserSchema.safeParse({ ...STAF, password: 'cukuppanjang' }).success).toBe(true);
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
