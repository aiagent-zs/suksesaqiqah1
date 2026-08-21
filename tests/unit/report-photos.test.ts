import { describe, expect, it } from 'vitest';
import { MAX_EMBEDDED_PHOTOS, selectEmbeddablePhotos } from '@/features/reporting/photos';
import type { ReportMedia } from '@/features/reporting/types';

function media(overrides: Partial<ReportMedia>): ReportMedia {
  return {
    type: 'photo',
    stage: 'sembelih',
    caption: null,
    storagePath: 'BDG/2026/08/IA-202608-0001/slaughter/a.jpg',
    url: null,
    ...overrides,
  };
}

describe('selectEmbeddablePhotos', () => {
  it('menerima JPG, JPEG, dan PNG', () => {
    const result = selectEmbeddablePhotos([
      media({ storagePath: 'x/a.jpg' }),
      media({ storagePath: 'x/b.jpeg' }),
      media({ storagePath: 'x/c.png' }),
    ]);

    expect(result.map((r) => r.format)).toEqual(['jpg', 'jpg', 'png']);
  });

  it('melewati WebP — React PDF menghasilkan PDF rusak, bukan galat saat render', () => {
    const result = selectEmbeddablePhotos([
      media({ storagePath: 'x/a.webp' }),
      media({ storagePath: 'x/b.jpg' }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].storagePath).toBe('x/b.jpg');
  });

  it('melewati video dan catatan', () => {
    const result = selectEmbeddablePhotos([
      media({ type: 'video', storagePath: 'x/a.mp4' }),
      media({ type: 'note', storagePath: null }),
      media({ storagePath: 'x/b.png' }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].format).toBe('png');
  });

  it('melewati foto tanpa storage_path', () => {
    expect(selectEmbeddablePhotos([media({ storagePath: null })])).toHaveLength(0);
  });

  it('tidak peka huruf besar pada ekstensi', () => {
    const result = selectEmbeddablePhotos([media({ storagePath: 'x/FOTO.JPG' })]);
    expect(result).toHaveLength(1);
    expect(result[0].format).toBe('jpg');
  });

  it('membatasi jumlah foto yang disematkan', () => {
    const many = Array.from({ length: 20 }, (_, i) => media({ storagePath: `x/${i}.jpg` }));

    expect(selectEmbeddablePhotos(many)).toHaveLength(MAX_EMBEDDED_PHOTOS);
    expect(selectEmbeddablePhotos(many, 2)).toHaveLength(2);
  });

  it('menghitung batas dari foto yang benar-benar layak, bukan dari posisi', () => {
    // Enam WebP di depan tidak boleh memakan kuota dan menyisakan nol foto.
    const list = [
      ...Array.from({ length: 6 }, (_, i) => media({ storagePath: `x/w${i}.webp` })),
      media({ storagePath: 'x/ok.jpg' }),
    ];

    expect(selectEmbeddablePhotos(list, 2)).toHaveLength(1);
  });

  it('mempertahankan keterangan foto', () => {
    const result = selectEmbeddablePhotos([
      media({ storagePath: 'x/a.jpg', caption: 'Proses pemotongan' }),
    ]);
    expect(result[0].caption).toBe('Proses pemotongan');
  });
});
