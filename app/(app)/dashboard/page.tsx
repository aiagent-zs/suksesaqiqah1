import { requireAuth } from '@/server/auth/session';
import { logout } from '@/server/actions/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ShieldCheck, Building2, User, LogOut } from 'lucide-react';

export default async function DashboardPage() {
  const session = await requireAuth();
  const { profile, email } = session;

  const roleLabels: Record<string, string> = {
    direktur: 'Direktur Utama',
    manager_program: 'Manager Program',
    admin_pusat: 'Admin Pusat',
    admin_cabang: 'Admin Cabang',
    petugas_lapangan: 'Petugas Lapangan',
  };

  return (
    <div className="space-y-8 max-w-5xl">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#0b1c30] tracking-tight">
            Executive Command Dashboard
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Sistem Manajemen Operasional Aqiqah & Qurban Terintegrasi
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            Sistem Aktif & Terverifikasi
          </span>
        </div>
      </div>

      {/* KPI Command Stats Grid (4px Left-Border Accent as per design.md) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* KPI Card 1: Role */}
        <Card className="rounded-2xl border-l-4 border-l-[#16A34A] border-slate-200 shadow-sm bg-white hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Role & Akses Sesi
            </p>
            <CardTitle className="text-xl font-bold text-[#0b1c30]">
              {profile?.role ? (roleLabels[profile.role] ?? profile.role) : 'Staf Internal'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 mt-2">
              <User className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-xs text-slate-600 truncate">{email}</span>
            </div>
          </CardContent>
        </Card>

        {/* KPI Card 2: Branch Scope */}
        <Card className="rounded-2xl border-l-4 border-l-[#735c00] border-slate-200 shadow-sm bg-white hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Cakupan Cabang (Scope)
            </p>
            <CardTitle className="text-xl font-bold text-[#0b1c30]">
              {profile?.branch_id ? 'Cabang Khusus' : 'Seluruh Cabang (Pusat)'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 mt-2">
              <Building2 className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-xs text-slate-600 font-mono truncate">
                {profile?.branch_id ?? 'Pusat / Lintas Cabang'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* KPI Card 3: Supervisor Level */}
        <Card className="rounded-2xl border-l-4 border-l-teal-600 border-slate-200 shadow-sm bg-white hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Validasi Dokumentasi
            </p>
            <CardTitle className="text-xl font-bold text-[#0b1c30]">
              {profile?.is_supervisor ? 'Supervisor Validasi T1' : 'Staf Reguler'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 mt-2">
              <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
              <span className="text-xs text-slate-600">
                {profile?.is_supervisor ? 'Berhak melakukan approval T1' : 'Akses operasional standar'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Verification Card */}
      <Card className="rounded-2xl border border-slate-200 shadow-sm bg-white p-2">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-[#0b1c30]">
                Otentikasi & Keamanan Data (Tahap 2 Ready)
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Penegakan Row Level Security (RLS) PostgreSQL & Supabase Auth Aktif
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase">Pengguna Aktif</p>
              <p className="text-sm font-bold text-[#0b1c30]">{profile?.full_name ?? 'Staf Internal'}</p>
              <p className="text-xs text-slate-500">{email}</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase">Status Hak Akses</p>
              <p className="text-sm font-bold text-[#16A34A]">Terverifikasi RBAC</p>
              <p className="text-xs text-slate-500">Sesi dilindungi oleh Next.js Server Components</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
            <p className="text-xs text-slate-400">
              Sukses Aqiqah Command System v1.1
            </p>
            <form action={logout}>
              <Button
                type="submit"
                variant="outline"
                className="rounded-lg text-xs font-medium border-slate-300 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
              >
                <LogOut className="w-3.5 h-3.5 mr-1.5" />
                Keluar Sesi
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const metadata = {
  title: 'Dashboard — Sukses Aqiqah Command',
};
