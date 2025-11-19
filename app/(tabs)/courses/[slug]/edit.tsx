import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionTab } from '@/components/ui/action-tab';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { CourseDetails } from '@/types/course';
import { api, API_URL, Category, getCourseDetails, listCategories, ManagedUser, mgmtListUsers, uploadCourseBrochure, uploadCourseThumbnail } from '@/utils/api';
import { showToast } from '@/utils/toast';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, BackHandler, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

function resolveUrl(url?: string | null) {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_URL}${url}`;
}

export default function CourseEditScreen() {
  const { slug, from } = useLocalSearchParams<{ slug: string; from?: string }>();
  const borderColor = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({}, 'muted');
  const surface = useThemeColor({}, 'surface');
  const surface2 = useThemeColor({}, 'surface2');
  const tint = useThemeColor({}, 'tint');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [course, setCourse] = useState<CourseDetails | null>(null);
  
  // All editable fields
  const [title, setTitle] = useState('');
  const TITLE_MAX = 60;
  const titleRemaining = Math.max(0, TITLE_MAX - title.length);
  const [description, setDescription] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [fullDescription, setFullDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [previewVideoUrl, setPreviewVideoUrl] = useState('');
  const [brochureUrl, setBrochureUrl] = useState('');
  const [currency, setCurrency] = useState('EGP');
  const [showPrice, setShowPrice] = useState(true);
  const [price, setPrice] = useState<string>('');
  const [discountPrice, setDiscountPrice] = useState<string>('');
  
  // Instructors
  const [selectedInstructors, setSelectedInstructors] = useState<ManagedUser[]>([]);
  const [instructorPickerOpen, setInstructorPickerOpen] = useState(false);
  const [instructors, setInstructors] = useState<ManagedUser[]>([]);
  const [instructorsLoading, setInstructorsLoading] = useState(false);
  const [instructorQuery, setInstructorQuery] = useState('');
  
  // Categories
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const d = await getCourseDetails(slug);
        setCourse(d);
        setTitle(d.title || '');
        setDescription(d.description || '');
        setShortDescription(d.shortDescription || '');
        setFullDescription(d.fullDescription || '');
        setThumbnailUrl(d.thumbnailUrl || '');
        setPreviewVideoUrl(d.previewVideoUrl || '');
        setBrochureUrl(d.brochureUrl || '');
        setCurrency(d.currency || 'EGP');
        setShowPrice(d.showPrice ?? true);
        setPrice(d.price ? String(d.price) : '');
        setDiscountPrice(d.discountPrice ? String(d.discountPrice) : '');
        
        // Load instructors and categories
        const [allInstructors, allCategories] = await Promise.all([
          mgmtListUsers(),
          listCategories()
        ]);
        setInstructors(allInstructors.filter(u => u.role === 'INSTRUCTOR'));
        setCategories(allCategories);
        
        // Set selected instructors from course data
        if (d.instructors && d.instructors.length > 0) {
          const instructorUsers = d.instructors.map(i => ({
            id: i.id,
            email: i.email,
            name: i.name,
            role: 'INSTRUCTOR' as const,
            avatarUrl: i.avatarUrl,
            googlePicture: null,
            createdAt: new Date().toISOString(),
          }));
          setSelectedInstructors(instructorUsers);
        }
        
        // Set selected categories from course data
        if (d.categories && d.categories.length > 0) {
          setSelectedCategories(d.categories);
        }
      } catch (e: any) {
        if (Platform.OS === 'web') {
          showToast(e?.message || 'Failed to load');
        } else {
          Alert.alert('Failed to load', e?.message || '');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const openInstructorPicker = async () => {
    setInstructorPickerOpen(true);
    if (instructors.length === 0) {
      setInstructorsLoading(true);
      try {
        const all = await mgmtListUsers();
        setInstructors(all.filter(u => u.role === 'INSTRUCTOR'));
      } catch (e) {
        if (Platform.OS === 'web') {
          showToast('Failed to load instructors');
        } else {
          Alert.alert('Failed to load instructors');
        }
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
        if (Platform.OS === 'web') {
          showToast('Failed to load categories');
        } else {
          Alert.alert('Failed to load categories');
        }
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
      return exists ? prev.filter(x => x.id !== u.id) : [...prev, u];
    });
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const priceNumber = showPrice ? (price.trim() ? Number(price) : 0) : 0;
      const discountNumber = showPrice && discountPrice.trim() ? Number(discountPrice) : null;
      
      // Helper to check if a string is a full URL
      const isFullUrl = (url: string) => url.startsWith('http://') || url.startsWith('https://');
      
      // Build payload with only defined values
      const payload: any = {};
      
      if (title && title.trim()) payload.title = title.trim();
      if (description && description.trim()) payload.description = description.trim();
      if (shortDescription && shortDescription.trim()) payload.shortDescription = shortDescription.trim();
      if (fullDescription && fullDescription.trim()) payload.fullDescription = fullDescription.trim();
      
      // For URL fields: ONLY send if it's a full URL (user manually entered/changed it)
      // Don't send relative paths - they're already stored in the database
      if (thumbnailUrl && thumbnailUrl.trim() && isFullUrl(thumbnailUrl.trim())) {
        payload.thumbnailUrl = thumbnailUrl.trim();
      }
      if (previewVideoUrl && previewVideoUrl.trim() && isFullUrl(previewVideoUrl.trim())) {
        payload.previewVideoUrl = previewVideoUrl.trim();
      }
      if (brochureUrl && brochureUrl.trim() && isFullUrl(brochureUrl.trim())) {
        payload.brochureUrl = brochureUrl.trim();
      }
      
      if (currency && currency.trim()) payload.currency = currency.trim();
      
      payload.showPrice = showPrice;
      payload.price = priceNumber;
      if (discountNumber !== null) payload.discountPrice = discountNumber;
      
      // Always send categories (even if empty array)
      payload.categoriesIds = selectedCategories.map(c => c.id);
      
      // Only send instructorId if we have a selected instructor
      if (selectedInstructors.length > 0 && selectedInstructors[0]?.id) {
        payload.instructorId = selectedInstructors[0].id;
      }
      
      console.log('Saving course with payload:', payload);
      
      await api(`/courses/${slug}`, {
        method: 'PUT',
        auth: true,
        body: JSON.stringify(payload),
      } as any);
      
      showToast('Course updated');
      
      // Navigate back to the correct tab with refresh flag
      if (from === 'manager') {
        router.replace('/(tabs)/manager?refresh=1' as any);
      } else {
        router.replace('/(tabs)/explore?refresh=1' as any);
      }
    } catch (e: any) {
      console.error('Save error:', e);
      const errorMsg = e?.message || e?.error || 'Could not save';
      if (Platform.OS === 'web') {
        showToast(errorMsg);
        // Also show in alert for visibility
        Alert.alert('Save Failed', errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setSaving(false);
    }
  };

  const isWeb = Platform.OS === 'web';
  
  const handleCancel = () => {
    // Navigate to the correct tab without refresh
    // Default to explore if 'from' is not specified
    if (from === 'manager') {
      router.replace('/(tabs)/manager' as any);
    } else {
      // Default to explore (covers both from='explore' and undefined cases)
      router.replace('/(tabs)/explore' as any);
    }
  };
  
  // Intercept Android hardware back button
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleCancel();
      return true; // Prevent default behavior
    });
    
    return () => backHandler.remove();
  }, [from]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.centered}>
        <View style={styles.formContainer}>
          {/* Circular back button - same style as course details */}
          <View style={styles.topBackWrap}>
            <Pressable
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={handleCancel}
              style={[
                styles.topBackBtn,
                Platform.OS === 'web' && styles.topBackBtnWeb,
                { backgroundColor: surface, borderColor: borderColor }
              ]}
            >
              <ThemedText style={[styles.topBackArrow, Platform.OS === 'web' && styles.topBackArrowWeb]}>←</ThemedText>
            </Pressable>
          </View>
          
          <ThemedText type="title" style={{ paddingTop: isWeb ? 0 : 40, fontSize: 24 }}>Edit Course</ThemedText>
          {loading ? (
            <ThemedText>Loading…</ThemedText>
          ) : !course ? (
            <ThemedText>Not found</ThemedText>
          ) : (
            <>
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
                            <Image source={{ uri: resolveUrl(u.avatarUrl) }} style={styles.chipAvatar} />
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

              <ThemedView style={[styles.field, { height: 90, borderColor }]}><TextInput placeholder="Short description" placeholderTextColor={placeholderColor} value={shortDescription} onChangeText={setShortDescription} multiline style={[styles.input as any, { height: '100%', color: textColor }]} /></ThemedView>
              <ThemedView style={[styles.field, { height: 140, borderColor }]}><TextInput placeholder="Full description" placeholderTextColor={placeholderColor} value={fullDescription} onChangeText={setFullDescription} multiline style={[styles.input as any, { height: '100%', color: textColor }]} /></ThemedView>
              <ThemedView style={[styles.field, { height: 90, borderColor }]}><TextInput placeholder="Legacy description (optional)" placeholderTextColor={placeholderColor} value={description} onChangeText={setDescription} multiline style={[styles.input as any, { height: '100%', color: textColor }]} /></ThemedView>
              <ThemedView style={[styles.field, { borderColor }]}><TextInput placeholder="Preview video URL (optional)" placeholderTextColor={placeholderColor} value={previewVideoUrl} onChangeText={setPreviewVideoUrl} autoCapitalize="none" style={[styles.input as any, { color: textColor }]} /></ThemedView>
              
              <ThemedView style={[styles.field, { borderColor }]}>
                <TextInput placeholder="Brochure PDF URL (optional)" placeholderTextColor={placeholderColor} value={brochureUrl} onChangeText={setBrochureUrl} autoCapitalize="none" style={[styles.input as any, { color: textColor }]} />
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
                        if (Platform.OS === 'web') {
                          showToast(e?.message || 'Could not upload PDF');
                        } else {
                          Alert.alert('Upload failed', e?.message || 'Could not upload PDF');
                        }
                      }
                    }}>
                      <ThemedText>Upload brochure…</ThemedText>
                    </Pressable>
                  </View>
                )}
              </ThemedView>

              <ThemedView style={[styles.field, { borderColor }]}><TextInput placeholder="Currency (e.g. EGP, USD)" placeholderTextColor={placeholderColor} value={currency} onChangeText={setCurrency} autoCapitalize="characters" style={[styles.input as any, { color: textColor }]} /></ThemedView>
              
              {/* Pricing */}
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
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
                <View style={{ width: 120 }}>
                  <ActionTab size="sm" label={showPrice ? 'Price ON' : 'Price OFF'} onPress={() => setShowPrice(v => !v)} />
                </View>
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
                        if (Platform.OS === 'web') {
                          showToast(e?.message || 'Could not upload image');
                        } else {
                          Alert.alert('Upload failed', e?.message || 'Could not upload image');
                        }
                      }
                    }}>
                      <ThemedText>Upload image…</ThemedText>
                    </Pressable>
                  </View>
                )}
              </ThemedView>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <ActionTab label="Cancel" onPress={handleCancel} style={{ width: 'auto', paddingVertical: 8, paddingHorizontal: 12 }} />
                <ActionTab label={saving ? 'Saving…' : 'Save'} onPress={onSave} disabled={saving} style={{ width: 'auto', paddingVertical: 8, paddingHorizontal: 12 }} />
              </View>
            </>
          )}
        </View>
      </View>

      {/* Instructor Picker Modal */}
      <Modal visible={instructorPickerOpen} transparent animationType="fade" onRequestClose={() => setInstructorPickerOpen(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
          <Pressable style={StyleSheet.absoluteFill as any} onPress={() => setInstructorPickerOpen(false)} />
          <View style={[styles.modalCard, { backgroundColor: surface, borderColor: borderColor }]}> 
            <ThemedText type="subtitle" style={{ marginBottom: 12, fontSize: 18, fontWeight: '700' }}>Select Instructors</ThemedText>
            <View style={[styles.searchBox, { backgroundColor: surface2, borderColor: borderColor }]}>
              <TextInput
                placeholder="Search by name or email"
                placeholderTextColor={placeholderColor}
                value={instructorQuery}
                onChangeText={setInstructorQuery}
                autoCapitalize="none"
                style={{ color: textColor, fontSize: 15, paddingVertical: 2 }}
              />
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              {instructorsLoading ? (
                <ThemedText style={{ textAlign: 'center', paddingVertical: 20 }}>Loading…</ThemedText>
              ) : filteredInstructors.length === 0 ? (
                <ThemedText style={{ textAlign: 'center', paddingVertical: 20, opacity: 0.7 }}>No instructors found.</ThemedText>
              ) : (
                filteredInstructors.map((u) => {
                  const checked = selectedInstructors.some(x => x.id === u.id);
                  return (
                  <Pressable 
                    key={u.id} 
                    onPress={() => toggleSelectInstructor(u)} 
                    style={({ hovered }) => [
                      styles.pickerItem,
                      { backgroundColor: hovered ? surface2 : 'transparent' }
                    ]}
                  >
                    {u.avatarUrl ? (
                      <Image source={{ uri: resolveUrl(u.avatarUrl) }} style={styles.avatarSmall} />
                    ) : (
                      <View style={[styles.avatarSmall, { backgroundColor: '#666' }]} />
                    )}
                    <View style={{ flex: 1 }}>
                      <ThemedText numberOfLines={1} style={{ fontWeight: '600', fontSize: 15 }}>{u.name || 'Unnamed'}</ThemedText>
                      <ThemedText numberOfLines={1} style={{ opacity: 0.6, fontSize: 12, marginTop: 2 }}>{u.email}</ThemedText>
                    </View>
                    <View style={[styles.checkbox, { borderColor: checked ? tint : borderColor, backgroundColor: checked ? tint : 'transparent' }]}>
                      {checked && <ThemedText style={{ color: surface, fontSize: 14, fontWeight: '800' }}>✓</ThemedText>}
                    </View>
                  </Pressable>
                );
                })
              )}
            </ScrollView>
            <View style={[styles.modalFooter, { borderTopColor: borderColor }]}>
              <Pressable 
                style={({ hovered }) => [
                  styles.doneBtn,
                  { backgroundColor: hovered ? tint : surface2, borderColor: hovered ? tint : borderColor }
                ]}
                onPress={() => setInstructorPickerOpen(false)}
              >
                {({ hovered }) => <ThemedText style={[styles.doneBtnText, { color: hovered ? surface : textColor }]}>Done</ThemedText>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Category Picker Modal */}
      <Modal visible={categoryPickerOpen} transparent animationType="fade" onRequestClose={() => setCategoryPickerOpen(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
          <Pressable style={StyleSheet.absoluteFill as any} onPress={() => setCategoryPickerOpen(false)} />
          <View style={[styles.modalCard, { backgroundColor: surface, borderColor: borderColor }]}> 
            <ThemedText type="subtitle" style={{ marginBottom: 12, fontSize: 18, fontWeight: '700' }}>Select Categories</ThemedText>
            <View style={[styles.searchBox, { backgroundColor: surface2, borderColor: borderColor }]}>
              <TextInput
                placeholder="Search categories"
                placeholderTextColor={placeholderColor}
                value={categoryQuery}
                onChangeText={setCategoryQuery}
                autoCapitalize="none"
                style={{ color: textColor, fontSize: 15, paddingVertical: 2 }}
              />
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              {filteredCategories.length === 0 ? (
                <ThemedText style={{ textAlign: 'center', paddingVertical: 20, opacity: 0.7 }}>No categories found.</ThemedText>
              ) : (
                filteredCategories.map((c) => {
                  const checked = selectedCategories.some((x) => x.id === c.id);
                  return (
                    <Pressable 
                      key={c.id} 
                      onPress={() => toggleSelectCategory(c)} 
                      style={({ hovered }) => [
                        styles.pickerItem,
                        { backgroundColor: hovered ? surface2 : 'transparent' }
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <ThemedText numberOfLines={1} style={{ fontWeight: '600', fontSize: 15 }}>{c.name}</ThemedText>
                        <ThemedText numberOfLines={1} style={{ opacity: 0.6, fontSize: 12, marginTop: 2 }}>{c.slug}</ThemedText>
                      </View>
                      <View style={[styles.checkbox, { borderColor: checked ? tint : borderColor, backgroundColor: checked ? tint : 'transparent' }]}>
                        {checked && <ThemedText style={{ color: surface, fontSize: 14, fontWeight: '800' }}>✓</ThemedText>}
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
            <View style={[styles.modalFooter, { borderTopColor: borderColor }]}>
              <Pressable 
                style={({ hovered }) => [
                  styles.doneBtn,
                  { backgroundColor: hovered ? tint : surface2, borderColor: hovered ? tint : borderColor }
                ]}
                onPress={() => setCategoryPickerOpen(false)}
              >
                {({ hovered }) => <ThemedText style={[styles.doneBtnText, { color: hovered ? surface : textColor }]}>Done</ThemedText>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  centered: { width: '100%', alignItems: 'center' },
  formContainer: { width: '100%', maxWidth: 900, gap: 12 },
  field: { padding: 12, borderRadius: 10, borderWidth: 1 },
  input: { outlineWidth: 0, outlineColor: 'transparent' },
  btn: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10 },
  secondary: { backgroundColor: 'rgba(0,0,0,0.06)' },
  modalBackdrop: { flex: 1, padding: 16, justifyContent: 'flex-end' },
  modalCard: { 
    borderRadius: 16, 
    padding: 16, 
    borderWidth: 1,
    maxHeight: '70%',
    ...Platform.select({
      web: { boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
      default: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 }
    })
  } as any,
  searchBox: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 12
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  doneBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    ...Platform.select({
      web: { transitionDuration: '150ms', transitionProperty: 'background-color, border-color' },
      default: {}
    })
  } as any,
  doneBtnText: {
    fontWeight: '600',
    fontSize: 14,
  },
  instructorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  avatarSmall: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#999', marginRight: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.06)' },
  chipAvatar: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#999' },
  chipText: { fontWeight: '600', fontSize: 12 },
  instructorsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  fieldLabel: { fontWeight: '700', opacity: 0.75, fontSize: 12 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  topBackWrap: { marginBottom: 4 },
  topBackBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', borderWidth: 1 },
  topBackArrow: { fontSize: 20, lineHeight: 22, fontWeight: '600', opacity: 0.85 },
  topBackBtnWeb: { width: 48, height: 48, borderRadius: 24 },
  topBackArrowWeb: { fontSize: 26, lineHeight: 28 },
});
