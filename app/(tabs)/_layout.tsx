import { WebHeader } from '@/components/web/WebHeader';
import { Tabs, usePathname, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo } from 'react';
import { Platform, StatusBar as RNStatusBar, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/providers/AuthProvider';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  // Ensure mobile status bar content has proper contrast (run on theme change)
  useEffect(() => {
    if (Platform.OS !== 'web') {
      // Set system bar background to theme surface
      if (Platform.OS === 'android') {
        try { SystemUI.setBackgroundColorAsync(colors.surface2 as any); } catch {}
      }
      // Set icon/text color for contrast
      try { RNStatusBar.setBarStyle(colorScheme === 'dark' ? 'light-content' : 'dark-content', true); } catch {}
    }
  }, [colorScheme, colors.surface2]);

  // Build the visible tab order based on role
  const tabKeys = useMemo(() => {
    const base: string[] = ['index', 'explore'];
    if (user?.role === 'MANAGER') base.push('manager/index');
    base.push('Profile');
    return base;
  }, [user?.role]);

  // Determine the current route key within the tabs group
  const currentKey = useMemo(() => {
    // segments example:
    // - ["(tabs)"] => index
    // - ["(tabs)", "explore"]
    // - ["(tabs)", "manager"] => manager/index
    // - ["(tabs)", "manager", "123"] => not a root tab
    const i = segments.findIndex((s) => s === '(tabs)');
    if (i === -1) return undefined as string | undefined;
    const after = segments.slice(i + 1);
    if (after.length === 0) return 'index';
    if (after[0] === 'manager') {
      if (after.length === 1) return 'manager/index';
      return undefined as string | undefined; // manager detail/edit, not a root tab
    }
    return after[0] as string;
  }, [segments]);

  const isOnRootTab = useMemo(() => {
    return currentKey !== undefined && tabKeys.includes(currentKey);
  }, [currentKey, tabKeys]);

  const goToIndex = (idx: number) => {
    if (idx < 0 || idx >= tabKeys.length) return;
    const key = tabKeys[idx];
    // Map keys to routes inside the tabs group
    let target: string;
    switch (key) {
      case 'index':
        target = '/(tabs)';
        break;
      case 'explore':
        target = '/(tabs)/explore';
        break;
      case 'manager/index':
        target = '/(tabs)/manager';
        break;
      case 'Profile':
        target = '/(tabs)/Profile';
        break;
      default:
        target = pathname; // fallback no-op
    }
    if (target && target !== pathname) {
      // Replace so back button doesn't step through swipes
      router.replace(target as any);
    }
  };

  const currentIndex = useMemo(() => {
    if (!isOnRootTab || !currentKey) return -1;
    return tabKeys.indexOf(currentKey);
  }, [isOnRootTab, currentKey, tabKeys]);

  // Removed swipe gesture: main layout tabs are tap-only per requirements.
  
  return (
    <>
    <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} translucent={false} />
    <View style={{ flex: 1 }} collapsable={false}>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.icon,
        tabBarStyle: {
          backgroundColor: colors.surface2,
          borderTopColor: colors.border,
        },
        sceneStyle: { backgroundColor: colors.background, paddingTop: insets.top },
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      {/* Hidden auxiliary routes under tabs: add/edit course (not visible in tab bar) */}
      <Tabs.Screen name="courses/add" options={{ href: null, headerShown: Platform.OS === 'web', header: Platform.OS === 'web' ? () => <WebHeader /> : undefined }} />
      <Tabs.Screen name="courses/[slug]/edit" options={{ href: null, headerShown: Platform.OS === 'web', header: Platform.OS === 'web' ? () => <WebHeader /> : undefined }} />
      <Tabs.Screen
        name="index"
        options={{
          title: 'My Courses',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="sparkles" color={color} />,
          headerShown: Platform.OS === 'web',
          header: Platform.OS === 'web' ? () => <WebHeader /> : undefined,
        }}
      />
      {/* Always declare manager/index so we can explicitly hide it for non-managers */}
      <Tabs.Screen
        name="manager/index"
        options={{
          title: 'Manager',
          // Hide when not a MANAGER; when null, the route is not shown in the tab bar
          href: user?.role === 'MANAGER' ? '/manager' : null,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="person.2.badge.gearshape" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="Profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.crop.circle" color={color} />,
        }}
      />
      {/* Hide detail route from tab bar */}
      <Tabs.Screen name="manager/[id]" options={{ href: null }} />
    </Tabs>
      </View>
    </>
  );
}