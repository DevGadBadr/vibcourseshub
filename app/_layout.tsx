import TopSafeAreaOverlay from '@/components/top-safe-area-overlay';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import WebScrollbarStyle from '@/components/web-scrollbar-style';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '@/providers/AuthProvider';
import { ThemePreferenceProvider } from '@/providers/ThemeProvider';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  if (Platform.OS === 'web') {
    LogBox.ignoreLogs(['props.pointerEvents is deprecated']);
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Put StatusBar here so it takes global control */}
      <StatusBar 
        style={colorScheme === 'dark' ? 'light' : 'dark'}
        translucent
        backgroundColor="transparent"
      />

      <SafeAreaProvider>
        <ThemePreferenceProvider defaultTheme="light">
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <AuthProvider>
              <TopSafeAreaOverlay />

              <Stack
                screenOptions={{
                  headerShown: false,
                  // remove statusBarStyle from here — it conflicts
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen 
                  name="modal"
                  options={{ presentation: 'modal', title: 'Modal' }}
                />
              </Stack>

              <WebScrollbarStyle />
            </AuthProvider>
          </ThemeProvider>
        </ThemePreferenceProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
