import { notFound } from 'next/navigation';
import { CheckCircle2, Download, MapPin, ShieldCheck } from 'lucide-react';
import { getPublicReport } from '@/server/services/public-report';
import { ANIMAL_SPECIES_LABEL, DOC_STAGE_LABEL } from '@/lib/constants/order';
import { formatDate, formatDateTime, formatTime } from '@/lib/format';

type Params = Promise<{ token: string }>;

/**
 * Halaman laporan peserta tanpa login (docs/11 section 5).
 *
 * Sengaja `noindex`: tautannya dibagikan langsung ke peserta dan isinya memuat
 * nama serta pelaksanaan ibadah mereka — tidak boleh masuk hasil pencarian.
 */
export const metadata = {
  title: 'Laporan Pelaksanaan — Sukses Aqiqah',
  robots: { index: false, follow: false },
};

/** Label tahap untuk halaman publik. */
const STAGE_LABEL_PUBLIC: Record<string, string> = {
  persiapan: 'Persiapan',
  sembelih: 'Penyembelihan',
  masak: 'Pengolahan',
  salur: 'Penyaluran ke penerima',
  kirim: 'Pengiriman',
  terkirim: 'Sampai di alamat',
};

export default async function PublicReportPage({ params }: { params: Params }) {
  const { token } = await params;
  const report = await getPublicReport(token);

  // Token tak dikenal, terlalu pendek, atau laporannya belum dibuat —
  // ketiganya menghasilkan 404 yang sama agar tidak ada isyarat yang bisa
  // dipakai menebak token (docs/11 section 6).
  if (!report) notFound();

  const photos = report.media.filter((m) => m.type === 'photo' && m.url);
  const videos = report.media.filter((m) => m.type === 'video' && m.url);
  const notes = report.media.filter((m) => m.type === 'note' && m.caption);

  const animalSummary = Object.entries(
    report.animals.reduce<Record<string, number>>((acc, a) => {
      const label = ANIMAL_SPECIES_LABEL[a.species];
      acc[label] = (acc[label] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([label, count]) => `${count} ${label}`)
    .join(', ');

  const onBehalf = report.animals.map((a) => a.onBehalfOf).filter((v): v is string => Boolean(v));

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-10 sm:px-6">
      <header className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <p className="text-sm font-semibold tracking-wider text-emerald-700 uppercase">
          Sukses Aqiqah
        </p>
        <h1 className="mt-1 text-2xl font-bold text-emerald-900">Laporan Pelaksanaan</h1>
        <p className="mt-2 text-sm text-emerald-800 tabular-nums">
          {report.orderNumber}
          {report.report ? ` · versi ${report.report.version}` : ''}
          {report.vendorName ? ` · ${report.vendorName}` : ''}
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs text-emerald-800">
          <ShieldCheck className="size-3.5" />
          Seluruh bukti telah melalui validasi dua tingkat
        </p>
      </header>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">Ringkasan</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex gap-3">
            <dt className="w-36 shrink-0 text-slate-500">Peserta</dt>
            <dd className="font-medium text-slate-900">{report.participantName ?? '-'}</dd>
          </div>
          {onBehalf.length > 0 && (
            <div className="flex gap-3">
              <dt className="w-36 shrink-0 text-slate-500">Atas nama</dt>
              <dd className="text-slate-900">{onBehalf.join(', ')}</dd>
            </div>
          )}
          {/* Disembunyikan saat kosong, bukan ditampilkan sebagai "-": order
              qurban tidak punya anak, dan order sebelum 19 Agustus 2026 tidak
              pernah menanyakannya. */}
          {(report.childBirthPlace || report.childBirthDate) && (
            <div className="flex gap-3">
              <dt className="w-36 shrink-0 text-slate-500">Tempat, tanggal lahir</dt>
              <dd className="text-slate-900">
                {[
                  report.childBirthPlace,
                  report.childBirthDate ? formatDate(report.childBirthDate) : null,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </dd>
            </div>
          )}
          <div className="flex gap-3">
            <dt className="w-36 shrink-0 text-slate-500">Layanan</dt>
            <dd className="text-slate-900">
              {report.services.map((s) => `${s.name} (${s.qty})`).join(', ') || '-'}
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-36 shrink-0 text-slate-500">Hewan</dt>
            <dd className="text-slate-900">{animalSummary || '-'}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-36 shrink-0 text-slate-500">Lokasi</dt>
            <dd className="flex items-center gap-1.5 text-slate-900">
              <MapPin className="size-3.5 text-slate-400" />
              {report.schedule?.locationName ?? '-'}
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-36 shrink-0 text-slate-500">Tanggal pelaksanaan</dt>
            <dd className="text-slate-900">
              {report.schedule?.scheduledDate ? formatDate(report.schedule.scheduledDate) : '-'}
              {report.schedule?.scheduledTime
                ? ` · ${formatTime(report.schedule.scheduledTime)}`
                : ''}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">Status Pelaksanaan</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              label: 'Dipotong',
              value: `${report.progress.animalsSlaughtered}/${report.progress.animalsTotal} ekor`,
            },
            {
              label: 'Terdistribusi',
              value: `${report.progress.animalsDistributed}/${report.progress.animalsTotal} ekor`,
            },
            {
              label: 'Tahap selesai',
              value: `${report.progress.stagesValidated}/${report.progress.stagesTotal} tahap`,
            },
          ].map((cell) => (
            <div key={cell.label} className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-xs text-slate-500">{cell.label}</p>
              <p className="mt-0.5 font-semibold text-slate-900 tabular-nums">{cell.value}</p>
            </div>
          ))}
        </div>
      </section>

      {photos.length > 0 && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-900">Galeri Bukti</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((m, i) => (
              <figure key={i}>
                {/* Signed URL berumur pendek — sengaja bukan next/image, agar
                    tidak ada salinan hasil optimasi yang bertahan setelah
                    tautannya kedaluwarsa (docs/10 section 8). */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.url!}
                  alt={m.caption ?? `Bukti ${DOC_STAGE_LABEL[m.stage]}`}
                  loading="lazy"
                  className="aspect-4/3 w-full rounded-xl object-cover"
                />
                <figcaption className="mt-1 text-xs text-slate-500">
                  {DOC_STAGE_LABEL[m.stage]}
                  {m.caption ? ` · ${m.caption}` : ''}
                </figcaption>
              </figure>
            ))}
          </div>

          {videos.length > 0 && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {videos.map((m, i) => (
                <figure key={i}>
                  <video src={m.url!} controls preload="metadata" className="w-full rounded-xl" />
                  <figcaption className="mt-1 text-xs text-slate-500">
                    {DOC_STAGE_LABEL[m.stage]}
                    {m.caption ? ` · ${m.caption}` : ''}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>
      )}

      {report.stages.length > 0 && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-900">Tahap Pelaksanaan</h2>
          <p className="mt-1 text-sm text-slate-500">
            Setiap tahap di bawah sudah diperiksa dan divalidasi tim kami.
          </p>
          <ol className="mt-4 divide-y divide-slate-100">
            {report.stages.map((s, i) => (
              <li key={i} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                <div>
                  <p className="font-medium text-slate-900">
                    {STAGE_LABEL_PUBLIC[s.stage] ?? s.stage}
                  </p>
                  {s.notes && <p className="mt-0.5 text-xs text-slate-500">{s.notes}</p>}
                </div>
                <span className="shrink-0 text-xs text-slate-500 tabular-nums">
                  {s.occurredAt ? formatDate(s.occurredAt) : '-'}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {notes.length > 0 && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-900">Catatan Lapangan</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {notes.map((m, i) => (
              <li key={i} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <span>
                  <span className="text-slate-500">[{DOC_STAGE_LABEL[m.stage]}]</span> {m.caption}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {report.pdfUrl && (
        <div className="mt-6">
          <a
            href={report.pdfUrl}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-5 font-medium text-white transition-colors hover:bg-emerald-700"
          >
            <Download className="size-4" />
            Unduh PDF Laporan
          </a>
          <p className="mt-2 text-xs text-slate-500">
            Tautan unduhan berlaku 10 menit. Muat ulang halaman bila kedaluwarsa.
          </p>
        </div>
      )}

      <footer className="mt-10 border-t border-slate-200 pt-6 text-sm text-slate-500">
        <p className="font-medium text-slate-700">Terima kasih atas kepercayaan Anda.</p>
        <p className="mt-1">
          Laporan ini dibuat otomatis oleh sistem Sukses Aqiqah · Zakat Sukses
          {report.report ? ` · ${formatDateTime(report.report.generatedAt)}` : ''}
        </p>
      </footer>
    </main>
  );
}
