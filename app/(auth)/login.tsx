import { useAuth } from '@/providers/AuthProvider';
import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function LoginScreen() {
  const { signIn, loading, user, initializing } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Immediate redirect BEFORE rendering form to avoid flicker
  useEffect(() => {
    if (!initializing && user) {
      router.replace('/(tabs)' as any);
    }
  }, [user, initializing]);

  const onSubmit = async () => {
    setError(null);
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    // quick client-side email format check to give immediate feedback
    const emailOk = /.+@.+\..+/.test(email.trim());
    if (!emailOk) {
      setError('Please enter correct email address.');
      return;
    }
    try {
      await signIn(email.trim(), password);
    } catch (e: any) {
      // Friendly fallback handling if message not already normalized
      const raw = e?.message || '';
      if (/incorrect email or password/i.test(raw)) {
        setError('Incorrect email or password.');
      } else if (/password must be at least 8/i.test(raw)) {
        setError('Password must be at least 8 characters.');
      } else if (/enter correct email address/i.test(raw) || /email.+valid/i.test(raw)) {
        setError('Please enter correct email address.');
      } else if (/email is required/i.test(raw)) {
        setError('Email is required.');
      } else if (/password is required/i.test(raw)) {
        setError('Password is required.');
      } else {
        setError(raw || 'Login failed');
      }
    }
  };

  // While initializing OR already authenticated, render lightweight placeholder
  if (initializing || user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log in</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Pressable disabled={loading} onPress={onSubmit} style={styles.button}>
        <Text style={styles.buttonText}>{loading ? 'Loading...' : 'Log in'}</Text>
      </Pressable>
      <View style={styles.row}>
  <Link href={"/(auth)/signup" as any}>No account? Sign up</Link>
      </View>
      <View style={styles.row}>
        <Text style={styles.small}>Forgot password? (Coming soon)</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12, maxWidth: 480, alignSelf: 'center', width: '100%', justifyContent: 'center' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10 },
  button: { backgroundColor: '#0b5cff', paddingVertical: 12, borderRadius: 6, alignItems: 'center', marginTop: 4 },
  buttonText: { color: 'white', fontWeight: '600' },
  error: { color: '#b00020' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  small: { fontSize: 12, color: '#666' },
});