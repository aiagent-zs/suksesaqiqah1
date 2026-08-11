'use client';

import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@base-ui/react/dialog';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  ISSUE_SEVERITY_META,
  ISSUE_SEVERITY_ORDER,
  type IssueSeverity,
} from '@/lib/constants/order';
import { createIssueAction, updateIssueAction } from '@/server/actions/issues';
import type { IssueRow } from '../queries';

type Draft = {
  title: string;
  description: string;
  severity: IssueSeverity;
};

function toDraft(issue?: IssueRow): Draft {
  return {
    title: issue?.title ?? '',
    description: issue?.description ?? '',
    severity: issue?.severity ?? 'medium',
  };
}

/**
 * Form kendala dalam dialog — dipakai untuk **melaporkan** kendala baru dan
 * **mengoreksi** kendala yang sudah ada (`prd.md` FR-SL4).
 *
 * Keduanya satu komponen karena medannya identik; yang membedakan hanya action
 * tujuannya. Memisahkannya jadi dua berkas berarti dua salinan validasi yang
 * bisa berbeda diam-diam.
 *
 * `status` sengaja tidak ada di form ini. Menyatakan kendala selesai adalah
 * keputusan terpisah yang harus mencatat siapa penyelesainya, jadi jalurnya
 * lewat tombol status di panel, bukan lewat penyuntingan teks.
 */
export function IssueDialog({
  orderId,
  issue,
  trigger,
}: {
  orderId: string;
  /** Diisi = mode ubah. Dikosongkan = mode laporkan baru. */
  issue?: IssueRow;
  /** Elemen pemicu; base-ui menyatukan propsnya lewat `render`. */
  trigger: ReactElement;
}) {
  const router = useRouter();
  const isEdit = Boolean(issue);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(issue));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    // Disegarkan tiap kali dibuka, bukan saat ditutup: kalau user membatalkan
    // penyuntingan lalu membukanya lagi, yang tampil harus data tersimpan —
    // bukan sisa ketikan yang sudah ia urungkan.
    if (next) {
      setDraft(toDraft(issue));
      setError(null);
    }
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = issue
        ? await updateIssueAction({
            id: issue.id,
            title: draft.title,
            description: draft.description,
            severity: draft.severity,
          })
        : await createIssueAction({
            order_id: orderId,
            title: draft.title,
            description: draft.description,
            severity: draft.severity,
          });

      if (!result.ok) {
        setError(result.error?.message ?? 'Terjadi kesalahan.');
        return;
      }

      setOpen(false);
      router.refresh();
    });
  }

  const fieldId = issue ? `issue-${issue.id}` : 'issue-new';

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger render={trigger} />

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />

        <Dialog.Popup className="border-border bg-card fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border p-5 shadow-lg transition-all duration-150 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <Dialog.Title className="text-base font-semibold">
            {isEdit ? 'Ubah kendala' : 'Laporkan kendala'}
          </Dialog.Title>
          <Dialog.Description className="text-muted-foreground mt-0.5 text-sm">
            {isEdit
              ? 'Koreksi isi kendala. Status penanganannya diubah lewat tombol di panel.'
              : 'Kendala baru selalu tercatat sebagai Terbuka dan langsung terhitung di dashboard.'}
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
              <Label htmlFor={`${fieldId}-title`}>Judul kendala</Label>
              <Input
                id={`${fieldId}-title`}
                value={draft.title}
                placeholder="Mis. Hewan datang terlambat dari supplier"
                maxLength={200}
                autoFocus
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor={`${fieldId}-severity`}>Tingkat keparahan</Label>
              <Select
                id={`${fieldId}-severity`}
                value={draft.severity}
                onChange={(e) => setDraft({ ...draft, severity: e.target.value as IssueSeverity })}
                className="mt-1.5"
              >
                {ISSUE_SEVERITY_ORDER.map((severity) => (
                  <option key={severity} value={severity}>
                    {ISSUE_SEVERITY_META[severity].label}
                  </option>
                ))}
              </Select>
              <p className="text-muted-foreground mt-1 text-xs">
                Kendala berat muncul paling atas di panel dashboard.
              </p>
            </div>

            <div>
              <Label htmlFor={`${fieldId}-description`}>Deskripsi (opsional)</Label>
              <Textarea
                id={`${fieldId}-description`}
                value={draft.description}
                placeholder="Detail kendala dan tindakan yang sudah diambil"
                maxLength={2000}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                className="mt-1.5"
              />
            </div>

            <div className="mt-1 flex items-center justify-end gap-2">
              <Dialog.Close
                render={
                  <Button type="button" variant="outline" disabled={pending}>
                    Batal
                  </Button>
                }
              />
              {/* Judul di bawah 3 karakter ditolak schema; tombolnya dimatikan
                  supaya penolakannya tidak perlu lewat perjalanan ke server. */}
              <Button type="submit" disabled={pending || draft.title.trim().length < 3}>
                {isEdit ? 'Simpan perubahan' : 'Simpan kendala'}
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
