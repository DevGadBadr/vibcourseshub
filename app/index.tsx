import { useAuth } from '@/providers/AuthProvider';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

export default function Gate() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (user) return <Redirect href="/(tabs)" />;
  return <Redirect href={"/(auth)/login" as any} />;
}
