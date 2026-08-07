import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';
import { supabaseAnonKey, supabaseUrl } from './env';

/**
 * Supabase browser client — dipakai di Client Components ('use client').
 * Dibuat fresh setiap kali dipanggil (aman karena createBrowserClient internal caching).
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
}
