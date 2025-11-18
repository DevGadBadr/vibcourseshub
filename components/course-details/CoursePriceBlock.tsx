import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

export type CoursePriceBlockProps = {
  price?: number;
  discountPrice?: number | null;
  currency?: string;
  align?: 'left' | 'center' | 'right';
};

function formatCurrency(n?: number | null, currency: string = 'EGP') {
  if (typeof n !== 'number' || isNaN(n)) return '';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    const symbol = currency === 'EGP' ? 'E£' : `${currency} `;
    return `${symbol}${n.toFixed(2)}`;
  }
}

export const CoursePriceBlock: React.FC<CoursePriceBlockProps> = ({ price, discountPrice, currency = 'EGP', align = 'left' }) => {
  const tint = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const hasDiscount = typeof discountPrice === 'number' && discountPrice! < (price ?? Infinity);
  return (
    <ThemedView style={[
      styles.wrap,
      align === 'center' && styles.centerAlign,
      align === 'right' && styles.rightAlign,
    ]}>
      {hasDiscount ? (
        <View style={styles.row}>
          <ThemedText style={[styles.old, { color: textColor }]}>{formatCurrency(price, currency)}</ThemedText>
          <ThemedText style={[styles.new, { color: tint }]}>{formatCurrency(discountPrice!, currency)}</ThemedText>
        </View>
      ) : (
        <ThemedText style={[styles.new, { color: tint }]}>{formatCurrency(price, currency)}</ThemedText>
      )}
      {/* Removed VAT hint as requested */}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  centerAlign: { alignItems: 'center' },
  rightAlign: { alignItems: 'flex-end' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  old: { fontSize: 14, textDecorationLine: 'line-through' },
  new: { fontSize: 22, fontWeight: Platform.OS === 'ios' ? '800' : '700' },
  vatHint: { opacity: 0.6, fontSize: 11 },
});
