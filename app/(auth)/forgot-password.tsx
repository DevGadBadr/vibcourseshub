import { forgotPassword } from '@/utils/api';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showInput, setShowInput] = useState(true);

  const onSubmit = async () => {
    setError(null);
    setStatus(null);
    const trimmed = email.trim();
    if (!/.+@.+\..+/.test(trimmed)) {
      setError('Please enter correct email address.');
      return;
    }
    // Immediately update UI and trigger request in background
    setLoading(true);
    setStatus('Check your email for instructions to reset your password.');
    setShowInput(false);

    // Fire-and-forget the API call so UI doesn't wait for email sending
    forgotPassword(trimmed)
      .then(() => {
        setLoading(false);
      })
      .catch((e: any) => {
        const msg = e?.message || '';
        if (/no user with that email/i.test(msg)) {
          setError('There is no user with that email address.');
        } else {
          setError(msg || 'Could not send reset instructions.');
        }
        // Revert to allow correction/retry
        setShowInput(true);
        setStatus(null);
        setLoading(false);
      });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Forgot password</Text>
      {status && <Text style={styles.status}>{status}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
      <TextInput
        style={[styles.input, {display: showInput ? 'flex' : 'none'}]}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Your email address"
        value={email}
        onChangeText={setEmail}
      />
      <Pressable disabled={loading} onPress={onSubmit} style={[styles.button, { display: showInput ? 'flex' : 'none' }]}>
        <Text style={styles.buttonText}>{loading ? 'Sending…' : 'Confirm'}</Text>
      </Pressable>
      <Pressable onPress={() => router.replace('/(auth)/login' as any)} style={[styles.button, { backgroundColor: '#111' }]}>
        <Text style={styles.buttonText}>Back to login</Text>
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
