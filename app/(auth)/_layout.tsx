import { useAuth } from '@/providers/AuthProvider';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

export default function AuthLayout() {
  const { user, initializing } = useAuth();

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
    }}>
      <Stack.Screen name="login" options={{ title: 'Log in' }} />
      <Stack.Screen name="signup" options={{ title: 'Sign up' }} />
      <Stack.Screen name="verify-email" options={{ title: 'Check your email' }} />
    </Stack>
  );
}
