import { loginWithEmail } from '@/server/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ShieldCheck } from 'lucide-react';

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export const metadata = {
  title: 'Login — Sukses Aqiqah Command',
  description: 'Halaman login sistem manajemen Sukses Aqiqah Command Center',
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  const errorMessages: Record<string, string> = {
    oauth_failed: 'Login Google gagal. Coba lagi.',
    oauth_init_failed: 'Tidak dapat menghubungi Google. Coba lagi.',
    Invalid_login_credentials: 'Email atau password salah. Silakan periksa kembali.',
    Email_not_confirmed: 'Email belum dikonfirmasi. Periksa kotak masuk Anda.',
  };

  const errorMsg = error
    ? (errorMessages[error] ?? decodeURIComponent(error))
    : null;

  return (
    <div className="min-h-screen bg-[#0b1c30] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#004d1f] via-[#0b1c30] to-[#051120] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">

        {/* Logo & Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#16A34A] to-[#059669] shadow-lg shadow-emerald-900/50 ring-1 ring-white/20 mb-2">
            <ShieldCheck className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight font-sans">
            Sukses Aqiqah
          </h1>
          <p className="text-emerald-400 text-xs font-semibold tracking-wider uppercase">
            Command Center · Tebarkan Manfaat
          </p>
        </div>

        {/* Card Form (16px radius matching design.md) */}
        <Card className="bg-[#15273e]/90 backdrop-blur-xl border-[#213145] shadow-2xl rounded-2xl">
          <CardHeader className="space-y-1.5 pb-4">
            <CardTitle className="text-white font-semibold text-xl tracking-tight">
              Masuk Staf Internal
            </CardTitle>
            <CardDescription className="text-slate-400 text-sm">
              Masukkan kredensial terotorisasi untuk mengakses dashboard
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Error Alert */}
            {errorMsg && (
              <Alert variant="destructive" className="bg-red-950/50 border-red-500/50 text-red-200 rounded-lg">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                <AlertDescription className="text-red-200 text-sm">
                  {errorMsg}
                </AlertDescription>
              </Alert>
            )}

            {/* Login Form */}
            <form action={loginWithEmail} className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="input-email"
                  className="text-slate-200 text-sm font-medium"
                >
                  Email Staf
                </Label>
                <Input
                  id="input-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="nama@zakatsukses.org"
                  className="bg-[#0b1c30]/80 border-[#213145] text-white placeholder:text-slate-500 rounded-lg h-11 focus-visible:ring-[#16A34A] focus-visible:border-[#16A34A]"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="input-password"
                  className="text-slate-200 text-sm font-medium"
                >
                  Kata Sandi
                </Label>
                <Input
                  id="input-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="bg-[#0b1c30]/80 border-[#213145] text-white placeholder:text-slate-500 rounded-lg h-11 focus-visible:ring-[#16A34A] focus-visible:border-[#16A34A]"
                />
              </div>

              <Button
                id="btn-login-email"
                type="submit"
                className="w-full bg-gradient-to-r from-[#16A34A] to-[#059669] hover:from-[#15803D] hover:to-[#047857] text-white font-medium h-11 rounded-lg shadow-lg shadow-emerald-950/50 transition-all mt-2"
              >
                Masuk ke System
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer info */}
        <div className="text-center space-y-1">
          <p className="text-slate-400 text-xs">
            Akses terbatas hanya untuk staf & pengelola terotorisasi.
          </p>
          <p className="text-slate-500 text-[11px]">
            Sukses Aqiqah © 2026 · Hak Cipta Dilindungi
          </p>
        </div>
      </div>
    </div>
  );
}
