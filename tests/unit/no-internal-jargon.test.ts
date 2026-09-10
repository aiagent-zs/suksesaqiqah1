import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Rujukan dokumen internal tidak boleh sampai ke layar.
 *
 * ## Kenapa berkas ini ada
 *
 * Dua kalimat di halaman detail order berbunyi "Jejak audit perubahan order
 * (docs/05 section 4.17)" dan "Transisi mengikuti state machine docs/08" —
 * keduanya dirender untuk admin, superadmin, dan mitra. Bagi mereka itu bukan
 * keterangan, melainkan kode yang tidak bisa ditindaklanjuti: tidak ada
 * `docs/05` yang bisa mereka buka, dan "state machine" bukan istilah yang
 * dipakai siapa pun di lapangan.
 *
 * Kalimat seperti itu lahir saat fitur dibangun sambil menengok spesifikasi,
 * dan bertahan karena tidak ada yang menyalahkan — build lolos, tes lolos,
 * layar tetap tampil. Yang menemukan biasanya pengguna, di produksi.
 *
 * Yang dijaga: **teks yang dirender**, bukan komentar. Komentar justru tempat
 * yang benar untuk menyebut `docs/08` — di situ ia menerangkan asal aturannya
 * kepada yang membaca kodenya.
 */
const DIRS = ['app', 'features', 'components'];

/**
 * Istilah yang tidak berarti apa-apa bagi admin atau mitra.
 *
 * Sengaja sempit: yang dikejar adalah rujukan dokumen dan nama komponen
 * internal, bukan setiap kata teknis. "Status" dan "order" memang dipakai
 * sehari-hari di sini dan tidak perlu diusir.
 */
const JARGON = [
  /docs\/\d+/i,
  /\bsection\s+\d/i,
  /§\s*\d+/,
  /\bstate machine\b/i,
  /\bRLS\b/,
  /\bPostgREST\b/i,
  /\bSupabase\b/i,
  /\bwebhook\b/i,
  /\bn8n\b/i,
];

function tsxFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) tsxFiles(full, found);
    else if (entry.name.endsWith('.tsx')) found.push(full.replace(/\\/g, '/'));
  }
  return found;
}

/**
 * Buang komentar, sisakan kode.
 *
 * Baris diganti spasi (bukan dihapus) supaya nomor barisnya tetap cocok dengan
 * berkas aslinya — pesan galat yang menunjuk baris keliru lebih menyulitkan
 * daripada tidak menunjuk sama sekali.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/^\s*\/\/.*$/gm, '');
}

/**
 * Teks yang benar-benar sampai ke mata pengguna.
 *
 * Dipindai atas **seluruh berkas**, bukan per baris: Prettier memecah teks JSX
 * yang panjang ke beberapa baris, sehingga `>…<` tidak pernah utuh dalam satu
 * baris. Versi per-baris dari tes ini hijau terhadap dua kalimat yang justru
 * memicunya ditulis — celah yang tertangkap saat menguji tes ini sendiri.
 */
function renderedText(src: string): Array<{ text: string; index: number }> {
  return [
    // Teks di antara tag, boleh melintasi baris: >Halo\n  dunia<
    ...[...src.matchAll(/>([^<>{}]{4,}?)</g)],
    // Atribut yang dibaca pengguna atau pembaca layar.
    ...[...src.matchAll(/(?:title|placeholder|aria-label)=["']([^"']{4,})["']/g)],
  ].map((m) => ({ text: m[1].replace(/\s+/g, ' ').trim(), index: m.index ?? 0 }));
}

const offenders = DIRS.flatMap((d) => tsxFiles(d)).flatMap((file) => {
  const src = stripComments(readFileSync(file, 'utf8'));
  return renderedText(src)
    .filter(({ text }) => JARGON.some((p) => p.test(text)))
    .map(({ text, index }) => {
      const line = src.slice(0, index).split('\n').length;
      return `${file}:${line} → "${text}"`;
    });
});

describe('penemuannya sendiri harus bekerja', () => {
  it('memindai berkas dalam jumlah yang masuk akal', () => {
    // Kalau penelusurannya patah, tes di bawah hijau tanpa menjaga apa pun.
    expect(DIRS.flatMap((d) => tsxFiles(d)).length).toBeGreaterThan(50);
  });

  it('mengenali jargon saat memang ada', () => {
    const contoh = '<p>Transisi mengikuti state machine docs/08.</p>';
    expect(renderedText(contoh).some(({ text }) => JARGON.some((p) => p.test(text)))).toBe(true);
  });

  it('mengenalinya meski teksnya terpecah beberapa baris', () => {
    // Bentuk yang dihasilkan Prettier pada kalimat panjang — dan bentuk yang
    // membuat versi per-baris tes ini buta.
    const contoh = '<p className="x">\n  Jejak audit perubahan order (docs/05 section 4.17)\n</p>';
    expect(renderedText(contoh).some(({ text }) => JARGON.some((p) => p.test(text)))).toBe(true);
  });

  it('tidak mengusik komentar yang menyebut dokumen', () => {
    // Komentar justru tempat yang benar untuk merujuk spesifikasi.
    const komentar = stripComments('  // Urutannya mengikuti docs/08 section 3.\n  <p>Halo</p>');
    expect(komentar).not.toContain('docs/08');
  });
});

describe('tidak ada rujukan internal di layar', () => {
  it('tidak satu pun teks yang dirender memuat jargon', () => {
    expect(offenders, `Teks berikut sampai ke layar pengguna:\n${offenders.join('\n')}`).toEqual(
      [],
    );
  });
});
