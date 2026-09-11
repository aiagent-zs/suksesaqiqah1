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
  'h-11 rounded-lg border-[#213145] bg-[#0b1c30]/80 text-white placeholder:text-slate-500 focus-visible:border-[#16A34A] focus-visible:ring-[#16A34A]';

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
    <div className="flex min-h-screen items-center justify-center bg-[#0b1c30] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#004d1f] via-[#0b1c30] to-[#051120] p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <div className="mb-2 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 p-1.5 shadow-lg ring-1 shadow-emerald-900/50 ring-white/20 backdrop-blur-sm">
            <Image
              src="/images/logo_new.webp"
              alt="Logo Sukses Aqiqah"
              width={64}
              height={64}
              priority
              className="h-full w-full object-contain"
            />
          </div>
          <h1 className="font-sans text-3xl font-bold tracking-tight text-white">
            <span className="text-[#6EAF13]">Sukses</span>{' '}
            <span className="text-[#FF7200]">Aqiqah</span>
          </h1>
          <p className="text-xs font-semibold tracking-wider text-emerald-400 uppercase">
            Command Center · Tebarkan Manfaat
          </p>
        </div>

        <Card className="rounded-2xl border-[#213145] bg-[#15273e]/90 shadow-2xl backdrop-blur-xl">
          <CardHeader className="space-y-1.5 pb-4">
            <CardTitle className="text-xl font-semibold tracking-tight text-white">
              {title}
            </CardTitle>
            <CardDescription className="text-sm text-slate-400">{description}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">{children}</CardContent>
        </Card>

        {footer}
      </div>
    </div>
  );
}
