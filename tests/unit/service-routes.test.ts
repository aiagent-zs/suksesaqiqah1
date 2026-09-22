import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Rute katalog paket.
 *
 * ## Kenapa berkas ini ada
 *
 * Menyunting paket dulu hanya membuka formulir di **atas** daftar. Pada daftar
 * sepuluh paket itu berarti formulirnya terbuka di luar layar: tombol ditekan,
 * tidak ada yang tampak berubah, dan tombolnya terbaca sebagai rusak.
 *
 * Perbaikannya memindahkannya ke halaman sendiri — dan kepindahan itu membawa
 * satu risiko yang tidak terlihat dari kodenya: `/vendors/katalog/{id}`
 * bersarang di bawah rute dinamis `/vendors/[id]` yang sudah ada. Keduanya
 * hidup berdampingan (Next mendahulukan segmen harfiah), tapi tidak ada satu
 * pun galat yang muncul kalau kelak salah satunya dipindah atau dihapus —
 * yang terjadi hanya halaman katalog diam-diam ditangani halaman mitra.
 */
describe('rute katalog', () => {
  const root = process.cwd();

  it('halaman detail paket ada di tempat yang ditautkan daftar', () => {
    expect(existsSync(join(root, 'app/(app)/vendors/katalog/[id]/page.tsx'))).toBe(true);
  });

  it('halaman detail mitra tetap ada — keduanya berdampingan', () => {
    // Kalau yang ini hilang, `katalog` akan tetap cocok sebagai `[id]` dan
    // seluruh tautan katalog berakhir di halaman yang salah.
    expect(existsSync(join(root, 'app/(app)/vendors/[id]/page.tsx'))).toBe(true);
  });

  it('`/services` sudah tidak ada — katalog menyatu di /vendors', () => {
    expect(existsSync(join(root, 'app/(app)/services/page.tsx'))).toBe(false);
  });

  /**
   * Segmen harfiah `katalog` mendahului `[id]`, jadi `/vendors/katalog` tanpa
   * id **tidak** cocok dengan halaman detail paket — ia jatuh ke
   * `/vendors/[id]` dengan id `"katalog"`.
   *
   * Itu bukan kerusakan: `getVendorDetail` memakai `.maybeSingle()` yang
   * mengembalikan `null` untuk galat `22P02` (uuid tidak sah), dan halamannya
   * memanggil `notFound()`. Tes ini menjaga rantai itu tetap utuh — kalau
   * `.maybeSingle()` kelak diganti `.single()` yang melempar, alamat itu
   * berubah dari 404 jadi halaman galat.
   */
  it('halaman mitra memulangkan 404 untuk id yang tidak ditemukan', () => {
    const page = readFileSync(join(root, 'app/(app)/vendors/[id]/page.tsx'), 'utf8');
    expect(page).toContain('notFound()');

    const queries = readFileSync(join(root, 'features/vendors/queries.ts'), 'utf8');
    expect(queries).toContain('.maybeSingle()');
  });

  it('halaman detail paket juga memulangkan 404, bukan halaman kosong', () => {
    const page = readFileSync(join(root, 'app/(app)/vendors/katalog/[id]/page.tsx'), 'utf8');
    expect(page).toContain('notFound()');
  });
});

/**
 * Aksi per baris di daftar katalog.
 *
 * Yang diminta: **Lihat, Edit, Hapus** — bukan "Sunting" yang tidak membawa ke
 * mana pun. Ketiganya diperiksa sebagai teks yang benar-benar dirender, sebab
 * inilah yang dibaca operator di layar.
 */
