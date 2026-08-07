import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';
import { supabaseAnonKey, supabaseUrl } from './env';

/**
 * Supabase server client — dipakai di Server Components, Server Actions,
 * dan Route Handlers. Cookie dibaca/ditulis via next/headers.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // setAll dari Server Component tidak selalu bisa — diabaikan.
          // Middleware yang akan handle refresh token.
        }
      },
    },
  });
}
