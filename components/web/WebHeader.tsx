import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/providers/AuthProvider';
import { useThemePreference } from '@/providers/ThemeProvider';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';

export function WebHeader() {
  if (Platform.OS !== 'web') return null;
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useThemePreference();
  const bg = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');
  const tint = useThemeColor({}, 'tint');
  const surface2 = useThemeColor({}, 'surface2');
  const navItems: { label: string; route: string }[] = [
    { label: 'Explore', route: '/(tabs)/explore' },
    { label: 'My Courses', route: '/(tabs)' },
    ...(user?.role === 'MANAGER' ? [{ label: 'Manager', route: '/(tabs)/manager' }] : []),
  ];
  const [open, setOpen] = useState(false);
  const menuRef = useRef<View | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: any) => {
      if (!open) return;
      try {
        const el = (menuRef.current as any);
        if (el && el.contains && !el.contains(e.target)) setOpen(false);
      } catch {}
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleToggleMenu = () => setOpen(o => !o);
  const handleProfile = () => { setOpen(false); router.push('/(tabs)/Profile' as any); };
  const handleToggleTheme = () => { toggleTheme(); };
  const handleLogout = () => { setOpen(false); signOut(); };

  return (
    <View style={[styles.root, { backgroundColor: bg, borderBottomColor: border }]}> 
      {/* Logo left */}
      <View style={styles.leftCol}>
        <Pressable onPress={() => router.push('/(tabs)/explore' as any)} style={styles.logoWrap}>
          <Image source={require('../../assets/images/logo.avif')} style={styles.logo} resizeMode="contain" />
        </Pressable>
      </View>
      {/* Right cluster: nav tabs + theme + avatar */}
      <View style={styles.rightCluster}>
        <View style={styles.navRow}>
          {navItems.map((item) => (
            <Pressable
              key={item.route}
              onPress={() => router.replace(item.route as any)}
              style={({ hovered }) => [
                styles.navBtn,
                { backgroundColor: hovered ? surface2 : 'transparent', borderColor: hovered ? border : 'transparent' },
              ]}
            >
              <ThemedText style={styles.navText}>{item.label}</ThemedText>
            </Pressable>
          ))}
        </View>
        {user && (
          <View ref={menuRef} style={{ position:'relative' }}>
            <Pressable onPress={handleToggleMenu} style={styles.avatarWrap} accessibilityRole="button" accessibilityLabel="User menu">
              {user.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: tint }]}> 
                  <ThemedText style={{ fontSize: 12, fontWeight: '700' }}>{(user.name || user.email || 'U').slice(0, 2).toUpperCase()}</ThemedText>
                </View>
              )}
            </Pressable>
            {open && (
              <View style={styles.menu}>
                <Pressable style={styles.menuItem} onPress={handleProfile}>
                  <IconSymbol name="person.crop.circle" size={18} color={tint} />
                  <ThemedText style={styles.menuText}>Profile</ThemedText>
                </Pressable>
                <Pressable style={styles.menuItem} onPress={handleToggleTheme}>
                  <IconSymbol name={theme === 'light' ? 'moon.fill' : 'sun.max.fill'} size={18} color={tint} />
                  <ThemedText style={styles.menuText}>Theme: {theme === 'light' ? 'Dark' : 'Light'}</ThemedText>
                </Pressable>
                <Pressable style={styles.menuItem} onPress={handleLogout}>
                  <IconSymbol name="paperplane.fill" size={18} color={tint} />
                  <ThemedText style={styles.menuText}>Logout</ThemedText>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { height:64, flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:28, borderBottomWidth:StyleSheet.hairlineWidth, position:'sticky', top:0, zIndex:1000 },
  leftCol: { flexDirection:'row', alignItems:'center' },
  rightCluster: { flexDirection:'row', alignItems:'center', gap:18 },
  logoWrap: { alignItems:'center', justifyContent:'center' },
  logo: { width:160, height:50 },
  navRow: { flexDirection:'row', alignItems:'center', gap:8, flexWrap:'nowrap' },
  navBtn: { paddingVertical:10, paddingHorizontal:18, borderRadius:22, borderWidth:1, transitionDuration: '160ms', transitionProperty: 'background-color, box-shadow, transform' } as any,
  navText: { fontSize:15, fontWeight:'600' },
  themeBtn: { width:40, height:40, borderRadius:20, alignItems:'center', justifyContent:'center', boxShadow:'0 4px 10px rgba(0,0,0,0.12)', backgroundColor:'#fff' },
  avatarWrap:{},
  avatar:{ width:34, height:34, borderRadius:17, backgroundColor:'#4b5563' },
  avatarFallback:{ alignItems:'center', justifyContent:'center' },
  menu: { position:'absolute', top:44, right:0, minWidth:190, backgroundColor:'#fff', paddingVertical:8, borderRadius:10, boxShadow:'0 6px 22px rgba(0,0,0,0.16)', borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(0,0,0,0.08)', gap:4, zIndex:2000 },
  menuItem: { flexDirection:'row', alignItems:'center', gap:10, paddingVertical:8, paddingHorizontal:12 },
  menuText: { fontSize:13, fontWeight:'600' }
});
