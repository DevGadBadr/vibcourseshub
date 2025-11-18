import { CourseCard } from '@/components/course-card';
import CourseGrid from '@/components/course-grid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionTab } from '@/components/ui/action-tab';
import { Skeleton } from '@/components/ui/skeleton';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/providers/AuthProvider';
import { Course } from '@/types/course';
import { api, Category, listCategories, mgmtReorderCategories, reorderCourses } from '@/utils/api';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
// Lazy import DnD libraries per platform to keep bundles slim
const DNDK: any = Platform.OS === 'web' ? { core: require('@dnd-kit/core'), sortable: require('@dnd-kit/sortable') } : null;
const DraggableFlatList: any = Platform.OS !== 'web' ? require('react-native-draggable-flatlist').default : null;

type ListResponse = { data: Course[]; nextCursor: number | null };

// simple in-memory cache for course list between tab visits
let EXPLORE_CACHE: { key: string; data: Course[]; categories: Category[]; timestamp: number } | null = null;

export default function ExploreScreen() {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  // Top padding is handled globally by Tabs sceneStyle; keep only small local spacing
  const topPad = 12;
  const tint = useThemeColor({}, 'tint');
  // Choose layout based on width/platform
  const useGrid = isWeb || width >= 900; // grid on web and wide screens

  const { user } = useAuth();
  const [items, setItems] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [reorderMode, setReorderMode] = useState<null | 'courses' | 'categories'>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filterCategories, setFilterCategories] = useState<number[]>([]);
  const [filterInstructorId, setFilterInstructorId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState<null | 'categories' | 'instructor'>(null);
  const [sideOpen, setSideOpen] = useState(false);
  const [allInstructors, setAllInstructors] = useState<any[]>([]);

  const buildKey = () => `${filterCategories.join(',')}|${filterInstructorId ?? ''}`;
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (opts?: { force?: boolean }) => {
    const force = !!opts?.force;
    const key = buildKey();
    if (!force && EXPLORE_CACHE && EXPLORE_CACHE.key === key && EXPLORE_CACHE.data.length) {
      setItems(EXPLORE_CACHE.data);
      if (categories.length === 0 && EXPLORE_CACHE.categories?.length) setCategories(EXPLORE_CACHE.categories);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params: string[] = [];
      if (filterCategories.length) params.push(`categoryIds=${filterCategories.join(',')}`);
      if (filterInstructorId) params.push(`instructorId=${filterInstructorId}`);
      const qs = params.length ? `?${params.join('&')}` : '';
      const res = await api<ListResponse>(`/courses${qs}`);
      setItems(res.data);
      EXPLORE_CACHE = { key, data: res.data, categories, timestamp: Date.now() };
      if (categories.length === 0) {
        try { const cats = await listCategories(); setCategories(cats); } catch {}
      }
      // Capture full instructor list once (from unfiltered data) so choosing an instructor doesn't shrink list
      if (allInstructors.length === 0) {
        try {
          const base = await api<ListResponse>('/courses');
          const baseInstr = Array.from(new Map(base.data.map(i => [i.instructor?.id, i.instructor])).values()).filter(Boolean);
          setAllInstructors(baseInstr as any);
        } catch {}
      }
    } finally {
      setLoading(false);
    }
  }, [filterCategories, filterInstructorId, categories.length, allInstructors.length]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load({ force: true }); } finally { setRefreshing(false); }
  }, [load]);

  if (!useGrid) {
    // Mobile: compact filters and horizontally scrollable categories; no reorder
    return (
      <ThemedView style={{ flex: 1 }}>
        {/* Title + compact filter buttons */}
          <ScrollView
            contentContainerStyle={{ paddingBottom: 24 }}
            refreshControl={Platform.OS !== 'web' ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            ) : undefined}
          >
            <View style={{ paddingHorizontal: 0, paddingTop: topPad }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 }}>
                <Pressable onPress={() => setSideOpen(true)} style={{ padding: 6, borderRadius: 8 }}>
                  <Ionicons name="menu" size={24} color={tint} />
                </Pressable>
                <ThemedText style={styles.sectionTitle}>Explore courses</ThemedText>
              </View>
              <View style={{ paddingHorizontal: 16, paddingBottom:16,flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <Pressable onPress={() => setPickerOpen('categories')} style={[styles.btn, styles.btnSecondary, styles.btnSm]}><ThemedText style={styles.btnTextSm}>{filterCategories.length ? `${filterCategories.length} Categories` : 'Categories'}</ThemedText></Pressable>
                <Pressable onPress={() => setPickerOpen('instructor')} style={[styles.btn, styles.btnSecondary, styles.btnSm]}><ThemedText style={styles.btnTextSm}>{filterInstructorId ? 'Instructor: Selected' : 'Instructor'}</ThemedText></Pressable>
                {(filterCategories.length || filterInstructorId) ? (
                  <Pressable onPress={() => { setFilterCategories([]); setFilterInstructorId(null); }} style={[styles.btn, styles.btnSecondary, styles.btnSm]}><ThemedText style={styles.btnTextSm}>Clear</ThemedText></Pressable>
                ) : null}
              </View>
            </View>
            {loading ? (
              <View style={{ paddingHorizontal: 16, gap: 16 }}>
                {[0,1,2].map((g) => (
                  <View key={`sk-m-${g}`}>
                    <Skeleton width={140} height={18} style={{ marginBottom: 10 }} />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                      {[0,1,2,3].map((i) => (
                        <View key={`sk-card-${g}-${i}`} style={{ width: 260, gap: 8 }}>
                          <Skeleton width={'100%'} height={140} />
                          <Skeleton width={'80%'} height={14} />
                          <Skeleton width={'60%'} height={12} />
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                ))}
              </View>
            ) : (() => {
              const byCat: Record<string, { cat?: Category; items: Course[] }> = {};
              const catMap = new Map(categories.map((c) => [c.id, c]));
              for (const course of items) {
                const cats = course.categories && course.categories.length ? course.categories : [{ id: -1, name: 'Uncategorized', slug: 'uncategorized' } as any];
                for (const c of cats) {
                  const key = String(c.id);
                  if (!byCat[key]) byCat[key] = { cat: (c.id === -1 ? { id: -1, name: 'Uncategorized', slug: 'uncategorized' } as any : (catMap.get(c.id) || { id: c.id, name: c.name, slug: c.slug } as any)), items: [] };
                  byCat[key].items.push(course);
                }
              }
              const ordered = Object.values(byCat).sort((a, b) => {
                if ((a.cat?.id ?? 0) === -1) return 1;
                if ((b.cat?.id ?? 0) === -1) return -1;
                return (a.cat?.name || '').localeCompare(b.cat?.name || '');
              });
              return ordered.map((group) => (
                <View key={`m-cat-${group.cat?.id}`} style={{ marginBottom: 8 }}>
                  <ThemedText style={{ paddingHorizontal: 16, fontWeight: '700', opacity: 0.9, marginBottom: 6 }}>{group.cat?.name}</ThemedText>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                    {group.items.map((item) => (
                      <View key={item.id} style={{ width: 260 }}>
                        <CourseCard
                          course={item}
                          size="compact"
                          isAdmin={user?.role === 'ADMIN' || user?.role === 'MANAGER'}
                          onEdit={(c) => router.push({ pathname: '/(tabs)/courses/[slug]/edit' as any, params: { slug: c.slug } } as any)}
                          onPress={(c) => router.push({ pathname: `/courses/${c.slug}` } as any)}
                        />
                      </View>
                    ))}
                  </ScrollView>
                </View>
              ));
            })()}
          </ScrollView>
        

        {/* Pickers */}
        {pickerOpen && (
          <FilterPickers
            mode={pickerOpen}
            onClose={() => setPickerOpen(null)}
            categories={categories}
            selectedCategoryIds={filterCategories}
            onChangeCategories={setFilterCategories}
            instructors={(allInstructors.length ? allInstructors : Array.from(new Map(items.map(i => [i.instructor?.id, i.instructor])).values()).filter(Boolean)) as any}
            selectedInstructorId={filterInstructorId}
            onChangeInstructor={setFilterInstructorId}
          />
        )}
        {sideOpen && (
          <SideSheet onClose={() => setSideOpen(false)}>
            <ThemedText type="subtitle" style={{ marginBottom: 8 }}>Filters</ThemedText>
            <ThemedText style={{ opacity: 0.7, marginBottom: 6 }}>Categories</ThemedText>
            {categories.map((c) => {
              const checked = filterCategories.includes(c.id);
              return (
                <Pressable key={c.id} onPress={() => setFilterCategories(checked ? filterCategories.filter((id) => id !== c.id) : [...filterCategories, c.id])} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
                  <ThemedText style={{ flex: 1 }}>{c.name}</ThemedText>
                  <ThemedText style={{ fontWeight: '800', opacity: checked ? 1 : 0.25 }}>{checked ? '✓' : '○'}</ThemedText>
                </Pressable>
              );
            })}
            <View style={{ height: 12 }} />
            <ThemedText style={{ opacity: 0.7, marginBottom: 6 }}>Instructor</ThemedText>
            {Array.from(new Map(items.map(i => [i.instructor?.id, i.instructor])).values()).filter(Boolean).map((i: any) => (
              <Pressable key={i.id} onPress={() => setFilterInstructorId(filterInstructorId === i.id ? null : i.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
                <ThemedText style={{ flex: 1 }}>{i.name || i.email}</ThemedText>
                <ThemedText style={{ fontWeight: '800', opacity: filterInstructorId === i.id ? 1 : 0.25 }}>{filterInstructorId === i.id ? '✓' : '○'}</ThemedText>
              </Pressable>
            ))}
          </SideSheet>
        )}
      </ThemedView>
    );
  }

  // Web / wide screens: centered responsive grid with compact cards
  const maxWidth = 1280;
  const containerWidth = Math.min(width, maxWidth);
  const targetCardWidth = 260; // consistent card width target
  const columns = Math.max(3, Math.min(6, Math.floor(containerWidth / targetCardWidth)));
  const gap = 16;
  const innerWidth = containerWidth - 32; // 16px side padding
  const cardWidth = Math.floor((innerWidth - (columns - 1) * gap) / columns);

  const gridData = items;

  const onDragEnd = async (result: any) => {
    if (!result.destination) return;
    const src = result.source.index;
    const dst = result.destination.index;
    if (src === dst) return;
    const next = [...gridData];
    const [moved] = next.splice(src, 1);
    next.splice(dst, 0, moved);
    setItems(next); // optimistic
    setSavingOrder(true);
    try {
      const payload = next.map((c, idx) => ({ id: c.id, position: idx + 1 }));
      await reorderCourses(payload);
      console.log('Reorder saved (web).');
    } catch (e) {
      // refetch fallback
      load();
    } finally { setSavingOrder(false); }
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
      <View key={`grid-root-${columns}`} style={[styles.webWrapper, { maxWidth, alignSelf: 'center', paddingTop: 12 }]}>
      <View style={styles.headerRow}>
        <ThemedText type="title" style={styles.heading}>Explore courses</ThemedText>
        {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <ActionTab label={reorderMode === 'categories' ? (savingOrder ? 'Saving…' : 'Done') : 'Reorder Categories'} onPress={() => {
              if (reorderMode === 'categories') {
                // finish categories reorder
                setReorderMode(null);
              } else {
                setReorderMode('categories');
              }
            }} style={{ width: 'auto', paddingVertical: 10, paddingHorizontal: 12 }} />
            <ActionTab label={reorderMode === 'courses' ? (savingOrder ? 'Saving…' : 'Done') : 'Reorder Courses'} onPress={() => {
              if (reorderMode === 'courses') {
                setReorderMode(null);
              } else {
                setReorderMode('courses');
              }
            }} style={{ width: 'auto', paddingVertical: 10, paddingHorizontal: 12 }} />
          </View>
        )}
      </View>
      {/* Filters */}
      <View style={{ paddingHorizontal: 16, flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <Pressable onPress={() => setPickerOpen('categories')} style={[styles.btn, styles.btnSecondary]}><ThemedText style={styles.btnText}>{filterCategories.length ? `${filterCategories.length} Categories` : 'Categories'}</ThemedText></Pressable>
        <Pressable onPress={() => setPickerOpen('instructor')} style={[styles.btn, styles.btnSecondary]}><ThemedText style={styles.btnText}>{filterInstructorId ? 'Instructor: Selected' : 'Instructor'}</ThemedText></Pressable>
        {(filterCategories.length || filterInstructorId) ? (
          <Pressable onPress={() => { setFilterCategories([]); setFilterInstructorId(null); }} style={[styles.btn, styles.btnSecondary]}><ThemedText style={styles.btnText}>Clear</ThemedText></Pressable>
        ) : null}
      </View>
      {!reorderMode && (
        <View>
          {loading ? (
            <View style={{ paddingHorizontal: 16 }}>
              {/* skeleton grid: 12 items */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -(gap/2) }}>
                {Array.from({ length: columns * 2 }).map((_, i) => (
                  <View key={`sk-${i}`} style={{ width: cardWidth, padding: gap/2, gap: 8 }}>
                    <Skeleton width={'100%'} height={160} />
                    <Skeleton width={'80%'} height={16} />
                    <Skeleton width={'60%'} height={12} />
                  </View>
                ))}
              </View>
            </View>
          ) : (() => {
            // Group by category; show uncategorized last
            const byCat: Record<string, { cat?: Category; items: Course[] }> = {};
            const catMap = new Map(categories.map((c) => [c.id, c]));
            for (const course of gridData) {
              const cats = course.categories && course.categories.length ? course.categories : [{ id: -1, name: 'Uncategorized', slug: 'uncategorized' } as any];
              for (const c of cats) {
                const key = String(c.id);
                if (!byCat[key]) byCat[key] = { cat: (c.id === -1 ? { id: -1, name: 'Uncategorized', slug: 'uncategorized' } as any : (catMap.get(c.id) || { id: c.id, name: c.name, slug: c.slug } as any)), items: [] };
                byCat[key].items.push(course);
              }
            }
            const ordered = Object.values(byCat).sort((a, b) => {
              if ((a.cat?.id ?? 0) === -1) return 1;
              if ((b.cat?.id ?? 0) === -1) return -1;
              return (a.cat?.name || '').localeCompare(b.cat?.name || '');
            });
            return ordered.map((group) => (
              <View key={`cat-${group.cat?.id}`} style={{ marginBottom: 16 }}>
                <ThemedText style={{ paddingHorizontal: 16, fontWeight: '700', opacity: 0.9, marginBottom: 8 }}>{group.cat?.name}</ThemedText>
                <CourseGrid
                  items={group.items}
                  maxWidth={maxWidth}
                  targetCardWidth={targetCardWidth}
                  gap={gap}
                  isAdmin={user?.role === 'ADMIN' || user?.role === 'MANAGER'}
                  onEdit={(c) => router.push({ pathname: '/(tabs)/courses/[slug]/edit' as any, params: { slug: c.slug } } as any)}
                  onPress={(c) => router.push({ pathname: `/courses/${c.slug}` } as any)}
                />
              </View>
            ));
          })()}
        </View>
      )}
      {reorderMode === 'courses' && Platform.OS === 'web' && DNDK && (
        <WebPerCategorySortable
          items={gridData}
          categories={categories}
          onReorder={async (next: Course[]) => {
            setItems(next);
            setSavingOrder(true);
            try {
              const payload = next.map((c, idx) => ({ id: c.id, position: idx + 1 }));
              await reorderCourses(payload);
            } catch (e) { load(); } finally { setSavingOrder(false); }
          }}
        />
      )}
      {reorderMode === 'categories' && Platform.OS === 'web' && DNDK && (
        <WebCategoriesSortable
          categories={categories}
          onReorder={async (ordered: Category[]) => {
            setSavingOrder(true);
            try {
              await mgmtReorderCategories(ordered.map(c => c.id));
              const cats = await listCategories();
              setCategories(cats);
            } catch (e) { /* ignore */ } finally { setSavingOrder(false); setReorderMode(null); }
          }}
        />
      )}
      </View>
      </ScrollView>
      {/* Pickers */}
      {pickerOpen && (
        <FilterPickers
          mode={pickerOpen}
          onClose={() => setPickerOpen(null)}
          categories={categories}
          selectedCategoryIds={filterCategories}
          onChangeCategories={setFilterCategories}
          instructors={Array.from(new Map(items.map(i => [i.instructor?.id, i.instructor])).values()).filter(Boolean) as any}
          selectedInstructorId={filterInstructorId}
          onChangeInstructor={setFilterInstructorId}
        />
      )}
    </ThemedView>
  );
}

// --- Web sortable grid using dnd-kit ---
type SortableGridProps = { columns: number; items: Course[]; cardWidth: number; gap?: number; onReorder: (next: Course[]) => void | Promise<void> };
function WebSortableGrid({ columns, items, cardWidth, gap = 16, onReorder }: SortableGridProps) {
  const { DndContext, closestCenter, PointerSensor, useSensor, useSensors } = DNDK.core;
  const { SortableContext, useSortable, arrayMove, rectSortingStrategy } = DNDK.sortable;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const ids = items.map((c) => String(c.id));

  function handleDragEnd(event: any) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    const moved = arrayMove(items, oldIndex, newIndex);
    onReorder(moved);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -(gap / 2) }}>
          {items.map((c) => (
            <WebSortableItem key={c.id} id={String(c.id)} columns={columns} cardWidth={cardWidth} gap={gap}>
              <CourseCard course={c} size="compact" isAdmin={true} onPress={(cc) => router.push({ pathname: `/courses/${cc.slug}` } as any)} />
            </WebSortableItem>
          ))}
        </View>
      </SortableContext>
    </DndContext>
  );
}

function WebSortableItem({ id, columns, cardWidth, gap = 16, children }: { id: string; columns: number; cardWidth: number; gap?: number; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = DNDK.sortable.useSortable({ id });
  const style: any = {
    width: cardWidth,
    padding: gap / 2,
    cursor: 'grab',
    transition,
    zIndex: isDragging ? 1 : undefined,
    // Map dnd-kit transform to RN web transform style
    transform: transform ? undefined : undefined,
  };
  if (transform) {
    style.transform = [{ translateX: transform.x }, { translateY: transform.y }];
  }
  return (
    <View ref={setNodeRef} {...attributes} {...listeners} style={style}>
      {children}
    </View>
  );
}

// Per-category course reorder: separate sortable contexts per category grouping (no cross-category dragging)
function WebPerCategorySortable({ items, categories, onReorder }: { items: Course[]; categories: Category[]; onReorder: (next: Course[]) => void }) {
  const grouped: Record<number, Course[]> = {};
  for (const c of items) {
    const catIds = (c.categories && c.categories.length ? c.categories.map(cc => cc.id) : [-1]);
    for (const id of catIds) {
      if (!grouped[id]) grouped[id] = [];
      grouped[id].push(c);
    }
  }
  const orderedCats = categories.slice().sort((a,b) => (a.position||0)-(b.position||0));
  return (
    <View style={{ paddingHorizontal:16, paddingBottom:32, gap:24 }}>
      {orderedCats.map(cat => (
        <WebSortableGridCategory key={cat.id} cat={cat} courses={grouped[cat.id]||[]} onReorder={onReorder} />
      ))}
    </View>
  );
}

function WebSortableGridCategory({ cat, courses, onReorder }: { cat: Category; courses: Course[]; onReorder: (next: Course[]) => void }) {
  if (!courses.length) return null;
  const ids = courses.map(c => String(c.id));
  const { DndContext, closestCenter, PointerSensor, useSensor, useSensors } = DNDK.core;
  const { SortableContext, useSortable, arrayMove, rectSortingStrategy } = DNDK.sortable;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  function handleDragEnd(event: any) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    const moved = arrayMove(courses, oldIndex, newIndex);
    // Merge back into global ordering (simple optimistic sequence by course id order)
    onReorder(moved.concat([]));
  }
  return (
    <View>
      <ThemedText style={{ fontWeight:'700', opacity:0.9, marginBottom:8 }}>{cat.name}</ThemedText>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:16 }}>
            {courses.map(c => <WebCourseSortableItem key={c.id} id={String(c.id)}><CourseCard course={c} size="compact" isAdmin onPress={(cc) => router.push({ pathname: `/courses/${cc.slug}` } as any)} /></WebCourseSortableItem>)}
          </View>
        </SortableContext>
      </DndContext>
    </View>
  );
}

function WebCourseSortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = DNDK.sortable.useSortable({ id });
  const style: any = { cursor:'grab', transition, zIndex: isDragging?1:undefined };
  if (transform) style.transform = `translate(${transform.x}px, ${transform.y}px)`;
  return (
    <View ref={setNodeRef} {...attributes} {...listeners} style={style}>{children}</View>
  );
}

// Categories vertical reorder list
function WebCategoriesSortable({ categories, onReorder }: { categories: Category[]; onReorder: (ordered: Category[]) => void }) {
  const ids = categories.map(c => String(c.id));
  const { DndContext, closestCenter, PointerSensor, useSensor, useSensors } = DNDK.core;
  const { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } = DNDK.sortable;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  function handleDragEnd(event: any) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    const moved = arrayMove(categories, oldIndex, newIndex);
    onReorder(moved);
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <View style={{ gap:8, padding:16 }}>
          {categories.map(c => <WebCategorySortableItem key={c.id} id={String(c.id)} category={c} />)}
        </View>
      </SortableContext>
    </DndContext>
  );
}

function WebCategorySortableItem({ id, category }: { id: string; category: Category }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = DNDK.sortable.useSortable({ id });
  const style: any = { padding:12, borderRadius:10, backgroundColor:'#1f2937', cursor:'grab', transition, boxShadow: isDragging?'0 4px 12px rgba(0,0,0,0.3)':'0 2px 6px rgba(0,0,0,0.15)' };
  if (transform) style.transform = `translate(${transform.x}px, ${transform.y}px)`;
  return (
    <View ref={setNodeRef} {...attributes} {...listeners} style={style}>
      <ThemedText style={{ fontWeight:'600' }}>{category.name}</ThemedText>
      <ThemedText style={{ fontSize:11, opacity:0.5 }}>Courses: {category.courseCount || 0}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  mobileContainer: { paddingVertical: 12, gap: 16 },
  webWrapper: { flex: 1, width: '100%', paddingTop: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 },
  heading: { marginBottom: 8, paddingVertical: 8, fontSize: 24, fontWeight: '700' },
  list: { paddingBottom: 24 },
  row: { marginBottom: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { marginBottom: 8, paddingHorizontal: 16, fontSize: 20, fontWeight: '700' },
  btn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  btnPrimary: Platform.select({ web: { boxShadow: '0 6px 16px rgba(0,0,0,0.15)' }, default: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 3 } }) as any,
  btnSecondary: { backgroundColor: '#374151' },
  btnText: { color: 'white', fontWeight: '600', fontSize: 14, letterSpacing: 0.3 },
  btnSm: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10 },
  btnTextSm: { color: 'white', fontWeight: '600', fontSize: 12, letterSpacing: 0.2 },
});

