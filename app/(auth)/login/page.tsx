import { loginWithEmail, loginWithGoogle } from '@/server/actions/auth';

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

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
      {/* Card utama */}
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

        {/* Card form */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 shadow-xl">
          <h2 className="text-white font-semibold text-lg mb-6">
            Masuk ke Sistem
          </h2>

          {/* Error message */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-400/40 text-red-200 text-sm flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-9h2V5H9v4zm0 4h2v-2H9v2z"
                  clipRule="evenodd"
                />
              </svg>
              {errorMsg}
            </div>
          )}

          {/* Google OAuth button */}
          <form action={loginWithGoogle}>
            <button
              id="btn-login-google"
              type="submit"
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white text-gray-700 font-medium text-sm hover:bg-gray-50 active:bg-gray-100 transition-colors shadow-sm mb-5"
            >
              {/* Google icon */}
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Lanjutkan dengan Google
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-white/20" />
            <span className="text-white/40 text-xs">atau</span>
            <div className="flex-1 h-px bg-white/20" />
          </div>

          {/* Email + Password form */}
          <form action={loginWithEmail} className="space-y-4">
            <div>
              <label
                htmlFor="input-email"
                className="block text-sm font-medium text-emerald-200 mb-1.5"
              >
                Email
              </label>
              <input
                id="input-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="nama@zakatsukses.org"
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="input-password"
                className="block text-sm font-medium text-emerald-200 mb-1.5"
              >
                Password
              </label>
              <input
                id="input-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all"
              />
            </div>

            <button
              id="btn-login-email"
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white font-semibold text-sm transition-colors shadow-lg shadow-emerald-500/25 mt-1"
            >
              Masuk
            </button>
          </form>
        </div>

        <p className="text-center text-white/30 text-xs mt-6">
          Sistem internal Sukses Aqiqah · Akses hanya untuk staf terotorisasi
        </p>
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Login — Sukses Aqiqah',
  description: 'Halaman login sistem manajemen Sukses Aqiqah',
};
