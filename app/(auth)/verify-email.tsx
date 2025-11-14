import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

async function resend(email: string) {
  const res = await fetch((process.env.EXPO_PUBLIC_API_URL || (global as any).API_URL || 'https://devgadbadr.com/vibapi') + '/email-verification/resend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function verify(email: string, token: string) {
  const res = await fetch((process.env.EXPO_PUBLIC_API_URL || (global as any).API_URL || 'https://devgadbadr.com/vibapi') + '/email-verification/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, token }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams();
  const [email, setEmail] = useState<string | null>(typeof params.email === 'string' ? params.email : null);
  const [token, setToken] = useState<string | null>(typeof params.token === 'string' ? params.token : null);
  const [status, setStatus] = useState<string>('Waiting for verification...');
  const [cooldown, setCooldown] = useState<number>(0);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (!email) {
      // Try to recover from storage
      (async () => {
        try {
          const pending = typeof localStorage !== 'undefined' ? localStorage.getItem('pendingVerifyEmail') : null;
          if (pending) setEmail(pending);
        } catch {}
      })();
    }
  }, [email]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown(c => c - 1), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // Auto-verify if email + token present from link
  useEffect(() => {
    (async () => {
      if (email && token) {
        setVerifying(true);
        try {
          await verify(email, token);
          setStatus('Your email has been verified. You can now log in.');
          setVerified(true);
        } catch (e: any) {
          setStatus(e.message || 'Verification failed or link expired. You can request a new email.');
        } finally {
          setVerifying(false);
        }
      } else {
        setStatus('A verification link has been sent. Check your email.');
      }
    })();
  }, [email, token]);

  const onResend = async () => {
    if (!email || cooldown > 0) return;
    try {
      await resend(email);
      setStatus('Verification email resent. Check your inbox.');
      setCooldown(60); // match backend default cooldown seconds
    } catch (e: any) {
      setStatus(e.message || 'Could not resend email.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Email Verification</Text>
      {email && !token && (
        <Text style={styles.text}>We sent a verification link to {email}. Open it to finish verifying.</Text>
      )}
      {email && token && (
        <Text style={styles.text}>Verifying {email}...</Text>
      )}
      {!email && <Text style={styles.text}>Check your inbox for the verification link.</Text>}
      <Text style={styles.status}>{status}</Text>
      {verifying && <ActivityIndicator />}
      {!verified && (
        <Pressable style={[styles.button, cooldown > 0 && { opacity: 0.6 }]} disabled={cooldown > 0} onPress={onResend}>
          <Text style={styles.buttonText}>{cooldown > 0 ? `Resend (${cooldown}s)` : 'Resend email'}</Text>
        </Pressable>
      )}
      <Pressable style={[styles.button, { backgroundColor: '#111' }]} onPress={() => router.replace('/(auth)/login' as any)}>
        <Text style={styles.buttonText}>Go to log in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12, maxWidth: 480, alignSelf: 'center', width: '100%', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  text: { fontSize: 16, color: '#444', textAlign: 'center' },
  button: { backgroundColor: '#0b5cff', paddingVertical: 12, borderRadius: 6, alignItems: 'center', marginTop: 4 },
  buttonText: { color: 'white', fontWeight: '600' },
  status: { fontSize: 14, color: '#2563eb', textAlign: 'center' },
});
