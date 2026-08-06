/**
 * Stub untuk paket `server-only` saat dijalankan di Vitest.
 *
 * Di build Next.js, `import 'server-only'` sengaja gagal bila modulnya ikut
 * ter-bundle ke client. Paket itu tidak punya isi yang bisa dijalankan di
 * Node biasa, jadi test runner memakai modul kosong ini sebagai gantinya
 * (lihat alias di vitest.config.mts).
 */
export {};
