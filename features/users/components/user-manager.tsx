'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Plus, ShieldCheck, Store, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ROLE_LABEL } from '@/lib/constants/roles';
import { changeUserRole, createUser, setUserActive } from '@/server/actions/users';
import type { UserRow } from '../queries';

type VendorOption = { id: string; code: string; name: string };

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
 */
export function UserManager({
  users,
  vendorsWithoutAccount,
  currentUserId,
}: {
  users: UserRow[];
  vendorsWithoutAccount: VendorOption[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({
    email: '',
    full_name: '',
    phone: '',
    role: 'vendor' as 'superadmin' | 'admin' | 'vendor',
    vendor_id: '',
    password: '',
  });

  function run(fn: () => Promise<{ ok: boolean; error?: { message: string } }>, done?: () => void) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error?.message ?? 'Terjadi kesalahan.');
        return;
      }
      done?.();
      router.refresh();
    });
  }

  const needsVendor = draft.role === 'vendor';
  const noVendorAvailable = needsVendor && vendorsWithoutAccount.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Pengguna</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Akun login untuk tim dan mitra pelaksana
          </p>
        </div>
        <Button type="button" onClick={() => setShowForm((v) => !v)}>
          <Plus className="size-4" />
          Buat akun
        </Button>
      </div>

      {error && (
        <p className="border-destructive/20 bg-destructive/5 text-destructive flex items-start gap-2 rounded-xl border px-4 py-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {notice && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </p>
      )}

      {showForm && (
        <div className="border-border bg-card grid gap-3 rounded-2xl border p-4 shadow-sm sm:grid-cols-2">
          <div>
            <Label htmlFor="u-name">Nama lengkap</Label>
            <Input
              id="u-name"
              value={draft.full_name}
              onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="u-email">Email</Label>
            <Input
              id="u-email"
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="u-phone">Nomor WhatsApp (opsional)</Label>
            <Input
              id="u-phone"
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="u-role">Peran</Label>
            <Select
              id="u-role"
              value={draft.role}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  role: e.target.value as typeof draft.role,
                  // Peran non-vendor tidak boleh tertaut mitra — cerminan
                  // constraint `profiles_staff_no_vendor_check`.
                  vendor_id: e.target.value === 'vendor' ? draft.vendor_id : '',
                })
              }
              className="mt-1.5"
            >
              <option value="vendor">Vendor — pelaksana lapangan</option>
              <option value="admin">Admin — penghubung pembeli & mitra</option>
              <option value="superadmin">Superadmin — akses penuh</option>
            </Select>
          </div>

          {needsVendor && (
            <div className="sm:col-span-2">
              <Label htmlFor="u-vendor">Mitra</Label>
              <Select
                id="u-vendor"
                value={draft.vendor_id}
                disabled={noVendorAvailable}
                onChange={(e) => setDraft({ ...draft, vendor_id: e.target.value })}
                className="mt-1.5"
              >
                <option value="">Pilih mitra</option>
                {vendorsWithoutAccount.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.code})
                  </option>
                ))}
              </Select>
              <p className="text-muted-foreground mt-1 text-xs">
                Satu mitra satu akun. Mitra yang sudah punya akun tidak muncul di daftar ini.
              </p>
              {noVendorAvailable && (
                <p className="text-destructive mt-1 text-xs">
                  Semua mitra aktif sudah punya akun. Daftarkan mitra baru lebih dulu di menu Mitra.
                </p>
              )}
            </div>
          )}

          <div className="sm:col-span-2">
            <Label htmlFor="u-pass">Kata sandi awal</Label>
            <Input
              id="u-pass"
              type="text"
              value={draft.password}
              placeholder="Minimal 8 karakter"
              onChange={(e) => setDraft({ ...draft, password: e.target.value })}
              className="mt-1.5"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Sampaikan sandi ini langsung ke pemiliknya, lalu minta ia menggantinya.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:col-span-2">
            <Button
              type="button"
              disabled={
                pending ||
                !draft.email ||
                !draft.full_name ||
                draft.password.length < 8 ||
                (needsVendor && !draft.vendor_id)
              }
              onClick={() =>
                run(
                  async () => {
                    const result = await createUser(draft);
                    if (result.ok) {
                      setNotice(`Akun ${draft.email} dibuat.`);
                      setShowForm(false);
                      setDraft({
                        email: '',
                        full_name: '',
                        phone: '',
                        role: 'vendor',
                        vendor_id: '',
                        password: '',
                      });
                    }
                    return result;
                  },
                )
              }
            >
              Simpan akun
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setShowForm(false)}
            >
              Batal
            </Button>
          </div>
        </div>
      )}

      <ul className="border-border bg-card divide-border divide-y rounded-2xl border shadow-sm">
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
              {/* Peran vendor hanya bisa diubah lewat halaman ini bersama
                  mitranya, jadi tombol cepat di bawah sengaja terbatas pada
                  aktif/non-aktif — perubahan peran menuntut memilih mitra. */}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending || u.id === currentUserId}
                onClick={() => run(() => setUserActive({ user_id: u.id, is_active: !u.isActive }))}
              >
                {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
              </Button>

              {u.role !== 'superadmin' && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    run(() => changeUserRole({ user_id: u.id, role: 'superadmin', vendor_id: '' }))
                  }
                >
                  <ShieldCheck className="size-3.5" />
                  Jadikan superadmin
                </Button>
              )}

              {u.role === 'superadmin' && u.id !== currentUserId && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    run(() => changeUserRole({ user_id: u.id, role: 'admin', vendor_id: '' }))
                  }
                >
                  <UserCog className="size-3.5" />
                  Turunkan ke admin
                </Button>
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
