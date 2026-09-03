/**
 * Aturan berkas foto katalog di bucket `public-assets`.
 *
 * Modul ini sengaja murni — tanpa impor Supabase atau `server-only` — karena
 * dipakai di dua sisi: klien memvalidasi sebelum mengunggah, server
 * memvalidasi ulang sebelum menyimpan `photo_path`. Validasi klien hanya
 * kenyamanan; yang mengikat adalah pemeriksaan di server action. Pola yang
 * sama dengan `features/payments/storage.ts`.
 *
 * ## Bucket ini publik, dan itu disengaja
 *
 * Berbeda dari `documentation` dan `payment-proofs` yang privat dan hanya
 * lewat signed URL berdurasi pendek. Foto katalog memang untuk dipajang di
 * halaman depan kepada pengunjung anonim — menandatanganinya berarti URL yang
 * kedaluwarsa di tengah kunjungan dan tidak bisa disinggahkan CDN.
 *
 * Konsekuensinya perlu disadari: **apa pun yang diunggah ke sini bisa dibaca
 * siapa saja yang menebak URL-nya.** Karena itu hanya superadmin yang boleh
 * menulis (`storage_public_assets_write`), dan tempatnya bukan untuk berkas
 * yang memuat data pemesan.
 */

export const PUBLIC_ASSET_BUCKET = 'public-assets';

/** Sama dengan `file_size_limit` bucket di migration 09 — jangan dibuat berbeda. */
export const SERVICE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/**
 * MIME yang diizinkan beserta ekstensi kanoniknya.
 *
 * Bagian dari daftar bucket, bukan seluruhnya: `image/svg+xml` dan
 * `image/x-icon` sengaja **tidak** ikut meski bucket menerimanya. SVG adalah
 * dokumen yang bisa memuat `<script>`, dan berkas ini disajikan dari origin
 * yang sama dengan aplikasi. Untuk foto masakan ia juga tidak berguna.
 *
 * Ekstensi diturunkan dari MIME, bukan dari nama berkas kiriman pengguna,
 * supaya `foto.webp.svg` tidak pernah menentukan ekstensi yang tersimpan.
 */
export const SERVICE_PHOTO_MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Bentuk path yang sah: `services/{slug}/{uuid}.{ext}`.
 *
 * Tiap segmen dibatasi charset sempit, jadi pola ini sekaligus menutup path
 * traversal (`../`) dan path absolut — keduanya tidak mungkin lolos regex ini.
 *
 * Slug ikut masuk path sebagai penanda yang terbaca manusia saat menyisir
 * bucket. Ia **tidak** dipakai untuk mencocokkan kepemilikan: slug bisa
 * disunting, dan path lama yang menyebut slug sebelumnya tetap sah — yang
 * mengikat foto ke paket adalah kolom `photo_path`, bukan isi path-nya.
 */
const SERVICE_PHOTO_PATH_PATTERN =
  /^services\/[a-z0-9]+(?:-[a-z0-9]+)*\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;

export type ServicePhotoCheck = { ok: true; ext: string } | { ok: false; message: string };

/** Validasi MIME & ukuran satu berkas foto katalog. */
export function checkServicePhoto(file: { type: string; size: number }): ServicePhotoCheck {
  const ext = SERVICE_PHOTO_MIME_EXT[file.type];
  if (!ext) {
    return { ok: false, message: 'Foto harus berupa JPG, PNG, atau WebP.' };
  }

  if (file.size <= 0) {
    return { ok: false, message: 'Berkas foto kosong.' };
  }

  if (file.size > SERVICE_PHOTO_MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return {
      ok: false,
      message: `Ukuran foto ${mb} MB melebihi batas 5 MB. Perkecil dulu gambarnya.`,
    };
  }

  return { ok: true, ext };
}

/** Path unggahan baru untuk sebuah paket. */
export function servicePhotoPath(slug: string, ext: string): string {
  return `services/${slug}/${crypto.randomUUID()}.${ext}`;
}

/**
 * Apakah `photo_path` menunjuk berkas bawaan repo, bukan Storage?
 *
 * Kesepuluh foto landing yang sudah ada tinggal di `public/images/landing/`
 * dan ikut saat build. Keduanya hidup berdampingan di kolom yang sama, jadi
 * pembedanya harus satu aturan yang dipakai di mana-mana — di sini, di
 * `SitePhoto`, dan di aksi hapus.
 */
export function isRepoPhotoPath(path: string): boolean {
  return path.startsWith('images/');
}

/**
 * Path Storage yang sah untuk disimpan ke `photo_path`.
 *
 * Diperiksa ulang di server action meski path-nya dirakit sendiri oleh
 * `servicePhotoPath()`: yang sampai ke action datang dari klien, dan klien
 * bisa mengirim apa pun. Tanpa ini, `photo_path` bisa diisi path ke object
 * milik bucket lain.
 */
export function isServicePhotoPath(path: string): boolean {
  return SERVICE_PHOTO_PATH_PATTERN.test(path);
}
