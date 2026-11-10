import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Kerangka halaman masuk, lupa sandi, dan atur sandi.
 *
 * Ketiganya bagian dari satu perjalanan — gagal masuk, minta tautan, buat sandi
 * baru, masuk — jadi berpindah di antaranya tidak boleh terasa seperti
 * berpindah aplikasi. Latar, logo, dan kartunya disatukan di sini supaya tidak
 * ada satu pun yang diam-diam tertinggal saat yang lain diubah.
 *
 * Kelas medan isian ikut diekspor: ketiga halaman memakai `<Input>` dengan
 * warna gelap yang sama, dan menyalinnya tiga kali adalah cara termudah
 * membuat satu halaman terlihat berbeda tanpa ada yang sadar.
 */
export const AUTH_FIELD_CLASS =
  'h-11 rounded-lg border-line bg-white text-ink placeholder:text-ink-muted/70 focus-visible:border-primary focus-visible:ring-primary/30';

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  /** Baris di bawah kartu — tautan kembali, keterangan hak cipta. */
  footer?: React.ReactNode;
}) {
  return (
    <div className="bg-surface-muted flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <div className="border-line mb-2 inline-flex size-16 items-center justify-center rounded-lg border bg-white p-1.5">
            <Image
              src="/images/logo_new.webp"
              alt="Logo Sukses Aqiqah"
              width={64}
              height={64}
              priority
              className="h-full w-full object-contain"
            />
          </div>
          <h1 className="text-h2 font-bold tracking-tight">
            <span className="text-[#6EAF13]">Sukses</span>{' '}
            <span className="text-[#FF7200]">Aqiqah</span>
          </h1>
          <p className="text-ink-muted text-sm">Masuk untuk tim & mitra pelaksana</p>
        </div>

        <Card className="border-line rounded-lg bg-white shadow-sm">
          <CardHeader className="space-y-1.5 pb-4">
            <CardTitle className="text-ink text-xl font-semibold tracking-tight">{title}</CardTitle>
            <CardDescription className="text-ink-muted text-sm">{description}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">{children}</CardContent>
        </Card>

        {footer}
      </div>
    </div>
  );
}
