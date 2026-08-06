import { requireAuth } from '@/server/auth/session';
import { AuthProvider } from '@/components/providers/auth-provider';
import type { ReactNode } from 'react';
import { ShieldCheck, LayoutDashboard, ShoppingBag, FileText, Settings, LogOut } from 'lucide-react';
import { logout } from '@/server/actions/auth';

/**
 * Layout untuk route group (app)/* — terproteksi dengan Sukses Aqiqah Command Design System (design.md)
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireAuth();

  return (
    <AuthProvider profile={session.profile}>
      <div className="flex min-h-screen bg-[#f8f9ff] text-[#0b1c30]">
        
        {/* Sidebar 260px sesuai design.md */}
        <aside className="hidden lg:flex w-[260px] flex-col bg-[#0b1c30] text-white shrink-0 border-r border-slate-800">
          
          {/* Header Brand */}
          <div className="p-6 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#16A34A] to-[#059669] flex items-center justify-center shrink-0 shadow-md">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-base leading-tight tracking-tight text-white font-sans">
                  Sukses Aqiqah
                </p>
                <p className="text-emerald-400 text-xs font-semibold tracking-wider uppercase mt-0.5">
                  Command Center
                </p>
              </div>
            </div>
          </div>

          {/* User Profile Summary */}
          <div className="px-5 py-4 border-b border-slate-800/80 bg-slate-900/50">
            <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mb-1">
              Staf Terotentikasi
            </p>
            <p className="text-white text-sm font-semibold truncate">
              {session.profile?.full_name ?? session.email ?? 'User Staf'}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium border border-emerald-500/30">
                {session.profile?.role ?? 'staf'}
              </span>
              {session.profile?.is_supervisor && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-medium border border-amber-500/30">
                  Supervisor
                </span>
              )}
            </div>
          </div>

          {/* Navigasi Utama */}
          <nav className="flex-1 p-4 space-y-1">
            <a
              href="/dashboard"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg bg-emerald-600/20 text-emerald-400 font-medium text-sm border-l-4 border-emerald-500 transition-all"
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Dashboard</span>
            </a>
            <a
              href="#"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 font-medium text-sm transition-all"
            >
              <ShoppingBag className="w-4 h-4 shrink-0" />
              <span>Pesanan (Orders)</span>
            </a>
            <a
              href="#"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 font-medium text-sm transition-all"
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span>Dokumentasi</span>
            </a>
            <a
              href="#"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 font-medium text-sm transition-all"
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>Pengaturan</span>
            </a>
          </nav>

          {/* Footer Logout */}
          <div className="p-4 border-t border-slate-800">
            <form action={logout}>
              <button
                type="submit"
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/30 font-medium text-sm transition-all"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Keluar Sistem</span>
              </button>
            </form>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          
          {/* Header Mobile */}
          <header className="lg:hidden bg-[#0b1c30] text-white px-4 py-3 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <p className="font-bold text-sm">Sukses Aqiqah</p>
            </div>
            <span className="text-xs bg-emerald-900 text-emerald-200 px-2.5 py-1 rounded-full font-medium">
              {session.profile?.role ?? 'staf'}
            </span>
          </header>

          {/* Page Body */}
          <main className="flex-1 p-6 md:p-8 max-w-[1440px] w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </AuthProvider>
  );
}
