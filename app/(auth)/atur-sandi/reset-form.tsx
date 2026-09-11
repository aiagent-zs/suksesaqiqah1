'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, KeyRound } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BusyButton } from '@/components/ui/busy-button';
import { resetPassword } from '@/server/actions/auth';
import { AUTH_FIELD_CLASS } from '../auth-shell';

/**
 * Formulir kata sandi baru.
 *
 * **Tanpa sandi lama** — justru yang lupa sandinyalah yang sampai ke sini. Yang
 * membuktikan haknya adalah tautan di emailnya, yang sudah ditukar jadi sesi
 * sebelum halaman ini terbuka.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState({ new_password: '', confirm_password: '' });

  function submit() {
    setError(null);
    setFields({});
    startTransition(async () => {
      const result = await resetPassword(draft);

      if (!result.ok) {
        setError(result.message);
        setFields(result.fields ?? {});
        return;
      }

      setDraft({ new_password: '', confirm_password: '' });
      setDone(true);
      // Sesinya sudah penuh sekarang, jadi orangnya dibawa langsung masuk —
      // memintanya mengetik sandi yang baru saja ia buat hanya menambah satu
      // kesempatan salah ketik.
      router.replace('/dashboard');
      router.refresh();
    });
  }

  const canSubmit = draft.new_password.length >= 8 && draft.confirm_password.length > 0 && !done;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {error && (
        <p className="border-destructive/30 bg-destructive/10 text-destructive-foreground flex items-start gap-2 rounded-lg border px-3 py-2 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {done && (
        <p className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          <Check className="mt-0.5 size-4 shrink-0" />
          Kata sandi tersimpan. Mengalihkan ke dashboard…
        </p>
      )}

      <div>
        <Label htmlFor="new-pass" className="text-sm font-medium text-slate-200">
          Kata sandi baru
        </Label>
        <Input
          id="new-pass"
          type="password"
          autoComplete="new-password"
          autoFocus
          value={draft.new_password}
          disabled={pending || done}
          aria-invalid={Boolean(fields.new_password)}
          onChange={(e) => setDraft({ ...draft, new_password: e.target.value })}
          className={`mt-1.5 ${AUTH_FIELD_CLASS}`}
        />
        {fields.new_password ? (
          <p className="text-destructive mt-1 text-xs">{fields.new_password}</p>
        ) : (
          <p className="mt-1 text-xs text-slate-500">Minimal 8 karakter.</p>
        )}
      </div>

      <div>
        <Label htmlFor="confirm-pass" className="text-sm font-medium text-slate-200">
          Ulangi kata sandi baru
        </Label>
        <Input
          id="confirm-pass"
          type="password"
          autoComplete="new-password"
          value={draft.confirm_password}
          disabled={pending || done}
          aria-invalid={Boolean(fields.confirm_password)}
          onChange={(e) => setDraft({ ...draft, confirm_password: e.target.value })}
          className={`mt-1.5 ${AUTH_FIELD_CLASS}`}
        />
        {fields.confirm_password && (
          <p className="text-destructive mt-1 text-xs">{fields.confirm_password}</p>
        )}
      </div>

      <BusyButton
        type="submit"
        busy={pending}
        busyLabel="Menyimpan…"
        disabled={!canSubmit}
        className="w-full"
      >
        <KeyRound className="size-4" />
        Simpan kata sandi
      </BusyButton>
    </form>
  );
}
