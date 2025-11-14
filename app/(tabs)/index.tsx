import { CourseCard } from '@/components/course-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { Course } from '@/types/course';
import { api } from '@/utils/api';
import { Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

// Fetch authenticated user's enrolled courses
async function fetchMyCourses(): Promise<Course[]> {
  const res = await api<{ data: Course[] }>(`/courses/mine`, { method: 'GET', auth: true } as any);
  return res.data;
}

export default function MyCoursesScreen() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchMyCourses();
      setCourses(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load courses');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const maxWidth = 1280;
  const containerWidth = Math.min(width, maxWidth);
  const targetCardWidth = 240;
  const columns = isWeb ? Math.max(3, Math.min(6, Math.floor(containerWidth / targetCardWidth))) : 1;

  const heading = (
    <View style={styles.headerRow}>
      <ThemedText type="title" style={styles.title}>My Courses</ThemedText>
    </View>
  );

  if (isWeb) {
    // Use wrapping grid with fixed card width for consistent sizing (matches Explore)
    const cardWidth = 240; // base width similar to Explore targetCardWidth
    return (
      <ThemedView style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        >
          <View style={{ width: '100%', maxWidth, alignSelf: 'center' }}>
            {heading}
            {loading && !refreshing ? (
              <ThemedText>Loading…</ThemedText>
            ) : error ? (
              <ThemedText style={styles.error}>{error}</ThemedText>
            ) : courses.length === 0 ? (
              <ThemedView style={styles.emptyState}>
                <ThemedText type="subtitle">No courses yet</ThemedText>
                <ThemedText style={styles.emptyText}>Your courses will appear here once you enroll. Browse and buy your first course now!</ThemedText>
                <Link href="/explore" asChild>
                  <Pressable style={styles.ctaBtn}><ThemedText style={styles.ctaBtnText}>Go to Explore</ThemedText></Pressable>
                </Link>
              </ThemedView>
            ) : (
              <View style={styles.gridWrap}>
                {courses.map(c => (
                  <View key={c.id} style={[styles.gridItem, { width: cardWidth }]}> 
                    <CourseCard course={c} size="compact" hideNewBadge onPress={(cc) => router.push({ pathname: `/courses/${cc.slug}` } as any)} />
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </ThemedView>
    );
  }

  // Mobile layout
  return (
    <ThemedView style={{ flex: 1 }}>
      <FlatList
        data={courses}
        keyExtractor={(c) => String(c.id)}
        ListHeaderComponent={heading}
        contentContainerStyle={[styles.mobileList, { paddingHorizontal: 16, paddingBottom: 32 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={(
          loading && !refreshing ? <ThemedText style={{ paddingVertical: 8 }}>Loading…</ThemedText> : error ? <ThemedText style={styles.error}>{error}</ThemedText> : (
            <ThemedView style={styles.emptyState}>
              <ThemedText type="subtitle">No courses yet</ThemedText>
              <ThemedText style={styles.emptyText}>Your courses will appear here once you enroll. Browse and buy your first course now!</ThemedText>
              <Link href="/explore" asChild>
                <Pressable style={styles.ctaBtn}><ThemedText style={styles.ctaBtnText}>Go to Explore</ThemedText></Pressable>
              </Link>
            </ThemedView>
          )
        )}
        renderItem={({ item }) => (
          <CourseCard course={item} size="regular" hideNewBadge onPress={(c) => router.push({ pathname: `/courses/${c.slug}` } as any)} />
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  title: { paddingVertical: 4 },
  error: { color: '#dc2626', marginVertical: 8 },
  list: { paddingBottom: 24 },
  mobileList: { gap: 16 },
  emptyState: { gap: 14, paddingVertical: 8 },
  emptyText: { fontSize: 14, lineHeight: 20, opacity: 0.8 },
  ctaBtn: { alignSelf: 'flex-start', backgroundColor: '#2563eb', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8 },
  ctaBtnText: { color: 'white', fontWeight: '600', fontSize: 14 },
  row: { marginBottom: 16 },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  gridItem: { },
});
