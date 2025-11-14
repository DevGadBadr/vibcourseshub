import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '@/providers/AuthProvider';
import { ThemePreferenceProvider } from '@/providers/ThemeProvider';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  
  // Development-time logging to detect any undefined components.
  if (__DEV__) {
    console.log('RootLayout render - Stack is', typeof Stack, 'AuthProvider is', typeof AuthProvider);
  }
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemePreferenceProvider defaultTheme="light">
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AuthProvider>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
            <StatusBar style="auto" />
          </AuthProvider>
        </ThemeProvider>
      </ThemePreferenceProvider>
    </GestureHandlerRootView>
  );
}
