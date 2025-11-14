import { resetPassword } from '@/utils/api';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const e = typeof params.email === 'string' ? params.email : '';
    const t = typeof params.token === 'string' ? params.token : '';
    if (e) setEmail(e);
    if (t) setToken(t);
  }, [params]);

  const onSubmit = async () => {
    setError(null);
    setStatus(null);
    if (!/.+@.+\..+/.test(email.trim())) {
      setError('Please enter correct email address.');
      return;
    }
    if (!token) {
      setError('Missing or invalid reset token.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email.trim(), token, password);
      setStatus('Password has been reset. Please sign in.');
    } catch (e: any) {
      const msg = e?.message || 'Could not reset password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset password</Text>
      {status && <Text style={styles.status}>{status}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="New password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm password"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
      />
      <Pressable disabled={loading} onPress={onSubmit} style={styles.button}>
        <Text style={styles.buttonText}>{loading ? 'Saving…' : 'Confirm'}</Text>
      </Pressable>
      <Pressable onPress={() => router.replace('/(auth)/login' as any)} style={[styles.button, { backgroundColor: '#111' }]}>
        <Text style={styles.buttonText}>Go to log in</Text>
      </Pressable>
      {loading && <ActivityIndicator style={{ marginTop: 8 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12, maxWidth: 480, alignSelf: 'center', width: '100%', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10 },
  button: { backgroundColor: '#0b5cff', paddingVertical: 12, borderRadius: 6, alignItems: 'center', marginTop: 4 },
  buttonText: { color: 'white', fontWeight: '600' },
  error: { color: '#b00020' },
  status: { color: '#2563eb' },
});
