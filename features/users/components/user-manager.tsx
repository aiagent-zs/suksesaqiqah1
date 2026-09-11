'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Pencil, Plus, Store, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ROLE_LABEL } from '@/lib/constants/roles';
import { setUserActive } from '@/server/actions/users';
import { UserDialog } from './user-dialog';
import { UserDeleteDialog } from './user-delete-dialog';
import type { UserRow, VendorOption } from '../queries';

const ROLE_BADGE: Record<string, string> = {
  superadmin: 'bg-violet-50 text-violet-700 border-violet-200',
  admin: 'bg-blue-50 text-blue-700 border-blue-200',
  vendor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

/**
 * Pengelolaan akun — berhenti di superadmin.
 *
 * Alasannya bukan sekadar kerapian wewenang: siapa pun yang bisa mengubah role
 * bisa mengangkat dirinya sendiri, jadi memberi admin akses ke halaman ini sama
 * dengan menjadikan setiap admin calon superadmin.
 *
 * Komponen ini hanya menyusun daftar dan menangani aktif/non-aktif; membuat,
 * menyunting, dan menghapus tinggal di dialognya masing-masing. Perubahan peran
 * ikut di dialog sunting, bukan tombol cepat sendiri — satu tombol per peran
 * berarti dua tombol tambahan di tiap baris yang mengerjakan sebagian dari apa
 * yang sudah dikerjakan tombol Ubah.
 */
export function UserManager({
  users,
  vendors,
  currentUserId,
}: {
  users: UserRow[];
  vendors: VendorOption[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function toggleActive(user: UserRow) {
    setError(null);
    startTransition(async () => {
      const result = await setUserActive({ user_id: user.id, is_active: !user.isActive });
      if (!result.ok) {
        setError(result.error?.message ?? 'Terjadi kesalahan.');
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Pengguna</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Akun login untuk tim dan mitra pelaksana
          </p>
        </div>

        <UserDialog
          vendors={vendors}
          trigger={
            <Button type="button">
              <Plus className="size-4" />
              Buat akun
            </Button>
          }
        />
      </div>

      {error && (
        <p className="border-destructive/20 bg-destructive/5 text-destructive flex items-start gap-2 rounded-xl border px-4 py-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      <ul className="border-border bg-card divide-border divide-y rounded-lg border shadow-sm">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{u.fullName ?? '(tanpa nama)'}</span>
                <Badge className={ROLE_BADGE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                {!u.isActive && (
                  <Badge className="border-slate-200 bg-slate-100 text-slate-600">Non-aktif</Badge>
                )}
                {u.id === currentUserId && (
                  <span className="text-muted-foreground text-xs">(Anda)</span>
                )}
              </div>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {u.email ?? '-'}
                {u.phone ? ` · ${u.phone}` : ''}
              </p>
              {u.vendorName && (
                <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
                  <Store className="size-3" />
                  {u.vendorName}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <UserDialog
                user={u}
                vendors={vendors}
                trigger={
                  <Button type="button" size="sm" variant="outline" disabled={pending}>
                    <Pencil className="size-3.5" />
                    Ubah
                  </Button>
                }
              />

              {/* Akun sendiri tidak bisa dinonaktifkan atau dihapus: keduanya
                  mengunci orang ini keluar dari satu-satunya halaman yang bisa
                  membatalkannya. Ditegakkan di server juga. */}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending || u.id === currentUserId}
                onClick={() => toggleActive(u)}
              >
                {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
              </Button>

              {u.id !== currentUserId && (
                <UserDeleteDialog
                  user={u}
                  trigger={
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={pending}
                      aria-label={`Hapus akun ${u.fullName ?? u.email ?? ''}`}
                    >
                      <Trash2 className="size-3.5" />
                      Hapus
                    </Button>
                  }
                />
              )}
            </div>
          </li>
        ))}

        {users.length === 0 && (
          <li className="text-muted-foreground px-5 py-10 text-center text-sm">
            Belum ada akun terdaftar.
          </li>
        )}
      </ul>
    </div>
  );
}
