import Image from 'next/image';
import Link from 'next/link';
import { requireAuth } from '@/server/auth/session';
import { AuthProvider } from '@/components/providers/auth-provider';
import { IdleLogout } from '@/components/providers/idle-logout';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { MobileNav } from '@/components/layout/mobile-nav';
import type { ReactNode } from 'react';
import { LogOut } from 'lucide-react';
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
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 p-1 shadow-md">
                <Image
                  src="/images/logo_new.webp"
                  alt="Sukses Aqiqah Logo"
                  width={36}
                  height={36}
                  priority
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <p className="font-sans text-base leading-tight font-bold tracking-tight text-white">
                  <span className="text-[#6EAF13]">Sukses</span>{' '}
                  <span className="text-[#FF7200]">Aqiqah</span>
                </p>
                <p className="mt-0.5 text-xs font-semibold tracking-wider text-emerald-400 uppercase">
                  Command Center
                </p>
              </div>
            </div>
          </div>

          {/* User Profile Summary — sekaligus jalan ke halaman profil.
              Blok ini tempat paling alami mencarinya: orang menuju namanya
              sendiri ketika hendak mengurus akunnya, bukan ke menu terpisah
              yang bersaing dengan menu pekerjaan. */}
          <Link
            href="/profil"
            className="border-sidebar-border/80 bg-sidebar-accent/50 hover:bg-sidebar-accent block border-b px-5 py-4 transition-colors"
          >
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
              <span className="text-[11px] text-slate-400">Kelola akun</span>
            </div>
          </Link>

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
              <Image
                src="/images/logo_new.webp"
                alt="Sukses Aqiqah Logo"
                width={24}
                height={24}
                className="h-6 w-6 object-contain"
              />
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
