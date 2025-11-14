import { appStorage } from '@/utils/storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';

export type ThemeName = 'light' | 'dark';

type ThemePreferenceContextValue = {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  toggleTheme: () => void;
  hydrated: boolean;
};

export const ThemePreferenceContext = createContext<ThemePreferenceContextValue | undefined>(undefined);

const STORAGE_KEY = 'appTheme';

export const ThemePreferenceProvider: React.FC<{ children: React.ReactNode; defaultTheme?: ThemeName }> = ({ children, defaultTheme = 'light' }) => {
  const [theme, setThemeState] = useState<ThemeName>(defaultTheme);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = (await appStorage.getItem(STORAGE_KEY)) as ThemeName | null;
        if (mounted && (saved === 'light' || saved === 'dark')) {
          setThemeState(saved);
        } else if (mounted && !saved) {
          // optional: fall back to system preference on first run
          const system = Appearance.getColorScheme?.() ?? 'light';
          setThemeState(system === 'dark' ? 'dark' : 'light');
        }
      } finally {
        if (mounted) setHydrated(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const setTheme = useCallback((t: ThemeName) => {
    setThemeState(t);
    appStorage.setItem(STORAGE_KEY, t).catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev: ThemeName) => {
      const next: ThemeName = prev === 'light' ? 'dark' : 'light';
      appStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme, hydrated }), [theme, setTheme, toggleTheme, hydrated]);

  return (
    <ThemePreferenceContext.Provider value={value}>
      {children}
    </ThemePreferenceContext.Provider>
  );
};

export function useThemePreference() {
  const ctx = useContext(ThemePreferenceContext);
  if (!ctx) throw new Error('useThemePreference must be used within ThemePreferenceProvider');
  return ctx;
}