// Small shared picker modal component
function FilterPickers({ mode, onClose, categories, selectedCategoryIds, onChangeCategories, instructors, selectedInstructorId, onChangeInstructor }: {
  mode: 'categories' | 'instructor';
  onClose: () => void;
  categories: Category[];
  selectedCategoryIds: number[];
  onChangeCategories: (ids: number[]) => void;
  instructors: Array<{ id: number; name?: string | null; email?: string | null }>;
  selectedInstructorId: number | null;
  onChangeInstructor: (id: number | null) => void;
}) {
  const [q, setQ] = useState('');
  const borderColor = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({}, 'muted');
  const filteredCats = categories.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.slug.toLowerCase().includes(q.toLowerCase()));
  const filteredInstr = instructors.filter((i) => !q || (i.name || '').toLowerCase().includes(q.toLowerCase()) || (i.email || '').toLowerCase().includes(q.toLowerCase()));
  return (
    <View style={{ position: 'absolute', inset: 0 as any, backgroundColor: '#00000077', padding: 16, justifyContent: 'flex-end' }}>
      <Pressable style={StyleSheet.absoluteFill as any} onPress={onClose} />
      <View style={{ borderRadius: 12, padding: 10, backgroundColor: Platform.OS === 'web' ? '#1c1c1c' : '#222', maxHeight: '70%' }}>
        <ThemedText type="subtitle" style={{ marginBottom: 6, fontSize: 14 }}>{mode === 'categories' ? 'Select categories' : 'Select instructor'}</ThemedText>
        <ThemedView style={{ padding: 6, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: borderColor, marginBottom: 8 }}>
          <TextInput
            placeholder="Search"
            placeholderTextColor={placeholderColor}
            value={q}
            onChangeText={setQ}
            autoCapitalize="none"
            style={{ color: textColor, fontSize: 14, paddingVertical: 4 }}
          />
        </ThemedView>
        <ScrollView style={{ maxHeight: 420 }}>
          {mode === 'categories'
            ? filteredCats.map((c) => {
                const checked = selectedCategoryIds.includes(c.id);
                return (
                  <Pressable key={c.id} onPress={() => onChangeCategories(checked ? selectedCategoryIds.filter((id) => id !== c.id) : [...selectedCategoryIds, c.id])} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={{ fontWeight: '600', fontSize: 14 }}>{c.name}</ThemedText>
                      <ThemedText style={{ opacity: 0.7, fontSize: 12 }}>{c.slug}</ThemedText>
                    </View>
                    <ThemedText style={{ fontWeight: '800', opacity: checked ? 1 : 0.25 }}>{checked ? '✓' : '○'}</ThemedText>
                  </Pressable>
                );
              })
            : filteredInstr.map((i) => {
                const checked = selectedInstructorId === i.id;
                return (
                  <Pressable key={i.id} onPress={() => onChangeInstructor(checked ? null : i.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={{ fontWeight: '600', fontSize: 14 }}>{i.name || 'Unnamed'}</ThemedText>
                      <ThemedText style={{ opacity: 0.7, fontSize: 12 }}>{i.email}</ThemedText>
                    </View>
                    <ThemedText style={{ fontWeight: '800', opacity: checked ? 1 : 0.25 }}>{checked ? '✓' : '○'}</ThemedText>
                  </Pressable>
                );
              })}
        </ScrollView>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
          <Pressable onPress={onClose} style={[styles.btn, styles.btnSecondary, styles.btnSm]}><ThemedText style={styles.btnTextSm}>Done</ThemedText></Pressable>
        </View>
      </View>
    </View>
  );
}

function SideSheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const colorScheme = useColorScheme();
  const dark = (colorScheme ?? 'light') === 'dark';
  const sheetBg = useThemeColor({}, 'surface2');
  const dim = useWindowDimensions();

  const sheetW = Math.min(dim.width * 0.8, 380);
  const anim = useState(() => new Animated.Value(-sheetW))[0];

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim]);

  const close = () => {
    Animated.timing(anim, {
      toValue: -sheetW,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => { if (finished) onClose(); });
  };

  const overlay = dark ? '#00000066' : '#00000033';

  return (
    <View style={{ position: 'absolute', inset: 0 as any }} pointerEvents="box-none">
      <Pressable onPress={close} style={{ position: 'absolute', inset: 0 as any, backgroundColor: overlay }} />
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: sheetW,
          backgroundColor: sheetBg,
          padding: 14,
          transform: [{ translateX: anim }],
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <ScrollView>{children}</ScrollView>
      </Animated.View>
    </View>
  );
}