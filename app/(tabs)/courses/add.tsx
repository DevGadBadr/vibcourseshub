import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { api, API_URL, Category, listCategories, ManagedUser, mgmtListUsers, uploadCourseThumbnail } from '@/utils/api';
import { showToast } from '@/utils/toast';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

export default function CourseAddScreen() {
  const borderColor = useThemeColor({}, 'border');
  const placeholderColor = useThemeColor({}, 'muted');
  const textColor = useThemeColor({}, 'text');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const TITLE_MAX = 60;
  const titleRemaining = Math.max(0, TITLE_MAX - title.length);
  const [description, setDescription] = useState('');
  const [instructorEmail, setInstructorEmail] = useState('');
  const [selectedInstructors, setSelectedInstructors] = useState<ManagedUser[]>([]);
  const [instructorPickerOpen, setInstructorPickerOpen] = useState(false);
  const [instructors, setInstructors] = useState<ManagedUser[]>([]);
  const [instructorsLoading, setInstructorsLoading] = useState(false);
  const [instructorQuery, setInstructorQuery] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState('');
  // Pricing state
  const [showPrice, setShowPrice] = useState(true);
  const [price, setPrice] = useState<string>('');
  const [discountPrice, setDiscountPrice] = useState<string>('');

  const canSave = useMemo(() => title.length > 3 && slug.length > 3 && selectedInstructors.length > 0, [title, slug, selectedInstructors]);
  const isWeb = Platform.OS === 'web';

  // Reset to a fresh form whenever this screen gains focus (e.g., after saving and returning).
  useFocusEffect(
    useCallback(() => {
      setTitle('');
      setSlug('');
      setDescription('');
      setInstructorEmail('');
      setSelectedInstructors([]);
      setInstructorPickerOpen(false);
      setInstructors([]);
      setInstructorQuery('');
      setThumbnailUrl('');
      setPreview(false);
      setSaving(false);
      setSelectedCategories([]);
      setCategories([]);
      setCategoryPickerOpen(false);
      setShowPrice(true);
      setPrice('');
      setDiscountPrice('');
      setCategoryQuery('');
    }, [])
  );

  const openInstructorPicker = async () => {
    setInstructorPickerOpen(true);
    if (instructors.length === 0) {
      setInstructorsLoading(true);
      try {
        const all = await mgmtListUsers();
        setInstructors(all.filter(u => u.role === 'INSTRUCTOR'));
      } catch (e) {
        Alert.alert('Failed to load instructors');
        setInstructorPickerOpen(false);
      } finally {
        setInstructorsLoading(false);
      }
    }
  };

  const filteredInstructors = useMemo(() => {
    const q = instructorQuery.trim().toLowerCase();
    if (!q) return instructors;
    return instructors.filter(u =>
      (u.name || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [instructorQuery, instructors]);

  const openCategoryPicker = async () => {
    setCategoryPickerOpen(true);
    if (categories.length === 0) {
      try {
        const all = await listCategories();
        setCategories(all);
      } catch (e) {
        Alert.alert('Failed to load categories');
        setCategoryPickerOpen(false);
      }
    }
  };

  const filteredCategories = useMemo(() => {
    const q = categoryQuery.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q));
  }, [categoryQuery, categories]);

  const toggleSelectCategory = (c: Category) => {
    setSelectedCategories((prev) => {
      const exists = prev.some((x) => x.id === c.id);
      return exists ? prev.filter((x) => x.id !== c.id) : [...prev, c];
    });
  };

  const toggleSelectInstructor = (u: ManagedUser) => {
    setSelectedInstructors(prev => {
      const exists = prev.some(x => x.id === u.id);
      const next = exists ? prev.filter(x => x.id !== u.id) : [...prev, u];
      setInstructorEmail(next[0]?.email || '');
      return next;
    });
  };
  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const priceNumber = showPrice ? (price.trim() ? Number(price) : 0) : 0;
      const discountNumber = showPrice && discountPrice.trim() ? Number(discountPrice) : null;
      await api('/courses', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          title,
          slug,
          description,
          instructorId: selectedInstructors[0]?.id,
          instructorsIds: selectedInstructors.map(u => u.id),
          instructorEmail, // legacy fallback
          thumbnailUrl,
          categoriesIds: selectedCategories.map(c => c.id),
          // Pricing
          showPrice,
          price: priceNumber,
          discountPrice: discountNumber,
        }),
      } as any);
      showToast('Course added');
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
        <View style={styles.centered}>
          <View style={styles.formContainer}>
            <ThemedText type="title">Preview</ThemedText>
            <View style={styles.card}>
              {!!thumbnailUrl && (
                <Image source={{ uri: resolveAvatarUrl(thumbnailUrl) }} contentFit="contain" style={{ width: '100%', aspectRatio: 375/253, borderRadius: 8, marginBottom: 10, backgroundColor: '#eee' }} />
              )}
              <ThemedText style={styles.title}>{title || 'Untitled course'}</ThemedText>
              <ThemedText style={styles.meta}>
                {selectedInstructors.length > 0
                  ? selectedInstructors.map(u => u.name || u.email).join(', ')
                  : 'instructor@example.com'}
              </ThemedText>
              <ThemedText style={styles.desc}>{description || 'No description'}</ThemedText>
            </View>
            <View style={styles.row}>
              <Pressable style={[styles.btn, styles.secondary]} onPress={() => setPreview(false)}><ThemedText>Back</ThemedText></Pressable>
              <Pressable style={[styles.btn, styles.primary]} disabled={!canSave || saving} onPress={onSave}><ThemedText style={styles.btnText as any}>Save</ThemedText></Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.centered}>
        <View style={styles.formContainer}>
          <ThemedText type="title" style={{paddingTop: isWeb ? 0 : 40,fontSize: 24}}>Add Course</ThemedText>
          <ThemedView style={[styles.field, { borderColor, flexDirection: 'row', alignItems: 'center' }]}>
            <TextInput
              placeholder="Title"
              placeholderTextColor={placeholderColor}
              value={title}
              onChangeText={setTitle}
              maxLength={TITLE_MAX}
              style={[styles.input as any, { color: textColor, flex: 1 }]}
            />
            <ThemedText style={{ opacity: 0.6, fontSize: 12 }}>{titleRemaining}</ThemedText>
          </ThemedView>
          <ThemedView style={[styles.field, { borderColor }]}><TextInput placeholder="Slug (course-url)" placeholderTextColor={placeholderColor} value={slug} autoCapitalize="none" onChangeText={setSlug} style={[styles.input as any, { color: textColor }]} /></ThemedView>
          <Pressable onPress={openInstructorPicker} style={[styles.field, { borderColor, justifyContent: 'center', minHeight: 44 }]}>
            {selectedInstructors.length === 0 ? (
              <ThemedText style={{ color: placeholderColor }}>Select instructors</ThemedText>
            ) : (
              <View style={styles.instructorsRow}>
                <ThemedText style={styles.fieldLabel}>Instructors</ThemedText>
                <View style={styles.chipsWrap}>
                  {selectedInstructors.map((u) => (
                    <View key={u.id} style={styles.chip}>
                      {u.avatarUrl ? (
                        <Image source={{ uri: resolveAvatarUrl(u.avatarUrl) }} style={styles.chipAvatar} />
                      ) : (
                        <View style={[styles.chipAvatar, { backgroundColor: '#666' }]} />
                      )}
                      <ThemedText style={styles.chipText}>{u.name || u.email}</ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </Pressable>
          <Pressable onPress={openCategoryPicker} style={[styles.field, { borderColor, justifyContent: 'center', minHeight: 44 }]}> 
            {selectedCategories.length === 0 ? (
              <ThemedText style={{ color: placeholderColor }}>Select categories</ThemedText>
            ) : (
              <View style={styles.instructorsRow}>
                <ThemedText style={styles.fieldLabel}>Categories</ThemedText>
                <View style={styles.chipsWrap}>
                  {selectedCategories.map((c) => (
                    <View key={c.id} style={styles.chip}>
                      <ThemedText style={styles.chipText}>{c.name}</ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </Pressable>
          <ThemedView style={[styles.field, { height: 120, borderColor }]}><TextInput placeholder="Description" placeholderTextColor={placeholderColor} value={description} onChangeText={setDescription} multiline style={[styles.input as any, { height: '100%', color: textColor }]} /></ThemedView>
          {/* Pricing */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable onPress={() => setShowPrice((v) => !v)} style={[styles.btn, showPrice ? styles.primary : styles.secondary]}>
              <ThemedText style={showPrice ? (styles.btnText as any) : undefined}>{showPrice ? 'Show Price: ON' : 'Show Price: OFF'}</ThemedText>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <ThemedView style={[styles.field, { flex: 1, borderColor, opacity: showPrice ? 1 : 0.5 }]}>
              <ThemedText style={{ opacity: 0.7, fontSize: 12 }}>Price (USD)</ThemedText>
              <TextInput
                placeholder="e.g. 49.99"
                placeholderTextColor={placeholderColor}
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
                inputMode="decimal"
                editable={showPrice}
                style={{ paddingVertical: 6, color: textColor }}
              />
            </ThemedView>
            <ThemedView style={[styles.field, { flex: 1, borderColor, opacity: showPrice ? 1 : 0.5 }]}>
              <ThemedText style={{ opacity: 0.7, fontSize: 12 }}>Discount (optional)</ThemedText>
              <TextInput
                placeholder="e.g. 19.99"
                placeholderTextColor={placeholderColor}
                value={discountPrice}
                onChangeText={setDiscountPrice}
                keyboardType="decimal-pad"
                inputMode="decimal"
                editable={showPrice}
                style={{ paddingVertical: 6, color: textColor }}
              />
            </ThemedView>
          </View>
          <ThemedView style={[styles.field, { borderColor }]}>
            <TextInput placeholder="Thumbnail URL (optional)" placeholderTextColor={placeholderColor} value={thumbnailUrl} autoCapitalize="none" onChangeText={setThumbnailUrl} style={[styles.input as any, { color: textColor }]} />
            {Platform.OS === 'web' && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Pressable style={[styles.btn, styles.secondary]} onPress={async () => {
                  try {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = async () => {
                      const file = input.files && input.files[0];
                      if (!file) return;
                      const form = new FormData();
                      form.append('thumbnail', file);
                      const { url } = await uploadCourseThumbnail(form);
                      setThumbnailUrl(url);
                    };
                    input.click();
                  } catch (e: any) {
                    Alert.alert('Upload failed', e?.message || 'Could not upload image');
                  }
                }}>
                  <ThemedText>Upload image…</ThemedText>
                </Pressable>
              </View>
            )}
          </ThemedView>

          <View style={styles.row}>
            <Pressable style={[styles.btn, styles.secondary]} onPress={() => router.replace('/(tabs)/explore' as any)}><ThemedText>Cancel</ThemedText></Pressable>
            <Pressable style={[styles.btn, styles.secondary]} onPress={() => setPreview(true)}><ThemedText>Preview</ThemedText></Pressable>
            <Pressable style={[styles.btn, styles.primary]} disabled={!canSave || saving} onPress={onSave}><ThemedText style={styles.btnText as any}>Save</ThemedText></Pressable>
          </View>
        </View>
      </View>

      <Modal visible={instructorPickerOpen} transparent animationType="fade" onRequestClose={() => setInstructorPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill as any} onPress={() => setInstructorPickerOpen(false)} />
          <View style={[styles.modalCard, { backgroundColor: Platform.OS === 'web' ? '#1c1c1c' : '#222' }]}> 
            <ThemedText type="subtitle" style={{ marginBottom: 8 }}>Select instructor</ThemedText>
            <ThemedView style={[styles.field, { borderColor, marginBottom: 8 }]}>
              <TextInput
                placeholder="Search by name or email"
                placeholderTextColor={placeholderColor}
                value={instructorQuery}
                onChangeText={setInstructorQuery}
                autoCapitalize="none"
                style={[styles.input as any, { color: textColor }]}
              />
            </ThemedView>
            <ScrollView style={{ maxHeight: 360 }}>
              {instructorsLoading ? (
                <ThemedText>Loading…</ThemedText>
              ) : filteredInstructors.length === 0 ? (
                <ThemedText>No instructors found.</ThemedText>
              ) : (
                filteredInstructors.map((u) => {
                  const checked = selectedInstructors.some(x => x.id === u.id);
                  return (
                  <Pressable key={u.id} onPress={() => toggleSelectInstructor(u)} style={styles.instructorRow}>
                    {u.avatarUrl ? (
                      <Image source={{ uri: resolveAvatarUrl(u.avatarUrl) }} style={styles.avatarSmall} />
                    ) : (
                      <View style={[styles.avatarSmall, { backgroundColor: '#666' }]} />
                    )}
                    <View style={{ flex: 1 }}>
                      <ThemedText numberOfLines={1} style={{ fontWeight: '600' }}>{u.name || 'Unnamed'}</ThemedText>
                      <ThemedText numberOfLines={1} style={{ opacity: 0.7 }}>{u.email}</ThemedText>
                    </View>
                    <ThemedText style={{ fontWeight: '800', opacity: checked ? 1 : 0.25 }}>{checked ? '✓' : '○'}</ThemedText>
                  </Pressable>
                );
                })
              )}
            </ScrollView>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Pressable style={[styles.btn, styles.secondary]} onPress={() => setInstructorPickerOpen(false)}>
                <ThemedText>Done</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={categoryPickerOpen} transparent animationType="fade" onRequestClose={() => setCategoryPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill as any} onPress={() => setCategoryPickerOpen(false)} />
          <View style={[styles.modalCard, { backgroundColor: Platform.OS === 'web' ? '#1c1c1c' : '#222' }]}> 
            <ThemedText type="subtitle" style={{ marginBottom: 8 }}>Select categories</ThemedText>
            <ThemedView style={[styles.field, { borderColor, marginBottom: 8 }]}> 
              <TextInput
                placeholder="Search categories"
                placeholderTextColor={placeholderColor}
                value={categoryQuery}
                onChangeText={setCategoryQuery}
                autoCapitalize="none"
                style={[styles.input as any, { color: textColor }]}
              />
            </ThemedView>
            <ScrollView style={{ maxHeight: 360 }}>
              {filteredCategories.length === 0 ? (
                <ThemedText>No categories found.</ThemedText>
              ) : (
                filteredCategories.map((c) => {
                  const checked = selectedCategories.some((x) => x.id === c.id);
                  return (
                    <Pressable key={c.id} onPress={() => toggleSelectCategory(c)} style={styles.instructorRow}>
                      <View style={{ flex: 1 }}>
                        <ThemedText numberOfLines={1} style={{ fontWeight: '600' }}>{c.name}</ThemedText>
                        <ThemedText numberOfLines={1} style={{ opacity: 0.7 }}>{c.slug}</ThemedText>
                      </View>
                      <ThemedText style={{ fontWeight: '800', opacity: checked ? 1 : 0.25 }}>{checked ? '✓' : '○'}</ThemedText>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Pressable style={[styles.btn, styles.secondary]} onPress={() => setCategoryPickerOpen(false)}>
                <ThemedText>Done</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, },
  centered: { width: '100%', alignItems: 'center' },
  formContainer: { width: '100%', maxWidth: 900, gap: 12 },
  field: { padding: 12, borderRadius: 10, borderWidth: 1 },
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
  modalBackdrop: { flex: 1, backgroundColor: '#00000088', padding: 16, justifyContent: 'flex-end' },
  modalCard: { borderRadius: 12, padding: 12 },
  instructorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  avatarSmall: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#999', marginRight: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.06)' },
  chipAvatar: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#999' },
  chipText: { fontWeight: '600', fontSize: 12 },
  instructorsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  fieldLabel: { fontWeight: '700', opacity: 0.75, fontSize: 12 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
});

function resolveAvatarUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_URL}${url}`;
}
