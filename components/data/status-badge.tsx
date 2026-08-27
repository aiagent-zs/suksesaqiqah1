import { Badge } from '@/components/ui/badge';
import {
  DOC_STATUS_META,
  ISSUE_SEVERITY_META,
  ISSUE_STATUS_META,
  ORDER_STATUS_META,
  PAYMENT_STATUS_META,
  PAYMENT_VERIFICATION_META,
  type DocStatus,
  type IssueSeverity,
  type IssueStatus,
  type OrderStatus,
  type PaymentStatus,
  type PaymentVerificationStatus,
} from '@/lib/constants/order';

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const meta = ORDER_STATUS_META[status];
  return <Badge className={meta.className}>{meta.label}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const meta = PAYMENT_STATUS_META[status];
  return <Badge className={meta.className}>{meta.label}</Badge>;
}

/** Status validasi 2 tingkat dokumentasi (docs/10 section 6). */
export function DocStatusBadge({ status }: { status: DocStatus }) {
  const meta = DOC_STATUS_META[status];
  return <Badge className={meta.className}>{meta.label}</Badge>;
}

/** Status satu baris pembayaran — bukan `payment_status` order (lihat konstanta). */
export function PaymentVerificationBadge({ status }: { status: PaymentVerificationStatus }) {
  const meta = PAYMENT_VERIFICATION_META[status];
  return <Badge className={meta.className}>{meta.label}</Badge>;
}


/** Tingkat keparahan kendala — sama dengan yang dipakai panel dashboard. */
export function IssueSeverityBadge({ severity }: { severity: IssueSeverity }) {
  const meta = ISSUE_SEVERITY_META[severity];
  return <Badge className={meta.className}>{meta.label}</Badge>;
}

/** Status penanganan satu kendala — bukan tingkat keparahannya. */
export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  const meta = ISSUE_STATUS_META[status];
  return <Badge className={meta.className}>{meta.label}</Badge>;
}
