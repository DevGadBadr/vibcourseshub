import { useAuth } from '@/providers/AuthProvider';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

async function resend(email: string) {
  const res = await fetch((process.env.EXPO_PUBLIC_API_URL || (global as any).API_URL || 'https://devgadbadr.com/vibapi') + '/email-verification/resend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams();
  const [email, setEmail] = useState<string | null>(typeof params.email === 'string' ? params.email : null);
  const [status, setStatus] = useState<string>('A verification link has been sent.');
  const [cooldown, setCooldown] = useState<number>(0);
  const { loading } = useAuth();

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
      <Text style={styles.title}>Verify your email</Text>
      <Text style={styles.text}>
        {email ? `We sent a verification link to ${email}. Click the link to activate your account.` : 'We sent you a verification link. Verify your email, then log in.'}
      </Text>
      <Text style={styles.status}>{status}</Text>
      <Pressable style={[styles.button, cooldown > 0 && { opacity: 0.6 }]} disabled={cooldown > 0} onPress={onResend}>
        <Text style={styles.buttonText}>{cooldown > 0 ? `Resend (${cooldown}s)` : 'Resend email'}</Text>
      </Pressable>
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
