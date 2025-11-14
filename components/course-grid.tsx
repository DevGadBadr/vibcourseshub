import { CourseCard } from '@/components/course-card';
import type { Course } from '@/types/course';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

export type CourseGridProps = {
  items: Course[];
  maxWidth?: number; // container max width
  targetCardWidth?: number; // desired width per card (web)
  gap?: number; // horizontal/vertical gap in px
  paddingHorizontal?: number; // container horizontal padding
  isAdmin?: boolean;
  onEdit?: (c: Course) => void;
  onPress?: (c: Course) => void;
};

export function CourseGrid({
  items,
  maxWidth = 1280,
  targetCardWidth = 260,
  gap = 16,
  paddingHorizontal = 16,
  isAdmin,
  onEdit,
  onPress,
}: CourseGridProps) {
  const { width } = useWindowDimensions();
  const containerWidth = Math.min(width, maxWidth);

  if (Platform.OS !== 'web') {
    // On native, fall back to simple two-column responsive wrap
    const columns = containerWidth >= 720 ? 2 : 1;
    const innerWidth = containerWidth - paddingHorizontal * 2;
    const cardWidth = Math.floor((innerWidth - (columns - 1) * gap) / columns);
    return (
      <View style={[styles.wrapper, { maxWidth, alignSelf: 'center', paddingHorizontal }]}> 
        <View style={[styles.grid, { margin: -gap / 2 }]}> 
          {items.map((c) => (
            <View key={c.id} style={{ width: cardWidth, padding: gap / 2 }}> 
              <CourseCard course={c} size="regular" isAdmin={isAdmin} onEdit={onEdit} onPress={onPress} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  // Web: compute precise fixed card widths
  const innerWidth = containerWidth - paddingHorizontal * 2;
  const columns = Math.max(1, Math.min(6, Math.floor(innerWidth / targetCardWidth)));
  const cardWidth = Math.floor((innerWidth - (columns - 1) * gap) / columns);

  return (
    <View style={[styles.wrapper, { maxWidth, alignSelf: 'center', paddingHorizontal }]}> 
      <View style={[styles.grid, { margin: -gap / 2 }]}> 
        {items.map((c) => (
          <View key={c.id} style={{ width: cardWidth, padding: gap / 2 }}> 
            <CourseCard course={c} size="compact" isAdmin={isAdmin} onEdit={onEdit} onPress={onPress} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});

export default CourseGrid;
