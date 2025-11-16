import { CourseCard } from '@/components/course-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/providers/AuthProvider';
import { api, Category, listCategories } from '@/utils/api';
import { showToast } from '@/utils/toast';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

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
  isFeatured?: boolean;
  categories?: Array<{ id: number; name: string; slug: string }>;
  // Pricing
  price?: number;
  discountPrice?: number | null;
  showPrice?: boolean;
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [price, setPrice] = useState<string>('');
  const [discountPrice, setDiscountPrice] = useState<string>('');
  const [showPrice, setShowPrice] = useState<boolean>(true);

  // Hooks that must be called unconditionally (avoid rules-of-hooks violations)
  const textColor = useThemeColor({}, 'text');
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');
  const tint = useThemeColor({}, 'tint');

  useEffect(() => {
    (async () => {
      try {
        const d = await api<CourseDetail>(`/courses/${slug}`); setDetail(d);
        setPublished(!!d.isPublished);
        const hasFeatured = Object.prototype.hasOwnProperty.call(d as any, 'isFeatured');
        setSupportsFeatured(hasFeatured);
        setFeatured(hasFeatured ? ((d as any).isFeatured ?? false) : false);
        // Pricing initial
        setShowPrice((d as any).showPrice !== false);
        setPrice(typeof (d as any).price === 'number' ? String((d as any).price) : '');
        setDiscountPrice((d as any).discountPrice != null ? String((d as any).discountPrice) : '');
        try {
          const allCats = await listCategories();
          setCategories(allCats);
          if (Array.isArray(d.categories)) {
            const byId = new Map(allCats.map((c) => [c.id, c]));
            setSelectedCategories(d.categories.map((c) => byId.get(c.id) || c as any));
          }
        } catch {}
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
      const body: any = { title: detail.title, description: detail.description, thumbnailUrl: detail.thumbnailUrl, isPublished: published, categoriesIds: selectedCategories.map((c) => c.id) };
      if (supportsFeatured) body.isFeatured = featured;
      // Pricing
      body.showPrice = showPrice;
      body.price = showPrice ? (price.trim() ? Number(price) : 0) : 0;
      body.discountPrice = showPrice && discountPrice.trim() ? Number(discountPrice) : null;
      await api(`/courses/${slug}`, { method: 'PUT', auth: true, body: JSON.stringify(body) } as any);
      showToast('Course updated');
      try { router.back(); } catch {}
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Update failed');
    } finally { setSaving(false); }
  };

  if (loading) return <ScrollView contentContainerStyle={styles.container}><ThemedText>Loading...</ThemedText></ScrollView>;
  if (!detail) return <ScrollView contentContainerStyle={styles.container}><ThemedText>Not found.</ThemedText></ScrollView>;

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
            price: showPrice ? Number(price || detail.price || 0) : 0,
            discountPrice: showPrice ? (discountPrice.trim() ? Number(discountPrice) : (detail.discountPrice ?? null)) : null,
            showPrice: showPrice,
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
      <View style={styles.centered}>
        <View style={styles.formContainer}>
          <ThemedText type="title" style={{ fontSize: 24 }}>Edit Course</ThemedText>
          <ThemedView style={[styles.field, { backgroundColor: surface, borderColor: border }]}><TextInput placeholder="Title" placeholderTextColor={textColor + '88'} value={detail.title} onChangeText={v => updateField('title', v)} style={[styles.input as any, { color: textColor }]} /></ThemedView>
          <ThemedView style={[styles.field, { height: 120, backgroundColor: surface, borderColor: border }]}><TextInput placeholder="Description" placeholderTextColor={textColor + '66'} value={detail.description || ''} onChangeText={v => updateField('description', v)} multiline style={[styles.input as any, { height: '100%', color: textColor }]} /></ThemedView>
          <Pressable onPress={() => setCategoryPickerOpen(true)} style={[styles.field, { backgroundColor: surface, borderColor: border, justifyContent: 'center', minHeight: 44 }]}> 
            {selectedCategories.length === 0 ? (
              <ThemedText style={{ color: textColor + '66' }}>Select categories</ThemedText>
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
          <ThemedView style={[styles.field, { backgroundColor: surface, borderColor: border }]}><TextInput placeholder="Thumbnail URL" placeholderTextColor={textColor + '66'} value={detail.thumbnailUrl || ''} onChangeText={v => updateField('thumbnailUrl', v)} autoCapitalize="none" style={[styles.input as any, { color: textColor }]} /></ThemedView>
          {/* Pricing */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable onPress={() => setShowPrice(p => !p)} style={[styles.badgeBtn, showPrice ? styles.badgeOn : styles.badgeOff]}><ThemedText style={styles.badgeBtnText}>{showPrice ? 'Show Price: ON' : 'Show Price: OFF'}</ThemedText></Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <ThemedView style={[styles.field, { flex: 1, backgroundColor: surface, borderColor: border, opacity: showPrice ? 1 : 0.5 }]}>
              <ThemedText style={{ opacity: 0.7, fontSize: 12 }}>Price (USD)</ThemedText>
              <TextInput value={price} onChangeText={setPrice} placeholder="e.g. 49.99" placeholderTextColor={textColor + '66'} keyboardType="decimal-pad" inputMode="decimal" editable={showPrice} style={{ paddingVertical: 6, color: textColor }} />
            </ThemedView>
            <ThemedView style={[styles.field, { flex: 1, backgroundColor: surface, borderColor: border, opacity: showPrice ? 1 : 0.5 }]}>
              <ThemedText style={{ opacity: 0.7, fontSize: 12 }}>Discount (optional)</ThemedText>
              <TextInput value={discountPrice} onChangeText={setDiscountPrice} placeholder="e.g. 19.99" placeholderTextColor={textColor + '66'} keyboardType="decimal-pad" inputMode="decimal" editable={showPrice} style={{ paddingVertical: 6, color: textColor }} />
            </ThemedView>
          </View>
          {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable onPress={() => setPublished(p => !p)} style={[styles.badgeBtn, published ? styles.badgeOn : styles.badgeOff]}><ThemedText style={styles.badgeBtnText}>{published ? 'Published' : 'Unpublished'}</ThemedText></Pressable>
              {supportsFeatured && (
                <Pressable onPress={() => setFeatured(f => !f)} style={[styles.badgeBtn, featured ? styles.badgeOn : styles.badgeOff]}><ThemedText style={styles.badgeBtnText}>{featured ? 'Featured' : 'Not Featured'}</ThemedText></Pressable>
              )}
            </View>
          )}
          <View style={styles.row}>
            <Pressable style={[styles.btn, styles.secondary]} onPress={() => { try { router.back(); } catch {} }}><ThemedText>Cancel</ThemedText></Pressable>
            <Pressable style={[styles.btn, styles.secondary]} onPress={() => setPreview(true)}><ThemedText>Preview</ThemedText></Pressable>
            <Pressable style={[styles.btn, styles.primary, { backgroundColor: tint }]} disabled={!canSave || saving} onPress={onSave}><ThemedText style={styles.btnText as any}>Save</ThemedText></Pressable>
          </View>
        </View>
      </View>

      <Modal visible={categoryPickerOpen} transparent animationType="fade" onRequestClose={() => setCategoryPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill as any} onPress={() => setCategoryPickerOpen(false)} />
          <View style={[styles.modalCard, { backgroundColor: Platform.OS === 'web' ? '#1c1c1c' : '#222' }]}> 
            <ThemedText type="subtitle" style={{ marginBottom: 8 }}>Select categories</ThemedText>
            <ThemedView style={[styles.field, { borderColor: border, marginBottom: 8 }]}> 
              <TextInput
                placeholder="Search categories"
                placeholderTextColor={textColor + '66'}
                value={categoryQuery}
                onChangeText={setCategoryQuery}
                autoCapitalize="none"
                style={[styles.input as any, { color: textColor }]}
              />
            </ThemedView>
            <ScrollView style={{ maxHeight: 360 }}>
              {categories.filter((c) => !categoryQuery || c.name.toLowerCase().includes(categoryQuery.toLowerCase()) || c.slug.toLowerCase().includes(categoryQuery.toLowerCase())).map((c) => {
                const checked = selectedCategories.some((x) => x.id === c.id);
                return (
                  <Pressable key={c.id} onPress={() => setSelectedCategories(checked ? selectedCategories.filter((x) => x.id !== c.id) : [...selectedCategories, c])} style={styles.instructorRow}>
                    <View style={{ flex: 1 }}>
                      <ThemedText numberOfLines={1} style={{ fontWeight: '600' }}>{c.name}</ThemedText>
                      <ThemedText numberOfLines={1} style={{ opacity: 0.7 }}>{c.slug}</ThemedText>
                    </View>
                    <ThemedText style={{ fontWeight: '800', opacity: checked ? 1 : 0.25 }}>{checked ? '✓' : '○'}</ThemedText>
                  </Pressable>
                );
              })}
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
  container: { padding: 16, gap: 12 },
  centered: { width: '100%', alignItems: 'center' },
  formContainer: { width: '100%', maxWidth: 900, gap: 12 },
  field: { padding: 12, borderRadius: 10, borderWidth: 1 },
  input: { outlineWidth: 0, outlineColor: 'transparent' },
  row: { flexDirection: 'row', gap: 10, marginTop: 10 },
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
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
  modalBackdrop: { flex: 1, backgroundColor: '#00000088', padding: 16, justifyContent: 'flex-end' },
  modalCard: { borderRadius: 12, padding: 12 },
  instructorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.06)' },
  chipText: { fontWeight: '600', fontSize: 12 },
  instructorsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  fieldLabel: { fontWeight: '700', opacity: 0.75, fontSize: 12 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
});
