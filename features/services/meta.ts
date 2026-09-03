import type { Database } from '@/types/database';

type ServiceType = Database['public']['Enums']['service_type'];

/**
 * Satu sumber untuk membaca `services.meta`.
 *
 * ## Kenapa disatukan (3 September)
 *
 * Sampai hari ini ada **tiga** salinan pembaca kolom ini —
 * `serviceDetails()` di `features/services/queries.ts` dan
 * `features/vendors/queries.ts` (badannya identik, hanya beda `export`), plus
 * `itemsFrom()` di `features/landing/catalogue.ts`. Salinan pertama bahkan
 * membawa komentar yang membenarkan duplikasinya: *"keduanya menjawab
 * pertanyaan berbeda"*.
 *
 * Alasan itu tidak bertahan. Keduanya menjawab pertanyaan yang **sama** —
 * "apa isi paket ini?" — dan yang membuktikannya adalah bug 3 September:
 * `meta` bisa memuat bentuk aqiqah dan nasi box sekaligus, dan setiap salinan
 * mencetak keduanya bercampur. `metaFrom()` menutup jalan lahirnya bentuk
 * campuran **baru**, tetapi baris lama yang telanjur rusak tetap dirender
 * salah di empat layar. Memperbaikinya di tiga tempat berarti dua di antaranya
 * akan tertinggal cepat atau lambat.
 *
 * ## Bentuknya dua, dan pembedanya jenis paket
 *
 *   aqiqah    {"hasil": {"porsi": 80, "jenis": "gulai & sate"},
 *              "cocok_untuk": "keluarga kecil"}
 *   nasi_box  {"items": ["nasi putih", "sate"], "favorit": true}
 *
 * `meta` kolom bebas: ia bisa memuat kunci yang tidak dikenal siapa pun
 * (`favorit`, `premium`), dan bisa memuat sisa bentuk lawan dari baris yang
 * pernah berganti jenis. Karena itu **jenis paket yang menentukan apa yang
 * dibaca**, bukan sekadar kunci mana yang kebetulan ada.
 */

/** Isi paket dalam bentuk yang bisa disunting formulir. */
export type ServiceMetaFields = {
  porsi: number | null;
  jenisOlahan: string | null;
  cocokUntuk: string | null;
  items: string[];
};

function asObject(meta: unknown): Record<string, unknown> {
  return meta && typeof meta === 'object' && !Array.isArray(meta)
    ? (meta as Record<string, unknown>)
    : {};
}

/** Daftar lauk satu box, dari `meta.items`. */
export function metaItems(meta: unknown): string[] {
  const items = asObject(meta).items;
  return Array.isArray(items) ? items.filter((i): i is string => typeof i === 'string') : [];
}

/**
 * Isi paket terurai, untuk formulir katalog.
 *
 * Tidak menyaring per jenis: formulir memang perlu tahu apa yang **tersimpan**
 * supaya bisa menampilkannya kembali apa adanya. Yang menyaring adalah
 * `serviceDetails()` di bawah, yang dipakai untuk menampilkan.
 */
export function metaFields(meta: unknown): ServiceMetaFields {
  const m = asObject(meta);
  const hasil = asObject(m.hasil);

  return {
    porsi: typeof hasil.porsi === 'number' ? hasil.porsi : null,
    jenisOlahan: typeof hasil.jenis === 'string' ? hasil.jenis : null,
    cocokUntuk: typeof m.cocok_untuk === 'string' ? m.cocok_untuk : null,
    items: metaItems(meta),
  };
}

/**
 * Rincian paket sebagai kalimat siap tampil.
 *
 * **Menyaring menurut jenis paket**, dan itulah bedanya dengan versi lama.
 * Baris yang membawa sisa bentuk lawan — mungkin karena pernah berganti jenis
 * sebelum `metaFrom()` diperbaiki — akan tetap dirender benar: paket aqiqah
 * mencetak porsi dan olahan saja, nasi box mencetak lauknya saja.
 *
 * Tanpa penyaringan ini sebuah paket bisa tampil sebagai
 * "80 porsi · Olahan: gulai & sate · nasi putih · sate · Cocok untuk keluarga
 * kecil" — dan pengunjung tidak punya cara tahu mana yang benar.
 *
 * `type` opsional supaya pemanggil yang memang tidak tahu jenisnya (data
 * lama, atau join yang tidak membawa kolomnya) tetap mendapat perilaku lama
 * alih-alih daftar kosong.
 */
export function serviceDetails(meta: unknown, type?: ServiceType | string | null): string[] {
  const m = asObject(meta);
  const out: string[] = [];

  const isBox = type === 'nasi_box';
  const isAqiqahLike = type === undefined || type === null || !isBox;

  if (isAqiqahLike) {
    const hasil = asObject(m.hasil);
    if (typeof hasil.porsi === 'number' && hasil.porsi > 0) out.push(`${hasil.porsi} porsi`);
    if (typeof hasil.jenis === 'string' && hasil.jenis) out.push(`Olahan: ${hasil.jenis}`);
  }

  if (isBox || type === undefined || type === null) {
    out.push(...metaItems(meta));
  }

  if (isAqiqahLike && typeof m.cocok_untuk === 'string' && m.cocok_untuk) {
    out.push(`Cocok untuk ${m.cocok_untuk}`);
  }

  return out;
}
