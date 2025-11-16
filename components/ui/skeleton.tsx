import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View, ViewStyle } from 'react-native';

export function Skeleton({ width = '100%', height = 14, style }: { width?: number | string; height?: number; style?: ViewStyle }) {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => { loop.stop(); };
  }, [opacity]);
  return (
    <Animated.View style={[styles.box, { width, height, opacity }, style]} />
  );
}

export function SkeletonRow({ lines = 1, gap = 8 }: { lines?: number; gap?: number }) {
  return (
    <View style={{ gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '70%' : '100%'} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: Platform.OS === 'web' ? '#ffffff14' : '#99999933',
    borderRadius: 8,
  },
});
