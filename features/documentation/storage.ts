import type { Database } from '@/types/database';

export type DocStage = Database['public']['Enums']['doc_stage'];
export type DocType = Database['public']['Enums']['doc_type'];
export type DocStatus = Database['public']['Enums']['doc_status'];

/**
 * Aturan berkas dokumentasi lapangan (docs/17 section 1–3).
 *
 * Modul murni — dipakai klien sebelum mengunggah dan server sebelum menyimpan
 * `storage_path`. Yang mengikat adalah pemeriksaan di server action.
 */
export const DOC_BUCKET = 'documentation';

/** Sama dengan `file_size_limit` bucket di migration 08. */
export const DOC_MAX_BYTES = 25 * 1024 * 1024;

/** Target praktis untuk foto (docs/17 section 2) — dipakai sebagai peringatan, bukan penolakan. */
export const DOC_PHOTO_TARGET_BYTES = 2 * 1024 * 1024;

export const DOC_MIME_EXT: Record<string, { ext: string; type: DocType }> = {
  'image/jpeg': { ext: 'jpg', type: 'photo' },
  'image/png': { ext: 'png', type: 'photo' },
  'image/webp': { ext: 'webp', type: 'photo' },
  'video/mp4': { ext: 'mp4', type: 'video' },
};

/**
 * `{YYYY}/{MM}/{order_number}/{stage}/{uuid}.{ext}`
 *
 * Segmen cabang dibuang bersama tabelnya, dan sengaja **tidak** diganti kode
 * mitra: kode mitra bisa berubah, dan admin bisa memindahkan order ke mitra
 * lain — keduanya membuat prefix menunjuk pemilik yang sudah tidak relevan.
 * `order_number` unik global dan tidak pernah berubah seumur hidup order, jadi
 * pemeriksaan kepemilikan di bawah justru jadi lebih kuat.
 *
 * Charset tiap segmen sengaja sempit sehingga pola ini sekaligus menutup path
 * traversal dan path absolut.
 */
const DOC_PATH_PATTERN =
  /^\d{4}\/(?:0[1-9]|1[0-2])\/[A-Za-z0-9_-]{1,40}\/(?:persiapan|sembelih|masak|salur|kirim|terkirim|umum)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp|mp4)$/;

export type DocFileCheck =
  { ok: true; ext: string; type: DocType; oversizePhoto: boolean } | { ok: false; message: string };

/** Validasi MIME & ukuran satu berkas dokumentasi. */
export function checkDocFile(file: { type: string; size: number }): DocFileCheck {
  const meta = DOC_MIME_EXT[file.type];
  if (!meta) {
    return { ok: false, message: 'Dokumentasi harus berupa JPG, PNG, WebP, atau MP4.' };
  }

  if (file.size <= 0) {
    return { ok: false, message: 'Berkas dokumentasi kosong.' };
  }

  if (file.size > DOC_MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return { ok: false, message: `Ukuran berkas ${mb} MB melebihi batas 25 MB.` };
  }

  return {
    ok: true,
    ext: meta.ext,
    type: meta.type,
    // Bukan penolakan: foto besar tetap diterima, tapi petugas lapangan diberi
    // tahu supaya kuota datanya tidak terkuras (docs/17 section 2).
    oversizePhoto: meta.type === 'photo' && file.size > DOC_PHOTO_TARGET_BYTES,
  };
}

/**
 * Susun path dokumentasi.
 * `orderCreatedAt` menentukan folder tahun/bulan agar berkas satu order tidak
 * tersebar ke dua bulan hanya karena diunggah lewat tengah malam.
 */
export function buildDocPath(params: {
  orderNumber: string;
  orderCreatedAt: string;
  stage: DocStage;
  uuid: string;
  ext: string;
}): string {
  const d = new Date(params.orderCreatedAt);
  const year = String(d.getUTCFullYear());
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');

  return `${year}/${month}/${params.orderNumber}/${params.stage}/${params.uuid}.${params.ext}`;
}

/**
 * Apakah `path` benar-benar milik order & tahap ini?
 *
 * Kebijakan Storage `storage_documentation_insert` hanya menuntut pengunggah
 * punya role — sama sekali tidak membatasi folder. Tanpa pemeriksaan ini,
 * seorang petugas bisa menautkan berkas milik order lain ke dokumentasinya.
 */
export function isDocPathForOrder(path: string, orderNumber: string, stage: DocStage): boolean {
  if (!DOC_PATH_PATTERN.test(path)) return false;

  const segments = path.split('/');
  return segments[2] === orderNumber && segments[3] === stage;
}
