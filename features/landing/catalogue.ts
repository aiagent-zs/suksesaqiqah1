import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/env';
import type { Database } from '@/types/database';
import { metaItems } from '@/features/services/meta';

export type LandingProgram = {
  slug: string;
  /** Nama tanpa awalan jenis — kartunya sudah menuliskan "Aqiqah {name}". */
  name: string;
  price: number;
  popular: boolean;
  tagline: string | null;
  features: string[];
  photo: { src: string; alt: string } | null;
};

export type LandingBox = {
  slug: string;
  name: string;
  price: number;
  popular: boolean;
  items: string[];
};

/**
 * Katalog untuk halaman depan — **dibaca dari database**, bukan dari konstanta.
 *
 * ## Kenapa berubah
 *
 * Sampai 3 September halaman ini tidak menyentuh database sama sekali; seluruh
 * paket & harganya hardcode di `lib/constants/site.ts`. Dua daftar dijaga
 * sinkron oleh tangan, dan keduanya sudah pernah menyimpang: `paket-c-favorit`
 * & `paket-e-premium` membawa akhiran yang tidak pernah ada di katalog.
 *
 * Yang membuat penyimpangan itu berbahaya bukan besarnya, melainkan
 * senyapnya — `?paket=` dicocokkan sebagai slug, dan `checkout/page.tsx`
 * sengaja mengabaikan slug tak dikenal lalu jatuh ke paket pertama. Tidak ada
 * galat, tidak ada jejak; pengunjung mengira memesan Premium dan mendapat
 * Ekonomi. Satu sumber menghapus seluruh kelas kekeliruan itu.
 *
 * ## Ongkos yang diterima
 *
 * Halaman depan jadi punya query. Dulu ia prerender statis tanpa satu pun
 * permintaan database — itu keunggulan yang sungguhan, dan melepasnya perlu
 * alasan. Alasannya: katalog yang hanya bisa diubah developer bukan katalog,
 * dan halaman cepat yang memajang harga salah lebih mahal daripada query.
 *
 * Yang meredam ongkosnya sampai hampir nol: **halaman depan tetap prerender
 * statis**. Kliennya sengaja dirakit langsung dengan `@supabase/supabase-js`
 * alih-alih `lib/supabase/server.ts` — yang itu membaca `cookies()`, dan satu
 * panggilan `cookies()` saja memaksa seluruh rute jadi dinamis. Katalog adalah
 * data publik yang dibaca `anon` lewat `services_select_public`; tidak ada
 * sesi yang perlu dibaca, jadi tidak ada alasan menyentuh cookie.
 *
 * Hasilnya halaman ini dirender saat build lalu disajikan sebagai HTML statis,
 * persis seperti sebelum perubahan ini — dan tetap segar karena server action
 * katalog memanggil `revalidatePath('/')` tiap kali paket berubah.
 *
 * ## Kegagalan tidak boleh mengosongkan halaman
 *
 * Database tak terjangkau mengembalikan daftar kosong, bukan lemparan galat.
 * Halaman depan tanpa daftar paket masih menampilkan hero, proses, galeri, dan
 * kontak WhatsApp — sedangkan halaman yang gagal render sepenuhnya kehilangan
 * semuanya, termasuk jalan menghubungi. Pemanggilnya menyembunyikan section
 * yang kosong.
 */
export async function getLandingCatalogue(): Promise<{
  programs: LandingProgram[];
  boxes: LandingBox[];
}> {
  // Tanpa persistensi sesi: tidak ada yang login di halaman depan, dan
  // menyalakannya membuat klien ini mencoba menyimpan token di penyimpanan
  // yang tidak ada di server.
  const supabase = createSupabaseClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from('services')
    .select(
      'slug, type, name, price, tagline, landing_features, photo_path, photo_alt, is_popular, meta',
    )
    .eq('show_on_landing', true)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('sort_order');

  if (error) {
    console.error('[landing] getLandingCatalogue:', error.code ?? '-', error.message);
    return { programs: [], boxes: [] };
  }

  const rows = data ?? [];

  const programs = rows
    .filter((s) => s.type === 'aqiqah')
    .map((s) => ({
      slug: s.slug,
      // "Aqiqah Ekonomi" di katalog jadi "Ekonomi" di kartu, sebab kartunya
      // sudah menuliskan "Aqiqah {name}" dan tombolnya "Pesan paket {name}".
      // Tanpa ini keduanya berbunyi "Aqiqah Aqiqah Ekonomi".
      name: s.name.replace(/^aqiqah\s+/i, ''),
      price: Number(s.price),
      popular: s.is_popular,
      tagline: s.tagline,
      features: s.landing_features ?? [],
      photo: s.photo_path
        ? { src: s.photo_path, alt: s.photo_alt ?? `Sajian masakan paket ${s.name}` }
        : null,
    }));

  const boxes = rows
    .filter((s) => s.type === 'nasi_box')
    .map((s) => ({
      slug: s.slug,
      name: s.name,
      price: Number(s.price),
      popular: s.is_popular,
      items: metaItems(s.meta),
    }));

  return { programs, boxes };
}
