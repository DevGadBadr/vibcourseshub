import { ThemePreferenceContext } from '@/providers/ThemeProvider';
import { useContext } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

export function useColorScheme() {
	// Prefer explicit app theme if provider is mounted
	try {
		const ctx = useContext(ThemePreferenceContext);
		if (ctx?.theme) return ctx.theme;
	} catch {}
	// Fallback to system
	return useRNColorScheme() ?? 'light';
}
