import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { paymentsVerify } from '@/utils/api';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';

export default function PaymentSuccessScreen() {
  const { sessionId, paymentId } = useLocalSearchParams<{ sessionId?: string; paymentId?: string }>();
  const [status, setStatus] = useState<string>('verifying');
  const [enrollment, setEnrollment] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await paymentsVerify({ sessionId, paymentId: paymentId ? Number(paymentId) : undefined });
        if (!alive) return;
        setStatus(data.status);
        if (data.enrollment) setEnrollment(data.enrollment);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || 'Verification failed');
        setStatus('error');
      }
    })();
    return () => { alive = false; };
  }, [sessionId, paymentId]);

  return (
    <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
      {status === 'verifying' && <ActivityIndicator />}
      {status === 'paid' && (
        <>
          <ThemedText style={{ fontSize: 20, fontWeight: '700' }}>Payment Successful</ThemedText>
          {enrollment && <ThemedText>Enrollment granted for course #{enrollment.courseId} ({enrollment.enrollType})</ThemedText>}
          <Pressable onPress={() => enrollment?.courseId && router.replace(`/(tabs)/courses/${enrollment.courseId}`)}>
            <ThemedText style={{ fontWeight: '600', textDecorationLine: 'underline' }}>Go to Course</ThemedText>
          </Pressable>
        </>
      )}
      {status !== 'paid' && status !== 'verifying' && !error && (
        <ThemedText>Current status: {status}</ThemedText>
      )}
      {error && <ThemedText style={{ color: '#dc2626' }}>{error}</ThemedText>}
    </ThemedView>
  );
}