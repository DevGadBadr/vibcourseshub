import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { CourseCurriculumSection } from '@/types/course';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

function formatDuration(seconds?: number | null) {
  const s = typeof seconds === 'number' && seconds > 0 ? seconds : 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export const CurriculumAccordion: React.FC<{ sections?: CourseCurriculumSection[] }>
  = ({ sections }) => {
  const border = useThemeColor({}, 'border');
  const surface = useThemeColor({}, 'surface');
  const tint = useThemeColor({}, 'tint');
  const [open, setOpen] = useState<number | null>(null);
  if (!sections || sections.length === 0) return null;
  return (
    <View style={{ gap: 10 }}>
      {sections.map((sec) => {
        const expanded = open === sec.id;
        return (
          <ThemedView key={sec.id} style={[styles.section, { borderColor: border, backgroundColor: surface }]}> 
            <Pressable style={styles.header} onPress={() => setOpen(expanded ? null : sec.id)}>
              <View style={{ flex: 1, gap: 4 }}>
                <ThemedText numberOfLines={2} style={styles.sectionTitle}>{sec.title}</ThemedText>
                <ThemedText style={styles.meta}>{sec.lectureCount} lectures • {formatDuration(sec.totalDurationSeconds)}</ThemedText>
              </View>
              <IconSymbol name={expanded ? 'chevron.down' as any : 'chevron.forward'} size={18} color={tint} />
            </Pressable>
            {expanded && (
              <View style={styles.lecturesWrap}>
                {sec.lectures.map((l) => (
                  <View key={l.id} style={styles.lectureRow}>
                    <IconSymbol name={Platform.OS === 'ios' ? 'play.circle.fill' as any : 'play.circle'} size={18} color={tint} />
                    <ThemedText numberOfLines={2} style={styles.lectureTitle}>{l.title}</ThemedText>
                    <ThemedText style={styles.lectureDuration}>{formatDuration(l.durationSeconds)}</ThemedText>
                  </View>
                ))}
              </View>
            )}
          </ThemedView>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  section: { borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '600' },
  meta: { fontSize: 12, opacity: 0.6 },
  lecturesWrap: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.15)' },
  lectureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  lectureTitle: { flex: 1, fontSize: 13 },
  lectureDuration: { fontSize: 11, opacity: 0.6 },
});
