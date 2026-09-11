'use client';

import { useState, useTransition } from 'react';
import { AlertCircle, Check, Mail } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BusyButton } from '@/components/ui/busy-button';
import { requestPasswordReset } from '@/server/actions/auth';
import { AUTH_FIELD_CLASS } from '../auth-shell';

/**
 * Formulir permintaan tautan atur ulang.
 *
 * **Jawabannya selalu sama**, terdaftar atau tidak. Pesan yang membedakan
 * keduanya mengubah halaman ini jadi alat pemeriksa: siapa pun bisa mencoba
 * email satu per satu dan mengetahui mana yang punya akun di sini. Padahal
 * daftar akun kami memuat mitra dan staf.
 *
 * Sesudah berhasil, formulirnya diganti pesan — bukan dibiarkan terbuka dengan
 * tulisan hijau di atasnya. Yang sudah mengirim tidak perlu mengirim lagi, dan
 * kotak yang masih menganga mengundang percobaan kedua yang hanya akan menabrak
 * batas pengiriman.
 */
export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await requestPasswordReset(formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSent(result.message);
    });
  }

  if (sent) {
    return (
      <div className="space-y-3">
        <p className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-300">
          <Check className="mt-0.5 size-4 shrink-0" />
          {sent}
        </p>
        <p className="text-xs text-slate-500">
          Tautannya berlaku sekali pakai dan punya masa berlaku. Bila belum masuk dalam beberapa
          menit, periksa folder spam sebelum meminta yang baru.
        </p>
        <button
          type="button"
          onClick={() => setSent(null)}
          className="text-xs text-slate-400 underline-offset-4 transition-colors hover:text-slate-200 hover:underline"
        >
          Kirim ke email lain
        </button>
      </div>
    );
  }

  return (
    <form action={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reset-email" className="text-sm font-medium text-slate-200">
          Email akun
        </Label>
        <Input
          id="reset-email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          disabled={pending}
          placeholder="nama@zakatsukses.org"
          className={AUTH_FIELD_CLASS}
        />
      </div>

      {error && (
        <p className="border-destructive/30 bg-destructive/10 text-destructive-foreground flex items-start gap-2 rounded-lg border px-3 py-2 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      <BusyButton type="submit" busy={pending} busyLabel="Mengirim…" className="w-full">
        <Mail className="size-4" />
        Kirim tautan
      </BusyButton>
    </form>
  );
}
