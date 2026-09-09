// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { StageEventRow } from '@/features/stages/queries';

/**
 * Panel tahap pada order berisi lebih dari satu ekor.
 *
 * ## Kenapa berkas ini ada
 *
 * `generate_stage_checklist` menerbitkan **satu baris `sembelih` per ekor**, dan
 * ketiganya berbagi `seq` yang sama. Jadi order dua ekor menampilkan "Sembelih"
 * dua kali — benar secara data, tetapi di layar keduanya tampak identik.
 *
 * Pembedanya seharusnya `tag_code`. Kolom itu **opsional** dan pada kenyataannya
 * hampir selalu kosong: formulir hewan tidak mewajibkannya, dan keempat hewan di
 * produksi punya `tag_code = null`. Akibatnya kedua baris benar-benar tidak bisa
 * dibedakan.
 *
 * Yang terjadi kemudian: satu baris sudah dilaporkan (tombolnya hilang), satu
 * lagi belum (tombolnya ada). Dari layar itu terbaca sebagai **tombol yang
 * hilang tanpa sebab** — bukan sebagai dua ekor dengan keadaan berbeda. Itu
 * persis keluhan yang memicu berkas ini.
 *
 * Dua hal yang dijaga:
 *
 *   1. Baris per ekor selalu punya pembeda — `tag_code` bila ada, nomor urut
 *      bila tidak.
 *   2. Baris yang terkunci menyebut **tahap mana** yang menahannya. "Menunggu
 *      tahap sebelumnya" tidak berguna ketika yang menahan adalah satu dari dua
 *      baris sembelih, sementara baris satunya sudah selesai.
 */
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/server/actions/stages', () => ({ reportStage: vi.fn(), reviewStage: vi.fn() }));
vi.mock('@/server/actions/documentation', () => ({
  uploadDocumentation: vi.fn(),
  reviewDocumentation: vi.fn(),
  deleteDocumentation: vi.fn(),
}));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ storage: {} }) }));

const { StagePanel } = await import('@/features/stages/components/stage-panel');

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLElement | null = null;

function stage(over: Partial<StageEventRow> & Pick<StageEventRow, 'id' | 'stage' | 'seq'>) {
  return {
    status: 'pending',
    animalId: null,
    animalTag: null,
    reportedBy: null,
    reporterName: null,
    reportedAt: null,
    occurredAt: null,
    notes: null,
    packagesCount: null,
    recipientName: null,
    recipientPhone: null,
    recipientArea: null,
    weightKg: null,
    lat: null,
    lng: null,
    validatorName: null,
    validatedAt: null,
    reviewNote: null,
    ...over,
  } as StageEventRow;
}

/** Persis bentuk IA-202609-0002: dua ekor, salah satunya sudah dilaporkan. */
const DUA_EKOR: StageEventRow[] = [
  stage({ id: 'p1', stage: 'persiapan', seq: 1, status: 'reported' }),
  stage({ id: 's1', stage: 'sembelih', seq: 2, animalId: 'a1', status: 'reported' }),
  stage({ id: 's2', stage: 'sembelih', seq: 2, animalId: 'a2', status: 'pending' }),
  stage({ id: 'm1', stage: 'masak', seq: 3 }),
];

function mount(stages: StageEventRow[]) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      <StagePanel
        stages={stages}
        docs={[]}
        canReport
        canValidate={false}
        canUpload
        currentUserId="u1"
        orderNumber="IA-202609-0002"
        orderCreatedAt="2026-09-07T00:00:00.000Z"
        deliveryAddress={null}
      />,
    );
  });
  return container;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('membedakan baris per ekor', () => {
  it('memberi nomor urut ketika tag hewan kosong', () => {
    // Inti bug-nya: `tag_code` null di seluruh produksi, jadi badge pembedanya
    // tidak pernah muncul dan kedua baris tampak duplikat.
    const el = mount(DUA_EKOR);
    expect(el.textContent).toContain('Ekor 1');
    expect(el.textContent).toContain('Ekor 2');
  });

  it('memakai tag hewan bila memang terisi', () => {
    const el = mount(DUA_EKOR.map((s) => (s.id === 's1' ? { ...s, animalTag: 'KMB-01' } : s)));
    expect(el.textContent).toContain('KMB-01');
    // Yang tanpa tag tetap dapat nomor — bukan kosong.
    expect(el.textContent).toContain('Ekor 2');
  });

  it('tahap yang cuma satu baris tidak diberi nomor', () => {
    // "Masak Ekor 1" akan menyesatkan: memasak berlangsung per order, bukan
    // per ekor.
    const el = mount(DUA_EKOR);
    expect(el.textContent).not.toContain('Masak Ekor');
  });
});

describe('menyebut apa yang menahan', () => {
  it('menamai tahap yang belum dilaporkan, bukan sekadar "tahap sebelumnya"', () => {
    // Yang menahan `masak` adalah satu baris sembelih yang belum disentuh —
    // sementara baris sembelih satunya sudah dilaporkan dan terlihat selesai.
    const el = mount(DUA_EKOR);
    expect(el.textContent).toContain('Menunggu Sembelih dilaporkan lebih dulu.');
  });

  it('tidak menampilkan penahan pada baris yang sudah terbuka', () => {
    // Diuji terhadap kalimat penahannya, bukan kata "Menunggu" — kata itu juga
    // nama status pada badge, jadi mencarinya begitu saja selalu cocok.
    const semuaDilaporkan = DUA_EKOR.map((s) =>
      s.stage === 'masak' ? s : { ...s, status: 'reported' as const },
    );
    const el = mount(semuaDilaporkan);
    expect(el.textContent).not.toContain('dilaporkan lebih dulu');
  });
});
