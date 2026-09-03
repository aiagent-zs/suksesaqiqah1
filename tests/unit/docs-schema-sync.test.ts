import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `docs/` tidak boleh menyimpang dari skema.
 *
 * ## Kenapa berkas ini ada
 *
 * `docs/05`–`08` sempat **tertinggal enam pekan**: keempatnya masih
 * menggambarkan `branches`, lima role, dan `slaughter_records` — semuanya
 * dihapus 20 Agustus. Karena urutan otoritas menempatkan `docs/` paling akhir,
 * itu tidak pernah menghentikan pekerjaan; ia hanya menyesatkan siapa pun yang
 * membacanya duluan, termasuk yang menulis kode baru berdasarkan dokumen itu.
 *
 * Yang dijaga di sini bukan isi dokumennya — itu pekerjaan manusia — melainkan
 * **tidak adanya nama yang sudah tidak ada** dipakai sebagai deskripsi.
 */
describe('docs selaras dengan skema', () => {
  const DOCS = [
    '05_DATABASE_DESIGN.md',
    '06_MODULE_BREAKDOWN.md',
    '07_USER_ROLES.md',
    '08_WORKFLOW_MAP.md',
  ];

  /** Nama yang benar-benar dihapus dari database 20 Agustus. */
  const DIHAPUS = [
    'branches',
    'slaughter_records',
    'distributions',
    'pic_user_id',
    'branch_id',
    'v_branch_kpi',
    'admin_cabang',
    'admin_pusat',
    'petugas_lapangan',
    'manager_program',
  ];

  /**
   * Bagian yang memang **membicarakan** istilah lama dilewati.
   *
   * Dua bentuk, keduanya eksplisit:
   *
   *   1. Blockquote (`>`) — catatan revisi di puncak tiap dokumen.
   *   2. Blok bertanda `<!-- schema-history -->` … `<!-- /schema-history -->`
   *      untuk tabel & judul yang menerangkan apa yang dihapus.
   *
   * Versi pertama tes ini memakai regex kata kunci (`dihapus|diganti|…`) dan
   * harus ditambal dua kali karena tiap baris tabel berbunyi berbeda — lalu
   * masih meleset. Penanda eksplisit memindahkan keputusannya ke penulis
   * dokumen, yang memang tahu mana kalimat sejarah dan mana deskripsi, dan
   * tidak bisa lolos diam-diam hanya karena kebetulan memuat kata tertentu.
   */
  function barisAktif(src: string): Array<{ line: string; no: number }> {
    const out: Array<{ line: string; no: number }> = [];
    let dalamSejarah = false;

    src.split('\n').forEach((line, i) => {
      if (line.includes('<!-- schema-history -->')) dalamSejarah = true;
      else if (line.includes('<!-- /schema-history -->')) dalamSejarah = false;
      else if (!dalamSejarah && !line.trimStart().startsWith('>')) {
        out.push({ line, no: i + 1 });
      }
    });

    return out;
  }

  it.each(DOCS)('%s tidak memakai nama yang sudah dihapus sebagai deskripsi', (file) => {
    const src = readFileSync(join(process.cwd(), 'docs', file), 'utf8');

    const pelanggaran = barisAktif(src)
      .filter(({ line }) => DIHAPUS.some((t) => line.includes(t)))
      .map(({ line, no }) => `  baris ${no}: ${line.trim().slice(0, 90)}`);

    expect(pelanggaran, `\n${pelanggaran.join('\n')}`).toEqual([]);
  });

  it('penanda sejarah berpasangan', () => {
    // Penanda pembuka tanpa penutup membuat SELURUH sisa dokumen terlewat —
    // dan tes di atas berhenti menjaga apa pun tanpa pernah merah.
    for (const file of DOCS) {
      const src = readFileSync(join(process.cwd(), 'docs', file), 'utf8');
      const buka = (src.match(/<!-- schema-history -->/g) ?? []).length;
      const tutup = (src.match(/<!-- \/schema-history -->/g) ?? []).length;
      expect(buka, `${file}: penanda tidak berpasangan`).toBe(tutup);
    }
  });

  it('ketiga role yang berlaku disebut di 07', () => {
    const src = readFileSync(join(process.cwd(), 'docs/07_USER_ROLES.md'), 'utf8');
    for (const role of ['superadmin', 'admin', 'vendor']) {
      expect(src).toContain(role);
    }
  });

  it('05 menyebut kedua percabangan tahap', () => {
    const src = readFileSync(join(process.cwd(), 'docs/05_DATABASE_DESIGN.md'), 'utf8');
    // Percabangan inilah yang membuat tahapan tidak bisa jadi status, dan
    // itulah perubahan yang membuat v1.0 keliru.
    expect(src).toContain('persiapan → sembelih → masak → salur');
    expect(src).toContain('persiapan → sembelih → masak → kirim → terkirim');
  });

  it('design.md menyebut pustaka yang benar-benar dipakai', () => {
    const src = readFileSync(join(process.cwd(), 'design.md'), 'utf8');
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };

    // Yang terpasang sungguhan, dibaca dari package.json — bukan disalin.
    expect(pkg.dependencies).toHaveProperty('@base-ui/react');
    expect(pkg.dependencies).not.toHaveProperty('recharts');

    expect(src).toContain('@base-ui/react');
    // Recharts boleh disebut sebagai rencana, tapi tidak sebagai yang dipakai.
    for (const line of src.split('\n').filter((l) => /recharts/i.test(l))) {
      expect(line).toMatch(/bukan|kalau kelak|belum/i);
    }
  });

  it('setiap dokumen membawa versi & tanggal', () => {
    for (const file of DOCS) {
      const src = readFileSync(join(process.cwd(), 'docs', file), 'utf8');
      // Dokumen tanpa tanggal tidak bisa dinilai basi atau tidak — dan itulah
      // yang membuat keempatnya tertinggal enam pekan tanpa ada yang sadar.
      expect(src).toMatch(/\| Tanggal\s*\|/);
      expect(src).toMatch(/\| Versi\s*\|/);
    }
  });

  it('tidak ada lagi yang berstatus Draft menunggu approval', () => {
    for (const file of DOCS) {
      const src = readFileSync(join(process.cwd(), 'docs', file), 'utf8');
      expect(src).not.toMatch(/Draft — menunggu approval/);
    }
  });

  it('daftar DOCS menunjuk berkas yang nyata', () => {
    // Penjaga tes ini sendiri: daftar yang salah nama akan membuat seluruh
    // pemeriksaan di atas melempar, bukan diam-diam lolos.
    const ada = readdirSync(join(process.cwd(), 'docs'));
    for (const file of DOCS) expect(ada).toContain(file);
  });
});
