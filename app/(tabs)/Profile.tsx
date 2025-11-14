import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import ThemedCard from '@/components/ui/themed-card';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/providers/AuthProvider';
import { useThemePreference } from '@/providers/ThemeProvider';
import { API_URL, removeAvatar, uploadAvatar } from '@/utils/api';
import { appStorage } from '@/utils/storage';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function formatDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ProfileScreen() {
  const { user, signOut, refreshMe } = useAuth();
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme ?? 'light'].tint;
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();
  const { theme, setTheme } = useThemePreference();
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [editMenuVisible, setEditMenuVisible] = useState(false);
  const neutralBg = useThemeColor({}, 'neutral');
  const successBg = useThemeColor({}, 'success');
  const warningBg = useThemeColor({}, 'warning');
  const overlay = useThemeColor({}, 'overlay');
  const danger = useThemeColor({}, 'danger');
  const surface = useThemeColor({}, 'surface');

  // Height of the top overlay area (safe area + extra visual header space)
  const TOP_EXTRA = 8; // keep upper space compact
  const topPad = insets.top + TOP_EXTRA;

  const initials = useMemo(() => {
    if (!user?.name && !user?.email) return '?';
    const source = user?.name || user?.email || '';
    return source
      .split(/\s|@/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0].toUpperCase())
      .join('');
  }, [user]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await refreshMe();
    } finally {
      setRefreshing(false);
    }
  }, [refreshMe]);

  // Load locally stored avatar override (until backend upload is available)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const uri = await appStorage.getItem('localAvatarUri');
        if (mounted && uri) setLocalAvatar(uri);
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  // Auto-refresh when this screen gains focus (e.g., returning from verification in browser)
  useFocusEffect(
    useCallback(() => {
      refreshMe();
    }, [refreshMe])
  );

  // If user has a server avatar, clear any local temporary override
  useEffect(() => {
    if (user?.avatarUrl && localAvatar) {
      setLocalAvatar(null);
      appStorage.removeItem('localAvatarUri').catch(() => {});
    }
  }, [user?.avatarUrl]);

  const pickImage = useCallback(async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
      }
      const supportsNewMediaType = !!(ImagePicker as any)?.MediaType?.image;
      const pickerOptions: any = {
        ...(supportsNewMediaType ? { mediaTypes: [(ImagePicker as any).MediaType.image] } : {}),
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      };
      const res = await ImagePicker.launchImageLibraryAsync(pickerOptions);
      if (res.canceled) return;
      const asset = res.assets?.[0];
      const uri = asset?.uri;
      if (!uri) return;
      setLocalAvatar(uri);
      await appStorage.setItem('localAvatarUri', uri);
      // Also upload to backend and refresh user
      try {
        const fileName = uri.split('/').pop() || 'avatar.jpg';
        const mime = asset?.mimeType || 'image/jpeg';
        const form = new FormData();
        if (Platform.OS === 'web') {
          const blob = await (await fetch(uri)).blob();
          form.append('avatar', blob as any, fileName);
        } else {
          // React Native: provide a file descriptor
          form.append('avatar', { uri, name: fileName, type: mime } as any);
        }
        await uploadAvatar(form);
        await refreshMe();
      } catch (e) {
        // non-fatal: keep local preview
        console.warn('Avatar upload failed:', e);
      }
    } catch {}
  }, []);

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPad + 12 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.centered}>
          <View style={styles.containerNarrow}>
            <ThemedCard style={styles.headerCard}>
              <View style={styles.avatarWrapper}>
                <Pressable onPress={() => setPreviewVisible(true)}>
                  {user?.avatarUrl || localAvatar ? (
                    <Image source={{ uri: (resolveAvatarUrl(user?.avatarUrl) || localAvatar)! }} style={styles.avatarImage} />
                  ) : (
                    <View style={[styles.avatarFallback, { backgroundColor: tint }]}> 
                      <ThemedText type="defaultSemiBold" style={styles.avatarInitials}>{initials}</ThemedText>
                    </View>
                  )}
                </Pressable>
                <Pressable style={styles.editAvatarBtn} onPress={() => setEditMenuVisible(true)}>
                  <ThemedText style={styles.editAvatarText}>Edit</ThemedText>
                </Pressable>
              </View>
              <View style={styles.headerInfo}>
                <ThemedText type="title" style={styles.name}>{user?.name || 'Unnamed User'}</ThemedText>
                <ThemedText style={styles.email}>{user?.email}</ThemedText>
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, { backgroundColor: neutralBg }]}> 
                    <ThemedText style={styles.badgeText}>{user?.role || 'TRAINEE'}</ThemedText>
                  </View>
                  {user?.isEmailVerified ? (
                    <View style={[styles.badge, { backgroundColor: successBg }]}> 
                      <ThemedText style={styles.badgeText}>Email Verified</ThemedText>
                    </View>
                  ) : (
                    <View style={[styles.badge, { backgroundColor: warningBg }]}> 
                      <ThemedText style={styles.badgeText}>Email Unverified</ThemedText>
                    </View>
                  )}
                </View>
              </View>
            </ThemedCard>

            <ThemedCard style={styles.section}>
              <ThemedText type="subtitle">Account</ThemedText>
              <View style={styles.row}>
                <ThemedText style={styles.label}>Member since</ThemedText>
                <ThemedText style={styles.value}>{formatDate(user?.createdAt)}</ThemedText>
              </View>
              <View style={styles.row}>
                <ThemedText style={styles.label}>Role</ThemedText>
                <ThemedText style={styles.value}>{user?.role}</ThemedText>
              </View>
              <View style={styles.row}>
                <ThemedText style={styles.label}>Email</ThemedText>
                <ThemedText style={styles.value}>{user?.isEmailVerified ? 'Verified' : 'Unverified'}</ThemedText>
              </View>
              <View style={styles.row}>
                <ThemedText style={styles.label}>Login count</ThemedText>
                <ThemedText style={styles.value}>{user?.loginCount ?? 0}</ThemedText>
              </View>
            </ThemedCard>

            <ThemedCard style={styles.section}>
              <ThemedText type="subtitle">Appearance</ThemedText>
              <View style={styles.row}>
                <ThemedText style={styles.label}>Dark mode</ThemedText>
                <Switch value={theme === 'dark'} onValueChange={(v) => setTheme(v ? 'dark' : 'light')} />
              </View>
            </ThemedCard>

            <ThemedCard style={styles.section}>
              <View style={[styles.row, { justifyContent: 'flex-start', gap: 12 }]}>
                <Pressable style={[styles.logoutGhost, { borderColor: danger }]} onPress={() => signOut()}>
                  <ThemedText style={[styles.logoutGhostText, { color: danger }]}>Log out</ThemedText>
                </Pressable>
              </View>
            </ThemedCard>
          </View>
        </View>

        <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
          <Pressable style={[styles.previewBackdrop, { backgroundColor: overlay }]} onPress={() => setPreviewVisible(false)}>
            <Image
              source={{ uri: resolveAvatarUrl(user?.avatarUrl) || localAvatar || undefined }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          </Pressable>
        </Modal>

        {/* Edit menu modal */}
        <Modal visible={editMenuVisible} transparent animationType="fade" onRequestClose={() => setEditMenuVisible(false)}>
          <Pressable style={[styles.menuBackdrop, { backgroundColor: overlay }]} onPress={() => setEditMenuVisible(false)}>
            <View style={[styles.menuCard, { backgroundColor: surface }]}> 
              <Pressable style={styles.menuItem} onPress={async () => { setEditMenuVisible(false); await pickImage(); }}>
                <ThemedText style={styles.menuItemText}>Upload photo</ThemedText>
              </Pressable>
              {(user?.avatarUrl || localAvatar) && (
                <Pressable style={styles.menuItem} onPress={async () => {
                  try {
                    setEditMenuVisible(false);
                    if (user?.avatarUrl) {
                      await removeAvatar();
                      await refreshMe();
                    }
                    if (localAvatar) {
                      setLocalAvatar(null);
                      await appStorage.removeItem('localAvatarUri');
                    }
                    setPreviewVisible(false);
                  } catch (e) {
                    console.warn('Remove avatar failed:', e);
                  }
                }}>
                  <ThemedText style={[styles.menuItemText, { color: danger }]}>Remove photo</ThemedText>
                </Pressable>
              )}
              <Pressable style={[styles.menuItem, styles.menuCancel]} onPress={() => setEditMenuVisible(false)}>
                <ThemedText style={styles.menuItemText}>Cancel</ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, gap: 20 },
  centered: { width: '100%', alignItems: 'center' },
  containerNarrow: { width: '100%', maxWidth: 720, gap: 16 },
  headerCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 14,
    gap: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  avatarWrapper: { width: 84, height: 84, position: 'relative' },
  avatarImage: { width: 84, height: 84, borderRadius: 42 },
  avatarFallback: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 28 },
  editAvatarBtn: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    backgroundColor: '#00000088',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  editAvatarText: { color: 'white', fontSize: 12, fontWeight: '700' },
  headerInfo: { flex: 1 },
  name: { fontSize: 20, fontWeight: '700' },
  email: { opacity: 0.8, marginTop: 4 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  section: { padding: 16, borderRadius: 14, gap: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 14, opacity: 0.7 },
  value: { fontSize: 14, fontWeight: '600' },
  logoutGhost: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
  logoutGhostText: { fontWeight: '700' },
  previewBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  previewImage: { width: '100%', height: '80%' },
  menuBackdrop: { flex: 1, justifyContent: 'flex-end' },
  menuCard: { margin: 16, borderRadius: 12, overflow: 'hidden' },
  menuItem: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#00000020' },
  menuItemText: { fontSize: 16, fontWeight: '600' },
  menuCancel: { borderBottomWidth: 0 },
});

function resolveAvatarUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // treat as relative to API
  return `${API_URL}${url}`;
}
