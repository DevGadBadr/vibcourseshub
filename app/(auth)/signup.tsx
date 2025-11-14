import { useAuth } from '@/providers/AuthProvider';
import { validateEmail } from '@/utils/email';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function SignupScreen() {
  const { signUp, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) {
      setError(emailCheck.suggestion ? `${emailCheck.reason}. Did you mean ${emailCheck.suggestion}?` : emailCheck.reason || 'Invalid email');
      return;
    }
    if (!password) { setError('Password is required'); return; }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    try {
      await signUp({ email: email.trim(), password, name: name.trim() || undefined });
    } catch (e: any) {
      setError(e.message || 'Signup failed');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create account</Text>
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
        placeholder="Password (min 8 chars)"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={styles.input}
        placeholder="Name (optional)"
        value={name}
        onChangeText={setName}
      />
      <Pressable disabled={loading} onPress={onSubmit} style={[styles.button, loading && { opacity: 0.6 }] }>
        <Text style={styles.buttonText}>{loading ? 'Loading...' : 'Sign up'}</Text>
      </Pressable>
      <View style={styles.row}>
  <Link href={"/(auth)/login" as any}>Already have an account? Log in</Link>
      </View>
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
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});
