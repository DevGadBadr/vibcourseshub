import { ThemedText } from '@/components/themed-text';
import React from 'react';
import { StyleSheet, View } from 'react-native';

export const SectionHeader: React.FC<{ title: string } & React.PropsWithChildren> = ({ title, children }) => {
  return (
    <View style={styles.wrap}>
      <ThemedText type="subtitle" style={styles.title}>{title}</ThemedText>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontWeight: '800', fontSize: 18 },
});
