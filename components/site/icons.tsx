/**
 * Ikon SVG ringan (stroke-based, gaya Lucide) tanpa dependency tambahan.
 * Semua menerima className untuk ukuran/warna via Tailwind.
 */
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
};

export function IconMenu(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconWhatsApp(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.24 8.24 0 0 1-1.26-4.39c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43l-.48-.01c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.57.12.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29Z" />
    </svg>
  );
}

export function IconInstagram(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17.5 6.5h.01" />
    </svg>
  );
}

export function IconMail(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

export function IconShield(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3 5 6v6c0 4.4 3 7.5 7 9 4-1.5 7-4.6 7-9V6l-7-3Z" />
      <path d="m9.5 12 1.8 1.8 3.2-3.6" />
    </svg>
  );
}

export function IconActivity(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 12h4l2.5 7 5-14L17 12h4" />
    </svg>
  );
}

export function IconCamera(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}

export function IconFile(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function IconHeart(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 20s-7-4.4-9.2-8.6C1.3 8.7 2.7 5.5 5.8 5.5c1.9 0 3.2 1.1 4.2 2.4 1-1.3 2.3-2.4 4.2-2.4 3.1 0 4.5 3.2 3 5.9C19 15.6 12 20 12 20Z" />
    </svg>
  );
}

/** Ikon layanan. */
export function IconAqiqah(props: IconProps) {
  // kambing / hewan ternak stylized
  return (
    <svg {...base} {...props}>
      <path d="M6 8c-1.5 0-2.5-1-2.5-2.5C3.5 4 4.5 3.5 5.5 4c.4-1 1.4-1.5 2.3-1 .8-1 2.3-1 3 .2M6 8c0 1.2.4 2 1.2 2.8" />
      <path d="M8 11c0 3 1.6 5 4 5s4-2 4-5c0-1.7 1-2.5 2.2-2.5 1.3 0 2.3 1 2.3 2.4 0 1.3-.9 2.2-2 2.4" />
      <path d="M9 16v3M15 16v3" />
    </svg>
  );
}

export function IconQurban(props: IconProps) {
  // sapi / cattle stylized head
  return (
    <svg {...base} {...props}>
      <path d="M4 6c1.5 0 3 1.2 3.5 3M20 6c-1.5 0-3 1.2-3.5 3" />
      <path d="M7 9a5 5 0 0 0 10 0" />
      <path d="M7.5 9c-.9 1-1.5 2.4-1.5 4 0 3.3 2.7 6 6 6s6-2.7 6-6c0-1.6-.6-3-1.5-4" />
      <path d="M10.5 13.5h.01M13.5 13.5h.01" />
    </svg>
  );
}

export function IconSedekah(props: IconProps) {
  // hands giving / share
  return (
    <svg {...base} {...props}>
      <path d="M12 4v5m0 0 2.5-2.5M12 9 9.5 6.5" />
      <path d="M3 14l4-1.5c.6-.2 1.3-.1 1.8.3l2.2 1.7c.6.4 1.4.4 2 0l3.4-2.2c.7-.4 1.6-.2 2 .5.4.7.2 1.6-.5 2L15 20c-.8.6-1.8.8-2.8.6L6 19l-3 .8" />
    </svg>
  );
}

const iconMap = {
  aqiqah: IconAqiqah,
  qurban: IconQurban,
  sedekah: IconSedekah,
  shield: IconShield,
  activity: IconActivity,
  camera: IconCamera,
  file: IconFile,
  clock: IconClock,
  heart: IconHeart,
} as const;

export type IconName = keyof typeof iconMap;

export function Icon({ name, ...props }: IconProps & { name: IconName }) {
  const Cmp = iconMap[name];
  return <Cmp {...props} />;
}
