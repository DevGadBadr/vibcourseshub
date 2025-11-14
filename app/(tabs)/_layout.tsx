import { Tabs } from 'expo-router';

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
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.icon,
        tabBarStyle: {
          backgroundColor: colors.surface2,
          borderTopColor: colors.border,
        },
        sceneStyle: { backgroundColor: colors.background },
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      {/* Hidden auxiliary routes under tabs: add/edit course (not visible in tab bar) */}
      <Tabs.Screen name="courses/add" options={{ href: null }} />
      <Tabs.Screen name="courses/[slug]/edit" options={{ href: null }} />
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
        }}
      />
      <Tabs.Screen
        name="Profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.crop.circle" color={color} />,
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
      {/* Hide detail route from tab bar */}
      <Tabs.Screen name="manager/[id]" options={{ href: null }} />
    </Tabs>
  );
}