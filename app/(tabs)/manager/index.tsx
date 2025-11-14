import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionTab } from '@/components/ui/action-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/providers/AuthProvider';
import { API_URL, ApiError, CourseSummary, deleteCourse, ManagedUser, ManagedUserDetail, mgmtAddEnrollment, mgmtDeleteUser, mgmtGetUser, mgmtListCourses, mgmtListUsers, mgmtRemoveEnrollment, mgmtSetUserRole } from '@/utils/api';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Image, Modal, Platform, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function resolveAvatarUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_URL}${url}`;
}

// Fixed-width top tabs on web; compact minimum size on mobile
const TOP_TAB_WIDTH: number | undefined = Platform.OS === 'web' ? 100 : undefined;
const TOP_TAB_MIN_WIDTH: number = Platform.OS === 'web' ? 100 : 88;

export default function ManagerScreen() {
  const { user } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [activePanel, setActivePanel] = useState<'users' | 'courses'>('users');
  const [expanded, setExpanded] = useState<Record<number, { loaded: boolean; detail?: ManagedUserDetail } | undefined>>({});
  const [rolePickerFor, setRolePickerFor] = useState<ManagedUser | null>(null);
  const [coursePickerFor, setCoursePickerFor] = useState<ManagedUser | null>(null);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [managerCourses, setManagerCourses] = useState<CourseSummary[]>([]);
  const [deleteUserFor, setDeleteUserFor] = useState<ManagedUser | null>(null);
  const [unpublishFor, setUnpublishFor] = useState<{ slug: string; title: string } | null>(null);
  const border = useThemeColor({}, 'border');
  const danger = useThemeColor({}, 'danger');
  const surface = useThemeColor({}, 'surface');
  const surface2 = useThemeColor({}, 'surface2');
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme ?? 'light'].tint;
  const IS_MOBILE = Platform.OS !== 'web';
  const insets = useSafeAreaInsets();
  const TOP_EXTRA = 8; // keep upper space compact, same as Profile
  const topPad = insets.top + TOP_EXTRA;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, cs] = await Promise.all([mgmtListUsers(), mgmtListCourses()]);
      setUsers(u);
      setManagerCourses(cs.filter(c => c.isPublished !== false));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Redirect non-manager users away if they hit this route directly (web deep link/manual URL)
  useEffect(() => {
    if (!user || user.role !== 'MANAGER') {
      try { router.replace('/(tabs)/Profile' as any); } catch {}
    }
  }, [user]);

  const confirmDelete = useCallback((u: ManagedUser) => {
    setDeleteUserFor(u);
  }, []);

  const openRolePicker = useCallback((u: ManagedUser) => setRolePickerFor(u), []);
  const setRole = useCallback(async (role: ManagedUser['role']) => {
    const u = rolePickerFor; if (!u) return;
    try {
      const updated = await mgmtSetUserRole(u.id, role);
      setUsers(arr => arr.map(it => it.id === u.id ? { ...it, role: updated.role } : it));
    } catch (e) { Alert.alert('Failed to change role'); }
    finally { setRolePickerFor(null); }
  }, [rolePickerFor]);

  const toggleExpanded = useCallback(async (u: ManagedUser) => {
    const wasOpen = !!expanded[u.id];
    if (wasOpen) {
      // collapse only
      setExpanded(prev => { const c = { ...prev }; delete c[u.id]; return c; });
      return;
    }
    // open and load
    setExpanded(prev => ({ ...prev, [u.id]: { loaded: false } }));
    try {
      const d = await mgmtGetUser(u.id);
      setExpanded(prev => ({ ...prev, [u.id]: { loaded: true, detail: d } }));
    } catch (e) {
      setExpanded(prev => { const c = { ...prev }; delete c[u.id]; return c; });
      Alert.alert('Failed to load enrollments');
    }
  }, [expanded]);

  const openCoursePicker = useCallback(async (u: ManagedUser) => {
    try { const cs = await mgmtListCourses(); setCourses(cs); setCoursePickerFor(u); }
    catch { Alert.alert('Failed to load courses'); }
  }, []);

  const addCourse = useCallback(async (courseId: number) => {
    const u = coursePickerFor; if (!u) return;
    try {
      await mgmtAddEnrollment(u.id, courseId);
      const d = await mgmtGetUser(u.id);
      setExpanded(prev => ({ ...prev, [u.id]: { loaded: true, detail: d } }));
    } catch { Alert.alert('Failed to add course'); }
    finally { setCoursePickerFor(null); }
  }, [coursePickerFor]);

  const removeCourse = useCallback(async (u: ManagedUser, courseId: number) => {
    try {
      await mgmtRemoveEnrollment(u.id, courseId);
      const d = await mgmtGetUser(u.id);
      setExpanded(prev => ({ ...prev, [u.id]: { loaded: true, detail: d } }));
    } catch { Alert.alert('Failed to remove course'); }
  }, []);

  const renderItem = ({ item: u }: { item: ManagedUser }) => {
    const ACTION_W = Platform.OS === 'web' ? 140 : 110;
    const exp = expanded[u.id];
    const detail = exp?.detail;
    const initials = getInitials(u.name, u.email);
    const isOpen = !!exp;
    return (
      <View>
        {/* Unified card: top (avatar+name), middle (email), bottom actions */}
        <View style={[styles.userCard, styles.shadow, styles.containerNarrow, { backgroundColor: surface2 }]}> 
          <View style={styles.userTopRow}>
            {u.avatarUrl ? (
              <Image source={{ uri: resolveAvatarUrl(u.avatarUrl) }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: tint }]}> 
                <ThemedText style={styles.avatarInitials}>{initials}</ThemedText>
              </View>
            )}
            <ThemedText numberOfLines={1} ellipsizeMode="tail" style={styles.nameText}>
              {u.name || 'Unnamed'}
            </ThemedText>
          </View>
          <ThemedText numberOfLines={1} ellipsizeMode="middle" style={styles.emailText}>{u.email}</ThemedText>
          <View style={styles.actionRow}>
            {/* Fixed-width actions so both buttons are equal size regardless of label length */}
            <ActionTab
              label={u.role}
              onPress={() => openRolePicker(u)}
              size="sm"
              style={{ width: ACTION_W, paddingVertical: Platform.OS === 'web' ? 8 : 6, paddingHorizontal: 10, borderRadius: 10 }}
            />
            <ActionTab
              label={isOpen ? 'Hide Courses' : 'Enrolled Courses'}
              onPress={() => toggleExpanded(u)}
              size="sm"
              style={{ width: ACTION_W, paddingVertical: Platform.OS === 'web' ? 8 : 6, paddingHorizontal: 10, borderRadius: 10 }}
            />
            <View style={{ flex: 1 }} />
            {/* Right: remove (match ActionTab look used elsewhere) */}
            {u.role !== 'MANAGER' && user?.id !== u.id && (
              <ActionTab
                label="Remove"
                danger
                onPress={() => confirmDelete(u)}
                size="sm"
                style={[styles.smallAction, { width: Platform.OS === 'web' ? 104 : 88, paddingVertical: Platform.OS === 'web' ? 8 : 6 }]}
              />
            )}
          </View>
        </View>
        {detail && (
          <View style={[styles.collapseContainer, styles.containerNarrow, styles.shadow, { backgroundColor: surface2 }]}> 
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ThemedText type="subtitle" style={{ flex: 1 }}>Enrolled</ThemedText>
              <Pressable onPress={() => openCoursePicker(u)} style={[styles.addBtn, styles.shadow, { backgroundColor: tint }]}>
                <ThemedText style={styles.addBtnText}>Add</ThemedText>
              </Pressable>
            </View>
            {detail.enrollments.map(e => (
              <View key={e.courseId} style={[styles.courseRow, { borderBottomColor: border }]}> 
                {e.course.thumbnailUrl ? (
                  <Image source={{ uri: resolveAvatarUrl(e.course.thumbnailUrl) }} style={styles.courseThumb} />
                ) : (
                  <View style={[styles.courseThumb, styles.courseThumbFallback]} />
                )}
                <ThemedText style={{ flex: 1 }}>{e.course.title}</ThemedText>
                <ActionTab
                  label="Remove"
                  danger
                  size="sm"
                  onPress={() => removeCourse(u, e.courseId)}
                  style={{ width: Platform.OS === 'web' ? 96 : 88, paddingVertical: Platform.OS === 'web' ? 8 : 6, paddingHorizontal: 10, alignSelf: 'flex-start' }}
                />
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  if (user?.role !== 'MANAGER') {
    return <ThemedView style={{ flex: 1 }} />;
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      {/* Top horizontal nav aligned with content container */}
      <View style={[styles.containerNarrow, { paddingTop: 16 , paddingHorizontal: 0}]}> 
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <ActionTab
            label="Users"
            onPress={() => setActivePanel('users')}
            style={activePanel === 'users' ? styles.topTabActive : styles.topTab}
          />
          <ActionTab
            label="Courses"
            onPress={() => setActivePanel('courses')}
            style={activePanel === 'courses' ? styles.topTabActive : styles.topTab}
          />
        </View>
      </View>
      {/* Content area below */}
      {activePanel === 'users' ? (
        <FlatList
          data={users}
          keyExtractor={(u) => String(u.id)}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
          contentContainerStyle={{ paddingBottom: 24, paddingTop: 8 }}
        />
      ) : (
        <FlatList
          data={managerCourses}
          keyExtractor={(c) => String(c.id)}
          renderItem={({ item }: { item: CourseSummary }) => (
            <View style={[styles.courseCardRow, styles.shadow, styles.containerNarrow, { backgroundColor: surface2 }]}> 
              <View style={styles.courseInfoRow}>
                {item.thumbnailUrl ? (
                  <Image source={{ uri: resolveAvatarUrl(item.thumbnailUrl) }} style={styles.courseThumbLarge} />
                ) : (
                  <View style={[styles.courseThumbLarge, styles.courseThumbFallback]} />
                )}
                <View style={{ flex: 1, gap: 4 }}>
                  <ThemedText numberOfLines={1} ellipsizeMode="tail" style={styles.courseTitle}>
                    {item.title}
                  </ThemedText>
                  {item.instructor && (
                    <ThemedText style={styles.courseInstructor} numberOfLines={1}>
                      {item.instructor.name || item.instructor.email}
                    </ThemedText>
                  )}
                </View>
                {Platform.OS === 'web' && (
                  <View style={styles.courseActionsWrap}>
                    <ActionTab label="Edit" onPress={() => router.push({ pathname: '/(tabs)/courses/[slug]/edit' as any, params: { slug: item.slug } } as any)} style={styles.smallAction} />
                    <ActionTab label="Delete" danger onPress={() => setUnpublishFor({ slug: item.slug!, title: item.title })} style={styles.smallAction} />
                  </View>
                )}
              </View>
              {Platform.OS !== 'web' && (
                <View style={styles.courseActionsColumn}>
                  <ActionTab label="Edit" size="sm" onPress={() => router.push({ pathname: '/(tabs)/courses/[slug]/edit' as any, params: { slug: item.slug } } as any)} style={{ width: '100%' }} />
                  <ActionTab label="Delete" size="sm" danger onPress={() => setUnpublishFor({ slug: item.slug!, title: item.title })} style={{ width: '100%' }} />
                </View>
              )}
            </View>
          )}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
          contentContainerStyle={{ paddingBottom: 24, paddingTop: 8 }}
        />
      )}

      {/* Role picker modal */}
      <Modal visible={!!rolePickerFor} transparent animationType="fade" onRequestClose={() => setRolePickerFor(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setRolePickerFor(null)}>
          <View style={[styles.modalCard, { backgroundColor: surface }]}>
            <ThemedText type="subtitle" style={{ marginBottom: 8 }}>Change role</ThemedText>
            {(['TRAINEE','INSTRUCTOR','ADMIN','MANAGER'] as ManagedUser['role'][]).map(r => (
              <Pressable key={r} style={styles.modalRow} onPress={() => setRole(r)}>
                <ThemedText style={{ fontWeight: '600' }}>{r}</ThemedText>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Course picker modal */}
      <Modal visible={!!coursePickerFor} transparent animationType="fade" onRequestClose={() => setCoursePickerFor(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setCoursePickerFor(null)}>
          <View style={[styles.modalCard, { backgroundColor: surface }]}>
            <ThemedText type="subtitle" style={{ marginBottom: 8 }}>Add a course</ThemedText>
            <FlatList
              data={courses}
              keyExtractor={(c) => String(c.id)}
              renderItem={({ item }) => (
                <Pressable onPress={() => addCourse(item.id)} style={styles.modalRow}>
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

      {/* Confirm delete user (modal) */}
      <Modal visible={!!deleteUserFor} transparent animationType="fade" onRequestClose={() => setDeleteUserFor(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setDeleteUserFor(null)}>
          <View style={[styles.modalCard, { backgroundColor: surface }]}> 
            <ThemedText type="subtitle" style={{ marginBottom: 8 }}>Delete user</ThemedText>
            <ThemedText style={{ marginBottom: 12 }}>Are you sure you want to delete {deleteUserFor?.email}? This cannot be undone.</ThemedText>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
              <Pressable onPress={() => setDeleteUserFor(null)} style={[styles.ghostBtn, { backgroundColor: surface }]}><ThemedText>Cancel</ThemedText></Pressable>
              <Pressable onPress={async () => {
                const u = deleteUserFor!; setDeleteUserFor(null);
                try { await mgmtDeleteUser(u.id); await load(); }
                catch (e: any) {
                  let message = 'Cannot delete this user because they are linked to other records (e.g., instructor of courses). Reassign those courses first.';
                  if (e instanceof ApiError && e.details) {
                    const code = e.details?.code || e.details?.error?.code;
                    const constraint = e.details?.meta?.constraint || e.details?.meta?.target || e.details?.constraint;
                    if (code === 'P2003' || (typeof constraint === 'string' && String(constraint).includes('instructorId'))) {
                      message = 'This user is assigned as instructor on one or more courses. Reassign or unpublish those courses first.';
                    }
                  }
                  Alert.alert('Unable to delete user', message);
                }
              }} style={[styles.dangerBtn, { backgroundColor: danger }]}>
                <ThemedText style={styles.dangerBtnText}>Delete</ThemedText>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Confirm unpublish course (modal) */}
      <Modal visible={!!unpublishFor} transparent animationType="fade" onRequestClose={() => setUnpublishFor(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setUnpublishFor(null)}>
          <View style={[styles.modalCard, { backgroundColor: surface }]}> 
            <ThemedText type="subtitle" style={{ marginBottom: 8 }}>Delete course</ThemedText>
            <ThemedText style={{ marginBottom: 12 }}>This will permanently delete “{unpublishFor?.title}” and its enrollments. This cannot be undone. Continue?</ThemedText>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
              <ActionTab label="Cancel" onPress={() => setUnpublishFor(null)} style={{ flex: 1, width: undefined, paddingVertical: 8 }} />
              <ActionTab label="Delete" danger onPress={async () => {
                const p = unpublishFor; setUnpublishFor(null);
                if (!p) return;
                try { await deleteCourse(p.slug); await load(); }
                catch { Alert.alert('Failed to delete course'); }
              }} style={{ flex: 1, width: undefined, paddingVertical: 8 }} />
            </View>
          </View>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

function getInitials(name?: string | null, fallbackEmail?: string | null) {
  const source = (name && name.trim()) || (fallbackEmail && fallbackEmail.split('@')[0]) || '';
  if (!source) return '';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    const p = parts[0];
    return (p[0] || '').toUpperCase() + (p[1] || '').toUpperCase();
  }
  return ((parts[0][0] || '') + (parts[parts.length - 1][0] || '')).toUpperCase();
}

const styles = StyleSheet.create({
  containerNarrow: { width: '100%', maxWidth: 1000, alignSelf: 'center', paddingHorizontal: 16 },
  userCard: { width: '100%', borderRadius: 12, padding: 12, marginTop: 8 },
  courseCardRow: { width: '100%', borderRadius: 12, padding: 12, marginTop: 8 },
  userTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ccc' },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { color: 'white', fontWeight: '800' },
  nameText: { flex: 1, fontWeight: '700' },
  emailText: { opacity: 0.7, marginTop: 2 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  rolePill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, marginRight: 8 },
  ghostBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, marginRight: 6 },
  roleBtn: { width: 120, alignItems: 'center', justifyContent: 'center' },
  ghostBtnText: { fontSize: 12, fontWeight: '700' },
  roleText: { textAlign: 'center' },
  ghostBtnTextActive: { color: 'white' },
  dangerBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  dangerBtnText: { color: 'white', fontWeight: '700' },
  dangerOutlineBtn: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, borderWidth: 0 },
  dangerOutlineBtnText: { fontWeight: '700' },
  addBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  addBtnText: { color: 'white', fontWeight: '700' },
  courseRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  courseThumb: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#ccc' },
  courseThumbLarge: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#ccc' },
  courseThumbSmall: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#ccc', marginRight: 8 },
  courseThumbFallback: { backgroundColor: '#999' },
  modalBackdrop: { flex: 1, backgroundColor: '#00000077', padding: 16, justifyContent: 'flex-end' },
  modalCard: { maxHeight: '60%', borderRadius: 12, padding: 12 },
  modalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  collapseContainer: { marginTop: 4, padding: 8, borderRadius: 12 },
  shadow: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  tabsRow: { flexDirection: 'row', gap: 8 },
  tabItem: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#00000012' },
  tabItemActive: { backgroundColor: '#00000022' },
  tabText: { fontWeight: '700', opacity: 0.8 },
  tabTextActive: { opacity: 1 },
  headerLabel: { fontSize: 20, fontWeight: '800', opacity: 0.95 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 8 },
  courseInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  courseTitle: { fontWeight: '700', fontSize: 15 },
  courseInstructor: { fontSize: 12, opacity: 0.7 },
  courseActionsWrap: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  courseActionsColumn: { marginTop: 8, gap: 8 },
  smallAction: { paddingVertical: 8, paddingHorizontal: 10, width: 112, alignSelf: 'flex-start' },
  topTab: { paddingVertical: 6, paddingHorizontal: 10, minWidth: TOP_TAB_MIN_WIDTH, width: TOP_TAB_WIDTH },
  topTabActive: { paddingVertical: 6, paddingHorizontal: 10, minWidth: TOP_TAB_MIN_WIDTH, width: TOP_TAB_WIDTH, borderWidth: StyleSheet.hairlineWidth, borderColor: '#ffffff22' },
});
