import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { AuthShell } from '../auth-shell';
import { ResetPasswordForm } from './reset-form';

export const metadata = {
  title: 'Atur Kata Sandi — Sukses Aqiqah Command',
  description: 'Buat kata sandi baru untuk akun Sukses Aqiqah Command Center',
};

/**
 * Setel kata sandi baru sesudah menekan tautan atur ulang.
 *
 * **Di grup `(auth)`, bukan `(app)`**: yang datang ke sini justru orang yang
 * belum bisa masuk. Tata letak aplikasi menuntut sesi penuh beserta profilnya,
 * sementara yang dipegang orang ini hanya sesi sementara dari tautannya.
 *
 * `/auth/callback` sudah menukar `code` di tautan jadi sesi itu sebelum halaman
 * ini terbuka. Kalau penukarannya gagal — tautan kedaluwarsa, sudah dipakai,
 * atau dibuka di peramban lain — tidak ada sesi sama sekali, dan halaman ini
 * memulangkannya ke halaman masuk dengan penjelasan alih-alih menampilkan
 * formulir yang pasti ditolak.
 */
export default async function AturSandiPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    // Bukan `notFound()`: halamannya ada, yang tidak ada adalah haknya. Yang
    // dibutuhkan orang ini bukan "404" melainkan jalan meminta tautan baru.
    redirect('/login?error=reset_expired');
  }

  return (
    <AuthShell
      title="Buat kata sandi baru"
      description={`Untuk akun ${data.user.email}`}
      footer={
        <Link
          href="/login"
          className="flex items-center justify-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-slate-200"
        >
          <ArrowLeft className="size-3.5" />
          Kembali ke halaman masuk
        </Link>
      }
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
