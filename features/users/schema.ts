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
 * Sunting akun.
 *
 * `email` dan `password` menyentuh `auth.users`, bukan `profiles` — keduanya
 * hanya bisa lewat Admin API. Sandi opsional: kosong berarti tidak diubah,
 * karena sebagian besar penyuntingan hanya membetulkan nama atau peran dan
 * mengharuskan sandi baru setiap kali justru mendorong sandi yang gampang.
 */
export const updateUserSchema = z
  .object({
    user_id: uuid,
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
    vendor_id: uuid.optional().or(z.literal('')),
    password: z
      .string()
      .min(8, 'Kata sandi minimal 8 karakter')
      .max(72, 'Kata sandi terlalu panjang')
      .optional()
      .or(z.literal('')),
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

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/** Hapus akun — `deleted_at`, bukan `delete`. Lihat `deleteUser`. */
export const deleteUserSchema = z.object({ user_id: uuid });

/**
 * Ganti kata sandi akun **sendiri**.
 *
 * `current_password` bukan formalitas: `supabase.auth.updateUser()` menerima
 * sesi yang sudah hidup tanpa menanyakan apa pun, jadi laptop yang ditinggal
 * terbuka sebentar cukup untuk mengunci pemiliknya keluar dari akunnya
 * sendiri. Diverifikasi server dengan mencoba login memakai email pemanggil.
 *
 * Berbeda dari `updateUserSchema` yang dipakai superadmin di `/users`: di sana
 * yang mengubah bukan pemilik akunnya, jadi tidak ada sandi lama yang bisa ia
 * ketahui — kewenangannya yang menjadi pembuktian.
 */
export const changeOwnPasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Kata sandi saat ini wajib diisi'),
    new_password: z
      .string()
      .min(8, 'Kata sandi minimal 8 karakter')
      .max(72, 'Kata sandi terlalu panjang'),
    confirm_password: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.new_password !== v.confirm_password) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirm_password'],
        message: 'Ulangan kata sandi tidak sama',
      });
    }
    // Sandi yang "diganti" jadi sandi yang sama membuat orang mengira dirinya
    // sudah aman padahal tidak ada yang berubah.
    if (v.current_password === v.new_password) {
      ctx.addIssue({
        code: 'custom',
        path: ['new_password'],
        message: 'Kata sandi baru harus berbeda dari yang sekarang',
      });
    }
  });

/**
 * Ganti email akun **sendiri**.
 *
 * Sandi tetap diminta: email adalah identitas login sekaligus alamat pemulihan
 * akun. Yang berhasil mengubahnya diam-diam bisa mengambil alih akun itu lewat
 * "lupa sandi" kapan pun kemudian.
 *
 * Perpindahannya tidak seketika — Supabase mengirim tautan konfirmasi ke
 * alamat baru, dan email lama tetap berlaku sampai tautannya diklik. Itu
 * disengaja: salah ketik tidak mengunci siapa pun keluar.
 */
export const changeOwnEmailSchema = z.object({
  new_email: z.string().trim().toLowerCase().email('Format email tidak valid'),
  current_password: z.string().min(1, 'Kata sandi wajib diisi untuk mengubah email'),
});

export type ChangeOwnPasswordInput = z.infer<typeof changeOwnPasswordSchema>;
export type ChangeOwnEmailInput = z.infer<typeof changeOwnEmailSchema>;
