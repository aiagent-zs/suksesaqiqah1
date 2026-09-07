import Image from 'next/image';

/** Logo ikon baru (`logo_new.webp`) + Teks brand di JSX. */
export function Logo({ light = false, className = '' }: { light?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image
        src="/images/logo_new.webp"
        alt="Logo Sukses Aqiqah"
        width={44}
        height={44}
        priority
        className="shrink-0 object-contain"
      />
      <span className="flex flex-col leading-tight">
        <span className="text-lg font-bold tracking-tight">
          <span className="text-[#6EAF13]">Sukses</span>{' '}
          <span className="text-[#FF7200]">Aqiqah</span>
        </span>
        <span className={`text-[11px] font-medium ${light ? 'text-white/70' : 'text-neutral-500'}`}>
          by Zakat Sukses
        </span>
      </span>
    </span>
  );
}
