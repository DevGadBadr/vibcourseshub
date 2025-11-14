import { ThemePreferenceContext } from '@/providers/ThemeProvider';
import { useContext, useEffect, useState } from 'react';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  // Prefer explicit app theme if provider is mounted
  try {
    const ctx = useContext(ThemePreferenceContext);
    if (ctx?.theme) return ctx.theme;
  } catch {}
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  // const colorScheme = useRNColorScheme();

  // if (hasHydrated) {
  //   return colorScheme;
  // }

  return 'light';
}