describe('tombol per baris katalog', () => {
  const manager = readFileSync(
    join(process.cwd(), 'features/services/components/service-manager.tsx'),
    'utf8',
  );

  it('memakai Lihat / Edit / Hapus', () => {
    expect(manager).toContain('Lihat');
    expect(manager).toContain('Edit');
    expect(manager).toContain('Hapus');
  });

  it('tidak lagi memakai kata "Sunting"', () => {
    // Kata itu menandai perilaku lama — formulir sisipan yang tidak membawa ke
    // mana pun. Kalau ia muncul lagi, kemungkinan besar perilakunya ikut.
    expect(manager).not.toContain('Sunting');
  });

  it('Lihat adalah tautan sungguhan ke halaman detail, bukan handler', () => {
    // Inilah inti keluhan aslinya: tombol yang tidak memindahkan ke mana pun.
    // `href` memastikan ia benar-benar bernavigasi — sekaligus membuat
    // klik-tengah dan "buka di tab baru" bekerja.
    expect(manager).toContain('href={`/vendors/katalog/${s.id}`}');
  });

  it('Edit membuka dialog, dan itu bukan kemunduran ke formulir sisipan', () => {
    // Berubah 22 September: dulu tautan ke `#data-paket` di halaman detail.
    // Dialog lebih tepat untuk perbaikan cepat — operator tidak kehilangan
    // tempatnya di daftar, dan tidak perlu dua perpindahan halaman untuk
    // mengubah satu angka.
    //
    // Yang membedakannya dari formulir sisipan yang dulu dikeluhkan: dialog
    // TIDAK mendorong daftar ke bawah layar. Jadi yang dijaga di sini bukan
    // "jangan pakai formulir di layar ini", melainkan "jangan pakai yang
    // menggeser isi halaman".
    expect(manager).toContain('<ServiceDialog');
    expect(manager).toContain('service={s}');

    const dialog = readFileSync(
      join(process.cwd(), 'features/services/components/service-dialog.tsx'),
      'utf8',
    );
    expect(dialog).toContain('<Modal');

    // Markup-nya tinggal di primitif `components/ui/modal.tsx` sejak 22
    // September — sebelumnya tersalin delapan kali di `features/`. Yang dijaga
    // di sini justru sifatnya: `fixed` + `translate` membuatnya melayang di
    // atas halaman, jadi tidak ada isi yang bergeser.
    const modal = readFileSync(join(process.cwd(), 'components/ui/modal.tsx'), 'utf8');
    expect(modal).toContain('fixed top-1/2 left-1/2');
    // Tanpa keduanya, dialog panjang terpotong di layar pendek tanpa galat.
    expect(modal).toContain('max-h-[90dvh]');
    expect(modal).toContain('overflow-y-auto');
  });

  it('halaman detail tetap punya jangkar data paket', () => {
    // Dialog tidak menggantikan halaman detail: foto, kaitan ke order & mitra,
    // dan tombol aktif/non-aktif masih tinggal di sana. Jangkarnya dijaga
    // supaya tautan yang sudah dibagikan tidak mendarat di atas halaman.
    const detail = readFileSync(
      join(process.cwd(), 'app/(app)/vendors/katalog/[id]/page.tsx'),
      'utf8',
    );
    expect(detail).toContain('id="data-paket"');
  });

  it('hapus memakai dialog penegasan, bukan tombol yang bertukar teks', () => {
    // Tombol yang berubah jadi "Yakin hapus?" di tempat yang sama membuat klik
    // kedua yang tidak disengaja langsung menghapus — dan tidak menyisakan
    // ruang menjelaskan akibatnya.
    expect(manager).toContain('<ServiceDeleteDialog');

    // Diperiksa di luar komentar: penjelasan kenapa pola lama ditinggalkan
    // justru menyebut teksnya, dan `not.toContain` polos akan menangkap
    // komentar itu sendiri. Yang dijaga adalah teks yang benar-benar dirender.
    const rendered = manager
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(rendered).not.toContain('Yakin hapus?');

    const del = readFileSync(
      join(process.cwd(), 'features/services/components/service-delete-dialog.tsx'),
      'utf8',
    );
    expect(del).toContain('<ConfirmModal');

    // `ConfirmModal` wajib berdiri di atas `AlertDialog`, bukan `Dialog`: yang
    // pertama tidak bisa ditutup dengan klik di luar atau Escape, dan itu tepat
    // untuk aksi yang tidak punya jalan kembali. Diperiksa di primitifnya —
    // menukarnya di sana akan melemahkan seluruh penegasan sekaligus.
    const modal = readFileSync(join(process.cwd(), 'components/ui/modal.tsx'), 'utf8');
    expect(modal).toContain('AlertDialog.Root');
  });

  it('aktif/non-aktif tidak lagi di baris daftar', () => {
    // Pindah ke halaman detail supaya tombolnya bisa menjelaskan diri sebelum
    // ditekan: di sana jumlah order yang memakai paket ini sudah terbaca.
    expect(manager).not.toContain('Nonaktifkan');

    const actions = readFileSync(
      join(process.cwd(), 'features/services/components/service-detail-actions.tsx'),
      'utf8',
    );
    expect(actions).toContain('Nonaktifkan');
  });
});
