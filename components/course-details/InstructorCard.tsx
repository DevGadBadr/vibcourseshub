import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { CourseInstructorInfo } from '@/types/course';
import { API_URL } from '@/utils/api';
import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

export const InstructorCard: React.FC<{ instructor?: CourseInstructorInfo | null; onViewProfile?: () => void }>
  = ({ instructor, onViewProfile }) => {
  if (!instructor) return null;
  const border = useThemeColor({}, 'border');
  const surface = useThemeColor({}, 'surface');
  const tint = useThemeColor({}, 'tint');
  return (
    <ThemedView style={[styles.card, { borderColor: border, backgroundColor: surface }]}> 
      <View style={styles.row}> 
        {instructor.avatarUrl ? (
          <Image source={{ uri: resolveUrl(instructor.avatarUrl) }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.emptyAvatar]} />
        )}
        <View style={{ flex: 1, gap: 4 }}>
          <ThemedText style={styles.name}>{instructor.name || 'Instructor'}</ThemedText>
          {!!instructor.title && <ThemedText style={styles.title}>{instructor.title}</ThemedText>}
          {!!instructor.shortBio && <ThemedText numberOfLines={3} style={styles.bio}>{instructor.shortBio}</ThemedText>}
          {instructor.stats && (
            <View style={styles.statsRow}>
              {instructor.stats.averageRating != null && (
                <View style={styles.stat}><IconSymbol name={'star.fill' as any} size={14} color={'#f59e0b'} /><ThemedText style={styles.statText}>{Number(instructor.stats.averageRating).toFixed(1)}</ThemedText></View>
              )}
              {instructor.stats.studentsCount != null && (
                <View style={styles.stat}><IconSymbol name={'person.2.fill' as any} size={14} color={tint} /><ThemedText style={styles.statText}>{instructor.stats.studentsCount} students</ThemedText></View>
              )}
              {instructor.stats.coursesCount != null && (
                <View style={styles.stat}><IconSymbol name={'book.fill' as any} size={14} color={tint} /><ThemedText style={styles.statText}>{instructor.stats.coursesCount} courses</ThemedText></View>
              )}
            </View>
          )}
          <Pressable
            onPress={onViewProfile}
            style={({ pressed }) => [
              styles.viewBtn,
              {
                borderColor: tint,
                backgroundColor: pressed ? tint + '1A' : 'transparent'
              }
            ]}
          >
            <ThemedText style={[styles.viewBtnText, { color: tint }]}>View profile</ThemedText>
          </Pressable>
        </View>
      </View>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 12 },
  row: { flexDirection: 'row', gap: 12 },
  avatar: { width: 72, height: 72, borderRadius: 999 },
  emptyAvatar: { backgroundColor: '#333' },
  name: { fontSize: 16, fontWeight: '700' },
  title: { fontSize: 13, opacity: 0.8 },
  bio: { fontSize: 13, opacity: 0.8 },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 6, flexWrap: 'wrap' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12 },
  viewBtn: { marginTop: 10, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1 },
  viewBtnText: { fontWeight: '600', fontSize: 13 },
});

function resolveUrl(url?: string | null) {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_URL}${url}`;
}
