import Link from 'next/link';
import { loginWithEmail, type LoginErrorCode } from '@/server/actions/auth';
import { LoginSubmitButton } from './submit-button';
import { Input } from '@/components/ui/input';
import { AuthShell, AUTH_FIELD_CLASS } from '../auth-shell';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Clock } from 'lucide-react';
import { IDLE_NOTICE, IDLE_TIMEOUT_MS } from '@/lib/auth/idle';

interface LoginPageProps {
  searchParams: Promise<{ error?: string; notice?: string }>;
}

export const metadata = {
  title: 'Login — Sukses Aqiqah Command',
  description: 'Halaman login sistem manajemen Sukses Aqiqah Command Center',
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, notice } = await searchParams;

  // Kunci di sini harus sama persis dengan LoginErrorCode di
  // server/actions/auth.ts. Kode yang tidak dikenal jatuh ke pesan umum —
  // jangan tampilkan isi parameter URL apa adanya, itu bisa disetel siapa saja
  // lewat tautan dan menjadi celah teks palsu di halaman login.
  const errorMessages: Record<LoginErrorCode, string> = {
    invalid_input: 'Email dan kata sandi wajib diisi dengan benar.',
    invalid_credentials: 'Email atau kata sandi salah. Silakan periksa kembali.',
    email_not_confirmed: 'Email belum dikonfirmasi. Periksa kotak masuk Anda.',
    rate_limited: 'Terlalu banyak percobaan masuk. Tunggu beberapa saat lalu coba lagi.',
    // Tautan atur ulang hanya berlaku sekali dan punya masa berlaku. Kalimatnya
    // menyebutkan jalan keluarnya, bukan sekadar menyatakan gagal.
    reset_expired:
      'Tautan atur ulang kata sandi sudah tidak berlaku. Minta tautan baru lewat "Lupa kata sandi?" di bawah formulir.',
    oauth_failed:
      'Tautan tidak bisa diproses. Kalau ini tautan atur ulang kata sandi, mintalah yang baru.',
    unknown: 'Login gagal. Coba lagi atau hubungi administrator.',
  };

  const errorMsg = error ? (errorMessages[error as LoginErrorCode] ?? errorMessages.unknown) : null;

  // Sama seperti `error` di atas: hanya nilai yang dikenal yang ditampilkan.
  // Parameter URL bisa disetel siapa saja lewat tautan, jadi isinya tidak
  // pernah dicetak apa adanya.
  const noticeMsg =
    notice === IDLE_NOTICE
      ? `Anda keluar otomatis karena tidak ada aktivitas selama ${IDLE_TIMEOUT_MS / 60000} menit. Silakan masuk kembali.`
      : null;

  return (
    <AuthShell
      title="Masuk Staf Internal"
      description="Masukkan kredensial terotorisasi untuk mengakses dashboard"
      footer={
        <div className="space-y-1 text-center">
          <p className="text-xs text-slate-400">
            Akses terbatas hanya untuk staf &amp; pengelola terotorisasi.
          </p>
          <p className="text-[11px] text-slate-500">Sukses Aqiqah © 2026 · Hak Cipta Dilindungi</p>
        </div>
      }
    >
      {/* Keluar otomatis karena menganggur — pemberitahuan, bukan kegagalan */}
      {noticeMsg && (
        <Alert className="rounded-lg border-amber-500/50 bg-amber-950/50 text-amber-200">
          <Clock className="h-4 w-4 shrink-0 text-amber-400" />
          <AlertDescription className="text-sm text-amber-200">{noticeMsg}</AlertDescription>
        </Alert>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <Alert
          variant="destructive"
          className="rounded-lg border-red-500/50 bg-red-950/50 text-red-200"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <AlertDescription className="text-sm text-red-200">{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* Login Form */}
      <form action={loginWithEmail} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="input-email" className="text-sm font-medium text-slate-200">
            Email Staf
          </Label>
          <Input
            id="input-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="nama@zakatsukses.org"
            className={AUTH_FIELD_CLASS}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="input-password" className="text-sm font-medium text-slate-200">
            Kata Sandi
          </Label>
          <Input
            id="input-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className={AUTH_FIELD_CLASS}
          />
        </div>

        <LoginSubmitButton />
      </form>

      {/* Tautan, bukan panel yang mekar di bawah formulir: dua kotak
                email pada satu layar membuat orang ragu yang mana harus diisi
                — dan yang mencarinya justru orang yang sudah gagal masuk
                beberapa kali. */}
      <p className="mt-4 text-center">
        <Link
          href="/lupa-sandi"
          className="text-xs text-slate-400 underline-offset-4 transition-colors hover:text-emerald-400 hover:underline"
        >
          Lupa kata sandi?
        </Link>
      </p>
    </AuthShell>
  );
}
