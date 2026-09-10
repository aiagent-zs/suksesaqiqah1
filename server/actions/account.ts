'use server';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/env';
import { requireAuth } from '@/server/auth/session';
import { changeOwnEmailSchema, changeOwnPasswordSchema } from '@/features/users/schema';
import { forbidden, scopedInternalError, validationError, type ActionResult } from './result';

const internalError = scopedInternalError('account');

/**
 * Buktikan pemanggil memang tahu kata sandinya sekarang.
 *
 * **Klien sekali pakai tanpa cookie**, dan itu bukan kerapian belaka: klien
 * server biasa menulis cookie sesi, jadi memakainya untuk `signInWithPassword`
 * akan menimpa sesi yang sedang berjalan — dan ketika sandinya ternyata salah,
 * pemanggilnya justru terlempar keluar. Yang dipakai di sini tidak menyentuh
 * cookie sama sekali; sesi hasil pemeriksaan dibuang begitu jawabannya
 * diketahui.
 *
 * Kenapa perlu sama sekali: `supabase.auth.updateUser()` menerima sesi yang
 * sudah hidup tanpa menanyakan apa pun. Tanpa pemeriksaan ini, laptop yang
 * ditinggal terbuka sebentar cukup untuk mengganti sandi dan email pemiliknya
 * — mengunci dia keluar dari akunnya sendiri, secara permanen.
 */
async function verifyPassword(email: string, password: string): Promise<boolean> {
  const probe = createSupabaseClient(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await probe.auth.signInWithPassword({ email, password });
  return !error;
}

/**
 * Ganti kata sandi akun sendiri.
 *
 * Berlaku untuk **semua role**, termasuk mitra: pemilik akun berhak mengurus
 * kredensialnya tanpa menunggu superadmin. Yang tetap milik superadmin adalah
 * role dan status aktif — keduanya tidak disentuh di sini sama sekali.
 */
export async function changeOwnPassword(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  const email = session.email;
  if (!email) return forbidden('Sesi tidak memuat email; masuk ulang lebih dulu.');

  const parsed = changeOwnPasswordSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { current_password, new_password } = parsed.data;

  if (!(await verifyPassword(email, current_password))) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Kata sandi saat ini tidak cocok.',
        fields: { current_password: 'Kata sandi salah.' },
      },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: new_password });

  if (error) {
    // Supabase menolak sandi yang pernah dipakai atau yang tertangkap daftar
    // bocor; pesannya dibawa apa adanya supaya bisa dikerjakan pembacanya.
    return internalError(`Gagal mengganti kata sandi: ${error.message}`, error);
  }

  return { ok: true, data: null };
}

/**
 * Ganti email akun sendiri.
 *
 * **Tidak berpindah seketika.** Supabase mengirim tautan konfirmasi ke alamat
 * baru; email lama tetap berlaku untuk masuk sampai tautannya diklik. Itu yang
 * membuat salah ketik tidak mengunci siapa pun keluar — dan yang membuat
 * pesannya di layar harus mengatakan "cek email", bukan "tersimpan".
 *
 * `profiles.email` sengaja **tidak** ikut diperbarui di sini: ia baru boleh
 * berubah setelah alamatnya terbukti bisa dijangkau. Trigger
 * `handle_user_email_change` yang menyelaraskannya saat konfirmasi masuk.
 */
export async function changeOwnEmail(input: unknown): Promise<ActionResult<{ sentTo: string }>> {
  const session = await requireAuth();

  const email = session.email;
  if (!email) return forbidden('Sesi tidak memuat email; masuk ulang lebih dulu.');

  const parsed = changeOwnEmailSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { new_email, current_password } = parsed.data;

  if (new_email === email.toLowerCase()) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Email baru sama dengan yang sekarang.',
        fields: { new_email: 'Email ini sudah dipakai akun Anda.' },
      },
    };
  }

  if (!(await verifyPassword(email, current_password))) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Kata sandi tidak cocok.',
        fields: { current_password: 'Kata sandi salah.' },
      },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ email: new_email });

  if (error) {
    return internalError(`Gagal mengganti email: ${error.message}`, error);
  }

  revalidatePath('/profil');
  return { ok: true, data: { sentTo: new_email } };
}
