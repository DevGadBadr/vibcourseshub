import { CourseCard } from '@/components/course-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import TopSafeAreaOverlay from '@/components/top-safe-area-overlay';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/providers/AuthProvider';
import { Course } from '@/types/course';
import { api, reorderCourses } from '@/utils/api';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
// Lazy import DnD libraries per platform to keep bundles slim
const DNDK: any = Platform.OS === 'web' ? { core: require('@dnd-kit/core'), sortable: require('@dnd-kit/sortable') } : null;
const DraggableFlatList: any = Platform.OS !== 'web' ? require('react-native-draggable-flatlist').default : null;

type ListResponse = { data: Course[]; nextCursor: number | null };

export default function ExploreScreen() {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const TOP_EXTRA = 10;
  const topPad = 55 + TOP_EXTRA;
  const tint = useThemeColor({}, 'tint');
  // Choose layout based on width/platform
  const useGrid = isWeb || width >= 900; // grid on web and wide screens

  const { user } = useAuth();
  const [items, setItems] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [reorderMode, setReorderMode] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<ListResponse>('/courses');
      setItems(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!useGrid) {
    // Mobile: simple list, with drag-and-drop when in reorder mode (admins only)
    return (
      <ThemedView style={{ flex: 1 }}>
        <TopSafeAreaOverlay extra={TOP_EXTRA} />
        {reorderMode && Platform.OS !== 'web' && DraggableFlatList ? (
          <DraggableFlatList
            data={items}
            keyExtractor={(item: Course) => String(item.id)}
            contentContainerStyle={[styles.mobileContainer, { paddingTop: topPad }]}
            ListHeaderComponent={
              <View style={{ paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <ThemedText style={styles.sectionTitle}>{savingOrder ? 'Saving…' : 'Reorder courses'}</ThemedText>
                {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <Pressable onPress={() => setReorderMode(false)} style={[styles.btn, styles.btnSecondary]}>
                        <ThemedText style={styles.btnText}>Done</ThemedText>
                      </Pressable>
                      <Pressable onPress={() => router.push('/(tabs)/courses/add' as any)} style={[styles.btn, styles.btnPrimary, { backgroundColor: tint }]}>
                        <ThemedText style={styles.btnText}>+ Add New</ThemedText>
                      </Pressable>
                    </View>
                )}
              </View>
            }
            renderItem={({ item, drag, isActive }: any) => (
              <View style={{ paddingHorizontal: 16, opacity: isActive ? 0.85 : 1 }}>
                <Pressable onLongPress={drag} delayLongPress={120}>
                  <CourseCard course={item} size="regular" isAdmin={user?.role === 'ADMIN'} onEdit={(c) => router.push({ pathname: '/(tabs)/courses/[slug]/edit' as any, params: { slug: c.slug } } as any)} />
                </Pressable>
              </View>
            )}
            onDragEnd={async ({ data }: { data: Course[] }) => {
              setItems(data);
              setSavingOrder(true);
              try {
                const payload = data.map((c, idx) => ({ id: c.id, position: idx + 1 }));
                await reorderCourses(payload);
                console.log('Reorder saved (native).');
              } catch (e) {
                load();
              } finally { setSavingOrder(false); }
            }}
            activationDistance={16}
          />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={[styles.mobileContainer, { paddingTop: topPad }]}
            ListHeaderComponent={
              <View style={{ paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <ThemedText style={styles.sectionTitle}>Explore courses</ThemedText>
                {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable onPress={() => setReorderMode(r => !r)} style={[styles.btn, reorderMode ? styles.btnSecondary : styles.btnPrimary, reorderMode ? {} : { backgroundColor: tint }]}>
                      <ThemedText style={styles.btnText}>{reorderMode ? 'Done' : 'Reorder'}</ThemedText>
                    </Pressable>
                    <Pressable onPress={() => router.push('/(tabs)/courses/add' as any)} style={[styles.btn, styles.btnPrimary, { backgroundColor: tint }]}>
                      <ThemedText style={styles.btnText}>+ Add New</ThemedText>
                    </Pressable>
                  </View>
                )}
              </View>
            }
            renderItem={({ item }) => (
              <View style={{ paddingHorizontal: 16 }}>
                <CourseCard course={item} size="regular" isAdmin={user?.role === 'ADMIN' || user?.role === 'MANAGER'} onEdit={(c) => router.push({ pathname: '/(tabs)/courses/[slug]/edit' as any, params: { slug: c.slug } } as any)} />
              </View>
            )}
          />
        )}
      </ThemedView>
    );
  }

  // Web / wide screens: centered responsive grid with compact cards
  const maxWidth = 1280;
  const containerWidth = Math.min(width, maxWidth);
  const targetCardWidth = 240; // aim for ~5 across on ~1280px
  const columns = Math.max(3, Math.min(6, Math.floor(containerWidth / targetCardWidth)));

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
      <View key={`grid-root-${columns}`} style={[styles.webWrapper, { maxWidth, alignSelf: 'center', paddingTop: 20 }]}>
      <View style={styles.headerRow}>
        <ThemedText type="title" style={styles.heading}>Explore courses</ThemedText>
        {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={() => setReorderMode(r => !r)} style={[styles.btn, reorderMode ? styles.btnSecondary : styles.btnPrimary, reorderMode ? {} : { backgroundColor: tint }]}> 
              <ThemedText style={styles.btnText}>{reorderMode ? (savingOrder ? 'Saving…' : 'Done') : 'Reorder'}</ThemedText>
            </Pressable>
            <Pressable onPress={() => router.push('/(tabs)/courses/add' as any)} style={[styles.btn, styles.btnPrimary, { backgroundColor: tint }]}>
              <ThemedText style={styles.btnText}>+ Add New</ThemedText>
            </Pressable>
          </View>
        )}
      </View>
      {!reorderMode && (
        <FlatList
          key={`grid-${columns}`}
          data={gridData}
          keyExtractor={(item) => String(item.id)}
          numColumns={columns}
          columnWrapperStyle={[styles.row, { gap: 16 }]}
          contentContainerStyle={[styles.list, { paddingHorizontal: 16 }]}
          renderItem={({ item }) => (
            <View style={{ flex: 1 }}>
              <CourseCard course={item} size="compact" isAdmin={user?.role === 'ADMIN' || user?.role === 'MANAGER'} onEdit={(c) => router.push({ pathname: '/(tabs)/courses/[slug]/edit' as any, params: { slug: c.slug } } as any)} />
            </View>
          )}
        />
      )}
      {reorderMode && Platform.OS === 'web' && DNDK && (
        <WebSortableGrid
          columns={columns}
          items={gridData}
          onReorder={async (next: Course[]) => {
            setItems(next);
            setSavingOrder(true);
            try {
              const payload = next.map((c, idx) => ({ id: c.id, position: idx + 1 }));
              await reorderCourses(payload);
              console.log('Reorder saved (web).');
            } catch (e) { load(); } finally { setSavingOrder(false); }
          }}
        />
      )}
      </View>
    </ThemedView>
  );
}

