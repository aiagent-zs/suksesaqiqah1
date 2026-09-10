'use client';

import { useState, useTransition } from 'react';
import { AlertCircle, Check, KeyRound, Mail } from 'lucide-react';
import { BusyButton } from '@/components/ui/busy-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { changeOwnEmail, changeOwnPassword } from '@/server/actions/account';

type Result = {
  ok: boolean;
  error?: { message: string; fields?: Record<string, string> };
};

/** Satu medan beserta pesan galatnya sendiri. */
function Field({
  id,
  label,
  type,
  value,
  error,
  hint,
  autoComplete,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  error?: string;
  hint?: string;
  autoComplete: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5"
      />
      {hint && !error && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
      {error && <p className="text-destructive mt-1 text-xs">{error}</p>}
    </div>
  );
}

/**
 * Ganti kata sandi akun sendiri.
 *
 * **Sandi lama diminta**, meski Supabase tidak menuntutnya:
 * `auth.updateUser()` menerima sesi hidup begitu saja. Tanpa pemeriksaan itu,
 * laptop yang ditinggal terbuka sebentar cukup untuk mengganti sandi
 * pemiliknya — dan mengunci dia keluar dari akunnya sendiri.
 */
export function ChangePasswordForm() {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const set = (key: keyof typeof draft) => (v: string) => {
    setDraft((d) => ({ ...d, [key]: v }));
    setDone(false);
  };

  function submit() {
    setError(null);
    setFields({});
    startTransition(async () => {
      const result: Result = await changeOwnPassword(draft);
      if (!result.ok) {
        setError(result.error?.message ?? 'Terjadi kesalahan.');
        setFields(result.error?.fields ?? {});
        return;
      }
      // Dikosongkan sesudah berhasil: sandi yang tertinggal di form adalah
      // sandi yang terbaca orang berikutnya yang lewat.
      setDraft({ current_password: '', new_password: '', confirm_password: '' });
      setDone(true);
    });
  }

  const canSubmit =
    draft.current_password.length > 0 &&
    draft.new_password.length >= 8 &&
    draft.confirm_password.length > 0;

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {error && (
        <p className="border-destructive/20 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {done && (
        <p className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <Check className="mt-0.5 size-4 shrink-0" />
          Kata sandi berhasil diganti. Pakai yang baru saat masuk berikutnya.
        </p>
      )}

      <Field
        id="cur-pass"
        label="Kata sandi saat ini"
        type="password"
        autoComplete="current-password"
        value={draft.current_password}
        error={fields.current_password}
        disabled={pending}
        onChange={set('current_password')}
      />
      <Field
        id="new-pass"
        label="Kata sandi baru"
        type="password"
        autoComplete="new-password"
        hint="Minimal 8 karakter."
        value={draft.new_password}
        error={fields.new_password}
        disabled={pending}
        onChange={set('new_password')}
      />
      <Field
        id="confirm-pass"
        label="Ulangi kata sandi baru"
        type="password"
        autoComplete="new-password"
        value={draft.confirm_password}
        error={fields.confirm_password}
        disabled={pending}
        onChange={set('confirm_password')}
      />

      <div className="mt-1">
        <BusyButton type="submit" busy={pending} busyLabel="Mengganti…" disabled={!canSubmit}>
          <KeyRound className="size-3.5" />
          Ganti kata sandi
        </BusyButton>
      </div>
    </form>
  );
}

/**
 * Ganti email akun sendiri.
 *
 * Perpindahannya **tidak seketika** — Supabase mengirim tautan konfirmasi ke
 * alamat baru, dan email lama tetap berlaku sampai tautannya diklik. Pesan
 * berhasilnya karena itu berbunyi "cek email", bukan "tersimpan": mengatakan
 * tersimpan membuat orang mengira sudah bisa masuk dengan alamat baru, lalu
 * gagal tanpa tahu sebabnya.
 */
export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const [pending, startTransition] = useTransition();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState({ new_email: '', current_password: '' });

  const set = (key: keyof typeof draft) => (v: string) => {
    setDraft((d) => ({ ...d, [key]: v }));
    setSentTo(null);
  };

  function submit() {
    setError(null);
    setFields({});
    startTransition(async () => {
      const result = await changeOwnEmail(draft);
      if (!result.ok) {
        setError(result.error?.message ?? 'Terjadi kesalahan.');
        setFields(result.error?.fields ?? {});
        return;
      }
      setSentTo(result.data.sentTo);
      setDraft({ new_email: '', current_password: '' });
    });
  }

  const canSubmit = draft.new_email.includes('@') && draft.current_password.length > 0;

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div>
        <Label>Email saat ini</Label>
        <p className="bg-muted/50 mt-1.5 rounded-lg px-3 py-2 text-sm">{currentEmail}</p>
      </div>

      {error && (
        <p className="border-destructive/20 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {sentTo && (
        <p className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <Check className="mt-0.5 size-4 shrink-0" />
          <span>
            Tautan konfirmasi dikirim ke <strong>{sentTo}</strong>. Emailnya baru berpindah setelah
            tautan itu diklik — sampai saat itu, tetap masuk dengan email lama.
          </span>
        </p>
      )}

      <Field
        id="new-email"
        label="Email baru"
        type="email"
        autoComplete="email"
        value={draft.new_email}
        error={fields.new_email}
        disabled={pending}
        onChange={set('new_email')}
      />
      <Field
        id="email-pass"
        label="Kata sandi"
        type="password"
        autoComplete="current-password"
        hint="Diminta karena email adalah identitas login sekaligus alamat pemulihan akun."
        value={draft.current_password}
        error={fields.current_password}
        disabled={pending}
        onChange={set('current_password')}
      />

      <div className="mt-1">
        <BusyButton type="submit" busy={pending} busyLabel="Mengirim…" disabled={!canSubmit}>
          <Mail className="size-3.5" />
          Kirim tautan konfirmasi
        </BusyButton>
      </div>
    </form>
  );
}
