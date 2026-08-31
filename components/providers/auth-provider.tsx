'use client';

import React, { createContext, useContext } from 'react';
import type { Profile } from '@/server/auth/session';

interface AuthContextValue {
  profile: Profile | null;
}

const AuthContext = createContext<AuthContextValue>({ profile: null });

export function AuthProvider({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile: Profile | null;
}) {
  return <AuthContext.Provider value={{ profile }}>{children}</AuthContext.Provider>;
}

/**
 * Hook untuk membaca profile user (role, branch_id, dll) di Client Components.
 * Hanya tersedia di dalam <AuthProvider>.
 */
export function useAuth() {
  return useContext(AuthContext);
}
