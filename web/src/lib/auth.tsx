"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthResponse, AuthUser } from '@shared/index';
import { api, onSessionExpired } from './api';
import { SessionExpiredDialog } from '@/components/session-expired-dialog';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // The httpOnly auth cookie (if any) travels automatically with this
    // request; there is nothing to read client-side to decide whether to
    // even attempt it, so /api/auth/me is the single source of truth for
    // session restore on load.
    api<AuthUser>('/api/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    setUser(result.user);
    setSessionExpired(false);
    return result.user;
  }, []);

  const logout = useCallback(() => {
    api('/api/auth/logout', { method: 'POST' })
      .catch(() => undefined)
      .finally(() => {
        setUser(null);
        router.push('/login');
      });
  }, [router]);

  // Any authenticated request that comes back 401 (cookie expired or
  // invalidated) flips this flag — only relevant once we know a session
  // existed in the first place, so the login page itself is unaffected.
  useEffect(() => onSessionExpired(() => setSessionExpired(true)), []);

  const dismissExpiredSession = useCallback(() => {
    setSessionExpired(false);
    setUser(null);
    router.push('/login');
  }, [router]);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return (
    <AuthContext.Provider value={value}>
      {children}
      {sessionExpired && user ? <SessionExpiredDialog onExpire={dismissExpiredSession} /> : null}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export function homeFor(user: AuthUser): string {
  switch (user.role) {
    case 'super_admin':
      return '/super';
    case 'salon_admin':
      return '/admin';
    case 'kiosk':
      return `/kiosk/${user.salonId}`;
    default:
      return '/reception';
  }
}
