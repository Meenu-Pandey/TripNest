import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import { authService } from '@/services/auth.service';
import type { LoginInput, RegisterInput, User } from '@/types/auth';
import { AuthContext, type AuthContextValue, type AuthStatus } from './AuthContext';

export interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() => {
    return apiClient.getToken() ? 'loading' : 'unauthenticated';
  });

  const refreshUser = useCallback(async () => {
    const token = apiClient.getToken();
    if (!token) {
      setUser(null);
      setStatus('unauthenticated');
      return;
    }

    try {
      const currentUser = await authService.getMe();
      setUser(currentUser);
      setStatus('authenticated');
    } catch {
      apiClient.clearToken();
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    const token = apiClient.getToken();
    if (!token) return;

    let isMounted = true;
    authService
      .getMe()
      .then((currentUser) => {
        if (isMounted) {
          setUser(currentUser);
          setStatus('authenticated');
        }
      })
      .catch(() => {
        if (isMounted) {
          apiClient.clearToken();
          setUser(null);
          setStatus('unauthenticated');
        }
      });

    const handleUnauthorized = () => {
      setUser(null);
      setStatus('unauthenticated');
    };

    window.addEventListener('tripnest:unauthorized', handleUnauthorized);
    return () => {
      isMounted = false;
      window.removeEventListener('tripnest:unauthorized', handleUnauthorized);
    };
  }, []);

  const login = useCallback(
    async (input: LoginInput) => {
      setStatus('loading');
      try {
        const res = await authService.login(input);
        setUser(res.user);
        setStatus('authenticated');
      } catch (err) {
        setStatus('unauthenticated');
        throw err;
      }
    },
    [],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      setStatus('loading');
      try {
        const res = await authService.register(input);
        setUser(res.user);
        setStatus('authenticated');
      } catch (err) {
        setStatus('unauthenticated');
        throw err;
      }
    },
    [],
  );

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated' && user !== null,
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, status, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
