import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Platform, ViewProps } from 'react-native';

export type ThemedCardProps = ViewProps & {
  elevated?: boolean;
};

export default function ThemedCard({ style, elevated = true, ...rest }: ThemedCardProps) {
  const bg = useThemeColor({}, 'surface');
  const shadow = elevated
    ? (Platform.select({
        web: { boxShadow: '0 6px 16px rgba(0,0,0,0.08)' },
        default: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, elevation: 2 },
      }) as any)
    : null;
  return <ThemedView style={[{ backgroundColor: bg, borderRadius: 14 }, shadow, style]} {...rest} />;
}
