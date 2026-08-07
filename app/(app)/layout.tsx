import { requireAuth } from '@/server/auth/session';
import { AuthProvider } from '@/components/providers/auth-provider';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ShieldCheck,
  LayoutDashboard,
  ShoppingBag,
  CalendarDays,
  FileText,
  Settings,
  LogOut,
} from 'lucide-react';
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
        <aside className="hidden w-[260px] shrink-0 flex-col border-r border-slate-800 bg-[#0b1c30] text-white lg:flex">
          {/* Header Brand */}
          <div className="border-b border-slate-800/80 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#16A34A] to-[#059669] shadow-md">
                <ShieldCheck className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-sans text-base leading-tight font-bold tracking-tight text-white">
                  Sukses Aqiqah
                </p>
                <p className="mt-0.5 text-xs font-semibold tracking-wider text-emerald-400 uppercase">
                  Command Center
                </p>
              </div>
            </div>
          </div>

          {/* User Profile Summary */}
          <div className="border-b border-slate-800/80 bg-slate-900/50 px-5 py-4">
            <p className="mb-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Staf Terotentikasi
            </p>
            <p className="truncate text-sm font-semibold text-white">
              {session.profile?.full_name ?? session.email ?? 'User Staf'}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                {session.profile?.role ?? 'staf'}
              </span>
              {session.profile?.is_supervisor && (
                <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                  Supervisor
                </span>
              )}
            </div>
          </div>

          {/* Navigasi Utama */}
          <nav className="flex-1 space-y-1 p-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-lg border-l-4 border-emerald-500 bg-emerald-600/20 px-3.5 py-2.5 text-sm font-medium text-emerald-400 transition-all"
            >
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              <span>Dashboard</span>
            </Link>
            <Link
              href="/orders"
              className="flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-400 transition-all hover:bg-slate-800/60 hover:text-white"
            >
              <ShoppingBag className="h-4 w-4 shrink-0" />
              <span>Pesanan (Orders)</span>
            </Link>
            <Link
              href="/schedule"
              className="flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-400 transition-all hover:bg-slate-800/60 hover:text-white"
            >
              <CalendarDays className="h-4 w-4 shrink-0" />
              <span>Jadwal</span>
            </Link>
            <Link
              href="/validation"
              className="flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-400 transition-all hover:bg-slate-800/60 hover:text-white"
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span>Validasi Dokumentasi</span>
            </Link>
            <a
              href="#"
              className="flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-400 transition-all hover:bg-slate-800/60 hover:text-white"
            >
              <Settings className="h-4 w-4 shrink-0" />
              <span>Pengaturan</span>
            </a>
          </nav>

          {/* Footer Logout */}
          <div className="border-t border-slate-800 p-4">
            <form action={logout}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-400 transition-all hover:bg-red-950/30 hover:text-red-400"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>Keluar Sistem</span>
              </button>
            </form>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header Mobile */}
          <header className="flex items-center justify-between border-b border-slate-800 bg-[#0b1c30] px-4 py-3 text-white lg:hidden">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <p className="text-sm font-bold">Sukses Aqiqah</p>
            </div>
            <span className="rounded-full bg-emerald-900 px-2.5 py-1 text-xs font-medium text-emerald-200">
              {session.profile?.role ?? 'staf'}
            </span>
          </header>

          {/* Page Body */}
          <main className="mx-auto w-full max-w-[1440px] flex-1 p-6 md:p-8">{children}</main>
        </div>
      </div>
    </AuthProvider>
  );
}
