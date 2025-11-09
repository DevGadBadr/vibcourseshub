import { Stack } from 'expo-router';

export default function AuthLayout() {
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
