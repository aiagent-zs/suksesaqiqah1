import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Menghapus versi laporan — dan yang tidak boleh dihapus.
 *
 * ## Kenapa berkas ini ada
 *
 * Versi yang sudah ditandai terkirim tautannya **sudah ada di tangan peserta**.
 * Menghapus barisnya mematikan tautan itu tanpa mereka tahu kenapa — dan
 * `sent_at` juga yang dibaca `v_order_progress.report_sent`, jadi
 * menghapusnya mengembalikan order ke keadaan "belum pernah mengirim laporan"
 * dan menutup lagi gerbang `reporting → completed` yang sudah terlewati.
 *
 * Yang dijaga di sini bukan sekadar "ada pemeriksaan", melainkan bahwa
 * pemeriksaannya **berlapis**: satu di layar (tombolnya tidak dirender), satu
 * di server (baris dibaca dan ditolak), dan satu di database
 * (`.is('sent_at', null)` pada DELETE). Lapisan ketiga yang menutup dua celah
 * yang tidak bisa ditutup dua lapisan pertama — permintaan yang dikirim
 * langsung ke API, dan orang lain yang menandainya terkirim di sela pembacaan
 * dan penghapusan.
 *
 * Kewenangannya diuji langsung terhadap produksi lewat impersonasi di dalam
 * transaksi yang di-rollback: admin BERHASIL, mitra ditolak RLS.
 */
const ACTION = readFileSync('server/actions/reports.ts', 'utf8');
const PANEL = readFileSync('features/reporting/components/report-manager.tsx', 'utf8');

/** Badan `deleteReport` saja — supaya tidak cocok pada aksi tetangganya. */
const deleteBlock = ACTION.slice(
  ACTION.indexOf('export async function deleteReport'),
  ACTION.length,
);

describe('yang sudah terkirim tidak bisa dihapus', () => {
  it('server menolaknya sebelum menyentuh apa pun', () => {
    expect(deleteBlock).toMatch(/if\s*\(row\.sent_at\)/);
    expect(deleteBlock).toContain('sudah dikirim ke peserta');
  });

  it('penolakannya menyebutkan jalan keluarnya', () => {
    // "Tidak bisa dihapus" tanpa kelanjutan meninggalkan operator buntu —
    // yang salah cetak memang dibetulkan dengan membuat versi baru.
    expect(deleteBlock).toMatch(/[Bb]uat versi baru/);
  });

  it('DELETE-nya sendiri ikut menuntut sent_at kosong', () => {
    // Lapisan yang tidak bisa dilewati: antara pembacaan dan penghapusan,
    // orang lain bisa menandainya terkirim.
    expect(deleteBlock).toMatch(/\.delete\(\)[\s\S]{0,200}\.is\('sent_at',\s*null\)/);
  });

  it('layar tidak merender tombolnya untuk versi terkirim', () => {
    expect(PANEL).toMatch(/!report\.sentAt/);
  });
});

describe('kewenangan', () => {
  it('menuntut GENERATE_REPORT', () => {
    // Yang membuat laporan boleh membereskan kekeliruannya sendiri, tanpa
    // menunggu superadmin.
    expect(deleteBlock).toMatch(/canDo\(session\.profile\?\.role,\s*'GENERATE_REPORT'\)/);
  });

  it('tombolnya ikut tunduk pada canGenerate', () => {
    expect(PANEL).toMatch(/canGenerate\s*&&\s*!report\.sentAt/);
  });
});

describe('berkas PDF-nya ikut dibuang', () => {
  it('menghapusnya dari bucket reports', () => {
    // Tanpa barisnya, PDF itu tidak bisa dijangkau dari mana pun dan hanya
    // menumpuk di bucket.
    expect(deleteBlock).toMatch(/\.from\('reports'\)[\s\S]{0,80}\.remove\(/);
  });

  it('kegagalan storage tidak membatalkan penghapusan', () => {
    // Barisnya sudah hilang; menggagalkan seluruhnya menyisakan keadaan yang
    // lebih membingungkan daripada satu berkas yatim. Dicatat ke log, bukan
    // dikembalikan sebagai galat.
    const storagePart = deleteBlock.slice(deleteBlock.indexOf('.remove('));
    expect(storagePart).toContain('console.error');
    expect(storagePart).not.toMatch(/return\s+internalError/);
  });
});
