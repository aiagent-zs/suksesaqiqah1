import { siteConfig } from '@/lib/constants/site';

/** Logo teks + lambang Sukses Aqiqah. */
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="bg-primary inline-flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          {/* bulan sabit + daun: ibadah & manfaat */}
          <path
            d="M16.5 4.5a7.5 7.5 0 1 0 3 6c-3.6 1.3-7-1-7-4.5 0-.6.1-1.1.3-1.6-.1 0-.2.1-.3.1"
            fill="currentColor"
            opacity="0.95"
          />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={`text-base font-bold tracking-tight ${light ? 'text-white' : 'text-neutral-900'}`}
        >
          {siteConfig.name}
        </span>
        <span className={`text-[11px] font-medium ${light ? 'text-white/70' : 'text-neutral-500'}`}>
          by Zakat Sukses
        </span>
      </span>
    </span>
  );
}