// --- Web sortable grid using dnd-kit ---
type SortableGridProps = { columns: number; items: Course[]; onReorder: (next: Course[]) => void | Promise<void> };
function WebSortableGrid({ columns, items, onReorder }: SortableGridProps) {
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
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {items.map((c) => (
            <WebSortableItem key={c.id} id={String(c.id)} columns={columns}>
              <CourseCard course={c} size="compact" isAdmin={true} />
            </WebSortableItem>
          ))}
        </View>
      </SortableContext>
    </DndContext>
  );
}

function WebSortableItem({ id, columns, children }: { id: string; columns: number; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = DNDK.sortable.useSortable({ id });
  const style: any = {
    width: `${100 / columns}%`,
    padding: 8,
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

const styles = StyleSheet.create({
  mobileContainer: { paddingVertical: 12, gap: 16 },
  webWrapper: { flex: 1, width: '100%', paddingTop: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 },
  heading: { marginBottom: 8, paddingVertical: 12 },
  list: { paddingBottom: 24 },
  row: { marginBottom: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { marginBottom: 8, paddingHorizontal: 16, fontSize: 20, fontWeight: '700' },
  btn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  btnPrimary: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 3 },
  btnSecondary: { backgroundColor: '#374151' },
  btnText: { color: 'white', fontWeight: '600', fontSize: 14, letterSpacing: 0.3 },
});
