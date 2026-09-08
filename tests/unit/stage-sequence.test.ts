import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  STAGE_SEQUENCE,
  STAGE_META,
  STAGE_EVENT_STATUS_META,
  canReportStage,
  currentStage,
  stageSequence,
  type FulfilmentStage,
} from '@/features/stages/sequence';

/**
 * Urutan tahap hidup di dua tempat: `public.fulfilment_sequence()` di database
 * (yang menegakkan urutan lewat trigger) dan `STAGE_SEQUENCE` di sini (yang
 * merender stepper). Keduanya harus sama persis.
 *
 * Berkas migration-nya dibaca langsung, bukan disalin ke dalam tes — tes yang
 * membandingkan salinan dengan salinan tidak membuktikan apa pun.
 */
describe('urutan tahap sama antara SQL dan TypeScript', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260820000400_stage_events.sql'),
    'utf8',
  );

  function sequenceFromSql(mode: 'salur' | 'kirim'): string[] {
    const line = sql.split('\n').find((l) => l.trim().startsWith(`when '${mode}'`));
    if (!line) throw new Error(`Baris urutan untuk mode ${mode} tidak ditemukan di migration.`);

    const inside = line.slice(line.indexOf('[') + 1, line.indexOf(']'));
    return inside.split(',').map((s) => s.trim().replace(/'/g, ''));
  }

  it('salur berhenti di penyaluran', () => {
    expect(sequenceFromSql('salur')).toEqual(STAGE_SEQUENCE.salur);
  });

  it('kirim berlanjut sampai konfirmasi terkirim', () => {
    expect(sequenceFromSql('kirim')).toEqual(STAGE_SEQUENCE.kirim);
  });

  it('keduanya berbagi tiga tahap awal, lalu bercabang', () => {
    const shared = ['persiapan', 'sembelih', 'masak'];
    expect(STAGE_SEQUENCE.salur.slice(0, 3)).toEqual(shared);
    expect(STAGE_SEQUENCE.kirim.slice(0, 3)).toEqual(shared);
    expect(STAGE_SEQUENCE.salur.slice(3)).toEqual(['salur']);
    expect(STAGE_SEQUENCE.kirim.slice(3)).toEqual(['kirim', 'terkirim']);
  });

  it('tahap khusus kirim tidak pernah muncul di alur salur', () => {
    expect(STAGE_SEQUENCE.salur).not.toContain('kirim');
    expect(STAGE_SEQUENCE.salur).not.toContain('terkirim');
    expect(STAGE_SEQUENCE.kirim).not.toContain('salur');
  });
});

describe('stage_requirements sejalan dengan urutan tahap', () => {
  const master = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260820000200_master_tables.sql'),
    'utf8',
  );

  it('setiap tahap yang menuntut bukti ada dalam salah satu alur', () => {
    // Baris seperti:  ('sembelih',  1, false, 'Sembelih'),
    const rows = [...master.matchAll(/\('(\w+)',\s*(\d+),\s*(true|false),/g)];
    expect(rows.length).toBeGreaterThan(0);

    const semua = new Set<string>([...STAGE_SEQUENCE.salur, ...STAGE_SEQUENCE.kirim]);
    for (const [, stage] of rows) {
      expect(semua.has(stage)).toBe(true);
    }
  });

  it('setiap tahap punya label dan keterangan di layar', () => {
    for (const stage of new Set([...STAGE_SEQUENCE.salur, ...STAGE_SEQUENCE.kirim])) {
      expect(STAGE_META[stage].label.length).toBeGreaterThan(0);
      expect(STAGE_META[stage].hint.length).toBeGreaterThan(0);
    }
  });

  it('setiap status laporan punya label', () => {
    for (const status of ['pending', 'reported', 'validated', 'rejected'] as const) {
      expect(STAGE_EVENT_STATUS_META[status].label.length).toBeGreaterThan(0);
    }
  });
});

