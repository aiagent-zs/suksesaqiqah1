
/**
 * Kredensial Supabase dari environment.
 *
 * Ketiga pembuat client (`client.ts`, `server.ts`, `middleware.ts`) dulu memakai
 * `process.env.X!` — tanda `!` itu hanya janji ke TypeScript dan tidak ada
 * artinya saat runtime, sehingga `.env.local` yang belum diisi muncul sebagai
 * lemparan dari dalam @supabase/ssr di baris `createServerClient(...)`, jauh
 * dari penyebab sebenarnya. Di sini kesalahannya diberi nama.
 *
 * Nilai ditulis sebagai ekspresi literal `process.env.NEXT_PUBLIC_...` karena
 * Next.js mengganti bentuk itu saat build agar ikut terbawa ke bundel browser;
 * akses dinamis (`process.env[key]`) tidak ikut tergantikan.
 */
const SETUP_HINT =
  'Salin .env.example ke .env.local lalu isi kredensialnya. ' +
  'Project cloud: Settings > API Keys di dashboard Supabase. ' +
  'Database lokal: jalankan `npm run db:start` dan ambil nilainya dari keluaran perintah itu.';

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Environment ${name} belum diisi. ${SETUP_HINT}`);
  }
  return value;
}

export function supabaseUrl(): string {
  return required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
}

/**
 * Kunci publik untuk client-side.
 *
 * Supabase mengganti nama `anon key` menjadi `publishable key` (berawalan
 * `sb_publishable_`); keduanya menempati posisi argumen yang sama dan sama-sama
 * tunduk pada RLS. Nama baru dipakai lebih dulu, nama lama tetap diterima agar
 * project yang belum bermigrasi tidak ikut rusak.
 */
export function supabaseAnonKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', key);
}
