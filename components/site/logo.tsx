import Image from 'next/image';

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
        width={34}
        height={36}
        priority
        className="shrink-0 object-contain"
      />
      <span className="flex flex-col leading-none">
        {/* Warna brand pada logo tidak ikut berubah di latar gelap — keduanya
            sudah cukup kontras di atas terang maupun gelap, dan mengubahnya
            akan membuat logo terbaca sebagai merek yang berbeda. Yang
            menyesuaikan hanya baris "by Zakat Sukses" di bawahnya. */}
        <span className="text-base font-bold tracking-tight">
          <span className="text-[#91C416]">Sukses</span>{' '}
          <span className="text-[#FA8202]">Aqiqah</span>
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


