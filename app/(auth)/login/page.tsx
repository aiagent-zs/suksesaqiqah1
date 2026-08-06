import { loginWithEmail } from '@/server/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export const metadata = {
  title: 'Login — Sukses Aqiqah',
  description: 'Halaman login sistem manajemen Sukses Aqiqah',
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  const errorMessages: Record<string, string> = {
    oauth_failed: 'Login Google gagal. Coba lagi.',
    oauth_init_failed: 'Tidak dapat menghubungi Google. Coba lagi.',
    Invalid_login_credentials: 'Email atau password salah.',
    Email_not_confirmed: 'Email belum dikonfirmasi. Periksa kotak masuk Anda.',
  };

  const errorMsg = error
    ? (errorMessages[error] ?? decodeURIComponent(error))
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo & Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/30 mb-4">
            <svg
              className="w-9 h-9 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3c-1.2 5.4-5 7.8-7 9a9 9 0 1014 0c-2-1.2-5.8-3.6-7-9z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Sukses Aqiqah
          </h1>
          <p className="text-emerald-300 text-sm mt-1">
            Tunaikan Ibadah, Tebarkan Manfaat
          </p>
        </div>

        {/* Card Form */}
        <Card className="bg-white/10 backdrop-blur-md border-white/20 shadow-xl">
          <CardHeader className="pb-2">
            <h2 className="text-white font-semibold text-lg">
              Masuk ke Sistem
            </h2>
            <p className="text-white/50 text-sm">
              Gunakan akun staf Anda untuk melanjutkan
            </p>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Error Alert */}
            {errorMsg && (
              <Alert variant="destructive" className="bg-red-500/20 border-red-400/40 text-red-200">
                <AlertCircle className="h-4 w-4 text-red-300" />
                <AlertDescription className="text-red-200">
                  {errorMsg}
                </AlertDescription>
              </Alert>
            )}

            {/* Login Form */}
            <form action={loginWithEmail} className="space-y-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="input-email"
                  className="text-emerald-200 font-medium"
                >
                  Email
                </Label>
                <Input
                  id="input-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="nama@zakatsukses.org"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-emerald-400 focus-visible:border-emerald-400"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="input-password"
                  className="text-emerald-200 font-medium"
                >
                  Password
                </Label>
                <Input
                  id="input-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-emerald-400 focus-visible:border-emerald-400"
                />
              </div>

              <Button
                id="btn-login-email"
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white font-semibold shadow-lg shadow-emerald-500/25 mt-1"
              >
                Masuk
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-white/30 text-xs mt-6">
          Sistem internal Sukses Aqiqah · Akses hanya untuk staf terotorisasi
        </p>
      </div>
    </div>
  );
}
