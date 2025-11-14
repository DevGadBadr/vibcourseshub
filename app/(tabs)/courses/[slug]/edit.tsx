import { CourseCard } from '@/components/course-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/providers/AuthProvider';
import { api } from '@/utils/api';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

type CourseDetail = {
  id: number;
  slug: string;
  title: string;
  description?: string | null;
  instructorId: number;
  thumbnailUrl?: string | null;
  promoUrl?: string | null;
  level?: string | null;
  language?: string | null;
  durationSeconds?: number | null;
  isPublished: boolean;
};

export default function CourseEditScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { user } = useAuth();
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [published, setPublished] = useState<boolean>(true);
  const [featured, setFeatured] = useState<boolean>(false);
  const [supportsFeatured, setSupportsFeatured] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await api<CourseDetail>(`/courses/${slug}`); setDetail(d);
        setPublished(!!d.isPublished);
        const hasFeatured = Object.prototype.hasOwnProperty.call(d as any, 'isFeatured');
        setSupportsFeatured(hasFeatured);
        setFeatured(hasFeatured ? ((d as any).isFeatured ?? false) : false);
      } catch (e: any) { Alert.alert('Error', e?.message || 'Failed to load course'); } finally { setLoading(false); }
    })();
  }, [slug]);

  const canSave = useMemo(() => !!detail && detail.title.length > 3, [detail]);

  const updateField = <K extends keyof CourseDetail>(key: K, value: CourseDetail[K]) => {
    setDetail(d => d ? { ...d, [key]: value } : d);
  };

  const onSave = async () => {
    if (!canSave || !detail) return;
    setSaving(true);
    try {
      const body: any = { title: detail.title, description: detail.description, thumbnailUrl: detail.thumbnailUrl, isPublished: published };
      if (supportsFeatured) body.isFeatured = featured;
      await api(`/courses/${slug}`, { method: 'PUT', auth: true, body: JSON.stringify(body) } as any);
      Alert.alert('Saved', 'Course updated');
      router.replace('/(tabs)/explore' as any);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Update failed');
    } finally { setSaving(false); }
  };

  if (loading) return <ScrollView contentContainerStyle={styles.container}><ThemedText>Loading...</ThemedText></ScrollView>;
  if (!detail) return <ScrollView contentContainerStyle={styles.container}><ThemedText>Not found.</ThemedText></ScrollView>;

  const textColor = useThemeColor({}, 'text');
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');
  const tint = useThemeColor({}, 'tint');

  if (preview) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedText type="title">Preview</ThemedText>
        <View style={{ maxWidth: 320 }}>
          <CourseCard course={{
            id: detail.id,
            slug: detail.slug,
            title: detail.title,
            description: detail.description || undefined,
            thumbnailUrl: detail.thumbnailUrl || undefined,
            averageRating: 5,
            ratingCount: 0,
            instructor: { id: detail.instructorId, name: 'Instructor', email: 'instructor@example.com' },
          } as any} size="compact" hideNewBadge />
        </View>
        <ThemedText style={styles.previewDesc}>{detail.description || 'No description provided.'}</ThemedText>
        <View style={styles.row}>
          <Pressable style={[styles.btn, styles.secondary]} onPress={() => setPreview(false)}><ThemedText>Back</ThemedText></Pressable>
          <Pressable style={[styles.btn, styles.primary, { backgroundColor: tint }]} disabled={!canSave || saving} onPress={onSave}><ThemedText style={styles.btnText as any}>Save</ThemedText></Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title">Edit Course</ThemedText>
      <ThemedView style={[styles.field, { backgroundColor: surface, borderColor: border }]}><TextInput placeholder="Title" placeholderTextColor={textColor + '88'} value={detail.title} onChangeText={v => updateField('title', v)} style={[styles.input as any, { color: textColor }]} /></ThemedView>
      <ThemedView style={[styles.field, { height: 120, backgroundColor: surface, borderColor: border }]}><TextInput placeholder="Description" placeholderTextColor={textColor + '66'} value={detail.description || ''} onChangeText={v => updateField('description', v)} multiline style={[styles.input as any, { height: '100%', color: textColor }]} /></ThemedView>
      <ThemedView style={[styles.field, { backgroundColor: surface, borderColor: border }]}><TextInput placeholder="Thumbnail URL" placeholderTextColor={textColor + '66'} value={detail.thumbnailUrl || ''} onChangeText={v => updateField('thumbnailUrl', v)} autoCapitalize="none" style={[styles.input as any, { color: textColor }]} /></ThemedView>
      {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable onPress={() => setPublished(p => !p)} style={[styles.badgeBtn, published ? styles.badgeOn : styles.badgeOff]}><ThemedText style={styles.badgeBtnText}>{published ? 'Published' : 'Unpublished'}</ThemedText></Pressable>
          <Pressable onPress={() => setFeatured(f => !f)} style={[styles.badgeBtn, featured ? styles.badgeOn : styles.badgeOff]}><ThemedText style={styles.badgeBtnText}>{featured ? 'Featured' : 'Not Featured'}</ThemedText></Pressable>
        </View>
      )}
      <View style={styles.row}>
        <Pressable style={[styles.btn, styles.secondary]} onPress={() => router.replace('/(tabs)/explore' as any)}><ThemedText>Cancel</ThemedText></Pressable>
        <Pressable style={[styles.btn, styles.secondary]} onPress={() => setPreview(true)}><ThemedText>Preview</ThemedText></Pressable>
        <Pressable style={[styles.btn, styles.primary, { backgroundColor: tint }]} disabled={!canSave || saving} onPress={onSave}><ThemedText style={styles.btnText as any}>Save</ThemedText></Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  field: { padding: 12, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  input: { outlineWidth: 0, outlineColor: 'transparent' },
  row: { flexDirection: 'row', gap: 10, marginTop: 10 },
  btn: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10 },
  primary: { backgroundColor: '#0a7ea4' },
  secondary: { backgroundColor: 'rgba(0,0,0,0.06)' },
  btnText: { color: 'white', fontWeight: '700' },
  previewDesc: { marginTop: 12, fontSize: 13, opacity: 0.8 },
  title: { fontSize: 18, fontWeight: '700' },
  meta: { opacity: 0.7, marginTop: 4 },
  desc: { marginTop: 8 },
  badgeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  badgeOn: { backgroundColor: '#0a7ea4' },
  badgeOff: { backgroundColor: 'rgba(0,0,0,0.06)' },
  badgeBtnText: { color: 'white', fontWeight: '700' },
});
