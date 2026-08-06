import { Badge } from '@/components/ui/badge';
import {
  ANIMAL_STATUS_META,
  ORDER_STATUS_META,
  PAYMENT_STATUS_META,
  SCHEDULE_STATUS_META,
  type AnimalStatus,
  type OrderStatus,
  type PaymentStatus,
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

export function AnimalStatusBadge({ status }: { status: AnimalStatus }) {
  const meta = ANIMAL_STATUS_META[status];
  return <Badge className={meta.className}>{meta.label}</Badge>;
}

export function ScheduleStatusBadge({ status }: { status: ScheduleStatus }) {
  const meta = SCHEDULE_STATUS_META[status];
  return <Badge className={meta.className}>{meta.label}</Badge>;
}
