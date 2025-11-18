import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { API_URL, mgmtGetUser } from '@/utils/api';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

type PreviewUser = {
  id: number;
  name?: string | null;
  email: string;
  avatarUrl?: string | null;
  role: string;
  // Optional title if present on user
  title?: string | null;
};

function resolveAvatarUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_URL}${url}`;
}

export default function ProfilePreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [user, setUser] = useState<PreviewUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const data = await mgmtGetUser(Number(id));
        setUser({ id: data.id, name: data.name, email: data.email, role: data.role, avatarUrl: data.avatarUrl as any, title: (data as any).title ?? null });
      } catch (e: any) {
        setError(e?.message || 'Profile not available');
      }
    })();
  }, [id]);

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()}><ThemedText style={{ opacity: 0.8 }}>{'← Back'}</ThemedText></Pressable>
        {error && <ThemedText style={{ color: '#dc2626' }}>{error}</ThemedText>}
        {user && (
          <View style={styles.card}>
            {user.avatarUrl ? (
              <Image source={{ uri: resolveAvatarUrl(user.avatarUrl) }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: '#333' }]} />
            )}
            <ThemedText type="title" style={styles.name}>{user.name || 'Unnamed'}</ThemedText>
            {!!user.title && <ThemedText style={styles.title}>{user.title}</ThemedText>}
            <ThemedText style={styles.meta}>{user.role}</ThemedText>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  card: { alignItems: 'center', gap: 8, paddingTop: 12 },
  avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: 8 },
  name: { fontSize: 22, fontWeight: '700' },
  title: { fontSize: 14, opacity: 0.85 },
  meta: { fontSize: 12, opacity: 0.7 },
});
