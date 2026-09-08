import { ListPageSkeleton } from '@/components/data/list-page-skeleton';

export default function Loading() {
  return <ListPageSkeleton label="daftar mitra" rows={5} withFilters={false} />;
}
