import Image from 'next/image';
import type { Brand } from '@/lib/brand';

/** Logo ikon + teks merek di JSX. Merek tanpa aset logo tampil sebagai teks saja. */
export function Logo({
  brand,
  light = false,
  className = '',
}: {
  brand: Brand;
  light?: boolean;
  className?: string;
}) {
  const [first, second] = brand.wordmark;
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {brand.logo && (
        <Image
          src={brand.logo}
          alt={`Logo ${brand.name}`}
          width={44}
          height={44}
          priority
          className="shrink-0 object-contain"
        />
      )}
      <span className="flex flex-col leading-tight">
        <span className="text-lg font-bold tracking-tight">
          <span className="text-[#6EAF13]">{first}</span>{' '}
          <span className="text-[#FF7200]">{second}</span>
        </span>
        <span className={`text-[11px] font-medium ${light ? 'text-white/70' : 'text-neutral-500'}`}>
          by Zakat Sukses
        </span>
      </span>
    </span>
  );
}
