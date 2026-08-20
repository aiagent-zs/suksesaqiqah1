import { z } from 'zod';

const uuid = z.string().uuid('Pilihan tidak valid');

/**
 * Buat akun pengguna.
 *
 * `role` di sini **tidak** ikut ke user metadata: `handle_new_user` sengaja
 * mengabaikan metadata role sejak desain ulang, karena selama pendaftaran
 * mandiri terbuka di Supabase, siapa pun bisa menyisipkan `{"role":"admin"}`
 * dan langsung jadi admin. Role ditetapkan lewat UPDATE terpisah oleh server
 * action, yang lebih dulu memastikan pemanggilnya superadmin.
 */
export const createUserSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Format email tidak valid'),
    full_name: z.string().trim().min(2, 'Nama wajib diisi').max(150, 'Nama terlalu panjang'),
    phone: z
      .string()
      .trim()
      .max(20, 'Nomor terlalu panjang')
      .regex(/^[0-9+()\- ]*$/, 'Nomor hanya boleh berisi angka dan tanda + ( ) -')
      .optional()
      .or(z.literal('')),
    role: z.enum(['superadmin', 'admin', 'vendor']),
    /** Wajib untuk vendor — akun vendor tanpa mitra tidak bisa melihat apa pun. */
    vendor_id: uuid.optional().or(z.literal('')),
    password: z
      .string()
      .min(8, 'Kata sandi minimal 8 karakter')
      .max(72, 'Kata sandi terlalu panjang'),
  })
  .superRefine((v, ctx) => {
    // Cerminan `profiles_vendor_scope_check` di database: vendor aktif wajib
    // punya mitra, karena `can_read_order` membandingkan `profiles.vendor_id`
    // dan tanpa itu akunnya hidup tapi buta.
    if (v.role === 'vendor' && !v.vendor_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['vendor_id'],
        message: 'Akun vendor harus ditautkan ke mitra',
      });
    }

    // Cerminan `profiles_staff_no_vendor_check`: staf yang merangkap vendor
    // bisa memvalidasi pekerjaannya sendiri.
    if (v.role !== 'vendor' && v.vendor_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['vendor_id'],
        message: 'Akun admin/superadmin tidak boleh ditautkan ke mitra',
      });
    }
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;

/** Aktifkan atau nonaktifkan akun. */
export const setUserActiveSchema = z.object({
  user_id: uuid,
  is_active: z.boolean(),
});

/**
 * Ubah role sebuah akun.
 *
 * Dipisah dari penyuntingan data lain dengan sengaja: inilah satu-satunya
 * medan yang menentukan wewenang, dan memisahkannya membuat perubahannya
 * terbaca jelas di audit.
 */
export const changeRoleSchema = z
  .object({
    user_id: uuid,
    role: z.enum(['superadmin', 'admin', 'vendor']),
    vendor_id: uuid.optional().or(z.literal('')),
  })
  .superRefine((v, ctx) => {
    if (v.role === 'vendor' && !v.vendor_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['vendor_id'],
        message: 'Akun vendor harus ditautkan ke mitra',
      });
    }
    if (v.role !== 'vendor' && v.vendor_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['vendor_id'],
        message: 'Akun admin/superadmin tidak boleh ditautkan ke mitra',
      });
    }
  });

export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;
