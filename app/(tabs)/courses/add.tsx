import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { api } from '@/utils/api';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

export default function CourseAddScreen() {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [instructorEmail, setInstructorEmail] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSave = useMemo(() => title.length > 3 && slug.length > 3 && instructorEmail.includes('@'), [title, slug, instructorEmail]);
  const isWeb = Platform.OS === 'web';
  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await api('/courses', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ title, slug, description, instructorEmail, thumbnailUrl }),
      } as any);
      Alert.alert('Success', 'Course added');
      router.replace('/(tabs)/explore' as any);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  if (preview) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedText type="title">Preview</ThemedText>
        <View style={styles.card}>
          {!!thumbnailUrl && (
            <Image source={{ uri: thumbnailUrl }} style={{ width: '100%', aspectRatio: 16/9, borderRadius: 8, marginBottom: 10, backgroundColor: '#eee' }} />
          )}
          <ThemedText style={styles.title}>{title || 'Untitled course'}</ThemedText>
          <ThemedText style={styles.meta}>{instructorEmail || 'instructor@example.com'}</ThemedText>
          <ThemedText style={styles.desc}>{description || 'No description'}</ThemedText>
        </View>
        <View style={styles.row}>
          <Pressable style={[styles.btn, styles.secondary]} onPress={() => setPreview(false)}><ThemedText>Back</ThemedText></Pressable>
          <Pressable style={[styles.btn, styles.primary]} disabled={!canSave || saving} onPress={onSave}><ThemedText style={styles.btnText as any}>Save</ThemedText></Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title" style={{paddingTop: isWeb ? 0 : 40,fontSize: 24}}>Add Course</ThemedText>
      <ThemedView style={styles.field}><TextInput placeholder="Title" value={title} onChangeText={setTitle} style={styles.input as any} /></ThemedView>
      <ThemedView style={styles.field}><TextInput placeholder="Slug (course-url)" value={slug} autoCapitalize="none" onChangeText={setSlug} style={styles.input as any} /></ThemedView>
      <ThemedView style={styles.field}><TextInput placeholder="Instructor email" value={instructorEmail} autoCapitalize="none" onChangeText={setInstructorEmail} style={styles.input as any} /></ThemedView>
      <ThemedView style={[styles.field, { height: 120 }]}><TextInput placeholder="Description" value={description} onChangeText={setDescription} multiline style={[styles.input as any, { height: '100%' }]} /></ThemedView>
      <ThemedView style={styles.field}><TextInput placeholder="Thumbnail URL (optional)" value={thumbnailUrl} autoCapitalize="none" onChangeText={setThumbnailUrl} style={styles.input as any} /></ThemedView>

      <View style={styles.row}>
        <Pressable style={[styles.btn, styles.secondary]} onPress={() => router.replace('/(tabs)/explore' as any)}><ThemedText>Cancel</ThemedText></Pressable>
        <Pressable style={[styles.btn, styles.secondary]} onPress={() => setPreview(true)}><ThemedText>Preview</ThemedText></Pressable>
        <Pressable style={[styles.btn, styles.primary]} disabled={!canSave || saving} onPress={onSave}><ThemedText style={styles.btnText as any}>Save</ThemedText></Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, },
  field: { padding: 12, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.2)' },
  input: { outlineWidth: 0, outlineColor: 'transparent' },
  row: { flexDirection: 'row', gap: 10, marginTop: 10 },
  btn: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10 },
  primary: { backgroundColor: '#0a7ea4' },
  secondary: { backgroundColor: 'rgba(0,0,0,0.06)' },
  btnText: { color: 'white', fontWeight: '700' },
  card: { padding: 16, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.2)' },
  title: { fontSize: 18, fontWeight: '700' },
  meta: { opacity: 0.7, marginTop: 4 },
  desc: { marginTop: 8 },
});