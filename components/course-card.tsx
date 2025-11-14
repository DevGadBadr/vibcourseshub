import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { Course } from '@/types/course';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

function formatPrice(priceCents: number, currency: string) {
  const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency });
  return formatter.format(priceCents / 100);
}

function renderStars(rating: number) {
  const stars = [] as React.ReactNode[];
  for (let i = 1; i <= 5; i++) {
    const diff = rating - i + 1; // value in (-inf, 1]
    let name: any = 'star';
    if (diff >= 1) name = 'star.fill';
    else if (diff >= 0.25) name = 'star.lefthalf.fill';
    stars.push(<IconSymbol key={i} name={name} size={14} color={diff >= 0.25 ? '#f59e0b' : '#d1d5db'} />);
  }
  return <View style={styles.stars}>{stars}</View>;
}

type Props = { course: Course; onPress?: (c: Course) => void; onEdit?: (c: Course) => void; size?: 'regular' | 'compact'; isAdmin?: boolean; hideNewBadge?: boolean };

export const CourseCard: React.FC<Props> = ({ course, onPress, onEdit, size = 'regular', isAdmin, hideNewBadge }) => {
  const s = size === 'compact' ? compactStyles : styles;
  const [hovered, setHovered] = useState(false);
  const showEdit = isAdmin && (Platform.OS !== 'web' ? false : hovered);
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');
  const warning = useThemeColor({}, 'warning');
  const neutral = useThemeColor({}, 'neutral');
  return (
    <Pressable
      style={[s.card, { backgroundColor: surface, borderColor: border }]}
      onPress={() => onPress?.(course)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
    >
  <Image source={{ uri: course.thumbnailUrl ?? undefined }} style={[s.thumbnail, { backgroundColor: neutral }]} cachePolicy="memory" />
      {isAdmin && (
        <Pressable
          style={[s.editBtn, { opacity: showEdit ? 1 : 0 }]}
          onPress={() => onEdit?.(course)}
          hitSlop={8}
          // keep hovered state when moving pointer onto the button on web
          onHoverIn={() => setHovered(true)}
          onHoverOut={() => setHovered(false)}
        >
          <ThemedText style={s.editText}>Edit</ThemedText>
        </Pressable>
      )}
      <View style={s.body}>
        <ThemedText numberOfLines={2} style={s.title}>{course.title}</ThemedText>
        <ThemedText style={s.instructor} numberOfLines={1}>{course.instructor?.name ?? course.instructor?.email ?? '—'}</ThemedText>
        <View style={s.ratingRow}>
          {renderStarsToken(Number(course.averageRating ?? 5), warning, border)}
          {course.ratingCount && course.ratingCount > 0 ? (
            <ThemedText style={[s.ratingText, { color: warning }]}>{Number(course.averageRating ?? 5).toFixed(1)}</ThemedText>
          ) : hideNewBadge ? null : (
            <View style={[s.inlineBadge]}>
              <ThemedText style={[s.inlineBadgeText, { color: warning }]}>New</ThemedText>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  editBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, zIndex: 2 },
  editText: { fontSize: 12, color: 'white', fontWeight: '700' },
  thumbnail: { width: '100%', aspectRatio: 16/9 },
  body: { padding: 10, gap: 4 },
  title: { fontSize: 14, fontWeight: '600' },
  instructor: { fontSize: 12, opacity: 0.7 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  stars: { flexDirection: 'row', gap: 2 },
  ratingText: { fontSize: 12, fontWeight: '500' },
  inlineBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  inlineBadgeText: { fontSize: 11, fontWeight: '800' },
});

const compactStyles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  editBtn: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, zIndex: 2 },
  editText: { fontSize: 11, color: 'white', fontWeight: '700' },
  thumbnail: { width: '100%', aspectRatio: 16/10 },
  body: { padding: 8, gap: 3 },
  title: { fontSize: 13, fontWeight: '600' },
  instructor: { fontSize: 11, opacity: 0.7 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  stars: { flexDirection: 'row', gap: 2 },
  ratingText: { fontSize: 11, fontWeight: '500' },
  inlineBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  inlineBadgeText: { fontSize: 10, fontWeight: '800' },
});

// Render stars using themed colors
function renderStarsToken(rating: number, activeColor: string, inactiveColor: string) {
  const stars = [] as React.ReactNode[];
  for (let i = 1; i <= 5; i++) {
    const diff = rating - i + 1;
    let name: any = 'star';
    if (diff >= 1) name = 'star.fill';
    else if (diff >= 0.25) name = 'star.lefthalf.fill';
    const color = diff >= 0.25 ? activeColor : inactiveColor;
    stars.push(<IconSymbol key={i} name={name} size={14} color={color} />);
  }
  return <View style={styles.stars}>{stars}</View>;
}
