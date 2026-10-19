import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { supabaseUrl } from './env';

/**
 * Client service-role — **melewati RLS**.
 *
 * Hanya untuk route yang dipanggil server lain tanpa sesi login (webhook
 * Durianpay). Jangan diimpor dari komponen atau server action yang menerima
 * input pengguna: di sana RLS adalah pagar utamanya.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Environment SUPABASE_SERVICE_ROLE_KEY belum diisi.');
  return createClient<Database>(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
