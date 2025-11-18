import { CoursePriceBlock } from '@/components/course-details/CoursePriceBlock';
// import { CurriculumAccordion } from '@/components/course-details/CurriculumAccordion';
import { ContactInfo } from '@/components/course-details/ContactInfo';
import { InstructorCard } from '@/components/course-details/InstructorCard';
import { SectionHeader } from '@/components/course-details/SectionHeader';
import { StickyBuyBar } from '@/components/course-details/StickyBuyBar';
// import { WhatYouWillLearnList } from '@/components/course-details/WhatYouWillLearnList';
import logoImg from '@/assets/images/logo.avif';
import { BrochureViewer } from '@/components/course-details/BrochureViewer';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Skeleton } from '@/components/ui/skeleton';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { CourseDetails } from '@/types/course';
import { getCourseDetails } from '@/utils/api';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

export default function CourseDetailsScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [detail, setDetail] = useState<CourseDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSticky, setShowSticky] = useState(false);
  const priceBlockY = useRef<number>(0);
  const scrollY = useRef(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const scrollRef = useRef<ScrollView | null>(null);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setDetail(null);
    setShowSticky(false);
    setError(null);
    if (scrollRef.current) {
      try { scrollRef.current.scrollTo({ y: 0, animated: false }); } catch {}
    }
    (async () => {
      try {
        const data = await getCourseDetails(slug);
        if (!alive) return;
        setDetail(data);
        fadeAnim.setValue(0);
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || 'Failed to load course');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [slug]);

  const tint = useThemeColor({}, 'tint');
  const success = useThemeColor({}, 'success');
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');
  const warning = useThemeColor({}, 'warning');

  const onScroll = (e: any) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
    const shouldShow = scrollY.current > (priceBlockY.current + 40);
    if (shouldShow !== showSticky) setShowSticky(shouldShow);
  };

  const handleBuyNow = () => {
    Alert.alert('TODO', 'Buy flow not implemented yet');
  };
  const handleAddToCart = () => {
    Alert.alert('TODO', 'Add to cart not implemented yet');
  };
  const handleWishlist = () => {
    Alert.alert('TODO', 'Wishlist not implemented yet');
  };

  if (loading) {
    return (
      <ScrollView contentContainerStyle={styles.loadingWrap}>
        <Skeleton width={'100%'} height={220} />
        <View style={{ height: 16 }} />
        <Skeleton width={'80%'} height={28} />
        <View style={{ height: 6 }} />
        <Skeleton width={'60%'} height={16} />
        <View style={{ height: 12 }} />
        <Skeleton width={'100%'} height={56} />
        <View style={{ height: 20 }} />
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={{ marginBottom: 12 }}>
            <Skeleton width={'100%'} height={18} />
          </View>
        ))}
      </ScrollView>
    );
  }
  if (error) return <ScrollView contentContainerStyle={styles.loadingWrap}><ThemedText style={{ color: '#dc2626' }}>{error}</ThemedText></ScrollView>;
  if (!detail) return <ScrollView contentContainerStyle={styles.loadingWrap}><ThemedText>Not found</ThemedText></ScrollView>;

  const previewSrc = detail.previewVideoUrl || detail.thumbnailUrl;
  // badges removed
  const rating = typeof detail.averageRating === 'number' ? detail.averageRating : 5;
  const showPrice = detail.showPrice !== false;

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView ref={scrollRef} onScroll={onScroll} scrollEventThrottle={32} contentContainerStyle={styles.scrollContent}>
        <Animated.View style={[styles.animWrap, { opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0,1], outputRange: [12,0] }) }] }]}> 
          <View style={styles.container}> 
            {/* Web: arrange title/info left and preview right */}
            {Platform.OS === 'web' ? (
              <View style={{ flexDirection: 'row', gap: 20, alignItems: 'flex-start' }}>
                <View style={{ flex: 1, gap: 10 }}>
                  <ThemedText style={styles.title}>{detail.title}</ThemedText>
                  {!!detail.shortDescription && <ThemedText style={styles.shortDesc}>{detail.shortDescription}</ThemedText>}
                  <View style={styles.ratingRow}>
                    <ThemedText style={styles.ratingValue}>{rating.toFixed(1)}</ThemedText>
                    <View style={styles.starsWrap}>{renderStars(rating, warning, border)}</View>
                    <ThemedText style={styles.ratingMeta}>{detail.ratingsCount} ratings • {detail.studentsCount} students</ThemedText>
                  </View>
                  {detail.instructor && (
                    <Pressable onPress={() => Alert.alert('TODO', 'Instructor profile not implemented yet')}>
                      <ThemedText style={styles.instructorLine}>Created by {detail.instructor.name || 'Instructor'}</ThemedText>
                    </Pressable>
                  )}
                  <ThemedText style={styles.metaLine}>Last updated {new Date(detail.lastUpdatedAt || Date.now()).toLocaleDateString()}</ThemedText>
                </View>
                <View style={[styles.previewWrap, { width: 420, flexShrink: 0 }]}> 
                  {previewSrc ? (
                    <Image source={{ uri: previewSrc }} style={[styles.preview, { aspectRatio: 16/9, ...(Platform.OS === 'web' ? { objectPosition: 'bottom' } : {}) }]} resizeMode="cover" />
                  ) : (
                    <View style={[styles.preview, { backgroundColor: '#222', aspectRatio: 16/9 }]} />
                  )}
                </View>
              </View>
            ) : (
              <>
              {/* Preview area (mobile stacked) */}
              <View style={styles.previewWrap}> 
                {previewSrc ? (
                  <Image source={{ uri: previewSrc }} style={[styles.preview, Platform.OS === 'web' ? { objectPosition: 'bottom' } : {}]} resizeMode="cover" />
                ) : (
                  <View style={[styles.preview, { backgroundColor: '#222' }]} />
                )}
              </View>
              {/* Title & badges */}
              <View style={{ gap: 10 }}>
              <ThemedText style={styles.title}>{detail.title}</ThemedText>
              {!!detail.shortDescription && <ThemedText style={styles.shortDesc}>{detail.shortDescription}</ThemedText>}
              {/* Badges removed */}
              {/* Rating row */}
              <View style={styles.ratingRow}>
                <ThemedText style={styles.ratingValue}>{rating.toFixed(1)}</ThemedText>
                <View style={styles.starsWrap}>{renderStars(rating, warning, border)}</View>
                <ThemedText style={styles.ratingMeta}>{detail.ratingsCount} ratings • {detail.studentsCount} students</ThemedText>
              </View>
              {/* Instructors row */}
              {detail.instructor && (
                <Pressable onPress={() => Alert.alert('TODO', 'Instructor profile not implemented yet')}>
                  <ThemedText style={styles.instructorLine}>Created by {detail.instructor.name || 'Instructor'}</ThemedText>
                </Pressable>
              )}
              <ThemedText style={styles.metaLine}>Last updated {new Date(detail.lastUpdatedAt || Date.now()).toLocaleDateString()}</ThemedText>
              </View>
              </>
            )}
            {/* Pricing & actions */}
            {showPrice && (
              <View style={styles.priceActionsWrap} onLayout={(e) => { priceBlockY.current = e.nativeEvent.layout.y; }}>
                <CoursePriceBlock price={detail.discountPrice != null ? detail.price : detail.price} discountPrice={detail.discountPrice} currency={detail.currency} />
                <Pressable style={[styles.buyBtn, { backgroundColor: success }]} onPress={handleBuyNow}><ThemedText style={styles.buyBtnText}>Enroll Now</ThemedText></Pressable>
                <View style={styles.secondaryRow}> 
                  <Pressable style={[styles.secondaryBtn, { borderColor: border }]} onPress={handleAddToCart}><ThemedText style={styles.secondaryBtnText}>Add to cart</ThemedText></Pressable>
                  <Pressable style={[styles.secondaryBtn, { borderColor: border }]} onPress={handleWishlist}><ThemedText style={styles.secondaryBtnText}>Wishlist</ThemedText></Pressable>
                </View>
              </View>
            )}
            {/* Brochure PDF */}
            <View>
              <SectionHeader title="Course Brochure" />
              <BrochureViewer slug={slug} url={detail.brochureUrl} />
            </View>
            {/* Full description */}
            {!!detail.fullDescription && (
              <View>
                <SectionHeader title="About this course" />
                <ThemedText style={{ opacity: 0.9, lineHeight: 20 }}>{detail.fullDescription}</ThemedText>
              </View>
            )}
            {/* Instructor */}
            <View>
              <SectionHeader title="Instructor" />
              <InstructorCard instructor={detail.instructor} onViewProfile={() => detail.instructor?.id && router.push(`/profile/${detail.instructor.id}`)} />
            </View>
            {/* Company Logo */}
            <View style={{ alignItems: 'center', marginTop: 8, marginBottom: -4 }}>
              <Image source={logoImg as any} style={{ width: 140, height: 48, resizeMode: 'contain' }} />
            </View>
            {/* Contact / Company Info */}
            <View>
              <SectionHeader title="Contact" />
              <ContactInfo />
            </View>
            <View>
              <Pressable onPress={() => router.replace('/(tabs)/explore')} style={{ marginTop: 8 }}>
                <ThemedText style={{ opacity: 0.8 }}>{'← Back to Explore'}</ThemedText>
              </Pressable>
            </View>
            <View style={{ height: 40 }} />
          </View>
        </Animated.View>
      </ScrollView>
      <StickyBuyBar visible={showSticky && showPrice} price={detail.discountPrice != null ? detail.discountPrice : detail.price} discountPrice={detail.discountPrice ? detail.price : undefined} currency={detail.currency} onBuyNow={handleBuyNow} />
    </ThemedView>
  );
}

