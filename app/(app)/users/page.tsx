import { ShieldOff } from 'lucide-react';
import { requireAuth } from '@/server/auth/session';
import { canDo } from '@/server/auth/capabilities';
import { getVendorsWithoutAccount, listUsers } from '@/features/users/queries';
import { UserManager } from '@/features/users/components/user-manager';

export const metadata = { title: 'Pengguna — Sukses Aqiqah' };

/**
 * Pengelolaan akun — berhenti di superadmin.
 *
 * Halaman ini tetap bisa dibuka role lain, tapi tanpa data dan dengan alasannya
 * dijelaskan. Pola yang sama dipakai `/validation`: menyembunyikan halaman
 * begitu saja membuat orang menebak apakah menunya rusak atau memang bukan
 * haknya. Pertahanan sesungguhnya tetap RLS dan pemeriksaan di server action —
 * yang memakai service role, jadi ia memeriksa rolenya sendiri.
 */
export default async function UsersPage() {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_USERS')) {
    return (
      <div className="border-border bg-card rounded-lg border p-10 text-center shadow-sm">
        <ShieldOff className="text-muted-foreground mx-auto size-8" />
        <h1 className="mt-3 text-lg font-semibold">Pengelolaan akun dibatasi</h1>
        <p className="text-muted-foreground mx-auto mt-1.5 max-w-md text-sm">
          Hanya superadmin yang dapat membuat dan mengubah akun. Siapa pun yang bisa mengubah peran
          bisa mengangkat dirinya sendiri, jadi wewenang ini sengaja tidak dibagikan.
        </p>
      </div>
    );
  }

  const [users, vendorsWithoutAccount] = await Promise.all([
    listUsers(),
    getVendorsWithoutAccount(),
  ]);

  return (
    <UserManager
      users={users}
      vendorsWithoutAccount={vendorsWithoutAccount}
      currentUserId={session.id}
    />
  );
}
