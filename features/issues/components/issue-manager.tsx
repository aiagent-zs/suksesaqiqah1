'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, AlertTriangle, Pencil, Plus, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { IssueSeverityBadge, IssueStatusBadge } from '@/components/data/status-badge';
import {
  ISSUE_SEVERITY_META,
  ISSUE_SEVERITY_ORDER,
  ISSUE_STATUS_ORDER,
  type IssueSeverity,
  type IssueStatus,
} from '@/lib/constants/order';
import { formatDateTime } from '@/lib/format';
import { reportIssue, updateIssue, updateIssueStatus } from '@/server/actions/issues';
import type { IssueRow, IssueSummary } from '../queries';

type Draft = {
  title: string;
  description: string;
  severity: IssueSeverity;
};

const EMPTY_DRAFT: Draft = { title: '', description: '', severity: 'medium' };

/**
 * Label tombol perpindahan status — kalimat perintah, bukan nama status.
 * "Selesai" sebagai tombol terbaca seperti keterangan; "Tandai selesai" jelas
 * sebuah aksi.
 */
const ISSUE_STATUS_ACTION: Record<IssueStatus, string> = {
  open: 'Buka kembali',
  in_progress: 'Tandai ditangani',
  resolved: 'Tandai selesai',
};

/**
 * Pencatatan & penanganan kendala order (`prd.md` FR-SL4).
 *
 * Inilah satu-satunya jalur pembuatan kendala di UI. Sebelum panel ini ada,
 * "Kendala Terbuka" di dashboard selalu kosong: view-nya membaca tabel `issues`
 * yang tidak pernah terisi dari aplikasi.
 *
 * Tidak ada tombol hapus — tabelnya memang tanpa kebijakan RLS `delete`; salah
 * catat dikoreksi lewat Ubah, kendala yang beres ditutup lewat Selesai.
 */
