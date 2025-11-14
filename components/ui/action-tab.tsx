import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';

type ActionTabProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  danger?: boolean; // makes text danger color
  style?: ViewStyle | ViewStyle[];
  size?: 'md' | 'sm';
};

export function ActionTab({ label, onPress, disabled, danger, style, size = 'md' }: ActionTabProps) {
  const scheme = useColorScheme();
  const dangerColor = useThemeColor({}, 'danger');
  const textColor = danger ? dangerColor : undefined;
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ hovered, pressed }) => [
        size === 'sm' ? styles.baseSm : styles.base,
        style,
        disabled && { opacity: 0.5 },
        scheme === 'dark'
          ? { backgroundColor: hovered || pressed ? '#ffffff18' : '#ffffff0A' }
          : { backgroundColor: hovered || pressed ? '#00000010' : '#00000005' },
      ]}
    >
      <ThemedText style={[size === 'sm' ? styles.labelSm : styles.label, textColor ? { color: textColor } : null]} numberOfLines={1}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseSm: {
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 15, fontWeight: '600' },
  labelSm: { fontSize: 13, fontWeight: '600' },
});
