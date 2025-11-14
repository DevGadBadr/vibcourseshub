import { CourseCard } from '@/components/course-card';
import CourseGrid from '@/components/course-grid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import TopSafeAreaOverlay from '@/components/top-safe-area-overlay';
import { ActionTab } from '@/components/ui/action-tab';
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
                      <ActionTab label="Done" onPress={() => setReorderMode(false)} style={{ width: 'auto', paddingVertical: 10, paddingHorizontal: 12 }} />
                      <ActionTab label="+ Add New" onPress={() => router.push('/(tabs)/courses/add' as any)} style={{ width: 'auto', paddingVertical: 10, paddingHorizontal: 12 }} />
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
                    <ActionTab label={reorderMode ? 'Done' : 'Reorder'} onPress={() => setReorderMode(r => !r)} style={{ width: 'auto', paddingVertical: 10, paddingHorizontal: 12 }} />
                    <ActionTab label="+ Add New" onPress={() => router.push('/(tabs)/courses/add' as any)} style={{ width: 'auto', paddingVertical: 10, paddingHorizontal: 12 }} />
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
      <View key={`grid-root-${columns}`} style={[styles.webWrapper, { maxWidth, alignSelf: 'center', paddingTop: 12 }]}>
      <View style={styles.headerRow}>
        <ThemedText type="title" style={styles.heading}>Explore courses</ThemedText>
        {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <ActionTab label={reorderMode ? (savingOrder ? 'Saving…' : 'Done') : 'Reorder'} onPress={() => setReorderMode(r => !r)} style={{ width: 'auto', paddingVertical: 10, paddingHorizontal: 12 }} />
            <ActionTab label="+ Add New" onPress={() => router.push('/(tabs)/courses/add' as any)} style={{ width: 'auto', paddingVertical: 10, paddingHorizontal: 12 }} />
          </View>
        )}
      </View>
      {!reorderMode && (
        <CourseGrid
          items={gridData}
          maxWidth={maxWidth}
          targetCardWidth={targetCardWidth}
          gap={gap}
          isAdmin={user?.role === 'ADMIN' || user?.role === 'MANAGER'}
          onEdit={(c) => router.push({ pathname: '/(tabs)/courses/[slug]/edit' as any, params: { slug: c.slug } } as any)}
        />
      )}
      {reorderMode && Platform.OS === 'web' && DNDK && (
        <WebSortableGrid
          columns={columns}
          items={gridData}
          cardWidth={cardWidth}
          gap={gap}
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
              <CourseCard course={c} size="compact" isAdmin={true} />
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
  btnPrimary: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 3 },
  btnSecondary: { backgroundColor: '#374151' },
  btnText: { color: 'white', fontWeight: '600', fontSize: 14, letterSpacing: 0.3 },
});
