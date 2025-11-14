import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import ThemedCard from '@/components/ui/themed-card';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { API_URL, CourseSummary, ManagedUserDetail, mgmtAddEnrollment, mgmtGetUser, mgmtListCourses, mgmtRemoveEnrollment, mgmtSetUserRole } from '@/utils/api';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Image, Modal, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

function resolveAvatarUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_URL}${url}`;
}

const ROLES: Array<ManagedUserDetail['role']> = ['TRAINEE', 'INSTRUCTOR', 'ADMIN', 'MANAGER'];

export default function ManagerUserDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<ManagedUserDetail | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [coursePickerOpen, setCoursePickerOpen] = useState(false);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const border = useThemeColor({}, 'border');
  const danger = useThemeColor({}, 'danger');
  const surface = useThemeColor({}, 'surface');
  const tint = Colors[(useColorScheme() ?? 'light')].tint;

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const u = await mgmtGetUser(Number(id));
      setData(u);
    } finally {
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const openCoursePicker = useCallback(async () => {
    try {
      const cs = await mgmtListCourses();
      setCourses(cs);
      setCoursePickerOpen(true);
    } catch (e) { console.warn('Failed to load courses', e); }
  }, []);

  const enrolledIds = new Set((data?.enrollments || []).map(e => e.courseId));
  const availableCourses = courses.filter(c => !enrolledIds.has(c.id));

  const changeRole = useCallback(async () => {
    if (!data) return;
    const currentIndex = ROLES.indexOf(data.role);
    const nextRole = ROLES[(currentIndex + 1) % ROLES.length];
    try {
      const updated = await mgmtSetUserRole(data.id, nextRole);
      setData({ ...data, role: updated.role });
    } catch (e) { Alert.alert('Failed to change role'); }
  }, [data]);

  const addCourse = useCallback(async (courseId: number) => {
    if (!data) return;
    try {
      await mgmtAddEnrollment(data.id, courseId);
      setCoursePickerOpen(false);
      await load();
    } catch (e) { Alert.alert('Failed to add course'); }
  }, [data, load]);

  const removeCourse = useCallback(async (courseId: number) => {
    if (!data) return;
    try {
      await mgmtRemoveEnrollment(data.id, courseId);
      await load();
    } catch (e) { Alert.alert('Failed to remove course'); }
  }, [data, load]);

  return (
    <ThemedView style={{ flex: 1 }}>
      <FlatList
        data={data ? data.enrollments : []}
        keyExtractor={(e) => String(e.courseId)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListHeaderComponent={
          <ThemedCard style={styles.header}>
            <View style={styles.headerRow}>
              {data?.avatarUrl ? (
                <Image source={{ uri: resolveAvatarUrl(data.avatarUrl) }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]} />
              )}
              <View style={{ flex: 1 }}>
                <ThemedText type="title">{data?.name || 'Unnamed'}</ThemedText>
                <ThemedText style={{ opacity: 0.8 }}>{data?.email}</ThemedText>
                <Pressable onPress={changeRole} style={[styles.rolePill, { borderColor: border }]}> 
                  <ThemedText style={{ fontSize: 12, fontWeight: '700' }}>{data?.role}</ThemedText>
                </Pressable>
              </View>
              <Pressable onPress={openCoursePicker} style={[styles.addBtn, { backgroundColor: tint }]}>
                <ThemedText style={{ color: 'white', fontWeight: '700' }}>Add Course</ThemedText>
              </Pressable>
            </View>
            <ThemedText type="subtitle" style={{ marginTop: 12 }}>Enrolled Courses</ThemedText>
          </ThemedCard>
        }
        renderItem={({ item }) => (
          <View style={[styles.courseRow, { borderBottomColor: border }]}> 
            {item.course.thumbnailUrl ? (
              <Image source={{ uri: resolveAvatarUrl(item.course.thumbnailUrl) }} style={styles.courseThumb} />
            ) : (
              <View style={[styles.courseThumb, styles.courseThumbFallback]} />
            )}
            <ThemedText style={{ flex: 1 }}>{item.course.title}</ThemedText>
            <Pressable onPress={() => removeCourse(item.courseId)} style={[styles.removeBtn, { borderColor: danger }]}>
              <ThemedText style={{ color: danger, fontWeight: '700' }}>Remove</ThemedText>
            </Pressable>
          </View>
        )}
      />

      <Modal visible={coursePickerOpen} transparent animationType="fade" onRequestClose={() => setCoursePickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setCoursePickerOpen(false)}>
          <View style={[styles.modalCard, { backgroundColor: surface }]}>
            <ThemedText type="subtitle" style={{ marginBottom: 8 }}>Add a course</ThemedText>
            <FlatList
              data={availableCourses}
              keyExtractor={(c) => String(c.id)}
              renderItem={({ item }) => (
                <Pressable onPress={() => addCourse(item.id)} style={styles.pickRow}>
                  {item.thumbnailUrl ? (
                    <Image source={{ uri: resolveAvatarUrl(item.thumbnailUrl) }} style={styles.courseThumbSmall} />
                  ) : (
                    <View style={[styles.courseThumbSmall, styles.courseThumbFallback]} />
                  )}
                  <ThemedText style={{ flex: 1 }}>{item.title}</ThemedText>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  header: { margin: 12, padding: 12, borderRadius: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#ccc' },
  avatarFallback: { backgroundColor: '#999' },
  rolePill: { marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  addBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  courseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  courseThumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#ccc' },
  courseThumbSmall: { width: 36, height: 36, borderRadius: 6, backgroundColor: '#ccc', marginRight: 8 },
  courseThumbFallback: { backgroundColor: '#999' },
  removeBtn: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
  modalBackdrop: { flex: 1, backgroundColor: '#00000077', padding: 16, justifyContent: 'flex-end' },
  modalCard: { maxHeight: '60%', backgroundColor: 'white', borderRadius: 12, padding: 12 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
});
