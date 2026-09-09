// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { StageEventRow } from '@/features/stages/queries';
import type { DocumentationRow } from '@/features/documentation/queries';

/**
 * Foto sebagai bagian dari laporan tahap, bukan aksi terpisah.
 *
 * ## Kenapa berkas ini ada
 *
 * Sebelumnya mitra harus mengerjakan dua langkah untuk satu pekerjaan: isi form
 * laporan, lalu tekan "Tambah bukti" di luar form dan unggah fotonya sendiri.
 * Yang lupa langkah kedua meninggalkan tahap yang **tampak selesai tanpa
 * bukti** — dan itu baru ketahuan berhari-hari kemudian, saat gerbang
 * kelengkapan menolak order naik ke Pelaporan.
 *
 * Sekarang fotonya jadi medan di dalam form. Dua hal yang dijaga di sini:
 *
 *   1. **Urutannya foto dulu, laporan kemudian.** Kalau dibalik, laporan
 *      tersimpan lebih dulu dan kegagalan unggah meninggalkan persis keadaan
 *      yang ingin dihindari: tahap selesai tanpa bukti.
 *   2. **Foto wajib.** Laporan tanpa bukti tidak bisa disimpan sama sekali —
 *      tahap yang tercatat selesai tanpa foto adalah tahap yang tidak bisa
 *      dibuktikan kepada pemesan, dan itu yang dijual laporan peserta. Yang
 *      sudah punya bukti terlampir boleh disimpan ulang tanpa memilih berkas
 *      lagi: membetulkan bobot tidak menuntut memotret ulang.
 */
const reportStage = vi.fn();
const uploadDocumentation = vi.fn();
const storageUpload = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/server/actions/stages', () => ({
  reportStage: (...a: unknown[]) => reportStage(...a),
  reviewStage: vi.fn(),
}));
vi.mock('@/server/actions/documentation', () => ({
  uploadDocumentation: (...a: unknown[]) => uploadDocumentation(...a),
  reviewDocumentation: vi.fn(),
  deleteDocumentation: vi.fn(),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ storage: { from: () => ({ upload: storageUpload }) } }),
}));

const { StagePanel } = await import('@/features/stages/components/stage-panel');

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLElement | null = null;

const SEMBELIH: StageEventRow = {
  id: 's1',
  stage: 'sembelih',
  seq: 1,
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
};

function mount() {
  return mountWith([]);
}

function mountWith(docs: DocumentationRow[], row: StageEventRow = SEMBELIH) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      <StagePanel
        stages={[row]}
        docs={docs}
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

const press = (el: HTMLElement, label: string) => {
  const btn = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes(label));
  act(() => btn?.click());
  return btn;
};

/** Sisipkan berkas ke input file — `files` hanya bisa disetel lewat properti. */
function attach(el: HTMLElement, ...names: string[]) {
  const input = el.querySelector('input[type="file"]') as HTMLInputElement;
  const files = names.map((n) => new File(['x'], n, { type: 'image/jpeg' }));
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  act(() => input.dispatchEvent(new Event('change', { bubbles: true })));
}

