import { useThemeColor } from '@/hooks/use-theme-color';
import React from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const TopSafeAreaOverlay: React.FC<{ extra?: number }> = ({ extra = 0 }) => {
  const insets = useSafeAreaInsets();
  const backgroundColor = useThemeColor({}, 'background');
  const pointerEventsProp = Platform.OS === 'web' ? {} : { pointerEvents: 'none' as const };
  return (
    <View
      {...pointerEventsProp}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: insets.top + extra,
        backgroundColor,
        zIndex: 10,
        ...(Platform.OS === 'web' ? { pointerEvents: 'none' as const } : {}),
      }}
    />
  );
};

export default TopSafeAreaOverlay;
