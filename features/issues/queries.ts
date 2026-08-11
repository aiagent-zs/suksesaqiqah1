import 'server-only';
import { createClient } from '@/lib/supabase/server';
import {
  ISSUE_OPEN_STATUSES,
  ISSUE_SEVERITY_ORDER,
  type IssueSeverity,
  type IssueStatus,
} from '@/lib/constants/order';

export type IssueRow = {
  id: string;
  title: string;
  description: string | null;
  severity: IssueSeverity;
  status: IssueStatus;
  reporterName: string | null;
  resolverName: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

export type IssueSummary = {
  rows: IssueRow[];
  /** Kendala berstatus `open` / `in_progress` — definisi yang sama dengan dashboard. */
  openCount: number;
  /** Keparahan terberat di antara yang masih terbuka; null kalau tidak ada. */
  maxOpenSeverity: IssueSeverity | null;
};

const EMPTY: IssueSummary = { rows: [], openCount: 0, maxOpenSeverity: null };

// Dua FK menunjuk `profiles` (reported_by & resolved_by), jadi masing-masing
// embed harus menyebut nama constraint-nya — tanpa itu PostgREST menolak query
// karena hubungannya ambigu.
const ISSUE_SELECT = `
  id, title, description, severity, status, created_at, resolved_at,
  reporter:profiles!issues_reported_by_fkey ( full_name ),
  resolver:profiles!issues_resolved_by_fkey ( full_name )
`;

type RawIssue = {
  id: string;
  title: string;
  description: string | null;
  severity: IssueSeverity;
  status: IssueStatus;
  created_at: string;
  resolved_at: string | null;
  reporter: { full_name: string | null } | null;
  resolver: { full_name: string | null } | null;
};

/**
 * Kendala satu order (`prd.md` FR-SL4).
 *
 * Urutannya: yang belum selesai lebih dulu (`status` mengikuti urutan enum
 * `open → in_progress → resolved`), lalu yang paling berat, lalu yang terbaru —
 * sama seperti cara panel dashboard membaca kendala.
 */
export async function getOrderIssues(orderId: string): Promise<IssueSummary> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('issues')
    .select(ISSUE_SELECT)
    .eq('order_id', orderId)
    .order('status', { ascending: true })
    .order('severity', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) return EMPTY;

  const rows = ((data ?? []) as unknown as RawIssue[]).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    severity: r.severity,
    status: r.status,
    reporterName: r.reporter?.full_name ?? null,
    resolverName: r.resolver?.full_name ?? null,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
  }));

  const open = rows.filter((r) => ISSUE_OPEN_STATUSES.includes(r.status));

  return {
    rows,
    openCount: open.length,
    // ISSUE_SEVERITY_ORDER sudah terurut berat → ringan, jadi yang pertama
    // ketemu adalah yang terberat.
    maxOpenSeverity: ISSUE_SEVERITY_ORDER.find((s) => open.some((r) => r.severity === s)) ?? null,
  };
}
