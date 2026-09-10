import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * `reports.generated_by` menyimpan **uuid profil**, bukan nama orang.
 *
 * ## Kenapa berkas ini ada
 *
 * Kolomnya `uuid` dengan FK ke `profiles`
 * (`20260820000500_documentation_reporting.sql:136`), tetapi `generateReport`
 * mengisinya dengan `session.profile?.full_name` — sebuah string biasa.
 * Postgres menolak seluruh INSERT:
 *
 *     22P02 invalid input syntax for type uuid: "Sholahuddin (Superadmin)"
 *
 * Akibatnya di produksi berlapis, dan itu yang membuatnya sulit dikenali: PDF
 * 2,5 MB sudah terunggah ke Storage, tetapi barisnya tidak pernah masuk tabel.
 * Percobaan berikutnya menghitung `nextVersion` dari tabel yang kosong — jadi
 * selalu v1, path yang sama, kali ini ditolak di langkah unggah. Satu bug
 * menutupi bug lainnya, dan yang terbaca di layar cuma "Gagal menyimpan PDF
 * laporan".
 *
 * Migration lama (`20260806010300:52`) memang mendefinisikannya `text` dengan
 * komentar "id/nama user" — versi 20 Agustus mengetatkannya jadi uuid, dan
 * kodenya tidak ikut berubah.
 *
 * Dua sisi yang dijaga di sini, karena memperbaiki satu tanpa yang lain
 * membuat layar menampilkan uuid mentah kepada operator:
 *
 *   1. Yang **ditulis** adalah `profile.id`.
 *   2. Yang **dibaca** adalah `full_name` lewat join, bukan kolom mentahnya.
 */
const ACTION = readFileSync('server/actions/reports.ts', 'utf8');
const QUERIES = readFileSync('features/reporting/queries.ts', 'utf8');

/** Blok `.insert({...})` ke tabel `reports` di dalam `generateReport`. */
const insertBlock = ACTION.slice(
  ACTION.indexOf(".from('reports')\n    .insert("),
  ACTION.indexOf('.select', ACTION.indexOf(".from('reports')\n    .insert(")),
);

describe('yang ditulis ke generated_by', () => {
  it('mengirim id profil', () => {
    expect(insertBlock).toMatch(/generated_by:\s*session\.profile\?\.id/);
  });

  it('tidak pernah mengirim nama atau email', () => {
    // Keduanya string; kolomnya uuid. Yang mana pun menolak seluruh INSERT,
    // dan pesannya tidak menyebut kolom mana yang salah.
    expect(insertBlock).not.toContain('full_name');
    expect(insertBlock).not.toContain('session.email');
  });

  it('tidak memakai kata sandaran seperti "sistem"', () => {
    // `?? 'sistem'` adalah bentuk yang persis menyebabkan bug ini: ia terbaca
    // sebagai penjagaan, padahal justru menjamin nilai yang tidak valid saat
    // profilnya kosong. Kolomnya nullable — `null` yang benar.
    expect(insertBlock).not.toContain("'sistem'");
  });
});

describe('yang dibaca untuk ditampilkan', () => {
  it('mengambil full_name lewat join, bukan kolom mentahnya', () => {
    // Tanpa ini layar menampilkan uuid kepada operator — secara teknis benar,
    // tapi tidak memberi tahu siapa pun siapa yang membuat laporannya.
    expect(QUERIES).toContain('reports_generated_by_fkey');
    expect(QUERIES).toContain('full_name');
  });

  it('menyebut nama FK-nya secara eksplisit', () => {
    // `profiles` tanpa nama FK menghasilkan HTTP 300 PGRST201 bila tabelnya
    // punya lebih dari satu kaitan ke `profiles` — kekeliruan yang sama pernah
    // mengosongkan panel pembayaran tanpa satu pun galat di layar.
    expect(QUERIES).toMatch(/profiles!reports_generated_by_fkey/);
  });

  it('tidak lagi memilih kolom generated_by mentah', () => {
    const select = QUERIES.slice(QUERIES.indexOf(".from('reports')"), QUERIES.indexOf('.eq('));
    expect(select).not.toMatch(/[\s,]generated_by[\s,]/);
  });
});
