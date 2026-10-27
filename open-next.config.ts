import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Tanpa incremental cache (R2): hampir seluruh halaman dinamis (cookie kanal,
// sesi Supabase), jadi bucket cache belum memberi apa-apa selain satu resource
// yang harus dibuat dulu. Tambahkan `r2IncrementalCache` bila ada halaman ISR.
export default defineCloudflareConfig({});
