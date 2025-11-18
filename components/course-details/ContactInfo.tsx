import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

type ContactLink = { icon: keyof typeof Ionicons.glyphMap; label: string; url: string };

function open(url: string) {
  // Ensure protocols
  const final = url.startsWith('http') || url.startsWith('mailto:') || url.startsWith('tel:') ? url : `https://${url}`;
  Linking.openURL(final).catch(() => {});
}

export function ContactInfo() {
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');
  const tint = useThemeColor({}, 'tint');

  const phone = '+20 102 260 4579';
  const telHref = 'tel:+201022604579';
  const email = 'info@vibsolutions.net';

  const links: ContactLink[] = [
    { icon: 'call-outline', label: phone, url: telHref },
    { icon: 'globe-outline', label: 'www.vibsolutions.net', url: 'https://www.vibsolutions.net' },
    { icon: 'logo-linkedin', label: 'linkedin.com/company/vibsolutions', url: 'https://www.linkedin.com/company/vibsolutions' },
    { icon: 'logo-facebook', label: 'facebook.com/VS.vibsolutions', url: 'https://www.facebook.com/VS.vibsolutions' },
  ];

  // Google Maps queries
  const gizaQuery = encodeURIComponent('The Address Mega Mall, October Gardens, Giza, Egypt');
  const tripoliQuery = encodeURIComponent('Al-sarraj main street, Al-sarraj, Tripoli, Libya');
  const mapsBase = Platform.OS === 'ios' ? 'http://maps.apple.com/?q=' : 'https://www.google.com/maps/search/?api=1&query=';
  const addresses: ContactLink[] = [
    { icon: 'pin-outline', label: 'Office No. 61 – The Address Mega Mall – October Gardens – Giza', url: `${mapsBase}${gizaQuery}` },
    { icon: 'pin-outline', label: 'Al‑sarraj main street, Al‑sarraj, Tripoli, Libya', url: `${mapsBase}${tripoliQuery}` },
  ];

  return (
    <ThemedView style={{ gap: 8 }}>
      {[...links, ...addresses, { icon: 'mail-outline', label: email, url: `mailto:${email}` } as ContactLink].map((item, idx) => (
        <Pressable key={idx} onPress={() => open(item.url)} style={[styles.row, { borderColor: border }]}
          accessibilityRole={Platform.OS === 'web' ? 'link' : undefined}
          accessibilityHint={`Open ${item.label}`}>
          <View style={[styles.iconWrap, { borderColor: border }]}> 
            <Ionicons name={item.icon} size={18} color={tint} />
          </View>
          <ThemedText style={[styles.label, { color: text }]} numberOfLines={2}>{item.label}</ThemedText>
        </Pressable>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  iconWrap: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: 14 },
  label: { fontSize: 13, flexShrink: 1, opacity: 0.95 },
});

export default ContactInfo;
