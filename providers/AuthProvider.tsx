import { appStorage as storage } from '@/utils/storage';
import Constants from 'expo-constants';
import { router, useSegments } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';

export type User = {
  id: number;
  email: string;
  name?: string | null;
  title?: string | null;
  role: string;
  isEmailVerified?: boolean;
  createdAt?: string;
  loginCount?: number;
  avatarUrl?: string | null;
  emailVerifiedAt?: string | null;
  provider?: string | null;
  googlePicture?: string | null;
  googleId?: string | null;
} | null;

const API_URL = (Constants.expoConfig?.extra as any)?.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'https://devgadbadr.com/vibapi';

class ApiError extends Error {
  status: number;
  details?: any;
  constructor(message: string, status: number, details?: any) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function toHumanValidation(messages: unknown): string | null {
  if (!Array.isArray(messages)) return null;
  const mapOne = (m: string) => {
    const msg = m.toLowerCase();
    if (msg.includes('email must be an email')) return 'Please enter correct email address.';
    if (msg.includes('password must be longer than or equal to 8 characters')) return 'Password must be at least 8 characters.';
    if (msg.includes('password should not be empty')) return 'Password is required.';
    if (msg.includes('email should not be empty')) return 'Email is required.';
    // Fallback: capitalize first letter
    return m.charAt(0).toUpperCase() + m.slice(1);
  };
  return messages.map(mapOne).join('\n');
}

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
    // Try to parse JSON error for friendly messages
    let payload: any = null;
    try {
      payload = await res.json();
    } catch {
      // ignore
    }

    const validationMsg = toHumanValidation(payload?.message);
    let message: string | undefined = validationMsg || payload?.message;

    // Specific friendly messages
    if (!message && res.status === 403) message = 'You do not have permission to perform this action.';
    // Login invalid credentials
    if (res.status === 403 && (payload?.message === 'Invalid credentials' || String(payload?.message).toLowerCase().includes('invalid credentials'))) {
      message = 'Incorrect email or password.';
    }
    if (!message) message = res.statusText || 'Request failed';

    throw new ApiError(message, res.status, payload);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

interface AuthContextValue {
  user: User;
  loading: boolean;
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: { email: string; password: string; name?: string; title?: string }) => Promise<'verify' | 'ok'>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
  googleSignIn: (idToken: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const segments = useSegments();

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

  // Refresh when app returns to foreground (helps reflect verification changes without manual actions)
  useEffect(() => {
    let mounted = true;
    const lastRef = { t: 0 };
    const sub = AppState.addEventListener('change', async (state) => {
      if (!mounted) return;
      if (state === 'active') {
        const now = Date.now();
        // throttle to avoid excessive calls when bouncing between states
        if (now - lastRef.t > 30_000) {
          lastRef.t = now;
          try { await loadSession(); } catch {}
        }
      }
    });
    return () => { mounted = false; sub.remove(); };
  }, [loadSession]);

  // Route guard: keep unauthenticated users out of tabs and authenticated users out of auth screens.
  useEffect(() => {
    if (initializing) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login' as any);
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)' as any);
    }
  }, [segments, user, initializing]);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const data = await api<{ accessToken: string; refreshToken: string; user: User }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify({ email, password, device: Platform.OS }) }
      );
      await storage.setItem('accessToken', data.accessToken);
      await storage.setItem('refreshToken', data.refreshToken);
      setUser(data.user);
      router.replace('/(tabs)');
    } finally {
      setLoading(false);
    }
  }, []);

  const signUp = useCallback(async (payload: { email: string; password: string; name?: string; title?: string }): Promise<'verify' | 'ok'> => {
    setLoading(true);
    try {
      // returns created user (no tokens) per backend
      await api('/auth/signup', { method: 'POST', body: JSON.stringify(payload) });

      // Trigger email verification for the just-signed-up user
      try {
        await api('/email-verification/request', {
          method: 'POST',
          body: JSON.stringify({ email: payload.email }),
        });
      } catch (e) {
        // Non-fatal: still navigate to verification screen
        console.warn('Failed to send verification email:', e);
      }

      // keep email so the verify screen can show/resend
      await storage.setItem('pendingVerifyEmail', payload.email);

      // After signup, prompt verification screen (include email for convenience)
      router.replace({ pathname: '/(auth)/verify-email' as any, params: { email: payload.email } } as any);
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

  const googleSignIn = useCallback(async (idToken: string) => {
    setLoading(true);
    try {
      const data = await api<{ accessToken: string; refreshToken: string; user: User }>(
        '/auth/google',
        { method: 'POST', body: JSON.stringify({ idToken }), timeoutMs: 12000 } as any
      );
      if (data.accessToken) await storage.setItem('accessToken', data.accessToken);
      if (data.refreshToken) await storage.setItem('refreshToken', data.refreshToken);
      setUser(data.user);
      router.replace('/(tabs)');
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(() => ({ user, loading, initializing, signIn, signUp, signOut, refreshMe, googleSignIn }), [user, loading, initializing, signIn, signUp, signOut, refreshMe, googleSignIn]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
