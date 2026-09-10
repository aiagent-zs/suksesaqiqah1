/**
 * Foto anak untuk sertifikat aqiqah — aturan berkas dan path-nya.
 *
 * **Tanpa `'server-only'`**, dan itu disengaja: pemilihan berkas serta
 * pembentukan path terjadi di browser, karena berkasnya diunggah langsung dari
 * sana ke Storage (badan Server Action dibatasi 1 MB, foto ponsel rutin
 * melewatinya). Yang memang hanya bisa berjalan di server — mengunduh foto
 * untuk disematkan ke PDF — tinggal di `child-photo.server.ts`.
 */

/** Berkas foto anak yang diterima — sama dengan yang bisa disematkan React PDF. */
const ACCEPTED: Record<string, 'jpg' | 'png'> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
};

export const CHILD_PHOTO_ACCEPT = 'image/jpeg,image/png';

/** Batas ukuran foto anak. Sertifikat satu halaman tidak butuh lebih. */
export const CHILD_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Periksa berkas foto anak sebelum diunggah.
 *
 * **WebP sengaja ditolak** meski bucket `documentation` menerimanya untuk bukti
 * lapangan: React PDF hanya bisa menyematkan JPEG dan PNG. Membiarkannya
 * terunggah berarti sertifikatnya gagal dirender belakangan — jauh dari tempat
 * berkasnya dipilih, dengan pesan yang tidak menyebut foto sama sekali.
 */
export function checkChildPhoto(
  file: File,
): { ok: true; ext: 'jpg' | 'png' } | { ok: false; message: string } {
  const ext = ACCEPTED[file.type];
  if (!ext) {
    return { ok: false, message: 'Foto anak harus JPG atau PNG.' };
  }
  if (file.size > CHILD_PHOTO_MAX_BYTES) {
    return { ok: false, message: 'Ukuran foto maksimal 5 MB.' };
  }
  return { ok: true, ext };
}

/**
 * Path foto anak di bucket `documentation`.
 *
 * Nomor order tetap segmen ke-3, sama seperti bukti tahap — itulah yang dibaca
 * `storage_documentation_read` lewat `split_part(name, '/', 3)`, jadi
 * penjagaan per-mitra ikut berlaku tanpa policy tambahan.
 */
export function buildChildPhotoPath(params: {
  orderNumber: string;
  orderCreatedAt: string;
  uuid: string;
  ext: 'jpg' | 'png';
}): string {
  const d = new Date(params.orderCreatedAt);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}/${mm}/${params.orderNumber}/anak/${params.uuid}.${params.ext}`;
}
