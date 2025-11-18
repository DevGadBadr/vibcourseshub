import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { CoursePriceBlock } from './CoursePriceBlock';

export type StickyBuyBarProps = {
  visible: boolean;
  price?: number;
  discountPrice?: number | null;
  currency?: string;
  onBuyNow?: () => void;
};

export const StickyBuyBar: React.FC<StickyBuyBarProps> = ({ visible, price, discountPrice, currency, onBuyNow }) => {
  const tint = useThemeColor({}, 'tint');
  const cardBg = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');
  const isWeb = Platform.OS === 'web';
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: visible ? 1 : 0, duration: 240, useNativeDriver: true }).start();
  }, [visible]);
  
  if (isWeb) {
    // Web: top-right small card, drops from top
    const translateY = anim.interpolate({ inputRange: [0,1], outputRange: [-60,0] });
    const opacity = anim;
    return (
      <Animated.View pointerEvents={visible ? 'auto' : 'none'} style={[styles.webContainer, { opacity, transform: [{ translateY }] }]}> 
        <ThemedView style={[styles.webCard, { backgroundColor: cardBg, borderColor: border, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 18, elevation: 10 }]}> 
          <View style={{ marginBottom: 8 }}>
            <CoursePriceBlock price={price} discountPrice={discountPrice} currency={currency} />
          </View>
          <Pressable onPress={onBuyNow} style={[styles.buyBtn, { backgroundColor: tint }]}> 
            <ThemedText style={styles.buyText}>Enroll Now</ThemedText>
          </Pressable>
          <Pressable onPress={() => {}} style={[styles.secondaryWebBtn, { borderColor: border }]}> 
            <ThemedText style={[styles.buyText, { color: 'inherit' as any }]}>Add to cart</ThemedText>
          </Pressable>
        </ThemedView>
      </Animated.View>
    );
  }
  
  // Mobile: bottom sticky bar with distinct background
  const translateY = anim.interpolate({ inputRange: [0,1], outputRange: [80,0] });
  const opacity = anim;
  return (
    <Animated.View pointerEvents={visible ? 'auto' : 'none'} style={[styles.mobileContainer, { opacity, transform: [{ translateY }] }]}> 
      <ThemedView style={[styles.mobileBar, { backgroundColor: cardBg, borderTopWidth: 1, borderTopColor: border, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 12 }]}> 
        <View style={{ flex: 1 }}>
          <CoursePriceBlock price={price} discountPrice={discountPrice} currency={currency} />
        </View>
        <Pressable onPress={onBuyNow} style={[styles.buyBtn, { backgroundColor: tint }]}> 
          <ThemedText style={styles.buyText}>Enroll Now</ThemedText>
        </Pressable>
      </ThemedView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  // Web: fixed top-right card
  webContainer: { 
    position: 'fixed' as any, 
    top: 72, 
    right: 32, 
    zIndex: 100,
    maxWidth: 340,
  },
  webCard: { 
    padding: 14, 
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 260,
  },
  // Mobile: bottom bar that touches tab bar
  mobileContainer: { 
    position: 'absolute', 
    left: 0, 
    right: 0, 
    bottom: 0,
  },
  mobileBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 16, 
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
  },
  buyBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 0 },
  buyText: { color: 'white', fontWeight: '700', fontSize: 15 },
  secondaryWebBtn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 0, borderWidth: 1, alignItems: 'center' },
});
