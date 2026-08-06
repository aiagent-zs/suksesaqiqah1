import { requireAuth } from '@/server/auth/session';
import { logout } from '@/server/actions/auth';

export default async function DashboardPage() {
  const session = await requireAuth();
  const { profile, email } = session;

  const roleLabels: Record<string, string> = {
    direktur: 'Direktur',
    manager_program: 'Manager Program',
    admin_pusat: 'Admin Pusat',
    admin_cabang: 'Admin Cabang',
    petugas_lapangan: 'Petugas Lapangan',
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          Selamat datang di sistem manajemen Sukses Aqiqah
        </p>
      </div>

      {/* Auth verification card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-gray-900">
              {profile?.full_name ?? email ?? 'User'}
            </p>
            <p className="text-gray-400 text-xs">{email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-1">Role</p>
            <p className="font-semibold text-gray-900 text-sm">
              {profile?.role
                ? (roleLabels[profile.role] ?? profile.role)
                : 'Belum ada profil'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-1">Supervisor</p>
            <p className="font-semibold text-gray-900 text-sm">
              {profile?.is_supervisor ? 'Ya' : 'Tidak'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 col-span-2">
            <p className="text-xs text-gray-400 mb-1">Branch ID</p>
            <p className="font-mono text-gray-700 text-xs break-all">
              {profile?.branch_id ?? '— (akses semua cabang)'}
            </p>
          </div>
        </div>
      </div>

      {/* Auth status badge */}
      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
        <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
        <p className="text-emerald-700 text-sm font-medium">
          Auth & RBAC aktif ✓ — Sesi terverifikasi, RLS siap di database.
        </p>
      </div>

      {/* Logout */}
      <form action={logout}>
        <button
          id="btn-logout"
          type="submit"
          className="text-sm text-red-500 hover:text-red-700 underline underline-offset-2 transition-colors"
        >
          Keluar dari sistem
        </button>
      </form>
    </div>
  );
}

export const metadata = {
  title: 'Dashboard — Sukses Aqiqah',
};