function renderStars(rating: number, activeColor: string, inactiveColor: string) {
  const nodes: React.ReactNode[] = [];
  for (let i = 1; i <= 5; i++) {
    const diff = rating - i + 1;
    let fillPct = 0;
    if (diff >= 1) fillPct = 1;
    else if (diff >= 0.75) fillPct = 0.75;
    else if (diff >= 0.5) fillPct = 0.5;
    else if (diff >= 0.25) fillPct = 0.25;
    const char = '★';
    const color = fillPct >= 0.75 ? activeColor : fillPct >= 0.25 ? activeColor : inactiveColor;
    nodes.push(<ThemedText key={i} style={{ color, fontSize: 14, marginRight: 2 }}>{char}</ThemedText>);
  }
  return <View style={{ flexDirection: 'row', alignItems: 'center' }}>{nodes}</View>;
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 80 },
  loadingWrap: { padding: 16, gap: 12 },
  container: { width: '100%', maxWidth: 1000, alignSelf: 'center', padding: 16, gap: 20 },
  previewWrap: { borderRadius: 0, overflow: 'hidden', position: 'relative' },
  preview: { width: '100%', aspectRatio: 16/9, backgroundColor: '#111' },
  playOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  triangle: { width: 0, height: 0, borderLeftWidth: 18, borderTopWidth: 12, borderBottomWidth: 12, borderLeftColor: '#fff', borderTopColor: 'transparent', borderBottomColor: 'transparent' },
  title: { fontSize: 24, fontWeight: '700', lineHeight: 30 },
  shortDesc: { fontSize: 14, lineHeight: 20, opacity: 0.85 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingValue: { fontSize: 14, fontWeight: '700' },
  starsWrap: { flexDirection: 'row' },
  ratingMeta: { fontSize: 12, opacity: 0.7 },
  instructorLine: { fontSize: 12, opacity: 0.8, marginTop: 4 },
  metaLine: { fontSize: 12, opacity: 0.7 },
  priceActionsWrap: { gap: 14 },
  buyBtn: { paddingVertical: 14, borderRadius: 0, alignItems: 'center' },
  buyBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
  secondaryRow: { flexDirection: 'row', gap: 12 },
  secondaryBtn: { flex: 1, paddingVertical: 12, borderRadius: 0, borderWidth: 1, alignItems: 'center' },
  secondaryBtnText: { fontWeight: '600' },
  animWrap: { flex: 1 },
  starRow: { flexDirection: 'row', gap: 4 },
});
