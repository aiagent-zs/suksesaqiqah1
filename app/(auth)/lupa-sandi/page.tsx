import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AuthShell } from '../auth-shell';
import { ForgotPasswordForm } from './forgot-password-form';

export const metadata = {
  title: 'Lupa Kata Sandi — Sukses Aqiqah Command',
  description: 'Minta tautan untuk mengatur ulang kata sandi akun Sukses Aqiqah Command Center',
};

/**
 * Minta tautan atur ulang kata sandi.
 *
 * **Halaman sendiri, bukan panel di bawah formulir masuk.** Dua kotak email
 * pada satu layar membuat orang ragu yang mana harus diisi — dan yang sedang
 * mencarinya justru orang yang sudah gagal masuk beberapa kali, keadaan yang
 * paling tidak memaafkan keraguan tambahan.
 *
 * Halaman tersendiri juga memberi tautan yang bisa dikirimkan: superadmin tidak
 * punya tombol atur ulang di `/users`, jadi yang bisa ia lakukan saat ada yang
 * mengeluh lupa sandi adalah mengirimkan alamat halaman ini.
 */
export default function LupaSandiPage() {
  return (
    <AuthShell
      title="Lupa kata sandi"
      description="Masukkan email akun Anda. Tautan untuk membuat kata sandi baru akan dikirim ke sana."
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
      <ForgotPasswordForm />
    </AuthShell>
  );
}
