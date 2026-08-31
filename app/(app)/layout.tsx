import { requireAuth } from '@/server/auth/session';
import { AuthProvider } from '@/components/providers/auth-provider';
import { IdleLogout } from '@/components/providers/idle-logout';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { MobileNav } from '@/components/layout/mobile-nav';
import type { ReactNode } from 'react';
import { ShieldCheck, LogOut } from 'lucide-react';
import { logout } from '@/server/actions/auth';
import { ROLE_LABEL } from '@/lib/constants/roles';

/**
 * Layout untuk route group (app)/* — terproteksi dengan Sukses Aqiqah Command Design System (design.md)
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireAuth();

  return (
    <AuthProvider profile={session.profile}>
      {/* Keluar otomatis saat menganggur — penegakannya di middleware,
          komponen ini yang membuat waktunya tepat (lib/auth/idle.ts) */}
      <IdleLogout />

      <div className="bg-background text-foreground flex min-h-screen">
        {/* Sidebar 260px sesuai design.md.

            `sticky top-0 h-screen`: sidebar tetap di tempat saat halaman
            digulir. Tanpa itu ia ikut terbawa naik — pada halaman panjang
            (daftar order, detail order yang penuh panel) menu dan tombol
            "Keluar Sistem" hilang dari layar dan operator harus menggulir
            kembali ke atas hanya untuk berpindah halaman.

            Sengaja `sticky`, bukan `fixed`: elemennya tetap menempati kolomnya
            sendiri di flex row, jadi konten utama tidak perlu diberi offset
            kiri yang harus dijaga tetap sama dengan lebar sidebar. */}
        <aside className="border-sidebar-border bg-sidebar sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col border-r text-white lg:flex">
          {/* Header Brand */}
          <div className="border-sidebar-border/80 border-b p-6">
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
          <div className="border-sidebar-border/80 bg-sidebar-accent/50 border-b px-5 py-4">
            <p className="mb-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Staf Terotentikasi
            </p>
            <p className="truncate text-sm font-semibold text-white">
              {session.profile?.full_name ?? session.email ?? 'User Staf'}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                {ROLE_LABEL[session.profile?.role ?? ''] ?? 'Staf'}
              </span>
            </div>
          </div>

          {/* Navigasi Utama — penanda aktif diturunkan dari pathname (client) */}
          <SidebarNav role={session.profile?.role} />

          {/* Footer Logout */}
          <div className="border-sidebar-border border-t p-4">
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
          <header className="border-sidebar-border bg-sidebar flex items-center justify-between border-b px-4 py-3 text-white lg:hidden">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <p className="text-sm font-bold">Sukses Aqiqah</p>
            </div>
            <span className="rounded-full bg-emerald-900 px-2.5 py-1 text-xs font-medium text-emerald-200">
              {session.profile?.role ?? 'staf'}
            </span>
          </header>

          {/* Page Body.
              Padding ditulis per sisi, bukan `p-6 md:p-8`: bottom-nav melayang
              di atas konten, jadi sisi bawah butuh ruang sendiri (`pb-24`) yang
              baru kembali normal begitu sidebar muncul di `lg`. Ditulis sebagai
              shorthand, nilai `pb` itu akan tertimpa `md:p-8`. */}
          <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 pt-6 pb-24 md:px-8 md:pt-8 lg:pb-8">
            {children}
          </main>
        </div>
      </div>

      {/* Navigasi < lg — sidebar di atas ini `hidden lg:flex` */}
      <MobileNav
        fullName={session.profile?.full_name ?? session.email ?? 'User Staf'}
        role={session.profile?.role}
      />
    </AuthProvider>
  );
}
