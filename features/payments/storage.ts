/**
 * Aturan berkas bukti transfer di bucket `payment-proofs` (docs/17 section 1–4).
 *
 * Modul ini sengaja murni — tanpa impor Supabase atau `server-only` — karena
 * dipakai di dua sisi: klien memvalidasi sebelum mengunggah, server
 * memvalidasi ulang sebelum menyimpan `proof_path`. Validasi klien hanya
 * kenyamanan; yang mengikat adalah pemeriksaan di server action.
 */

export const PROOF_BUCKET = 'payment-proofs';

/** Sama dengan `file_size_limit` bucket di migration 08 — jangan dibuat berbeda. */
export const PROOF_MAX_BYTES = 5 * 1024 * 1024;

/**
 * MIME yang diizinkan beserta ekstensi kanoniknya.
 * Daftarnya cocok dengan `allowed_mime_types` bucket; ekstensi diturunkan dari
 * MIME, bukan dari nama file kiriman pengguna, supaya `bukti.pdf.exe` tidak
 * pernah menentukan ekstensi yang tersimpan.
 */
export const PROOF_MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

/**
 * Bentuk path yang sah: `{branch_code}/{order_number}/{uuid}.{ext}` (docs/17 section 3).
 *
 * Tiap segmen dibatasi charset sempit, jadi pola ini sekaligus menutup path
 * traversal (`../`) dan path absolut — keduanya tidak mungkin lolos regex ini.
 */
const PROOF_PATH_PATTERN =
  /^[A-Za-z0-9_-]{1,16}\/[A-Za-z0-9_-]{1,40}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp|pdf)$/;

export type ProofFileCheck = { ok: true; ext: string } | { ok: false; message: string };

/** Validasi MIME & ukuran satu berkas bukti. */
export function checkProofFile(file: { type: string; size: number }): ProofFileCheck {
  const ext = PROOF_MIME_EXT[file.type];
  if (!ext) {
    return {
      ok: false,
      message: 'Bukti transfer harus berupa JPG, PNG, WebP, atau PDF.',
    };
  }

  if (file.size <= 0) {
    return { ok: false, message: 'Berkas bukti transfer kosong.' };
  }

  if (file.size > PROOF_MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return {
      ok: false,
      message: `Ukuran bukti transfer ${mb} MB melebihi batas 5 MB. Perkecil dulu gambarnya.`,
    };
  }

  return { ok: true, ext };
}

/**
 * Susun path bukti sesuai konvensi penamaan.
 * Nama berkas memakai uuid, bukan nama asli — menghindari tabrakan sekaligus
 * mencegah nama file membocorkan data peserta (docs/17 section 3).
 */
export function buildProofPath(
  branchCode: string,
  orderNumber: string,
  uuid: string,
  ext: string,
): string {
  return `${branchCode}/${orderNumber}/${uuid}.${ext}`;
}

/**
 * Apakah `path` benar-benar milik order ini?
 *
 * Kebijakan Storage hanya membatasi *bucket*, bukan folder — seorang Admin
 * Cabang yang berhak mengunggah bisa saja mengirim path milik order cabang
 * lain. Server action wajib memanggil ini sebelum menyimpan `proof_path`,
 * memakai branch & nomor order yang dibaca dari database, bukan dari klien.
 */
export function isProofPathForOrder(
  path: string,
  branchCode: string,
  orderNumber: string,
): boolean {
  if (!PROOF_PATH_PATTERN.test(path)) return false;
  return path.startsWith(`${branchCode}/${orderNumber}/`);
}
