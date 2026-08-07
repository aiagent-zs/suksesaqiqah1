import { Badge } from '@/components/ui/badge';
import {
  ANIMAL_STATUS_META,
  DOC_STATUS_META,
  ORDER_STATUS_META,
  PAYMENT_STATUS_META,
  PAYMENT_VERIFICATION_META,
  SCHEDULE_STATUS_META,
  type AnimalStatus,
  type DocStatus,
  type OrderStatus,
  type PaymentStatus,
  type PaymentVerificationStatus,
  type ScheduleStatus,
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

export function AnimalStatusBadge({ status }: { status: AnimalStatus }) {
  const meta = ANIMAL_STATUS_META[status];
  return <Badge className={meta.className}>{meta.label}</Badge>;
}

export function ScheduleStatusBadge({ status }: { status: ScheduleStatus }) {
  const meta = SCHEDULE_STATUS_META[status];
  return <Badge className={meta.className}>{meta.label}</Badge>;
}