describe('stageSequence', () => {
  it('mengembalikan daftar kosong bila mode belum ditentukan', () => {
    expect(stageSequence(null)).toEqual([]);
    expect(stageSequence(undefined)).toEqual([]);
  });
});

describe('gerbang urutan tahap', () => {
  const events = (
    statuses: Array<[FulfilmentStage, number, 'pending' | 'reported' | 'validated' | 'rejected']>,
  ) => statuses.map(([stage, seq, status]) => ({ stage, seq, status }));

  it('tahap pertama selalu boleh dilaporkan', () => {
    const e = events([
      ['persiapan', 1, 'pending'],
      ['sembelih', 2, 'pending'],
    ]);
    expect(canReportStage(e, 1)).toBe(true);
  });

  it('DILAPORKAN saja sudah membuka tahap berikutnya', () => {
    // Dilonggarkan 8 September. Aturan lama menuntut `validated`, dan
    // konsekuensinya persis seperti yang diperingatkan migration aslinya:
    // admin jadi penghambat di tiap tahap, dan mitra berhenti di lapangan
    // menunggu orang yang sedang tidak di depan layar.
    const e = events([
      ['persiapan', 1, 'reported'],
      ['sembelih', 2, 'pending'],
    ]);
    expect(canReportStage(e, 2)).toBe(true);
  });

  it('tervalidasi tentu juga membuka', () => {
    const e = events([
      ['persiapan', 1, 'validated'],
      ['sembelih', 2, 'pending'],
    ]);
    expect(canReportStage(e, 2)).toBe(true);
  });

  it('yang belum disentuh tetap menahan — urutannya masih dijaga', () => {
    // Longgar bukan berarti bebas: laporan tidak boleh masuk dengan urutan
    // yang mustahil, misalnya salur sebelum sembelih.
    const e = events([
      ['persiapan', 1, 'pending'],
      ['sembelih', 2, 'pending'],
    ]);
    expect(canReportStage(e, 2)).toBe(false);
  });

  it('sembelih beberapa ekor berbagi satu seq, jadi tetap paralel', () => {
    const e = events([
      ['persiapan', 1, 'validated'],
      ['sembelih', 2, 'reported'],
      ['sembelih', 2, 'pending'],
    ]);
    // Ekor kedua tidak terhalang ekor pertama.
    expect(canReportStage(e, 2)).toBe(true);
    // Masak tetap tertahan: ekor kedua belum dilaporkan sama sekali.
    expect(canReportStage(e, 3)).toBe(false);
  });

  it('masak terbuka begitu KEDUA ekor dilaporkan', () => {
    const e = events([
      ['persiapan', 1, 'validated'],
      ['sembelih', 2, 'reported'],
      ['sembelih', 2, 'reported'],
    ]);
    expect(canReportStage(e, 3)).toBe(true);
  });

  it('tahap yang DITOLAK tetap menahan tahap sesudahnya', () => {
    // Sengaja tidak ikut dilonggarkan: tahap ini sudah dinilai dan dinyatakan
    // kurang, jadi melanjutkan di atasnya berarti menumpuk pekerjaan di atas
    // dasar yang admin sudah bilang salah.
    const e = events([
      ['persiapan', 1, 'validated'],
      ['sembelih', 2, 'rejected'],
    ]);
    expect(canReportStage(e, 3)).toBe(false);
  });
});

describe('currentStage', () => {
  it('menunjuk tahap paling awal yang belum tervalidasi', () => {
    expect(
      currentStage([
        { stage: 'persiapan', seq: 1, status: 'validated' },
        { stage: 'sembelih', seq: 2, status: 'reported' },
        { stage: 'masak', seq: 3, status: 'pending' },
      ]),
    ).toBe('sembelih');
  });

  it('null bila seluruh tahap tervalidasi', () => {
    expect(
      currentStage([
        { stage: 'persiapan', seq: 1, status: 'validated' },
        { stage: 'salur', seq: 4, status: 'validated' },
      ]),
    ).toBeNull();
  });
});
