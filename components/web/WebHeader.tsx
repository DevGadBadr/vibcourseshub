import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/providers/AuthProvider';
import { router } from 'expo-router';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';

export function WebHeader() {
  if (Platform.OS !== 'web') return null;
  const { user } = useAuth();
  const bg = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');
  const tint = useThemeColor({}, 'tint');
  return (
    <View style={[styles.root, { backgroundColor: bg, borderBottomColor: border }]}> 
      <Pressable onPress={() => router.push('/(tabs)/explore' as any)} style={styles.left}>
        {/* Corrected logo path */}
        <Image source={require('../../assets/images/logo.avif')} style={styles.logo} />
        <ThemedText style={styles.brand}>VibCoursesHub</ThemedText>
      </Pressable>
      <View style={styles.right}>
        {user && (
          <Pressable onPress={() => router.push('/(tabs)/Profile' as any)} style={styles.avatarWrap}>
            {user.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: tint }]}><ThemedText style={{ fontSize:12, fontWeight:'700' }}>{(user.name||user.email||'U').slice(0,2).toUpperCase()}</ThemedText></View>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { height:55, flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, borderBottomWidth:StyleSheet.hairlineWidth },
  left: { flexDirection:'row', alignItems:'center', gap:10 },
  right: { flexDirection:'row', alignItems:'center', gap:12 },
  logo: { width:40, height:40, borderRadius:8, objectFit:'cover' },
  brand: { fontSize:16, fontWeight:'700' },
  avatarWrap:{},
  avatar:{ width:34, height:34, borderRadius:17, backgroundColor:'#4b5563' },
  avatarFallback:{ alignItems:'center', justifyContent:'center' }
});
