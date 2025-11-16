import { useAuth } from '@/providers/AuthProvider';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AuthLayout() {
  const { user, initializing } = useAuth();
  const insets = useSafeAreaInsets();

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{
      // On web, prevent showing a back button that could navigate to the tabs anchor
      headerBackVisible: false,
      headerLeft: () => null,
      // Ensure screen content starts below the system status bar
      contentStyle: { paddingTop: insets.top },
    }}>
      <Stack.Screen name="login" options={{ title: 'VibSolutions Courses'}} />
      <Stack.Screen name="signup" options={{ title: 'VibSolutions Courses' }} />
      <Stack.Screen name="verify-email" options={{ title: 'VibSolutions Courses' }} />
    </Stack>
  );
}
