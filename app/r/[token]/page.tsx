import { cache } from 'react';
import type { Metadata } from 'next';
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
/**
 * `cache` supaya `generateMetadata` dan halaman berbagi satu panggilan RPC per
 * permintaan: klien Supabase tidak lewat `fetch`, jadi memoisasi bawaan Next
 * tidak berlaku di sini.
 */
const loadReport = cache(getPublicReport);

/**
 * Judul tab ikut jujur soal 404: token tak dikenal dulu tetap berjudul
 * "Laporan Pelaksanaan" di atas halaman tidak ditemukan.
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { token } = await params;
  const report = await loadReport(token);
  return {
    title: report ? 'Laporan Pelaksanaan' : 'Laporan tidak ditemukan',
    robots: { index: false, follow: false },
  };
}

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
  const report = await loadReport(token);

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

  // Klaim "seluruh bukti tervalidasi" hanya boleh muncul bila memang begitu.
  // Laporan yang dibagikan saat sebagian tahap masih berjalan dulu tetap
  // menampilkannya, dan peserta membacanya sebagai pekerjaan yang sudah tuntas.
  const { stagesValidated, stagesTotal } = report.progress;
  const allValidated = Boolean(report.report) && stagesTotal > 0 && stagesValidated >= stagesTotal;

  const onBehalf = report.animals.map((a) => a.onBehalfOf).filter((v): v is string => Boolean(v));

  return (
    <main className="container-narrow min-h-dvh py-8 sm:py-12">
      <header className="bg-primary rounded-lg p-5 text-white sm:p-6">
        <p className="text-sm font-semibold text-white/80">Sukses Aqiqah</p>
        <h1 className="text-h2 mt-1 font-bold tracking-tight">Laporan Pelaksanaan</h1>
        <p className="mt-2 text-sm text-white/80 tabular-nums">
          {report.orderNumber}
          {report.report ? ` · versi ${report.report.version}` : ''}
          {report.vendorName ? ` · ${report.vendorName}` : ''}
        </p>
        <p className="mt-4 flex items-start gap-2 border-t border-white/20 pt-4 text-sm text-white">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          {allValidated
            ? 'Seluruh bukti telah melalui validasi dua tingkat'
            : stagesTotal > 0 && stagesValidated < stagesTotal
              ? `${stagesValidated} dari ${stagesTotal} tahap sudah divalidasi, sisanya masih berjalan`
              : 'Bukti pelaksanaan sedang diperiksa tim kami'}
        </p>
      </header>

      <section className="border-line mt-4 rounded-lg border bg-white p-5 sm:mt-6 sm:p-6">
        <h2 className="text-ink text-base font-semibold">Ringkasan</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex gap-3">
            <dt className="text-ink-muted w-28 shrink-0 sm:w-40">Peserta</dt>
            <dd className="text-ink font-medium">{report.participantName ?? '-'}</dd>
          </div>
          {onBehalf.length > 0 && (
            <div className="flex gap-3">
              <dt className="text-ink-muted w-28 shrink-0 sm:w-40">Atas nama</dt>
              <dd className="text-ink">{onBehalf.join(', ')}</dd>
            </div>
          )}
          {/* Disembunyikan saat kosong, bukan ditampilkan sebagai "-": order
              qurban tidak punya anak, dan order sebelum 19 Agustus 2026 tidak
              pernah menanyakannya. */}
          {(report.childBirthPlace || report.childBirthDate) && (
            <div className="flex gap-3">
              <dt className="text-ink-muted w-28 shrink-0 sm:w-40">Tempat, tanggal lahir</dt>
              <dd className="text-ink">
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
            <dt className="text-ink-muted w-28 shrink-0 sm:w-40">Layanan</dt>
            <dd className="text-ink">
              {report.services.map((s) => `${s.name} (${s.qty})`).join(', ') || '-'}
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="text-ink-muted w-28 shrink-0 sm:w-40">Hewan</dt>
            <dd className="text-ink">{animalSummary || '-'}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="text-ink-muted w-28 shrink-0 sm:w-40">Lokasi</dt>
            <dd className="text-ink flex items-center gap-1.5">
              <MapPin className="text-ink-muted size-3.5" />
              {report.schedule?.locationName ?? '-'}
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="text-ink-muted w-28 shrink-0 sm:w-40">Tanggal pelaksanaan</dt>
            <dd className="text-ink">
              {report.schedule?.scheduledDate ? formatDate(report.schedule.scheduledDate) : '-'}
              {report.schedule?.scheduledTime
                ? ` · ${formatTime(report.schedule.scheduledTime)}`
                : ''}
            </dd>
          </div>
        </dl>
      </section>

      <section className="border-line mt-4 rounded-lg border bg-white p-5 sm:mt-6 sm:p-6">
        <h2 className="text-ink text-base font-semibold">Status Pelaksanaan</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            // Kartu per-ekor hanya untuk pesanan yang memang punya hewan.
            // Pesanan katering selalu bernilai 0/0, dan "Dipotong 0/0 ekor" di
            // halaman yang dibaca pembeli terbaca seperti pekerjaan yang belum
            // jalan — padahal memang tidak ada yang perlu dipotong.
            ...(report.progress.animalsTotal > 0
              ? [
                  {
                    label: 'Dipotong',
                    value: `${report.progress.animalsSlaughtered}/${report.progress.animalsTotal} ekor`,
                  },
                  {
                    label: 'Terdistribusi',
                    value: `${report.progress.animalsDistributed}/${report.progress.animalsTotal} ekor`,
                  },
                ]
              : []),
            {
              label: 'Tahap selesai',
              value: `${report.progress.stagesValidated}/${report.progress.stagesTotal} tahap`,
            },
          ].map((cell) => (
            <div key={cell.label} className="bg-surface-muted rounded-lg px-4 py-3">
              <p className="text-ink-muted text-xs">{cell.label}</p>
              <p className="text-ink mt-0.5 font-semibold tabular-nums">{cell.value}</p>
            </div>
          ))}
        </div>
      </section>

      {photos.length > 0 && (
        <section className="border-line mt-4 rounded-lg border bg-white p-5 sm:mt-6 sm:p-6">
          <h2 className="text-ink text-base font-semibold">Galeri Bukti</h2>
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
                  className="aspect-4/3 w-full rounded-lg object-cover"
                />
                <figcaption className="text-ink-muted mt-1 text-xs">
                  {DOC_STAGE_LABEL[m.stage]}
                  {m.caption ? ` · ${m.caption}` : ''}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* Bagian sendiri, bukan menumpang di galeri foto: order yang hanya punya
          video dulu tidak menampilkan buktinya sama sekali. */}
      {videos.length > 0 && (
        <section className="border-line mt-4 rounded-lg border bg-white p-5 sm:mt-6 sm:p-6">
          <h2 className="text-ink text-base font-semibold">Video Bukti</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {videos.map((m, i) => (
              <figure key={i}>
                <video src={m.url!} controls preload="metadata" className="w-full rounded-lg" />
                <figcaption className="text-ink-muted mt-1 text-xs">
                  {DOC_STAGE_LABEL[m.stage]}
                  {m.caption ? ` · ${m.caption}` : ''}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {report.stages.length > 0 && (
        <section className="border-line mt-4 rounded-lg border bg-white p-5 sm:mt-6 sm:p-6">
          <h2 className="text-ink text-base font-semibold">Tahap Pelaksanaan</h2>
          <p className="text-ink-muted mt-1 text-sm">
            Setiap tahap di bawah sudah diperiksa dan divalidasi tim kami.
          </p>
          <ol className="divide-line mt-4 divide-y">
            {report.stages.map((s, i) => (
              <li key={i} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                <div>
                  <p className="text-ink font-medium">{STAGE_LABEL_PUBLIC[s.stage] ?? s.stage}</p>
                  {s.notes && <p className="text-ink-muted mt-0.5 text-xs">{s.notes}</p>}
                </div>
                <span className="text-ink-muted shrink-0 text-xs tabular-nums">
                  {s.occurredAt ? formatDate(s.occurredAt) : '-'}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {notes.length > 0 && (
        <section className="border-line mt-4 rounded-lg border bg-white p-5 sm:mt-6 sm:p-6">
          <h2 className="text-ink text-base font-semibold">Catatan Lapangan</h2>
          <ul className="text-ink mt-3 space-y-2 text-sm">
            {notes.map((m, i) => (
              <li key={i} className="flex gap-2">
                <CheckCircle2 className="text-primary mt-0.5 size-4 shrink-0" />
                <span>
                  <span className="text-ink-muted">[{DOC_STAGE_LABEL[m.stage]}]</span> {m.caption}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {report.pdfUrl && (
        <div className="mt-6">
          <a href={report.pdfUrl} className="btn btn-primary">
            <Download className="size-4" />
            Unduh PDF Laporan
          </a>
          <p className="text-ink-muted mt-2 text-xs">
            Tautan unduhan berlaku 10 menit. Muat ulang halaman bila kedaluwarsa.
          </p>
        </div>
      )}

      <footer className="border-line text-ink-muted mt-10 border-t pt-6 text-sm">
        <p className="text-ink font-medium">Terima kasih atas kepercayaan Anda.</p>
        <p className="mt-1">
          Laporan ini dibuat otomatis oleh sistem Sukses Aqiqah · Zakat Sukses
          {report.report ? ` · ${formatDateTime(report.report.generatedAt)}` : ''}
        </p>
      </footer>
    </main>
  );
}
