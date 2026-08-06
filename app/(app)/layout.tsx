import { requireAuth } from '@/server/auth/session';
import { AuthProvider } from '@/components/providers/auth-provider';
import type { ReactNode } from 'react';

/**
 * Layout untuk route group (app)/* — semua halaman yang butuh autentikasi.
 * requireAuth() redirect ke /login jika tidak ada sesi aktif.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireAuth();

  return (
    <AuthProvider profile={session.profile}>
      <div className="flex min-h-screen bg-gray-50">
        {/* Sidebar placeholder — akan diganti AppShell di Tahap 5 (Dashboard) */}
        <aside className="hidden lg:flex w-64 flex-col bg-emerald-900 text-white shrink-0">
          <div className="p-5 border-b border-emerald-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
                <svg
                  className="w-5 h-5 text-white"
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
              <div>
                <p className="font-semibold text-sm leading-none">
                  Sukses Aqiqah
                </p>
                <p className="text-emerald-400 text-xs mt-0.5">
                  Sistem Manajemen
                </p>
              </div>
            </div>
          </div>

          {/* User info */}
          <div className="p-4 border-b border-emerald-800 bg-emerald-950/30">
            <p className="text-xs text-emerald-400 uppercase tracking-wide font-medium mb-1">
              Login sebagai
            </p>
            <p className="text-white text-sm font-medium truncate">
              {session.profile?.full_name ?? session.email ?? 'User'}
            </p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-emerald-700 text-emerald-200 text-xs font-medium">
              {session.profile?.role ?? 'unknown'}
            </span>
          </div>

          {/* Nav placeholder */}
          <nav className="flex-1 p-4">
            <p className="text-emerald-500 text-xs">
              Navigasi akan ditambahkan di Tahap 5
            </p>
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar (mobile) */}
          <header className="lg:hidden bg-emerald-900 text-white px-4 py-3 flex items-center justify-between">
            <p className="font-semibold text-sm">Sukses Aqiqah</p>
            <span className="text-xs bg-emerald-700 px-2 py-0.5 rounded-full">
              {session.profile?.role ?? ''}
            </span>
          </header>

          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </AuthProvider>
  );
}
