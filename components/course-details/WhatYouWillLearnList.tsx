import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

export const WhatYouWillLearnList: React.FC<{ items?: string[] }>
  = ({ items }) => {
  const ok = useThemeColor({}, 'success');
  if (!items || items.length === 0) return null;
  return (
    <ThemedView style={styles.wrap}>
      {items.map((t, i) => (
        <View key={i} style={styles.row}>
          <IconSymbol name={Platform.OS === 'ios' ? 'checkmark.circle.fill' as any : 'checkmark.circle'} size={18} color={ok} />
          <ThemedText style={styles.text}>{t}</ThemedText>
        </View>
      ))}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  text: { flex: 1, lineHeight: 20 },
});
