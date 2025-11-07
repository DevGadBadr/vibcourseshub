import Constants from 'expo-constants';
import { router } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Storage abstraction (web: localStorage, native: in-memory fallback)
const memStore: Record<string, string | null> = {};
const storage = {
  async getItem(key: string) {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
    return memStore[key] ?? null;
  },
  async setItem(key: string, value: string) {
    if (typeof localStorage !== 'undefined') return localStorage.setItem(key, value);
    memStore[key] = value;
  },
  async removeItem(key: string) {
    if (typeof localStorage !== 'undefined') return localStorage.removeItem(key);
    memStore[key] = null;
  },
};

export type User = { id: number; email: string; name?: string | null; role: string; isEmailVerified?: boolean } | null;

const API_URL = (Constants.expoConfig?.extra as any)?.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'https://devgadbadr.com/vibapi';

async function api<T>(path: string, init?: RequestInit & { auth?: boolean }) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let access = await storage.getItem('accessToken');
  if (init?.auth && access) headers['Authorization'] = `Bearer ${access}`;

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (res.status === 401 && init?.auth) {
    // try refresh
    const rt = await storage.getItem('refreshToken');
    if (!rt) throw new Error('Unauthorized');
    const r = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!r.ok) throw new Error('Unauthorized');
    const data = await r.json();
    if (data?.accessToken) await storage.setItem('accessToken', data.accessToken);
    if (data?.refreshToken) await storage.setItem('refreshToken', data.refreshToken);
    access = data?.accessToken;
    const retryHeaders = { ...headers, Authorization: `Bearer ${access}` };
    const retry = await fetch(`${API_URL}${path}`, { ...init, headers: retryHeaders });
    if (!retry.ok) throw new Error(await retry.text());
    return (await retry.json()) as T;
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

interface AuthContextValue {
  user: User;
  loading: boolean;
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: { email: string; password: string; name?: string }) => Promise<'verify' | 'ok'>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      const at = await storage.getItem('accessToken');
      const rt = await storage.getItem('refreshToken');
      if (!at && !rt) {
        setUser(null);
        return;
      }
      const me = await api<User>('/auth/me', { method: 'GET', auth: true });
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await loadSession();
      setInitializing(false);
    })();
  }, [loadSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const data = await api<{ accessToken: string; refreshToken: string; user: User }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify({ email, password }) }
      );
      await storage.setItem('accessToken', data.accessToken);
      await storage.setItem('refreshToken', data.refreshToken);
      setUser(data.user);
      router.replace('/(tabs)');
    } finally {
      setLoading(false);
    }
  }, []);

  const signUp = useCallback(async (payload: { email: string; password: string; name?: string }): Promise<'verify' | 'ok'> => {
    setLoading(true);
    try {
      // returns created user (no tokens) per backend
      await api('/auth/signup', { method: 'POST', body: JSON.stringify(payload) });
      // After signup, prompt verification screen
  router.replace('/(auth)/verify-email' as any);
  return 'verify' as const;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const rt = await storage.getItem('refreshToken');
      if (rt) {
        await api('/auth/logout', { method: 'POST', auth: true, body: JSON.stringify({ refreshToken: rt }) });
      }
    } catch {}
    await storage.removeItem('accessToken');
    await storage.removeItem('refreshToken');
    setUser(null);
  router.replace('/(auth)/login' as any);
  }, []);

  const refreshMe = useCallback(async () => {
    await loadSession();
  }, [loadSession]);

  const value = useMemo(() => ({ user, loading, initializing, signIn, signUp, signOut, refreshMe }), [user, loading, initializing, signIn, signUp, signOut, refreshMe]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
