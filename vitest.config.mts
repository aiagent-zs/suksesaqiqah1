import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
      // `server-only` hanya penanda build Next.js dan tidak punya implementasi
      // yang bisa di-resolve Vitest. Diarahkan ke modul kosong agar modul server
      // murni (capabilities, state machine) tetap bisa diuji unit.
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
});
