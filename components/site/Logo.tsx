import Image from 'next/image';
import { siteConfig } from '@/lib/constants/site';

/** Logo ikon (`logo-icon.svg`) + Teks brand di JSX. */
export function Logo({
  light = false,
  className = '',
}: {
  light?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image
        src="/images/logo-icon.svg"
        alt="Logo Sukses Aqiqah"
        width={36}
        height={36}
        priority
        className="h-9 w-auto shrink-0 object-contain"
      />
      <span className="flex flex-col leading-none">
        <span className="text-base font-bold tracking-tight">
          <span className={light ? 'text-[#91C416]' : 'text-[#91C416]'}>
            Sukses
          </span>{' '}
          <span className={light ? 'text-[#FA8202]' : 'text-[#FA8202]'}>
            Aqiqah
          </span>
        </span>
        <span
          className={`text-[11px] font-medium ${
            light ? 'text-white/70' : 'text-neutral-500'
          }`}
        >
          by Zakat Sukses
        </span>
      </span>
    </span>
  );
}


