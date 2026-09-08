import { ArrowDown, CheckCircle2, Info } from 'lucide-react';
import { PANEL_LABEL, type NextStep } from '../next-step';

/**
 * "Apa yang harus dikerjakan sekarang" — satu kartu di puncak order.
 *
 * Sebelum ini jawabannya harus dirakit sendiri oleh admin dari tiga tempat yang
 * berjauhan: stepper di header (sampai mana), daftar alasan di sidebar kanan
 * (apa yang kurang), dan sembilan panel di kolom kiri (di mana mengisinya).
 * Ketiganya benar masing-masing, tetapi tidak satu pun menjawab pertanyaan yang
 * sebenarnya diajukan setiap kali halaman ini dibuka.
 *
 * Isinya **tidak menambah aturan apa pun**: penghalangnya datang dari `guard`
 * state machine yang sama dengan yang ditegakkan server action, jadi kartu ini
 * tidak mungkin menjanjikan sesuatu yang lalu ditolak tombolnya.
 *
 * Server Component — tidak ada state di sini, dan menjadikannya komponen klien
 * hanya akan mengirim JavaScript untuk sesuatu yang tidak pernah berubah tanpa
 * memuat ulang.
 */
export function NextStepCard({ step }: { step: NextStep }) {
  if (step.done) {
    return (
      <section className="rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4">
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-900">
          <CheckCircle2 className="size-4 shrink-0" />
          {step.title}
        </p>
      </section>
    );
  }

  const hasBlockers = step.blockers.length > 0;

  return (
    <section className="border-border bg-card rounded-lg border p-5 shadow-sm">
      <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
        Langkah berikutnya
      </p>
      <h2 className="mt-1 text-lg font-semibold">{step.title}</h2>

      {hasBlockers ? (
        <ul className="mt-3 space-y-1.5">
          {step.blockers.map((reason) => (
            <li key={reason} className="flex items-start gap-2 text-sm text-amber-800">
              <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />
              {reason}
            </li>
          ))}
        </ul>
      ) : (
        step.readyFor && (
          <p className="mt-3 text-sm text-emerald-800">
            Semua syarat terpenuhi — order siap dinaikkan lewat panel Aksi Status.
          </p>
        )
      )}

      {/* Tautan anchor biasa, bukan tombol ber-JavaScript: `scroll-mt-6` di
          `PhaseSection` yang membuat panelnya tidak tertutup tepi atas layar. */}
      {step.panel && (
        <a
          href={`#${step.panel}`}
          className="text-primary mt-3 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
        >
          <ArrowDown className="size-4" />
          Buka {PANEL_LABEL[step.panel]}
        </a>
      )}
    </section>
  );
}
