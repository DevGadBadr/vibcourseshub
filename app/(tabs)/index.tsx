import CourseGrid from '@/components/course-grid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Skeleton } from '@/components/ui/skeleton';
import type { Course } from '@/types/course';
import { Colors } from '@/constants/theme';
import { api } from '@/utils/api';
import { useFocusEffect } from '@react-navigation/native';
import { Link, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Platform, Pressable, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';

// Fetch authenticated user's enrolled courses
async function fetchMyCourses(): Promise<Course[]> {
  const res = await api<{ data: (Course & { progressPct?: number | null })[] }>(`/courses/mine`, { method: 'GET', auth: true } as any);
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

  useEffect(() => { load(); }, [load]);
  useFocusEffect(React.useCallback(() => { load(); }, [load]));

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
    const isEmpty = !loading && !refreshing && courses.length === 0;
    return (
      <ThemedView style={{ flex: 1 }}>
        <View style={{ alignSelf: 'center', width: '100%', maxWidth, paddingHorizontal: 16, paddingTop: 12 }}>
          {heading}
          {loading && !refreshing && (
            <View style={{ paddingVertical: 8 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -8 }}>
                {Array.from({ length: Math.max(6, columns * 2) }).map((_, i) => (
                  <View key={`sk-${i}`} style={{ width: Math.floor((containerWidth - 32 - (columns - 1) * 16) / columns), padding: 8, gap: 8 }}>
                    <Skeleton width={'100%'} height={160} />
                    <Skeleton width={'80%'} height={16} />
                    <Skeleton width={'60%'} height={12} />
                  </View>
                ))}
              </View>
            </View>
          )}
          {!!error && <ThemedText style={styles.error}>{error}</ThemedText>}
        </View>
        {!isEmpty && (
          <CourseGrid
            items={courses}
            maxWidth={maxWidth}
            targetCardWidth={260}
            gap={16}
            onPress={(cc) => router.push({ pathname: `/courses/${cc.slug}` } as any)}
          />
        )}
        {isEmpty && (
          <View style={{ alignSelf: 'center', width: '100%', maxWidth, paddingHorizontal: 16, paddingBottom: 32 }}>
            <ThemedView
              style={styles.emptyState}
              lightColor={Colors.light.surface2}
              darkColor={Colors.dark.surface2}
            >
              <ThemedText type="subtitle">No courses yet</ThemedText>
              <ThemedText style={styles.emptyText}>Your courses will appear here once you enroll. Browse and buy your first course now!</ThemedText>
              <Link href="/explore" asChild>
                <Pressable style={styles.ctaBtn}><ThemedText style={styles.ctaBtnText}>Go to Explore</ThemedText></Pressable>
              </Link>
            </ThemedView>
          </View>
        )}
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
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={(
          loading && !refreshing ? (
            <View style={{ paddingVertical: 8, gap: 12 }}>
              {[0,1,2,3,4].map((i) => (
                <View key={`sk-m-${i}`} style={{ flexDirection: 'row', gap: 12 }}>
                  <Skeleton width={84} height={64} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <Skeleton width={'90%'} height={16} />
                    <Skeleton width={'70%'} height={12} />
                    <Skeleton width={'60%'} height={8} />
                  </View>
                </View>
              ))}
            </View>
          ) : error ? <ThemedText style={styles.error}>{error}</ThemedText> : (
            <ThemedView
              style={styles.emptyState}
              lightColor={Colors.light.surface2}
              darkColor={Colors.dark.surface2}
            >
              <ThemedText type="subtitle">No courses yet</ThemedText>
              <ThemedText style={styles.emptyText}>Your courses will appear here once you enroll. Browse and buy your first course now!</ThemedText>
              <Link href="/explore" asChild>
                <Pressable style={styles.ctaBtn}><ThemedText style={styles.ctaBtnText}>Go to Explore</ThemedText></Pressable>
              </Link>
            </ThemedView>
          )
        )}
        renderItem={({ item }) => <MobileCourseRow course={item} onPress={() => router.push({ pathname: `/courses/${item.slug}` } as any)} />}
      />
    </ThemedView>
  );
}

// Compact mobile row replicating Udemy style: thumbnail left, details + progress right
function MobileCourseRow({ course, onPress }: { course: Course; onPress?: () => void }) {
  const pctRaw = typeof course.progressPct === 'number' ? Number(course.progressPct) : 0;
  const pct = Math.max(0, Math.min(100, pctRaw));
  return (
    <Pressable onPress={onPress} style={styles.rowItem}>
      <View style={styles.thumbWrap}>
        {course.thumbnailUrl ? (
          <Image source={{ uri: course.thumbnailUrl }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, { backgroundColor: '#333' }]} />
        )}
      </View>
      <View style={styles.rowContent}>
        <ThemedText numberOfLines={2} style={styles.rowTitle}>{course.title}</ThemedText>
        <ThemedText numberOfLines={1} style={styles.rowInstructor}>{course.instructor?.name || course.instructor?.email || 'Instructor'}</ThemedText>
        <View style={styles.progressBarWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
          <ThemedText style={styles.progressText}>{pct}% complete</ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  title: { paddingVertical: 8, fontSize: 24, fontWeight: '700' },
  error: { color: '#dc2626', marginVertical: 8 },
  list: { paddingBottom: 24 },
  mobileList: { gap: 16 },
  emptyState: {
    gap: 16,
    paddingVertical: 24,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  emptyText: { fontSize: 14, lineHeight: 20, opacity: 0.8, textAlign: 'center', maxWidth: 520 },
  ctaBtn: {
    alignSelf: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  ctaBtnText: { color: 'white', fontWeight: '600', fontSize: 14 },
  row: { marginBottom: 16 },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  gridItem: { },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#2a2a2a', marginVertical: 8 },
  rowItem: { flexDirection: 'row', gap: 12 },
  thumbWrap: { width: 84 },
  thumb: { width: 84, height: 64, borderRadius: 6, backgroundColor: '#111' },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  rowInstructor: { fontSize: 12, opacity: 0.7, marginTop: 4 },
  progressBarWrap: { marginTop: 8 },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: '#222', overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: '#7c3aed' },
  progressText: { fontSize: 12, marginTop: 6, opacity: 0.8 },
});
