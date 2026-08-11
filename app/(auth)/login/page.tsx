import { loginWithEmail, type LoginErrorCode } from '@/server/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Clock, ShieldCheck } from 'lucide-react';
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
    <div className="flex min-h-screen items-center justify-center bg-[#0b1c30] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#004d1f] via-[#0b1c30] to-[#051120] p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo & Brand Header */}
        <div className="space-y-2 text-center">
          <div className="mb-2 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#16A34A] to-[#059669] shadow-lg ring-1 shadow-emerald-900/50 ring-white/20">
            <ShieldCheck className="h-9 w-9 text-white" />
          </div>
          <h1 className="font-sans text-3xl font-bold tracking-tight text-white">Sukses Aqiqah</h1>
          <p className="text-xs font-semibold tracking-wider text-emerald-400 uppercase">
            Command Center · Tebarkan Manfaat
          </p>
        </div>

        {/* Card Form (16px radius matching design.md) */}
        <Card className="rounded-2xl border-[#213145] bg-[#15273e]/90 shadow-2xl backdrop-blur-xl">
          <CardHeader className="space-y-1.5 pb-4">
            <CardTitle className="text-xl font-semibold tracking-tight text-white">
              Masuk Staf Internal
            </CardTitle>
            <CardDescription className="text-sm text-slate-400">
              Masukkan kredensial terotorisasi untuk mengakses dashboard
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
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
                  className="h-11 rounded-lg border-[#213145] bg-[#0b1c30]/80 text-white placeholder:text-slate-500 focus-visible:border-[#16A34A] focus-visible:ring-[#16A34A]"
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
                  className="h-11 rounded-lg border-[#213145] bg-[#0b1c30]/80 text-white placeholder:text-slate-500 focus-visible:border-[#16A34A] focus-visible:ring-[#16A34A]"
                />
              </div>

              <Button
                id="btn-login-email"
                type="submit"
                className="mt-2 h-11 w-full rounded-lg bg-gradient-to-r from-[#16A34A] to-[#059669] font-medium text-white shadow-lg shadow-emerald-950/50 transition-all hover:from-[#15803D] hover:to-[#047857]"
              >
                Masuk ke System
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer info */}
        <div className="space-y-1 text-center">
          <p className="text-xs text-slate-400">
            Akses terbatas hanya untuk staf & pengelola terotorisasi.
          </p>
          <p className="text-[11px] text-slate-500">Sukses Aqiqah © 2026 · Hak Cipta Dilindungi</p>
        </div>
      </div>
    </div>
  );
}
