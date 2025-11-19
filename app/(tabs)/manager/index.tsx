import { Platform } from 'react-native';

// Platform-specific import: web gets null, native gets the PagerView component
// The .native.ts file is never bundled for web, so react-native-pager-view stays out
import { ManagerScreenNative } from '@/utils/native-manager';

// Web implementation (no swipe)
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionTab } from '@/components/ui/action-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/providers/AuthProvider';
import { API_URL, ApiError, Category, CourseSummary, deleteCourse, ManagedUser, ManagedUserDetail, mgmtAddEnrollment, mgmtCreateCategory, mgmtDeleteCategory, mgmtDeleteUser, mgmtGetUser, mgmtListCategories, mgmtListCourses, mgmtListUsers, mgmtRemoveEnrollment, mgmtSetUserRole, mgmtUpdateCategory } from '@/utils/api';
import { showToast } from '@/utils/toast';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Image, Modal, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
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
  // On native platforms, use the PagerView-enabled version
  if (Platform.OS !== 'web' && ManagerScreenNative) {
    const NativeComponent = ManagerScreenNative as React.ComponentType;
    return <NativeComponent />;
  }

  // Web implementation below (no swipe, no PagerView)
  return <ManagerScreenWeb />;
}

function ManagerScreenWeb() {
  const { user } = useAuth();
  const { refresh } = useLocalSearchParams<{ refresh?: string }>();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [activePanel, setActivePanel] = useState<'users' | 'courses' | 'categories'>('users');
  const [expanded, setExpanded] = useState<Record<number, { loaded: boolean; detail?: ManagedUserDetail } | undefined>>({});
  const [rolePickerFor, setRolePickerFor] = useState<ManagedUser | null>(null);
  const [coursePickerFor, setCoursePickerFor] = useState<ManagedUser | null>(null);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [managerCourses, setManagerCourses] = useState<CourseSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [catModalOpen, setCatModalOpen] = useState<null | { mode: 'create' } | { mode: 'edit'; cat: Category }>(null);
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [deleteCategoryFor, setDeleteCategoryFor] = useState<Category | null>(null);
  const [deleteUserFor, setDeleteUserFor] = useState<ManagedUser | null>(null);
  const [unpublishFor, setUnpublishFor] = useState<{ slug: string; title: string } | null>(null);
  const border = useThemeColor({}, 'border');
  const danger = useThemeColor({}, 'danger');
  const surface = useThemeColor({}, 'surface');
  const surface2 = useThemeColor({}, 'surface2');
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({}, 'muted');
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme ?? 'light'].tint;
  const IS_MOBILE = Platform.OS !== 'web';
  const insets = useSafeAreaInsets();
  const TOP_EXTRA = 8; // keep upper space compact, same as Profile
  const topPad = insets.top + TOP_EXTRA;

  const panels: Array<typeof activePanel> = ['users', 'courses', 'categories'];
  const goToPanel = useCallback((panel: typeof activePanel) => {
    setActivePanel(panel);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (!user || user.role !== 'MANAGER') return; // avoid hanging spinner for non-managers
      const [u, cs, cats] = await Promise.all([mgmtListUsers(), mgmtListCourses(), mgmtListCategories()]);
      setUsers(u);
      setManagerCourses(cs.filter(c => c.isPublished !== false));
      setCategories(cats);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );
  
  // Handle refresh parameter from edit/add screens
  useEffect(() => {
    if (refresh === '1') {
      load();
      // Clear the refresh parameter
      router.setParams({ refresh: undefined } as any);
    }
  }, [refresh, load]);

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
      showToast('Role updated');
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
      showToast('Course added');
    } catch { Alert.alert('Failed to add course'); }
    finally { setCoursePickerFor(null); }
  }, [coursePickerFor]);

  const removeCourse = useCallback(async (u: ManagedUser, courseId: number) => {
    try {
      await mgmtRemoveEnrollment(u.id, courseId);
      const d = await mgmtGetUser(u.id);
      setExpanded(prev => ({ ...prev, [u.id]: { loaded: true, detail: d } }));
      showToast('Enrollment removed');
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
        {isOpen && (
          <View style={[styles.collapseContainer, styles.containerNarrow, styles.shadow, { backgroundColor: surface2 }]}> 
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ThemedText style={{ flex: 1, fontSize: 14, fontWeight: '700', opacity: 0.9 }}>Enrolled Courses</ThemedText>
              <ActionTab
                label="Add"
                size="sm"
                onPress={() => openCoursePicker(u)}
                style={{ width: Platform.OS === 'web' ? 84 : 72, alignSelf: 'flex-start' }}
              />
            </View>
            {!exp?.loaded && (
              <>
                {[0,1,2].map((i) => (
                  <View key={`sk-${i}`} style={[styles.courseRow, { borderBottomColor: border }]}> 
                    <View style={[styles.courseThumb, styles.courseThumbFallback, { opacity: 0.4 }]} />
                    <View style={{ flex: 1, height: 14, borderRadius: 6, backgroundColor: '#99999944' }} />
                    <View style={{ width: Platform.OS === 'web' ? 96 : 88, height: 30, borderRadius: 8, backgroundColor: '#f87171', opacity: 0.4 }} />
                  </View>
                ))}
              </>
            )}
            {detail && detail.enrollments.map(e => (
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
      <View style={[styles.containerNarrow, { paddingTop: 16, paddingHorizontal: 0 }]}> 
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <ActionTab
            label="Users"
            onPress={() => goToPanel('users')}
            style={activePanel === 'users' ? [styles.topTab, styles.topTabActive] : styles.topTab}
          />
          <ActionTab
            label="Courses"
            onPress={() => goToPanel('courses')}
            style={activePanel === 'courses' ? [styles.topTab, styles.topTabActive] : styles.topTab}
          />
          <ActionTab
            label="Categories"
            onPress={() => goToPanel('categories')}
            style={activePanel === 'categories' ? [styles.topTab, styles.topTabActive] : styles.topTab}
          />
        </View>
      </View>
      {/* Content area (web uses conditional lists, no swipe) */}
      <View style={{ flex: 1 }}>
        {activePanel === 'users' && (
          <FlatList
            data={users}
            keyExtractor={(u) => String(u.id)}
            ListHeaderComponent={(
              <View style={[styles.containerNarrow, { paddingHorizontal: 0, paddingTop: 8, paddingLeft: 5, flexDirection:'row', alignItems:'center', justifyContent:'space-between' }]}> 
                <ThemedText style={styles.countBadge}>All: {users.length}</ThemedText>
              </View>
            )}
            renderItem={renderItem}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
            contentContainerStyle={{ paddingBottom: 24, paddingTop: 8, paddingHorizontal: 16 }}
          />
        )}
        {activePanel === 'courses' && (
          <FlatList
            data={managerCourses}
            keyExtractor={(c) => String(c.id)}
            ListHeaderComponent={(
              <View style={[styles.containerNarrow, { paddingHorizontal: 0, paddingTop: 8, paddingLeft: 5, flexDirection:'row', alignItems:'center', justifyContent:'space-between' }]}> 
                <ThemedText style={styles.countBadge}>All: {managerCourses.length}</ThemedText>
                <ActionTab label="+ Add New" onPress={() => router.push('/(tabs)/courses/add' as any)} style={{ width: 'auto', paddingVertical: 8, paddingHorizontal: 12 }} />
              </View>
            )}
            renderItem={({ item }: { item: CourseSummary }) => (
              <View style={[styles.courseCardRow, styles.shadow, styles.containerNarrow, { backgroundColor: surface2, flexDirection:'row', alignItems:'center', gap:12 }]}> 
                {item.thumbnailUrl ? (
                  <Image source={{ uri: resolveAvatarUrl(item.thumbnailUrl) }} style={styles.courseThumbLarge} />
                ) : (
                  <View style={[styles.courseThumbLarge, styles.courseThumbFallback]} />
                )}
                <View style={{ flex:1, gap:4 }}>
                  <ThemedText numberOfLines={1} style={styles.courseTitle}>{item.title}</ThemedText>
                  <ThemedText numberOfLines={1} style={styles.courseInstructor}>{item.instructor?.name || item.instructor?.email || 'Instructor'}</ThemedText>
                  <ThemedText style={{ fontSize:11, opacity:0.6 }}>Enrolls: {item.enrollCount ?? 0}</ThemedText>
                </View>
                <Pressable onPress={() => router.push({ pathname: '/(tabs)/courses/[slug]/edit' as any, params: { slug: item.slug, from: 'manager' } } as any)} style={styles.iconBtn}><Ionicons name="create-outline" size={20} color={tint} /></Pressable>
                <Pressable onPress={() => setUnpublishFor({ slug: item.slug!, title: item.title })} style={[styles.iconBtn, { backgroundColor: danger }]}><Ionicons name="trash-outline" size={20} color="white" /></Pressable>
              </View>
            )}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
            contentContainerStyle={{ paddingBottom: 24, paddingTop: 8, paddingHorizontal: 16 }}
          />
        )}
        {activePanel === 'categories' && (
          <FlatList
            data={categories}
            keyExtractor={(c) => String(c.id)}
            ListHeaderComponent={(
              <View style={[styles.containerNarrow, { paddingHorizontal: 0, paddingTop: 8, paddingLeft: 5, flexDirection:'row', alignItems:'center', justifyContent:'space-between' }]}> 
                <ThemedText style={styles.countBadge}>All: {categories.length}</ThemedText>
                <ActionTab label="+ Add Category" onPress={() => { setCatName(''); setCatSlug(''); setCatDesc(''); setCatModalOpen({ mode: 'create' }); }} style={{ width: 'auto', paddingVertical: 8, paddingHorizontal: 12 }} />
              </View>
            )}
            renderItem={({ item }) => (
              <View style={[styles.courseCardRow, styles.shadow, styles.containerNarrow, { backgroundColor: surface2 }]}> 
                <View style={{ flex: 1, gap: 4 }}>
                  <ThemedText style={styles.courseTitle}>{item.name}</ThemedText>
                  <ThemedText style={{ opacity: 0.7, fontSize: 12 }}>Courses: {item.courseCount ?? 0}</ThemedText>
                </View>
                <View style={styles.courseActionsWrap}>
                  <ActionTab label="Edit" onPress={() => { setCatName(item.name); setCatSlug(item.slug); setCatDesc(item.description || ''); setCatModalOpen({ mode: 'edit', cat: item }); }} style={styles.smallAction} />
                  <ActionTab label="Remove" danger onPress={() => setDeleteCategoryFor(item)} style={styles.smallAction} />
                </View>
              </View>
            )}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
            contentContainerStyle={{ paddingBottom: 24, paddingTop: 8, paddingHorizontal: 16 }}
          />
        )}
      </View>

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
                try { await mgmtDeleteUser(u.id); await load(); showToast('User deleted'); }
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
                try { await deleteCourse(p.slug); await load(); showToast('Course deleted'); }
                catch { Alert.alert('Failed to delete course'); }
              }} style={{ flex: 1, width: undefined, paddingVertical: 8 }} />
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Category create/edit modal */}
      <Modal visible={!!catModalOpen} transparent animationType="fade" onRequestClose={() => setCatModalOpen(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill as any} onPress={() => setCatModalOpen(null)} />
          <View style={[styles.modalCard, { backgroundColor: surface, borderColor: border }]}> 
            <ThemedText type="subtitle" style={{ marginBottom: 16, fontSize: 20, fontWeight: '700' }}>
              {catModalOpen?.mode === 'create' ? 'Add Category' : 'Edit Category'}
            </ThemedText>
            <View style={{ gap: 16 }}>
              <View style={{ gap: 6 }}>
                <ThemedText style={{ fontSize: 13, fontWeight: '600', opacity: 0.7 }}>Name</ThemedText>
                <View style={[styles.inputBox, { backgroundColor: surface2, borderColor: border }]}>
                  <TextInput 
                    value={catName} 
                    onChangeText={setCatName} 
                    placeholder="Enter category name"
                    style={{ paddingVertical: 10, paddingHorizontal: 12, color: textColor, fontSize: 15 }} 
                    placeholderTextColor={placeholderColor} 
                  />
                </View>
              </View>
              <View style={{ gap: 6 }}>
                <ThemedText style={{ fontSize: 13, fontWeight: '600', opacity: 0.7 }}>Slug</ThemedText>
                <View style={[styles.inputBox, { backgroundColor: surface2, borderColor: border }]}>
                  <TextInput 
                    value={catSlug} 
                    onChangeText={setCatSlug} 
                    placeholder="auto from name if empty" 
                    style={{ paddingVertical: 10, paddingHorizontal: 12, color: textColor, fontSize: 15 }} 
                    placeholderTextColor={placeholderColor} 
                  />
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: border }}>
                <ActionTab label="Cancel" onPress={() => setCatModalOpen(null)} style={{ width: 'auto', paddingVertical: 10, paddingHorizontal: 16 }} />
                <ActionTab label={catModalOpen?.mode === 'create' ? 'Create' : 'Save'} onPress={async () => {
                  try {
                    if (!catName.trim()) { 
                      if (Platform.OS === 'web') {
                        showToast('Name is required');
                      } else {
                        Alert.alert('Name is required'); 
                      }
                      return; 
                    }
                    if (catModalOpen?.mode === 'create') {
                      await mgmtCreateCategory({ name: catName.trim(), slug: catSlug.trim() || undefined });
                      showToast('Category created');
                    } else if (catModalOpen && 'cat' in catModalOpen) {
                      await mgmtUpdateCategory(catModalOpen.cat.id, { name: catName.trim(), slug: catSlug.trim() || undefined });
                      showToast('Category updated');
                    }
                    setCatModalOpen(null);
                    await load();
                  } catch { 
                    if (Platform.OS === 'web') {
                      showToast('Failed to save category');
                    } else {
                      Alert.alert('Failed to save category'); 
                    }
                  }
                }} style={{ width: 'auto', paddingVertical: 10, paddingHorizontal: 16 }} />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete category confirmation modal */}
      <Modal visible={!!deleteCategoryFor} transparent animationType="fade" onRequestClose={() => setDeleteCategoryFor(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill as any} onPress={() => setDeleteCategoryFor(null)} />
          <View style={[styles.modalCard, { backgroundColor: surface, borderColor: border }]}>
            <ThemedText type="subtitle" style={{ marginBottom: 12, fontSize: 20, fontWeight: '700' }}>
              Delete Category
            </ThemedText>
            <ThemedText style={{ fontSize: 15, lineHeight: 22, opacity: 0.85, marginBottom: 20 }}>
              Are you sure you want to delete <ThemedText style={{ fontWeight: '700' }}>"{deleteCategoryFor?.name}"</ThemedText>?{'\n'}
              This action cannot be undone.
            </ThemedText>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: border }}>
              <ActionTab label="Cancel" onPress={() => setDeleteCategoryFor(null)} style={{ width: 'auto', paddingVertical: 10, paddingHorizontal: 16 }} />
              <ActionTab 
                label="Delete" 
                danger 
                onPress={async () => {
                  if (!deleteCategoryFor) return;
                  try {
                    await mgmtDeleteCategory(deleteCategoryFor.id);
                    showToast('Category deleted');
                    setDeleteCategoryFor(null);
                    await load();
                  } catch {
                    if (Platform.OS === 'web') {
                      showToast('Failed to delete category');
                    } else {
                      Alert.alert('Failed to delete category');
                    }
                  }
                }} 
                style={{ width: 'auto', paddingVertical: 10, paddingHorizontal: 16 }} 
              />
            </View>
          </View>
        </View>
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
  field: { padding: 8, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
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
  modalCard: { 
    maxHeight: '60%', 
    borderRadius: 16, 
    padding: 20,
    borderWidth: 1,
    ...Platform.select({
      web: { boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
      default: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 }
    })
  } as any,
  inputBox: {
    borderRadius: 10,
    borderWidth: 0,
  },
  modalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  collapseContainer: { marginTop: 4, padding: 8, borderRadius: 12 },
  shadow: Platform.select({
    web: { boxShadow: '0px 4px 16px rgba(0,0,0,0.08)' },
    default: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  }) as any,
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
  iconBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#374151', alignItems: 'center', justifyContent: 'center' },
  topTab: { paddingVertical: 8, paddingHorizontal: 12, minWidth: TOP_TAB_MIN_WIDTH, width: TOP_TAB_WIDTH, borderRadius: 10 },
  topTabActive: { borderBottomWidth: 3, borderColor: '#7c3aed' },
  countBadge: { fontSize: 12, fontWeight: '700', opacity: 0.7 },
});
