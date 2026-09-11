'use client';

import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@base-ui/react/dialog';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { createUser, updateUser } from '@/server/actions/users';
import type { UserRow, VendorOption } from '../queries';

type Role = 'superadmin' | 'admin' | 'vendor';

type Draft = {
  email: string;
  full_name: string;
  phone: string;
  role: Role;
  vendor_id: string;
  password: string;
};

function toDraft(user?: UserRow): Draft {
  return {
    email: user?.email ?? '',
    full_name: user?.fullName ?? '',
    phone: user?.phone ?? '',
    role: (user?.role as Role) ?? 'vendor',
    vendor_id: user?.vendorId ?? '',
    password: '',
  };
}

/**
 * Form akun dalam dialog — dipakai untuk **membuat** akun baru dan **menyunting**
 * akun yang sudah ada.
 *
 * Keduanya satu komponen karena medannya identik kecuali satu: sandi wajib saat
 * membuat, opsional saat menyunting. Memisahkannya jadi dua berkas berarti dua
 * salinan validasi yang bisa berbeda diam-diam — dan keduanya harus tetap
 * cerminan `profiles_vendor_scope_check` di database.
 *
 * Dialog, bukan form inline: daftarnya panjang, dan form yang mekar di tengah
 * baris mendorong seluruh isi di bawahnya sehingga baris yang sedang disunting
 * berpindah dari tempat yang tadi dilihat operator.
 */
export function UserDialog({
  user,
  vendors,
  trigger,
}: {
  /** Diisi = mode sunting. Dikosongkan = mode buat baru. */
  user?: UserRow;
  vendors: VendorOption[];
  /** Elemen pemicu; base-ui menyatukan propsnya lewat `render`. */
  trigger: ReactElement;
}) {
  const router = useRouter();
  const isEdit = Boolean(user);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(user));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    // Disegarkan tiap kali dibuka, bukan saat ditutup: kalau user membatalkan
    // penyuntingan lalu membukanya lagi, yang tampil harus data tersimpan —
    // bukan sisa ketikan yang sudah ia urungkan.
    if (next) {
      setDraft(toDraft(user));
      setError(null);
    }
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      // `password` sengaja tidak ikut saat menyunting — `updateUserSchema`
      // tidak lagi mengenalnya, dan mengirimnya hanya akan diabaikan.
      const result = user
        ? await updateUser({
            user_id: user.id,
            email: draft.email,
            full_name: draft.full_name,
            phone: draft.phone,
            role: draft.role,
            vendor_id: draft.vendor_id,
          })
        : await createUser(draft);

      if (!result.ok) {
        setError(result.error?.message ?? 'Terjadi kesalahan.');
        return;
      }

      setOpen(false);
      router.refresh();
    });
  }

  const fieldId = user ? `user-${user.id}` : 'user-new';
  const needsVendor = draft.role === 'vendor';

  // Mitra yang sudah punya akun disembunyikan — kecuali milik akun yang sedang
  // disunting, kalau tidak pilihan mitranya sendiri lenyap dari daftar dan
  // penyimpanan apa pun ditolak `profiles_vendor_scope_check`.
  const vendorChoices = vendors.filter((v) => !v.takenBy || v.takenBy === user?.id);
  const noVendorAvailable = needsVendor && vendorChoices.length === 0;

  const canSubmit =
    !pending &&
    draft.email.trim().length > 0 &&
    draft.full_name.trim().length >= 2 &&
    // Hanya saat membuat: akun tanpa sandi tidak bisa dipakai siapa pun.
    // Menyunting tidak lagi menyentuh sandi sama sekali.
    (isEdit || draft.password.length >= 8) &&
    (!needsVendor || draft.vendor_id !== '');

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger render={trigger} />

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />

        <Dialog.Popup className="border-border bg-card fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border p-5 shadow-lg transition-all duration-150 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <Dialog.Title className="text-base font-semibold">
            {isEdit ? 'Ubah akun' : 'Buat akun'}
          </Dialog.Title>
          <Dialog.Description className="text-muted-foreground mt-0.5 text-sm">
            {isEdit
              ? 'Perubahan email dan peran berlaku sejak akun ini login berikutnya.'
              : 'Akun langsung aktif dan bisa dipakai login begitu disimpan.'}
          </Dialog.Description>

          {error && (
            <p className="border-destructive/20 bg-destructive/5 text-destructive mt-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}

          <form
            className="mt-4 grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div>
              <Label htmlFor={`${fieldId}-name`}>Nama lengkap</Label>
              <Input
                id={`${fieldId}-name`}
                value={draft.full_name}
                autoFocus
                onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor={`${fieldId}-email`}>Email</Label>
              <Input
                id={`${fieldId}-email`}
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor={`${fieldId}-phone`}>Nomor WhatsApp (opsional)</Label>
              <Input
                id={`${fieldId}-phone`}
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor={`${fieldId}-role`}>Peran</Label>
              <Select
                id={`${fieldId}-role`}
                value={draft.role}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    role: e.target.value as Role,
                    // Peran non-vendor tidak boleh tertaut mitra — cerminan
                    // constraint `profiles_staff_no_vendor_check`.
                    vendor_id: e.target.value === 'vendor' ? draft.vendor_id : '',
                  })
                }
                className="mt-1.5"
              >
                <option value="vendor">Vendor — pelaksana lapangan</option>
                <option value="admin">Admin — penghubung pembeli &amp; mitra</option>
                <option value="superadmin">Superadmin — akses penuh</option>
              </Select>
            </div>

            {needsVendor && (
              <div>
                <Label htmlFor={`${fieldId}-vendor`}>Mitra</Label>
                <Select
                  id={`${fieldId}-vendor`}
                  value={draft.vendor_id}
                  disabled={noVendorAvailable}
                  onChange={(e) => setDraft({ ...draft, vendor_id: e.target.value })}
                  className="mt-1.5"
                >
                  <option value="">Pilih mitra</option>
                  {vendorChoices.map((v) => (
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
                    Semua mitra aktif sudah punya akun. Daftarkan mitra baru lebih dulu di menu
                    Mitra.
                  </p>
                )}
              </div>
            )}

            {/* Sandi hanya diisi saat **membuat** akun — sesudah itu ia milik
                pemiliknya sendiri. Menyuntingnya dari sini berarti sandi
                seseorang lahir di tangan orang lain lalu disampaikan lewat
                WhatsApp atau lisan: tidak pernah benar-benar rahasia, dan tidak
                bisa dibedakan dari sandi yang bocor. Yang lupa sandinya dibantu
                lewat tombol "Kirim tautan atur ulang" di baris daftar. */}
            {!isEdit && (
              <div>
                <Label htmlFor={`${fieldId}-pass`}>Kata sandi awal</Label>
                <Input
                  id={`${fieldId}-pass`}
                  type="text"
                  value={draft.password}
                  placeholder="Minimal 8 karakter"
                  onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                  className="mt-1.5"
                />
                <p className="text-muted-foreground mt-1 text-xs">
                  Sampaikan sandi ini langsung ke pemiliknya, lalu minta ia menggantinya di menu
                  Profil Saya.
                </p>
              </div>
            )}

            <div className="mt-1 flex items-center justify-end gap-2">
              <Dialog.Close
                render={
                  <Button type="button" variant="outline" disabled={pending}>
                    Batal
                  </Button>
                }
              />
              <Button type="submit" disabled={!canSubmit}>
                {isEdit ? 'Simpan perubahan' : 'Simpan akun'}
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
