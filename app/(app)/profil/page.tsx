import { ShieldCheck } from 'lucide-react';
import { requireAuth } from '@/server/auth/session';
import { ROLE_LABEL } from '@/lib/constants/roles';
import { Badge } from '@/components/ui/badge';
import { ChangeEmailForm, ChangePasswordForm } from '@/features/users/components/account-forms';

export const metadata = { title: 'Profil Saya' };

/**
 * Profil akun sendiri — kredensial, bukan kewenangan.
 *
 * Terbuka untuk **semua role**, mitra termasuk: pemilik akun berhak mengurus
 * sandi dan emailnya tanpa menunggu superadmin. Sampai halaman ini ada,
 * satu-satunya jalan mengganti sandi adalah meminta superadmin melakukannya
 * lewat `/users` — yang berarti sandi barunya lewat tangan orang lain.
 *
 * ## Yang sengaja tidak ada di sini
 *
 * **Role dan status aktif.** Keduanya hanya bisa diubah superadmin di
 * `/users`. Kalau bisa diubah sendiri, mitra tinggal menaikkan dirinya jadi
 * superadmin dan seluruh margin serta data pemesan terbuka — RLS memutuskan
 * aksesnya dari `profiles.role`, jadi menulisnya sendiri sama dengan menulis
 * izinnya sendiri. Rolenya ditampilkan sebagai keterangan saja.
 *
 * **Nama dan nomor telepon.** Belum diminta; tidak ditambahkan hanya karena
 * kolomnya ada.
 */
export default async function ProfilPage() {
  const session = await requireAuth();
  const profile = session.profile;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Profil Saya</h1>
        <p className="text-muted-foreground mt-1 text-sm">Kelola kredensial akun Anda sendiri.</p>
      </header>

      <section className="border-border bg-card rounded-lg border p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Akun
            </p>
            <p className="mt-1 text-lg font-medium">{profile?.full_name ?? '-'}</p>
            <p className="text-muted-foreground mt-0.5 text-sm break-all">{session.email}</p>
          </div>
          {profile?.role && (
            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">
              {ROLE_LABEL[profile.role]}
            </Badge>
          )}
        </div>

        {/* Dikatakan terang-terangan, bukan dibiarkan jadi tebakan: orang yang
            mencari cara mengubah rolenya sendiri lebih baik menemukan
            jawabannya di sini daripada mencarinya di setiap halaman. */}
        <p className="text-muted-foreground mt-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          Peran dan status akun hanya dapat diubah superadmin. Hubungi superadmin bila perlu
          diperbarui.
        </p>
      </section>

      <section className="border-border bg-card rounded-lg border shadow-sm">
        <div className="border-border border-b px-5 py-4">
          <h2 className="text-base font-semibold">Kata sandi</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Kata sandi saat ini diminta sebagai pembuktian bahwa ini memang Anda.
          </p>
        </div>
        <div className="px-5 py-4">
          <ChangePasswordForm />
        </div>
      </section>

      <section className="border-border bg-card rounded-lg border shadow-sm">
        <div className="border-border border-b px-5 py-4">
          <h2 className="text-base font-semibold">Email</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Email dipakai untuk masuk. Perpindahannya perlu dikonfirmasi dari alamat baru.
          </p>
        </div>
        <div className="px-5 py-4">
          <ChangeEmailForm currentEmail={session.email ?? ''} />
        </div>
      </section>
    </div>
  );
}