beforeEach(() => {
  reportStage.mockReset();
  reportStage.mockResolvedValue({ ok: true, data: { id: 's1' } });
  uploadDocumentation.mockReset();
  uploadDocumentation.mockResolvedValue({ ok: true, data: { id: 'd1' } });
  storageUpload.mockReset();
  storageUpload.mockResolvedValue({ error: null });
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('foto ikut dalam form laporan', () => {
  it('medan foto ada di dalam form, bukan tombol terpisah', () => {
    const el = mount();
    press(el, 'Laporkan');
    expect(el.querySelector('input[type="file"]')).not.toBeNull();
    expect(el.textContent).toContain('Foto dokumentasi');
  });

  it('mengunggah foto lalu menyimpan laporan — satu tekan', async () => {
    const el = mount();
    press(el, 'Laporkan');
    attach(el, 'sembelih-1.jpg');

    await act(async () => {
      press(el, 'Simpan laporan');
    });

    expect(storageUpload).toHaveBeenCalledTimes(1);
    expect(reportStage).toHaveBeenCalledTimes(1);
    expect(uploadDocumentation).toHaveBeenCalledTimes(1);
    // Bukti ditautkan ke baris tahapnya, bukan ke tahap secara umum.
    expect(uploadDocumentation).toHaveBeenCalledWith(
      expect.objectContaining({ stage_event_id: 's1', type: 'photo' }),
    );
  });

  it('menerima beberapa foto sekaligus', () => {
    // Satu tahap sering perlu beberapa sudut pengambilan.
    const el = mount();
    press(el, 'Laporkan');
    const input = el.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.multiple).toBe(true);
  });
});

describe('urutan foto-dulu', () => {
  it('tidak menyimpan laporan bila unggahnya gagal', async () => {
    // Inti penjagaannya: laporan yang tersimpan tanpa bukti adalah keadaan yang
    // paling sulit disadari — baru ketahuan saat gerbang Pelaporan menolaknya.
    storageUpload.mockResolvedValue({ error: { message: 'jaringan terputus' } });

    const el = mount();
    press(el, 'Laporkan');
    attach(el, 'gagal.jpg');

    await act(async () => {
      press(el, 'Simpan laporan');
    });

    expect(reportStage).not.toHaveBeenCalled();
    expect(el.textContent).toContain('jaringan terputus');
  });
});

describe('satu jalan pada tahap yang belum dilaporkan', () => {
  const buttonTexts = (el: HTMLElement) =>
    [...el.querySelectorAll('button')].map((b) => b.textContent ?? '');

  it('tidak menawarkan "Tambah bukti" sebelum ada laporan', () => {
    // Dua tombol di baris yang sama menawarkan dua jalan untuk satu pekerjaan,
    // dan yang menempuh jalan bukti duluan meninggalkan foto yang menggantung
    // tanpa laporan yang menerangkannya. Form Laporkan sudah memuat fotonya.
    const el = mount();
    expect(buttonTexts(el).some((t) => t.includes('Laporkan'))).toBe(true);
    expect(buttonTexts(el).some((t) => t.includes('Tambah bukti'))).toBe(false);
  });

  it('menawarkannya begitu tahapnya dilaporkan', () => {
    // Di sini ia berguna: foto menyusul dari lapangan, atau mengganti yang
    // ditolak admin.
    const el = mountWith([], { ...SEMBELIH, status: 'reported' });
    expect(buttonTexts(el).some((t) => t.includes('Tambah bukti'))).toBe(true);
  });

  it('berhenti menawarkannya sesudah tervalidasi', () => {
    // Yang sudah disetujui admin tidak lagi menerima tambahan.
    const el = mountWith([], { ...SEMBELIH, status: 'validated' });
    expect(buttonTexts(el).some((t) => t.includes('Tambah bukti'))).toBe(false);
  });
});

describe('foto wajib', () => {
  const simpanButton = (el: HTMLElement) =>
    [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Simpan laporan'));

  it('menahan tombol Simpan selama belum ada foto', () => {
    // Tahap yang tercatat selesai tanpa foto tidak bisa dibuktikan kepada
    // pemesan — dan bukti itulah yang dijual laporan peserta.
    const el = mount();
    press(el, 'Laporkan');
    expect(simpanButton(el)?.disabled).toBe(true);
  });

  it('membuka tombol Simpan begitu foto dipilih', () => {
    const el = mount();
    press(el, 'Laporkan');
    attach(el, 'sembelih-1.jpg');
    expect(simpanButton(el)?.disabled).toBe(false);
  });

  it('baris yang sudah punya bukti boleh disimpan ulang tanpa foto baru', () => {
    // Membetulkan bobot atau catatan tidak menuntut memotret ulang apa yang
    // sudah terbukti.
    const el = mountWith([
      {
        id: 'd1',
        stageEventId: 's1',
        type: 'photo',
        stage: 'sembelih',
        status: 'pending',
        caption: null,
        reviewNote: null,
        createdAt: '2026-09-08T00:00:00.000Z',
        reviewedAt: null,
        uploaderId: 'u2',
        uploaderName: 'Mitra',
        reviewerName: null,
        animalTag: null,
        mediaUrl: null,
      },
    ]);
    press(el, 'Laporkan');
    expect(simpanButton(el)?.disabled).toBe(false);
  });

  it('bukti yang DITOLAK tidak dihitung sebagai bukti', () => {
    // Admin sudah menyatakannya kurang; memperlakukannya sebagai sah membuat
    // mitra bisa menyimpan ulang tanpa memperbaiki apa pun.
    const el = mountWith([
      {
        id: 'd1',
        stageEventId: 's1',
        type: 'photo',
        stage: 'sembelih',
        status: 'rejected',
        caption: null,
        reviewNote: 'foto buram',
        createdAt: '2026-09-08T00:00:00.000Z',
        reviewedAt: '2026-09-08T01:00:00.000Z',
        uploaderId: 'u2',
        uploaderName: 'Mitra',
        reviewerName: 'Admin',
        animalTag: null,
        mediaUrl: null,
      },
    ]);
    press(el, 'Laporkan');
    expect(simpanButton(el)?.disabled).toBe(true);
  });
});