export function IssueManager({
  orderId,
  summary,
  canManage,
}: {
  orderId: string;
  summary: IssueSummary;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  /** Id kendala yang sedang disunting inline — null berarti tidak ada. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);

  function run(fn: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error?.message ?? 'Terjadi kesalahan.');
        return;
      }
      router.refresh();
    });
  }

  function closeCreate() {
    setDraft(EMPTY_DRAFT);
    setShowForm(false);
  }

  function startEdit(row: IssueRow) {
    setError(null);
    setEditingId(row.id);
    setEditDraft({
      title: row.title,
      description: row.description ?? '',
      severity: row.severity,
    });
  }

  return (
    <section className="border-border bg-card rounded-2xl border shadow-sm">
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <AlertTriangle className="text-muted-foreground size-4" />
            Kendala
          </h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {summary.openCount > 0 ? (
              <>
                {summary.openCount} kendala terbuka
                {summary.maxOpenSeverity
                  ? ` · terberat ${ISSUE_SEVERITY_META[summary.maxOpenSeverity].label.toLowerCase()}`
                  : ''}
              </>
            ) : (
              `Tidak ada kendala terbuka · ${summary.rows.length} tercatat`
            )}
          </p>
        </div>

        {canManage && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setError(null);
              setShowForm((v) => !v);
            }}
          >
            <Plus className="size-3.5" />
            Laporkan kendala
          </Button>
        )}
      </div>

      {error && (
        <p className="border-destructive/20 bg-destructive/5 text-destructive flex items-start gap-2 border-b px-5 py-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {showForm && canManage && (
        <div className="border-border bg-muted/30 grid gap-3 border-b p-4">
          <div>
            <Label htmlFor="issue-title">Judul kendala</Label>
            <Input
              id="issue-title"
              value={draft.title}
              placeholder="Mis. Hewan datang terlambat dari supplier"
              maxLength={200}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="bg-card mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="issue-severity">Tingkat keparahan</Label>
            <Select
              id="issue-severity"
              value={draft.severity}
              onChange={(e) => setDraft({ ...draft, severity: e.target.value as IssueSeverity })}
              className="bg-card mt-1.5"
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
            <Label htmlFor="issue-description">Deskripsi (opsional)</Label>
            <Textarea
              id="issue-description"
              value={draft.description}
              placeholder="Detail kendala dan tindakan yang sudah diambil"
              maxLength={2000}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              className="bg-card mt-1.5"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              disabled={pending || draft.title.trim().length < 3}
              onClick={() =>
                run(async () => {
                  const result = await reportIssue({
                    order_id: orderId,
                    title: draft.title,
                    description: draft.description,
                    severity: draft.severity,
                  });
                  if (result.ok) closeCreate();
                  return result;
                })
              }
            >
              Simpan kendala
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={closeCreate}>
              Batal
            </Button>
          </div>
        </div>
      )}

      {summary.rows.length === 0 ? (
        <p className="text-muted-foreground flex items-center justify-center gap-2 px-5 py-10 text-center text-sm">
          <ShieldCheck className="text-primary size-4" />
          Belum ada kendala tercatat pada order ini.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {summary.rows.map((row) => (
            <li key={row.id} className="px-5 py-4">
              {editingId === row.id && canManage ? (
                <div className="grid gap-3">
                  <div>
                    <Label htmlFor={`issue-edit-title-${row.id}`}>Judul kendala</Label>
                    <Input
                      id={`issue-edit-title-${row.id}`}
                      value={editDraft.title}
                      maxLength={200}
                      onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <Label htmlFor={`issue-edit-severity-${row.id}`}>Tingkat keparahan</Label>
                    <Select
                      id={`issue-edit-severity-${row.id}`}
                      value={editDraft.severity}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, severity: e.target.value as IssueSeverity })
                      }
                      className="mt-1.5"
                    >
                      {ISSUE_SEVERITY_ORDER.map((severity) => (
                        <option key={severity} value={severity}>
                          {ISSUE_SEVERITY_META[severity].label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor={`issue-edit-desc-${row.id}`}>Deskripsi</Label>
                    <Textarea
                      id={`issue-edit-desc-${row.id}`}
                      value={editDraft.description}
                      maxLength={2000}
                      onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending || editDraft.title.trim().length < 3}
                      onClick={() =>
                        run(async () => {
                          const result = await updateIssue({
                            id: row.id,
                            title: editDraft.title,
                            description: editDraft.description,
                            severity: editDraft.severity,
                          });
                          if (result.ok) setEditingId(null);
                          return result;
                        })
                      }
                    >
                      Simpan perubahan
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => setEditingId(null)}
                    >
                      Batal
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-40 flex-1 font-medium">{row.title}</p>
                    <div className="flex shrink-0 items-center gap-2">
                      <IssueSeverityBadge severity={row.severity} />
                      <IssueStatusBadge status={row.status} />
                    </div>
                  </div>

                  {row.description && (
                    <p className="text-muted-foreground mt-1.5 text-sm whitespace-pre-wrap">
                      {row.description}
                    </p>
                  )}

                  <p className="text-muted-foreground mt-1.5 text-xs">
                    Dilaporkan {formatDateTime(row.createdAt)}
                    {row.reporterName ? ` oleh ${row.reporterName}` : ''}
                    {row.resolvedAt
                      ? ` · Selesai ${formatDateTime(row.resolvedAt)}${
                          row.resolverName ? ` oleh ${row.resolverName}` : ''
                        }`
                      : ''}
                  </p>

                  {canManage && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {/* Hanya status selain yang sekarang yang ditawarkan —
                          menulis ulang status yang sama ditolak server karena
                          akan menggeser waktu penyelesaian. */}
                      {ISSUE_STATUS_ORDER.filter((status) => status !== row.status).map(
                        (status) => (
                          <Button
                            key={status}
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={pending}
                            onClick={() => run(() => updateIssueStatus({ id: row.id, status }))}
                          >
                            {ISSUE_STATUS_ACTION[status]}
                          </Button>
                        ),
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => startEdit(row)}
                      >
                        <Pencil className="size-3.5" />
                        Ubah
                      </Button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
