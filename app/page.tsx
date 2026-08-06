import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth/session';

/**
 * Root page (/) — redirect berdasarkan status sesi:
 * - Sudah login → /dashboard
 * - Belum login → /login
 */
export default async function RootPage() {
  const session = await getSession();

  if (session) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
