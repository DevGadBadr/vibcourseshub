import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionTab } from '@/components/ui/action-tab';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { CourseDetails } from '@/types/course';
import { api, API_URL, getCourseDetails, uploadCourseBrochure } from '@/utils/api';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

function resolveUrl(url?: string | null) {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_URL}${url}`;
}

export default function CourseEditScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const borderColor = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({}, 'muted');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [course, setCourse] = useState<CourseDetails | null>(null);
  const [shortDescription, setShortDescription] = useState('');
  const [fullDescription, setFullDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [previewVideoUrl, setPreviewVideoUrl] = useState('');
  const [brochureUrl, setBrochureUrl] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const d = await getCourseDetails(slug);
        setCourse(d);
        setShortDescription(d.shortDescription || '');
        setFullDescription(d.fullDescription || '');
        setThumbnailUrl(d.thumbnailUrl || '');
        setPreviewVideoUrl(d.previewVideoUrl || '');
        setBrochureUrl(d.brochureUrl || '');
      } catch (e: any) {
        Alert.alert('Failed to load', e?.message || '');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const onSave = async () => {
    setSaving(true);
    try {
      await api(`/courses/${slug}`, {
        method: 'PUT',
        auth: true,
        body: JSON.stringify({
          shortDescription: shortDescription || null,
          fullDescription: fullDescription || null,
          thumbnailUrl: thumbnailUrl || null,
          previewVideoUrl: previewVideoUrl || null,
          brochureUrl: brochureUrl || null,
        }),
      } as any);
      Alert.alert('Saved');
      router.replace('/(tabs)/explore' as any);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.centered}>
        <View style={styles.formContainer}>
          <ThemedText type="title" style={{ fontSize: 24 }}>Edit Course</ThemedText>
          {loading ? (
            <ThemedText>Loading…</ThemedText>
          ) : !course ? (
            <ThemedText>Not found</ThemedText>
          ) : (
            <>
              <ThemedView style={[styles.field, { height: 90, borderColor }]}><TextInput placeholder="Short description" placeholderTextColor={placeholderColor} value={shortDescription} onChangeText={setShortDescription} multiline style={[styles.input as any, { height: '100%', color: textColor }]} /></ThemedView>
              <ThemedView style={[styles.field, { height: 140, borderColor }]}><TextInput placeholder="Full description" placeholderTextColor={placeholderColor} value={fullDescription} onChangeText={setFullDescription} multiline style={[styles.input as any, { height: '100%', color: textColor }]} /></ThemedView>
              <ThemedView style={[styles.field, { borderColor }]}><TextInput placeholder="Thumbnail URL" placeholderTextColor={placeholderColor} value={thumbnailUrl} onChangeText={setThumbnailUrl} autoCapitalize="none" style={[styles.input as any, { color: textColor }]} /></ThemedView>
              <ThemedView style={[styles.field, { borderColor }]}><TextInput placeholder="Preview video URL" placeholderTextColor={placeholderColor} value={previewVideoUrl} onChangeText={setPreviewVideoUrl} autoCapitalize="none" style={[styles.input as any, { color: textColor }]} /></ThemedView>
              <ThemedView style={[styles.field, { borderColor }]}>
                <TextInput placeholder="Brochure PDF URL" placeholderTextColor={placeholderColor} value={brochureUrl} onChangeText={setBrochureUrl} autoCapitalize="none" style={[styles.input as any, { color: textColor }]} />
                {Platform.OS === 'web' && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <Pressable style={[styles.btn, styles.secondary]} onPress={async () => {
                      try {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'application/pdf';
                        input.onchange = async () => {
                          const file = input.files && input.files[0];
                          if (!file) return;
                          const form = new FormData();
                          form.append('brochure', file);
                          const { url } = await uploadCourseBrochure(form);
                          setBrochureUrl(url);
                        };
                        input.click();
                      } catch (e: any) {
                        Alert.alert('Upload failed', e?.message || 'Could not upload PDF');
                      }
                    }}>
                      <ThemedText>Upload brochure…</ThemedText>
                    </Pressable>
                  </View>
                )}
              </ThemedView>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <ActionTab label="Cancel" onPress={() => router.replace('/(tabs)/explore' as any)} style={{ width: 'auto', paddingVertical: 8, paddingHorizontal: 12 }} />
                <ActionTab label={saving ? 'Saving…' : 'Save'} onPress={onSave} style={{ width: 'auto', paddingVertical: 8, paddingHorizontal: 12 }} />
              </View>
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  centered: { width: '100%', alignItems: 'center' },
  formContainer: { width: '100%', maxWidth: 900, gap: 12 },
  field: { padding: 12, borderRadius: 10, borderWidth: 1 },
  input: { outlineWidth: 0, outlineColor: 'transparent' },
  btn: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10 },
  secondary: { backgroundColor: 'rgba(0,0,0,0.06)' },
});
