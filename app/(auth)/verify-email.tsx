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
  const RESEND_COOLDOWN = 60; // seconds; should match backend default unless overridden

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
    // Update UI immediately and fire request in background (non-blocking)
    setStatus('Verification email resent. Check your inbox.');
    setCooldown(RESEND_COOLDOWN);
    (async () => {
      try {
        await resend(email);
      } catch (e: any) {
        // Log but don't block UX; provide soft feedback
        console.warn('Resend failed:', e?.message || e);
      }
    })();
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
        <View style={styles.inlineRow}>
          <Text style={styles.inlineText}>Didn't get it? </Text>
          <Pressable disabled={cooldown > 0} onPress={onResend}>
            <Text
              style={[
                styles.link,
                cooldown > 0 && styles.linkDisabled,
              ]}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend'}
            </Text>
          </Pressable>
        </View>
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
  inlineRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 8 },
  inlineText: { fontSize: 14, color: '#555' },
  link: { fontSize: 14, color: '#0b5cff', textDecorationLine: 'underline' },
  linkDisabled: { color: '#8aa3ff', textDecorationLine: 'none' },
});
